import { randomUUID } from "node:crypto";
import type { CommandDispatcher } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { InboxService } from "@pact/inbox";
import { McpTransport } from "@pact/mcp";
import { DeterministicFakeProvider, fakeProviderModel, ProviderRouter } from "@pact/model-provider";
import { RunError, RunService } from "@pact/runs";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerRunRoutes } from "../../services/api/src/run-routes.js";

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
  it("renews only the same MCP holder, preserves competing holders and reacquires after expiry", async () => {
    const accountId = await verifiedAccount(`renew-${randomUUID()}@example.test`);
    const service = runs();
    const before = clockNow;
    const first = await service.openMcpLease({ accountId, holderId: "connection-one" });
    clockNow = new Date(before.getTime() + 60_000);
    try {
      const renewed = await service.openMcpLease({ accountId, holderId: "connection-one" });
      expect(renewed.leaseId).toBe(first.leaseId);
      expect(renewed.expiresAt.getTime()).toBe(clockNow.getTime() + 15 * 60_000);
      await expect(service.openMcpLease({ accountId, holderId: "connection-two" })).rejects.toMatchObject({
        code: "RUN_ALREADY_ACTIVE",
      });
      await service.releaseMcpLease({ accountId, holderId: "connection-two" });
      const held = await pool.query("SELECT expires_at,released_at FROM write_leases WHERE subject_id=$1", [accountId]);
      expect(held.rows[0]).toMatchObject({ expires_at: renewed.expiresAt, released_at: null });
      await pool.query("UPDATE write_leases SET holder_kind='script' WHERE subject_id=$1", [accountId]);
      await expect(service.openMcpLease({ accountId, holderId: "connection-one" })).rejects.toMatchObject({
        code: "RUN_ALREADY_ACTIVE",
      });
      clockNow = new Date(renewed.expiresAt.getTime());
      const next = await service.openMcpLease({ accountId, holderId: "connection-two" });
      expect(next.leaseId).not.toBe(first.leaseId);
      expect((await pool.query("SELECT 1 FROM envoy_runs WHERE account_id=$1", [accountId])).rowCount).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT 1 FROM durable_jobs WHERE type='envoy.run.tick' AND payload->>'runId' IN (SELECT run_id::text FROM envoy_runs WHERE account_id=$1)",
            [accountId],
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      clockNow = before;
    }
  });
  it("reports an expired or missing lease without claiming an active model host", async () => {
    const accountId = await verifiedAccount(`execution-${randomUUID()}@example.test`),
      service = runs();
    const started = await service.start({
      accountId,
      objective: "Diagnostics",
      provider: "fixture",
      model: fakeProviderModel.id,
    });
    expect((await service.get(started.runId, accountId)).execution).toMatchObject({
      state: "queued",
      hostStatus: "unverified",
    });
    await pool.query("UPDATE write_leases SET released_at=$2 WHERE run_id=$1", [started.runId, clockNow]);
    expect((await service.list(accountId)).runs[0]?.execution?.state).toBe("lease_missing");
    await pool.query("UPDATE envoy_runs SET deadline_at=$2 WHERE run_id=$1", [started.runId, clockNow]);
    expect((await service.get(started.runId, accountId)).execution?.state).toBe("expired");
  });
  it("lists and reads truthful owner-only offline negotiation reports without any provider call", async () => {
    const email = `report-${randomUUID()}@example.test`;
    const accountId = await verifiedAccount(email),
      other = await verifiedAccount(`other-report-${randomUUID()}@example.test`),
      service = runs();
    const started = await service.start({
      accountId,
      objective: "A seeded negotiation",
      provider: "fixture",
      model: fakeProviderModel.id,
    });
    const id = randomUUID();
    for (const [callId, data] of Object.entries({
      offer: {
        code: "COMMITTED",
        commandId: id,
        disposition: "proposed",
        recordVersions: { [`supply-offer:${id}`]: 2 },
      },
      build: { code: "COMMITTED", commandId: id, recordVersions: { [`building:${id}`]: 1 } },
      denied: { code: "STALE_VERSION", commandId: id },
      approval: { code: "APPROVAL_REQUIRED", approvalId: id },
      assessment: { agentAssessment: "Counterparty may accept; not a factual agreement" },
    }))
      await pool.query(
        "INSERT INTO envoy_run_tool_results(product_scope,run_id,request_id,call_id,summary) VALUES($1,$2,$3,$4,$5)",
        ["pact", started.runId, "fixture", callId, JSON.stringify(data)],
      );
    const report = await service.report(started.runId, accountId);
    expect(report.entries.map((e) => e.category)).toEqual(["proposed", "committed", "failed", "approval_needed"]);
    expect((await service.get(started.runId, accountId)).modelCalls).toBe(0);
    expect((await service.list(other)).runs).toEqual([]);
    await expect(service.report(started.runId, other)).rejects.toThrow("FORBIDDEN");
    await service.wait(accountId, started.runId);
    expect((await service.report(started.runId, accountId)).nextStep).toContain("no automatic inference");
    const login = await identity.login({ email, password, ip: "127.0.0.1" });
    const server = Fastify();
    registerRunRoutes(server, identity, service);
    const response = await server.inject({
      url: `/v1/runs/${started.runId}/report`,
      headers: { cookie: `pact_session=${login.sessionToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().entries.map((e: { category: string }) => e.category)).toEqual([
      "proposed",
      "committed",
      "failed",
      "approval_needed",
    ]);
    expect((await server.inject({ url: `/v1/runs/${started.runId}/report` })).statusCode).toBe(403);
    await server.close();
    const principal = {
      accountId,
      productScope: ProductScopeSchema.parse("pact"),
      audience: "agent" as const,
      grantId: randomUUID(),
      agentScopes: ["world:read"] as "world:read"[],
    };
    const transport = new McpTransport({
      pool,
      productScope: "pact",
      dispatcher: {} as CommandDispatcher,
      origin: "https://pact.example",
      clock: { now: () => clockNow },
      runReports: { read: (id, owner) => (id ? service.report(id, owner) : service.list(owner)) },
    });
    const init = await transport.handlePost(principal, {
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", clientInfo: { name: "fixture", version: "1" }, capabilities: {} },
    });
    const result = await transport.handlePost(
      principal,
      { id: 2, method: "tools/call", params: { name: "pact_envoy_report_v1", arguments: { runId: started.runId } } },
      init.sessionId,
    );
    expect(JSON.stringify(result)).toContain("approval_needed");
    await expect(
      transport.handlePost(
        { ...principal, agentScopes: [] },
        { id: 3, method: "tools/call", params: { name: "pact_envoy_report_v1", arguments: {} } },
        init.sessionId,
      ),
    ).rejects.toThrow("FORBIDDEN");
    expect((await service.get(started.runId, accountId)).modelCalls).toBe(0);
    await service.stop(accountId, started.runId);
  });
  it("rejects run-limit escalation before acquiring a lease or queuing inference", async () => {
    const accountId = await verifiedAccount(`run-ceiling-${randomUUID()}@example.com`);
    const service = runs();
    const base = {
      accountId,
      objective: "Bounded synthetic run",
      provider: "fixture",
      model: fakeProviderModel.id,
    };
    const jobsBefore = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM durable_jobs WHERE type = 'envoy.run.tick'",
    );
    for (const limits of [
      { maxCalls: 21 },
      { maxTokens: 40_001 },
      { durationMs: 15 * 60_000 + 1 },
      { maxMessages: 25 },
      { maxConversations: 13 },
      { maxCalls: 0 },
      { maxTokens: 1.5 },
      { durationMs: Number.POSITIVE_INFINITY },
    ]) {
      await expect(service.start({ ...base, limits })).rejects.toMatchObject({ code: "INVALID_STATE" });
    }
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM envoy_runs WHERE account_id = $1", [accountId])).rows,
    ).toEqual([{ count: 0 }]);
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM write_leases WHERE subject_id = $1", [accountId])).rows,
    ).toEqual([{ count: 0 }]);
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM durable_jobs WHERE type = 'envoy.run.tick'")).rows,
    ).toEqual(jobsBefore.rows);
    const allowed = await service.start({
      ...base,
      limits: {
        maxCalls: 20,
        maxTokens: 40_000,
        durationMs: 15 * 60_000,
        maxMessages: 24,
        maxConversations: 12,
      },
    });
    expect(allowed).toMatchObject({ maxCalls: 20, maxTokens: 40_000, maxMessages: 24, maxConversations: 12 });
    expect(allowed.deadlineAt).toEqual(new Date(clockNow.getTime() + 15 * 60_000));
  });

  it("fails an unresolved redelivered model step without a second provider call", async () => {
    const accountId = await verifiedAccount(`run-redelivery-${randomUUID()}@example.com`);
    let entered!: () => void;
    let release!: () => void;
    const providerEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const providerBlocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let invoked = 0;
    const service = new RunService(pool, {
      productScope: "pact",
      clock: { now: () => clockNow },
      providerRouter: new ProviderRouter([
        {
          provider: "fixture",
          listModels: async () => [fakeProviderModel],
          invoke: async () => {
            invoked += 1;
            entered();
            await providerBlocked;
            return { stopReason: "completed" as const, toolCalls: [], usage: { inputTokens: 10, outputTokens: 5 } };
          },
        },
      ]),
    });
    const started = await service.start({
      accountId,
      objective: "Synthetic interrupted call",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 2 },
    });
    const original = service.executeModelCall(started.runId);
    await providerEntered;
    expect((await service.failInterruptedModelCall(started.runId)).status).toBe("running");
    await pool.query("UPDATE envoy_runs SET request_deadline_at=$2 WHERE run_id=$1", [started.runId, new Date(0)]);
    const recoveredAfterDeadline = await service.failInterruptedModelCall(started.runId);
    expect(recoveredAfterDeadline).toMatchObject({
      status: "failed",
      ambiguousCrash: true,
      lastErrorCode: "AMBIGUOUS_PROVIDER_CRASH",
      reservedTokens: 0,
    });
    release();
    await expect(original).resolves.toMatchObject({ status: "failed", modelCalls: 0 });
    await expect(service.executeModelCall(started.runId)).resolves.toMatchObject({ status: "failed" });
    expect(invoked).toBe(1);
    const lease = await pool.query<{ released_at: Date | null }>(
      "SELECT released_at FROM write_leases WHERE holder_id = $1",
      [started.runId],
    );
    expect(lease.rows[0]?.released_at).not.toBeNull();
  });

  it("persists bounded tool receipt summaries and supplies them to the next provider step", async () => {
    const accountId = await verifiedAccount(`run-tool-results-${randomUUID()}@example.com`);
    const seen: string[][] = [];
    const summary = JSON.stringify({ commandId: randomUUID(), code: "COMMITTED", charged: [] });
    const service = new RunService(pool, {
      productScope: "pact",
      clock: { now: () => clockNow },
      providerRouter: new ProviderRouter([
        {
          provider: "fixture",
          listModels: async () => [fakeProviderModel],
          invoke: async (request) => {
            seen.push(request.messages.map((message) => message.content));
            return seen.length === 1
              ? {
                  stopReason: "tool_calls" as const,
                  text: "I think the other party might accept; this is only an assessment.",
                  toolCalls: [{ id: "fixture-call", name: "fixture.command", arguments: {} }],
                  usage: { inputTokens: 12, outputTokens: 7 },
                }
              : {
                  stopReason: "completed" as const,
                  toolCalls: [],
                  usage: { inputTokens: 18, outputTokens: 7 },
                };
          },
        },
      ]),
      tools: [
        { name: "fixture.command", description: "Synthetic command", inputSchema: {}, parseArguments: () => ({}) },
      ],
      executeToolCalls: async () => [{ callId: "fixture-call", content: summary }],
    });
    const started = await service.start({
      accountId,
      objective: "Use the result of one synthetic command",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 2 },
    });
    expect((await service.executeModelCall(started.runId)).status).toBe("running");
    const persisted = await pool.query<{ call_id: string; summary: string }>(
      "SELECT call_id, summary FROM envoy_run_tool_results WHERE run_id = $1",
      [started.runId],
    );
    expect(persisted.rows.filter((r) => r.call_id === "fixture-call")).toEqual([{ call_id: "fixture-call", summary }]);
    expect(
      persisted.rows.some((r) => r.call_id.startsWith("assessment:") && r.summary.includes("agentAssessment")),
    ).toBe(true);
    expect((await service.executeModelCall(started.runId)).status).toBe("finished");
    const report = await service.report(started.runId, accountId);
    expect(report.assessments[0]?.label).toBe("Agent assessment — not an engine fact");
    expect(
      seen[1]?.some((content) => content.includes("Prior agent assessment (not an engine fact or authority)")),
    ).toBe(true);
    expect(seen[0]).not.toContain(`Server-recorded result for tool call fixture-call: ${summary}`);
    expect(seen[1]).toContain(`Server-recorded result for tool call fixture-call: ${summary}`);
    expect((await service.executeModelCall(started.runId)).status).toBe("finished");
    expect(seen).toHaveLength(2);
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM envoy_run_tool_results WHERE run_id = $1", [started.runId]))
        .rows[0]?.count,
    ).toBe(2);
    await pool.query("DELETE FROM envoy_runs WHERE run_id = $1", [started.runId]);
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM envoy_run_tool_results WHERE run_id = $1", [started.runId]))
        .rows[0]?.count,
    ).toBe(0);
  });

  it("does not invoke a provider when the actual objective exceeds remaining input allowance", async () => {
    const accountId = await verifiedAccount(`run-input-budget-${randomUUID()}@example.com`);
    let invoked = 0;
    const service = new RunService(pool, {
      productScope: "pact",
      clock: { now: () => clockNow },
      providerRouter: new ProviderRouter([
        {
          provider: "fixture",
          listModels: async () => [fakeProviderModel],
          invoke: async () => {
            invoked += 1;
            return { stopReason: "completed" as const, toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } };
          },
        },
      ]),
    });
    const started = await service.start({
      accountId,
      objective: "A".repeat(500),
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxTokens: 100 },
    });
    const finished = await service.executeModelCall(started.runId);
    expect(finished).toMatchObject({ status: "finished", usedCalls: 0, modelCalls: 0, reservedTokens: 0 });
    expect(invoked).toBe(0);
    expect(
      (await pool.query("SELECT in_flight_request_id FROM envoy_runs WHERE run_id = $1", [started.runId])).rows[0]
        ?.in_flight_request_id,
    ).toBeNull();
  });

  it("passes only validated provider tool calls to the run executor and checks the exact run lease", async () => {
    const accountId = await verifiedAccount(`run-tools-${randomUUID()}@example.com`);
    const otherAccountId = await verifiedAccount(`run-tools-other-${randomUUID()}@example.com`);
    const received: Array<{ runId: string; accountId: string; requestId: string; value: number }> = [];
    const service = new RunService(pool, {
      productScope: "pact",
      clock: { now: () => clockNow },
      providerRouter: new ProviderRouter([
        new DeterministicFakeProvider({ scenario: "success", toolName: "fixture.read", toolArguments: { value: 7 } }),
      ]),
      tools: [
        {
          name: "fixture.read",
          description: "A validated test-only tool",
          inputSchema: { type: "object" },
          parseArguments: (input) => {
            if (!input || typeof input !== "object" || !("value" in input) || input.value !== 7) {
              throw new Error("invalid tool arguments");
            }
            return { value: 7 };
          },
        },
      ],
      executeToolCalls: async ({ run, requestId, calls }) => {
        expect(calls).toHaveLength(1);
        const call = calls[0];
        if (!call) throw new Error("missing tool call");
        received.push({
          runId: run.runId,
          accountId: run.accountId,
          requestId,
          value: (call.arguments as { value: number }).value,
        });
      },
    });
    const started = await service.start({
      accountId,
      objective: "read test data",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 1 },
    });
    const lease = await pool.connect();
    try {
      await expect(service.assertRunWriteLease(lease, accountId, started.runId)).resolves.toBeUndefined();
      await expect(service.assertRunWriteLease(lease, otherAccountId, started.runId)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(service.assertMcpWriteLease(lease, accountId, started.runId)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      lease.release();
    }
    const finished = await service.executeModelCall(started.runId);
    expect(finished.status).toBe("finished");
    expect(received).toEqual([
      {
        runId: started.runId,
        accountId,
        requestId: expect.any(String),
        value: 7,
      },
    ]);
    const endedLease = await pool.connect();
    try {
      await expect(service.assertRunWriteLease(endedLease, accountId, started.runId)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      endedLease.release();
    }
  });

  it("fails closed when a provider returns a tool call without a run executor", async () => {
    const accountId = await verifiedAccount(`run-no-tool-executor-${randomUUID()}@example.com`);
    const service = new RunService(pool, {
      productScope: "pact",
      clock: { now: () => clockNow },
      providerRouter: new ProviderRouter([
        new DeterministicFakeProvider({ scenario: "success", toolName: "fixture.read" }),
      ]),
      tools: [{ name: "fixture.read", description: "test", inputSchema: {}, parseArguments: () => ({}) }],
    });
    const started = await service.start({
      accountId,
      objective: "read test data",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 3 },
    });
    const failed = await service.executeModelCall(started.runId);
    expect(failed.status).toBe("failed");
    expect(failed.lastErrorCode).toBe("MALFORMED_TOOL_CALL");
    expect(failed.usedCalls).toBe(1);
  });

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
