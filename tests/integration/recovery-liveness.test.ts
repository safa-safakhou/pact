import { randomUUID } from "node:crypto";
import {
  acquireJob,
  completeJob,
  createPool,
  createSchemaPool,
  createTestSchema,
  dropTestSchema,
  renewJob,
} from "@pact/db";
import { fakeProviderModel, ProviderError, ProviderRouter } from "@pact/model-provider";
import { RunService } from "@pact/runs";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool, pool: Pool, schema: string;
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "liveness");
  pool = createSchemaPool(url, schema);
});
beforeEach(async () => {
  await pool.query("DELETE FROM durable_jobs");
});
afterAll(async () => {
  await pool?.end();
  if (schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
async function owner() {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture',now(),'v1')",
    [id, `${id}@example.test`],
  );
  return id;
}
it("renews a 30-second job through a 31-second fake provider call without redelivery or premature run failure", async () => {
  let calls = 0;
  const runs = new RunService(pool, {
    productScope: "pact",
    clock: { now: () => new Date() },
    providerRouter: new ProviderRouter([
      {
        provider: "fixture",
        listModels: async () => [fakeProviderModel],
        invoke: async () => {
          calls++;
          await new Promise((r) => setTimeout(r, 31000));
          return { stopReason: "completed", toolCalls: [], usage: { inputTokens: 10, outputTokens: 5 } };
        },
      },
    ]),
  });
  const run = await runs.start({
    accountId: await owner(),
    objective: "Slow fake",
    provider: "fixture",
    model: fakeProviderModel.id,
    limits: { maxCalls: 1 },
  });
  const job = await acquireJob(pool, "owner:first", 30000);
  if (!job) throw Error("job");
  let lost = false;
  const timer = setInterval(() => {
    void renewJob(pool, job.id, "owner:first", 30000).then((ok) => {
      if (!ok) lost = true;
    });
  }, 1000);
  try {
    const pending = runs.executeModelCall(run.runId, {
      assertCurrent: async () => {
        if (!(await renewJob(pool, job.id, "owner:first", 30000))) throw Error("lost");
      },
    });
    await new Promise((r) => setTimeout(r, 30500));
    expect(await acquireJob(pool, "owner:second", 30000)).toBeUndefined();
    expect((await runs.failInterruptedModelCall(run.runId)).status).toBe("running");
    expect((await pending).status).toBe("finished");
    expect(calls).toBe(1);
    expect(lost).toBe(false);
    expect(await completeJob(pool, job.id, "owner:first")).toBe(true);
  } finally {
    clearInterval(timer);
  }
}, 40000);
it("retains a bounded retry after known pre-dispatch provider failure", async () => {
  const runs = new RunService(pool, {
    productScope: "pact",
    clock: { now: () => new Date() },
    providerRouter: new ProviderRouter([
      {
        provider: "fixture",
        listModels: async () => {
          throw new ProviderError("PROVIDER_UNAVAILABLE", true);
        },
        invoke: async () => {
          throw Error("must not invoke");
        },
      },
    ]),
  });
  const run = await runs.start({
    accountId: await owner(),
    objective: "Fixture",
    provider: "fixture",
    model: fakeProviderModel.id,
    limits: { maxCalls: 2 },
  });
  expect((await runs.executeModelCall(run.runId)).status).toBe("running");
  expect(
    (await pool.query("SELECT status FROM envoy_model_attempts WHERE run_id=$1", [run.runId])).rows[0].status,
  ).toBe("not_dispatched");
  const jobs = (
    await pool.query(
      "SELECT available_at>clock_timestamp() AS deferred FROM durable_jobs WHERE payload->>'runId'=$1 ORDER BY available_at DESC",
      [run.runId],
    )
  ).rows;
  expect(jobs[0].deferred).toBe(true);
});
it("owner stop fences a late provider result before any tool execution", async () => {
  let entered: () => void = () => {},
    release: () => void = () => {},
    tools = 0;
  const started = new Promise<void>((r) => {
      entered = r;
    }),
    blocked = new Promise<void>((r) => {
      release = r;
    });
  const runs = new RunService(pool, {
    productScope: "pact",
    clock: { now: () => new Date() },
    providerRouter: new ProviderRouter([
      {
        provider: "fixture",
        listModels: async () => [fakeProviderModel],
        invoke: async () => {
          entered();
          await blocked;
          return {
            stopReason: "tool_calls",
            toolCalls: [{ id: "one", name: "fixture", arguments: {} }],
            usage: { inputTokens: 10, outputTokens: 5 },
          };
        },
      },
    ]),
    executeToolCalls: async () => {
      tools++;
      return [];
    },
  });
  const accountId = await owner(),
    run = await runs.start({ accountId, objective: "Fixture", provider: "fixture", model: fakeProviderModel.id });
  const pending = runs.executeModelCall(run.runId);
  await started;
  await runs.stop(accountId, run.runId);
  release();
  expect((await pending).status).toBe("stopped");
  expect(tools).toBe(0);
  const evidence = (await pool.query("SELECT actual_tokens FROM envoy_model_attempts WHERE run_id=$1", [run.runId]))
    .rows[0];
  expect(evidence.actual_tokens).toBe(15);
});

it("bounds an uncooperative provider and records its late usage without executing late tools", async () => {
  let tools = 0;
  const runs = new RunService(pool, {
    productScope: "pact",
    clock: { now: () => new Date() },
    providerRouter: new ProviderRouter([
      {
        provider: "fixture",
        listModels: async () => [fakeProviderModel],
        invoke: async () => {
          await new Promise((r) => setTimeout(r, 250));
          return { stopReason: "completed", toolCalls: [], usage: { inputTokens: 10, outputTokens: 5 } };
        },
      },
    ]),
    executeToolCalls: async () => {
      tools++;
      return [];
    },
  });
  const run = await runs.start({
    accountId: await owner(),
    objective: "Fixture",
    provider: "fixture",
    model: fakeProviderModel.id,
    limits: { durationMs: 100 },
  });
  expect((await runs.executeModelCall(run.runId)).status).toBe("failed");
  await expect
    .poll(
      async () =>
        (await pool.query("SELECT actual_tokens FROM envoy_model_attempts WHERE run_id=$1", [run.runId])).rows[0]
          ?.actual_tokens,
      { timeout: 2000, interval: 20 },
    )
    .toBe(15);
  expect(
    (await pool.query("SELECT status FROM envoy_model_attempts WHERE run_id=$1", [run.runId])).rows[0].status,
  ).toBe("unknown");
  expect(tools).toBe(0);
});
it("recovers a pre-dispatch orphan and fences its old worker without another provider invocation", async () => {
  let entered: () => void = () => {},
    release: () => void = () => {},
    calls = 0;
  const blocked = new Promise<void>((r) => {
      release = r;
    }),
    ready = new Promise<void>((r) => {
      entered = r;
    });
  const runs = new RunService(pool, {
    productScope: "pact",
    clock: { now: () => new Date() },
    providerRouter: new ProviderRouter([
      {
        provider: "fixture",
        listModels: async () => {
          entered();
          await blocked;
          return [fakeProviderModel];
        },
        invoke: async () => {
          calls++;
          return { stopReason: "completed", toolCalls: [], usage: { inputTokens: 10, outputTokens: 5 } };
        },
      },
    ]),
  });
  const run = await runs.start({
      accountId: await owner(),
      objective: "Fixture",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 2 },
    }),
    old = runs.executeModelCall(run.runId);
  await ready;
  await pool.query("UPDATE envoy_runs SET request_deadline_at=clock_timestamp()-interval '1 second' WHERE run_id=$1", [
    run.runId,
  ]);
  const recovered = await runs.failInterruptedModelCall(run.runId);
  expect(recovered.status).toBe("running");
  expect(recovered.usedCalls).toBe(1);
  expect(recovered.lastErrorCode).toBe("RECOVERED_NO_GAME_EFFECTS");
  release();
  await old;
  expect(calls).toBe(0);
  expect(
    (await pool.query("SELECT status FROM envoy_model_attempts WHERE run_id=$1", [run.runId])).rows[0].status,
  ).toBe("not_dispatched");
});

it("retains unavailable final usage as an exposure gate rather than an invented measured bill", async () => {
  const runs = new RunService(pool, {
    productScope: "pact",
    clock: { now: () => new Date() },
    providerRouter: new ProviderRouter([
      {
        provider: "fixture",
        listModels: async () => [fakeProviderModel],
        invoke: async () => ({ stopReason: "completed", toolCalls: [] }),
      },
    ]),
  });
  const run = await runs.start({
    accountId: await owner(),
    objective: "Fixture",
    provider: "fixture",
    model: fakeProviderModel.id,
    limits: { maxCalls: 2 },
  });
  expect((await runs.executeModelCall(run.runId)).status).toBe("failed");
  const evidence = (
    await pool.query("SELECT status,allocation_tokens,actual_tokens FROM envoy_model_attempts WHERE run_id=$1", [
      run.runId,
    ])
  ).rows[0];
  expect(evidence.status).toBe("unknown");
  expect(evidence.allocation_tokens).toBeGreaterThan(0);
  expect(evidence.actual_tokens).toBeNull();
});
