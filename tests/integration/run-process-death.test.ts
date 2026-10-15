import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { runToolCommandId } from "@pact/application";
import { acquireJob, completeJob, createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import { fakeProviderModel, ProviderRouter } from "@pact/model-provider";
import { RunService } from "@pact/runs";
import { WorldClockService } from "@pact/world";
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

async function waitForExpiredJobLease(runId: string, workerId: string): Promise<void> {
  // The database owns lease time. A host timer is not proof that its clock has
  // crossed the persisted deadline, especially during a parallel suite.
  await expect
    .poll(
      async () => {
        const result = await pool.query<{ eligible: boolean }>(
          `SELECT available_at <= clock_timestamp() AND lease_expires_at <= clock_timestamp() AS eligible
       FROM durable_jobs WHERE status='ready' AND payload->>'runId'=$1 AND leased_by=$2`,
          [runId, workerId],
        );
        return result.rows[0]?.eligible;
      },
      { timeout: 5000, interval: 20 },
    )
    .toBe(true);
}

describe("PACT-051 inference process death", () => {
  it("retains a committed game command when its inference process dies before step reconciliation", async () => {
    const ownerAccountId = randomUUID();
    const peerAccountId = randomUUID();
    const ownerKingdomId = randomUUID();
    const peerKingdomId = randomUUID();
    for (const [accountId, kingdomId] of [
      [ownerAccountId, ownerKingdomId],
      [peerAccountId, peerKingdomId],
    ]) {
      await pool.query(
        `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
         VALUES ($1, 'pact', $2, 'fixture-only', clock_timestamp(), 'terms-v1')`,
        [accountId, `${accountId}@example.test`],
      );
      await pool.query(
        `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
           activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
         VALUES ($1, 'pact', $2, $3, 'Death Fixture', 'portrait.wolf', clock_timestamp(), 0, 0, 60000, $4)`,
        [kingdomId, accountId, `death_${randomUUID().slice(0, 8)}`, randomUUID()],
      );
    }
    const [kingdomA, kingdomB] = [ownerKingdomId, peerKingdomId].sort();
    await pool.query(
      `INSERT INTO social_contacts(product_scope, kingdom_a, kingdom_b, accepted_game_time_ms)
       VALUES ('pact', $1, $2, 0)`,
      [kingdomA, kingdomB],
    );
    await new WorldClockService(pool, "pact").bootstrap();
    await pool.query(
      "UPDATE world_clocks SET next_tick_due_at = clock_timestamp() + interval '10 minutes' WHERE product_scope = 'pact'",
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
      accountId: ownerAccountId,
      objective: "Send one synthetic message",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 2 },
    });
    const childScript = `
      import { randomUUID } from 'node:crypto';
      import { pactRunCommandTool, dispatchRunCommandTools } from '@pact/application';
      import { acquireJob, createSchemaPool } from '@pact/db';
      import { fakeProviderModel, ProviderRouter } from '@pact/model-provider';
      import { RunService } from '@pact/runs';
      import { createInferenceGameRuntime } from './workers/inference/dist/game-runtime.js';
      const db = createSchemaPool(process.env.PACT_TEST_DATABASE_URL, process.env.PACT_TEST_SCHEMA);
      const job = await acquireJob(db, 'killed-after-tool', 100);
      if (!job || job.type !== 'envoy.run.tick') throw new Error('expected run job');
      const router = new ProviderRouter([{
        provider: 'fixture', listModels: async () => [fakeProviderModel],
        invoke: async () => ({
          stopReason: 'tool_calls', usage: { inputTokens: 20, outputTokens: 10 },
          toolCalls: [{ id: 'committed-message', name: pactRunCommandTool.name, arguments: {
            schemaVersion: 'pact.command.v1', commandId: randomUUID(),
            actor: { principalId: process.env.PACT_TEST_PEER_ACCOUNT, productScope: 'pact',
              audience: 'human', subject: { type: 'account', id: process.env.PACT_TEST_PEER_ACCOUNT } },
            action: { kind: 'game.message.send', recipientKingdomId: process.env.PACT_TEST_PEER_KINGDOM,
              body: 'survives killed inference process' },
            submittedAt: new Date().toISOString()
          }}]
        })
      }]);
      const runtime = await createInferenceGameRuntime({
        pool: db, productScope: 'pact', clock: { now: () => new Date() },
        providerRouter: router, termsVersion: 'terms-v1'
      });
      const service = new RunService(db, {
        productScope: 'pact', clock: { now: () => new Date() }, providerRouter: router,
        tools: [pactRunCommandTool],
        executeToolCalls: async (input) => {
          const [receipt] = await dispatchRunCommandTools(runtime.dispatcher, 'pact', input);
          if (receipt?.code !== 'COMMITTED') throw new Error('game command did not commit');
          process.stdout.write('TOOL_COMMITTED\\n');
          await new Promise(() => {});
        }
      });
      await service.executeModelCall(job.payload.runId);
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", childScript], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PACT_TEST_DATABASE_URL: databaseUrl,
        PACT_TEST_SCHEMA: schema,
        PACT_TEST_PEER_ACCOUNT: peerAccountId,
        PACT_TEST_PEER_KINGDOM: peerKingdomId,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let readinessTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const ready = await Promise.race([
        once(child.stdout, "data").then(([data]) => String(data)),
        once(child, "exit").then(([code]) => {
          throw new Error(`Inference process exited before tool commit: ${code}`);
        }),
        new Promise<never>((_, reject) => {
          readinessTimeout = setTimeout(() => reject(new Error("Tool commit readiness timeout")), 10_000);
        }),
      ]);
      expect(ready).toContain("TOOL_COMMITTED");
    } finally {
      if (readinessTimeout) clearTimeout(readinessTimeout);
      if (child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGKILL");
        await exited;
      }
    }
    const inFlight = await pool.query<{ in_flight_request_id: string; used_messages: number }>(
      "SELECT in_flight_request_id, used_messages FROM envoy_runs WHERE run_id = $1",
      [run.runId],
    );
    const requestId = inFlight.rows[0]?.in_flight_request_id;
    expect(requestId).toBeTruthy();
    if (!requestId) throw new Error("Missing in-flight provider request");
    expect(inFlight.rows[0]?.used_messages).toBe(1);
    const commandId = runToolCommandId(run.runId, requestId, "committed-message");
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM command_receipts WHERE command_id = $1", [commandId])).rows,
    ).toEqual([{ count: 1 }]);
    expect(
      (
        await pool.query<{ sender_kingdom_id: string; recipient_kingdom_id: string }>(
          "SELECT sender_kingdom_id, recipient_kingdom_id FROM direct_messages WHERE operation_key = $1",
          [commandId],
        )
      ).rows,
    ).toEqual([{ sender_kingdom_id: ownerKingdomId, recipient_kingdom_id: peerKingdomId }]);
    expect((await pool.query("SELECT 1 FROM envoy_run_tool_results WHERE run_id = $1", [run.runId])).rowCount).toBe(0);
    await waitForExpiredJobLease(run.runId, "killed-after-tool");
    const reclaimed = await acquireJob(pool, "replacement-after-tool", 1_000);
    expect(reclaimed).toMatchObject({ type: "envoy.run.tick", attempts: 2 });
    if (!reclaimed) throw new Error("Missing reclaimed job");
    expect((reclaimed.payload as { runId?: string }).runId).toBe(run.runId);
    expect((await service.failInterruptedModelCall(run.runId)).status).toBe("running");
    await pool.query("UPDATE envoy_runs SET request_deadline_at=$2 WHERE run_id=$1", [run.runId, new Date(0)]);
    const recoveredAfterDeadline = await service.failInterruptedModelCall(run.runId);
    expect(recoveredAfterDeadline).toMatchObject({
      status: "failed",
      ambiguousCrash: true,
      usedMessages: 1,
      usedCalls: 0,
    });
    expect(await service.executeModelCall(run.runId)).toMatchObject({ status: "failed", usedMessages: 1 });
    expect(recoveryInvocations).toBe(0);
    expect(await completeJob(pool, reclaimed.id, "replacement-after-tool")).toBe(true);
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM command_receipts WHERE command_id = $1", [commandId])).rows,
    ).toEqual([{ count: 1 }]);
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM direct_messages WHERE operation_key = $1", [commandId]))
        .rows,
    ).toEqual([{ count: 1 }]);
    expect((await pool.query("SELECT 1 FROM envoy_run_tool_results WHERE run_id = $1", [run.runId])).rowCount).toBe(0);
  });

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

    // Observe actual expiry without rewriting job state or fabricating recovery.
    await waitForExpiredJobLease(run.runId, "killed-inference");
    const reclaimed = await acquireJob(pool, "replacement-inference", 1_000);
    expect(reclaimed).toMatchObject({ type: "envoy.run.tick", attempts: 2 });
    if (!reclaimed) throw new Error("Missing reclaimed job");
    expect((reclaimed.payload as { runId?: string }).runId).toBe(run.runId);
    expect((await service.failInterruptedModelCall(run.runId)).status).toBe("running");
    await pool.query("UPDATE envoy_runs SET request_deadline_at=$2 WHERE run_id=$1", [run.runId, new Date(0)]);
    const recoveredAfterDeadline = await service.failInterruptedModelCall(run.runId);
    expect(recoveredAfterDeadline).toMatchObject({
      status: "failed",
      ambiguousCrash: true,
      lastErrorCode: "AMBIGUOUS_PROVIDER_CRASH",
      reservedTokens: 0,
    });
    expect(await service.executeModelCall(run.runId)).toMatchObject({ status: "failed" });
    expect(recoveryInvocations).toBe(0);
    expect(await completeJob(pool, reclaimed.id, "replacement-inference")).toBe(true);
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
