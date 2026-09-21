import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { InboxService } from "@pact/inbox";
import { DeterministicFakeProvider, fakeProviderModel, ProviderRouter } from "@pact/model-provider";
import { RunError, RunService } from "@pact/runs";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const password = "A long test password 123!";
let admin: Pool;
let pool: Pool;
let schema: string;
let identity: IdentityService;
let inbox: InboxService;
let secretBox: AesGcmSecretBox;
let clockNow: Date;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "runs");
  pool = createSchemaPool(connectionString, schema);
  clockNow = new Date("2026-09-21T10:00:00.000Z");
  const clock = { now: () => clockNow };
  secretBox = new AesGcmSecretBox(Buffer.alloc(32, 7));
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set(["https://pact.example"]),
    clock,
    digester: new TokenDigester(Buffer.alloc(32, 17)),
    secretBox,
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  inbox = new InboxService(pool, { productScope: "pact", clock });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function verifiedAccount(email: string): Promise<string> {
  await identity.signup({ email, password, age18Declared: true, acceptedTermsVersion: "terms-v1" });
  const event = await pool.query<{ payload: { accountId: string; sealedToken: string } }>(
    `SELECT payload FROM outbox_events WHERE type = 'security.email.requested.v1' AND payload->>'template' = 'verify_email' ORDER BY id DESC LIMIT 1`,
  );
  const payload = event.rows[0]?.payload;
  if (!payload) throw new Error("missing verification");
  await identity.verifyEmail(Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8"));
  return payload.accountId;
}

function runs(provider = new DeterministicFakeProvider({ scenario: "success" })): RunService {
  return new RunService(pool, {
    productScope: "pact",
    clock: { now: () => clockNow },
    inbox,
    providerRouter: new ProviderRouter([provider]),
  });
}

describe("PACT-021 bounded runs and write leases", () => {
  it("stops at call limits, preserves allowance on resume, and rejects deadline extension", async () => {
    const accountId = await verifiedAccount(`run-${randomUUID()}@example.com`);
    const service = runs();
    const started = await service.start({
      accountId,
      objective: "sandbox objective",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 2, maxTokens: 40_000, durationMs: 15 * 60_000 },
    });
    expect(started.status).toBe("running");

    const afterFirst = await service.executeModelCall(started.runId);
    expect(afterFirst.usedCalls).toBe(1);
    expect(afterFirst.status).toBe("running");

    const waiting = await service.wait(accountId, started.runId);
    expect(waiting.status).toBe("waiting");
    expect(waiting.usedCalls).toBe(1);
    expect(waiting.deadlineAt.toISOString()).toBe(started.deadlineAt.toISOString());

    const resumed = await service.resume(accountId, started.runId);
    expect(resumed.status).toBe("running");
    expect(resumed.usedCalls).toBe(1);
    expect(resumed.deadlineAt.toISOString()).toBe(started.deadlineAt.toISOString());

    const finished = await service.executeModelCall(started.runId);
    expect(finished.usedCalls).toBe(2);
    expect(finished.status).toBe("finished");

    await expect(service.resume(accountId, started.runId)).rejects.toBeInstanceOf(RunError);

    clockNow = new Date("2026-09-21T10:20:00.000Z");
    const late = await service.start({
      accountId,
      objective: "second",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 3, durationMs: 60_000 },
    });
    await service.wait(accountId, late.runId);
    clockNow = new Date("2026-09-21T10:22:00.000Z");
    await expect(service.resume(accountId, late.runId)).rejects.toMatchObject({ code: "DEADLINE_PASSED" });
  });

  it("continues after client disconnect, ignores idle inbox for inference, and surfaces ambiguous crashes once", async () => {
    const accountId = await verifiedAccount(`run-idle-${randomUUID()}@example.com`);
    const service = runs();
    const started = await service.start({
      accountId,
      objective: "keep going",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 3 },
    });
    // Simulate browser close: no client session; server still executes.
    const continued = await service.executeModelCall(started.runId);
    expect(continued.usedCalls).toBe(1);
    expect(continued.status).toBe("running");

    const beforeInbox = continued.modelCalls;
    await inbox.publish(accountId, "approval.requested.v1", { n: 1 });
    service.assertIdleInboxDoesNotInvokeProvider();
    const afterInbox = await service.get(started.runId, accountId);
    expect(afterInbox.modelCalls).toBe(beforeInbox);

    await expect(
      service.start({
        accountId,
        objective: "conflict",
        provider: "fixture",
        model: fakeProviderModel.id,
      }),
    ).rejects.toMatchObject({ code: "RUN_ALREADY_ACTIVE" });

    const mcp = await service.openMcpLease({
      accountId: await verifiedAccount(`mcp-lease-${randomUUID()}@example.com`),
      holderId: "mcp-session-1",
    });
    expect(mcp.leaseId).toBeTruthy();

    const crashingAdapter = {
      provider: "fixture",
      listModels: async () => [fakeProviderModel],
      invoke: async () => {
        throw new Error("socket reset mid-response");
      },
    };
    const crashService = new RunService(pool, {
      productScope: "pact",
      clock: { now: () => clockNow },
      providerRouter: new ProviderRouter([crashingAdapter]),
    });
    const crashAccount = await verifiedAccount(`crash-${randomUUID()}@example.com`);
    const crashRun = await crashService.start({
      accountId: crashAccount,
      objective: "boom",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 5 },
    });
    const failed = await crashService.executeModelCall(crashRun.runId);
    expect(failed.status).toBe("failed");
    expect(failed.ambiguousCrash).toBe(true);
    expect(failed.usedCalls).toBe(0);
    // No automatic retry/billing loop: a second call is refused while failed.
    await expect(crashService.executeModelCall(crashRun.runId)).resolves.toMatchObject({ status: "failed" });
  });
});
