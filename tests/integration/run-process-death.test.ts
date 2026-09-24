import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { acquireJob, completeJob, createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import { fakeProviderModel, ProviderRouter } from "@pact/model-provider";
import { RunService } from "@pact/runs";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;

beforeAll(async () => {
  admin = createPool(databaseUrl);
  schema = await createTestSchema(admin, "run_death");
  pool = createSchemaPool(databaseUrl, schema);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

describe("PACT-051 inference process death", () => {
  it("reclaims a killed in-flight model job without invoking the provider twice", async () => {
    const accountId = randomUUID();
    await pool.query(
      `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
       VALUES ($1, 'pact', $2, 'fixture-only', clock_timestamp(), 'terms-v1')`,
      [accountId, `${accountId}@example.test`],
    );
    let recoveryInvocations = 0;
    const service = new RunService(pool, {
      productScope: "pact",
      clock: { now: () => new Date() },
      providerRouter: new ProviderRouter([
        {
          provider: "fixture",
          listModels: async () => [fakeProviderModel],
          invoke: async () => {
            recoveryInvocations += 1;
            return { stopReason: "completed" as const, toolCalls: [], usage: { inputTokens: 10, outputTokens: 5 } };
          },
        },
      ]),
    });
    const run = await service.start({
      accountId,
      objective: "Synthetic killed inference process",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 2 },
    });
    const childScript = `
      import { acquireJob, createSchemaPool } from '@pact/db';
      import { fakeProviderModel, ProviderRouter } from '@pact/model-provider';
      import { RunService } from '@pact/runs';
      const db = createSchemaPool(process.env.PACT_TEST_DATABASE_URL, process.env.PACT_TEST_SCHEMA);
      const job = await acquireJob(db, 'killed-inference', 100);
      if (!job || job.type !== 'envoy.run.tick') throw new Error('expected run job');
      const service = new RunService(db, {
        productScope: 'pact', clock: { now: () => new Date() },
        providerRouter: new ProviderRouter([{
          provider: 'fixture', listModels: async () => [fakeProviderModel],
          invoke: async () => {
            process.stdout.write('PROVIDER_ENTERED\\n');
            await new Promise(() => {});
          }
        }])
      });
      await service.executeModelCall(job.payload.runId);
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", childScript], {
      cwd: process.cwd(),
      env: { ...process.env, PACT_TEST_DATABASE_URL: databaseUrl, PACT_TEST_SCHEMA: schema },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let readinessTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const ready = await Promise.race([
        once(child.stdout, "data").then(([data]) => String(data)),
        once(child, "exit").then(([code]) => {
          throw new Error(`Inference process exited before provider entry: ${code}`);
        }),
        new Promise<never>((_, reject) => {
          readinessTimeout = setTimeout(() => reject(new Error("Inference process readiness timeout")), 10_000);
        }),
      ]);
      expect(ready).toContain("PROVIDER_ENTERED");
      const before = await pool.query<{ in_flight_request_id: string; reserved_tokens: number }>(
        "SELECT in_flight_request_id, reserved_tokens FROM envoy_runs WHERE run_id = $1",
        [run.runId],
      );
      expect(before.rows[0]?.in_flight_request_id).toBeTruthy();
      expect(before.rows[0]?.reserved_tokens).toBeGreaterThan(0);
    } finally {
      if (readinessTimeout) clearTimeout(readinessTimeout);
      if (child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGKILL");
        await exited;
      }
    }

    // Let the short lease expire; this models worker death without rewriting job state.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const reclaimed = await acquireJob(pool, "replacement-inference", 1_000);
    expect(reclaimed).toMatchObject({ type: "envoy.run.tick", attempts: 2 });
    if (!reclaimed) throw new Error("Missing reclaimed job");
    expect((reclaimed.payload as { runId?: string }).runId).toBe(run.runId);
    const recovered = await service.failInterruptedModelCall(run.runId);
    expect(recovered).toMatchObject({
      status: "failed",
      ambiguousCrash: true,
      lastErrorCode: "AMBIGUOUS_PROVIDER_CRASH",
      reservedTokens: 0,
    });
    expect(await service.executeModelCall(run.runId)).toMatchObject({ status: "failed" });
    expect(recoveryInvocations).toBe(0);
    await completeJob(pool, reclaimed.id, "replacement-inference");
    const jobState = await pool.query<{ status: string }>("SELECT status FROM durable_jobs WHERE id = $1", [
      reclaimed.id,
    ]);
    expect(jobState.rows[0]?.status).toBe("done");
    const results = await pool.query("SELECT 1 FROM envoy_run_tool_results WHERE run_id = $1", [run.runId]);
    expect(results.rowCount).toBe(0);
    const lease = await pool.query<{ released_at: Date | null }>(
      "SELECT released_at FROM write_leases WHERE product_scope = 'pact' AND subject_id = $1",
      [accountId],
    );
    expect(lease.rows[0]?.released_at).toBeInstanceOf(Date);
  });
});
