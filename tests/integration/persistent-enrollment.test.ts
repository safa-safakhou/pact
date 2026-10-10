import { randomUUID } from "node:crypto";
import type { CommandDispatcher } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { MCP_PROTOCOL_PRIMARY, McpTransport } from "@pact/mcp";
import { fakeProviderModel, ProviderRouter } from "@pact/model-provider";
import { PersistentPlayService, RunService } from "@pact/runs";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterEach, beforeEach, expect, it } from "vitest";
import { registerEnrollmentRoutes } from "../../services/api/src/enrollment-routes.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool,
  pool: Pool,
  schema: string,
  now = new Date("2026-10-24T22:30:00Z");
const clock = { now: () => now };
let calls = 0;
function runner() {
  return new RunService(pool, {
    productScope: "pact",
    clock,
    providerRouter: new ProviderRouter([
      {
        provider: "fixture",
        listModels: async () => [fakeProviderModel],
        invoke: async () => {
          calls++;
          return { stopReason: "completed" as const, toolCalls: [], usage: { inputTokens: 10, outputTokens: 5 } };
        },
      },
    ]),
    withCredential: async (_owner, _credential, _provider, operation) => operation(new Uint8Array()),
  });
}
function service(runs = runner(), available = async () => true) {
  return new PersistentPlayService(pool, "pact", { clock, runs, routeAvailable: available });
}
async function owner() {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture',$3,'terms-v1')",
    [id, `${id}@example.test`, now],
  );
  return id;
}
function enrollment(extra = {}) {
  return {
    schemaVersion: "pact.enrollment.v2",
    kind: "enroll",
    commandId: randomUUID(),
    enrollmentId: randomUUID(),
    expectedVersion: 0,
    route: "api",
    objective: "Choose using current facts",
    provider: "fixture",
    model: fakeProviderModel.id,
    credentialId: randomUUID(),
    deadlineAt: new Date(now.getTime() + 7200000).toISOString(),
    mode: "events",
    minIntervalMs: 3600000,
    totalCallBudget: 2,
    totalTokenBudget: 40000,
    sliceCalls: 1,
    sliceTokens: 20000,
    sliceDurationMs: 900000,
    maxMessages: 2,
    maxConversations: 2,
    ...extra,
  };
}
beforeEach(async () => {
  now = new Date("2026-10-24T22:30:00Z");
  calls = 0;
  admin = createPool(url);
  schema = await createTestSchema(admin, "enrollment");
  pool = createSchemaPool(url, schema);
});
afterEach(async () => {
  await pool?.end();
  if (schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
it("coalesces events, survives restart, shares one write lease and never replenishes budgets across Berlin DST", async () => {
  const id = await owner(),
    other = await owner(),
    runs = runner(),
    play = service(runs),
    command = enrollment();
  expect((await play.dispatch(true)).code).toBe("NO_ENROLLMENT");
  expect((await play.command(id, command)).code).toBe("COMMITTED");
  expect((await play.command(id, command)).code).toBe("ALREADY_COMMITTED");
  await expect(play.command(id, { ...command, objective: "Changed" })).rejects.toMatchObject({
    code: "OPERATION_CONFLICT",
  });
  expect((await play.read(other)).enrollments).toEqual([]);
  expect((await play.dispatch(false)).code).toBe("HOST_UNAVAILABLE");
  expect(calls).toBe(0);
  const admitted = await play.dispatch(true);
  expect(admitted.code).toBe("SLICE_ADMITTED");
  if (!admitted.runId) throw new Error("Missing slice");
  expect((await play.read(id)).enrollments[0]?.state).toBe("running_now");
  await expect(runs.openMcpLease({ accountId: id, holderId: "competing-host" })).rejects.toMatchObject({
    code: "RUN_ALREADY_ACTIVE",
  });
  expect((await runs.executeModelCall(admitted.runId)).status).toBe("finished");
  for (let i = 0; i < 100; i++)
    await pool.query(
      "INSERT INTO inbox_events(product_scope,event_id,account_id,type,payload,occurred_at) VALUES('pact',$1,$2,'message.received','{}',$3)",
      [randomUUID(), id, now],
    );
  expect((await service(runs).dispatch(true)).code).toBe("COOLING");
  now = new Date("2026-10-24T23:30:00Z");
  const second = await service(runs).dispatch(true);
  expect(second.code).toBe("SLICE_ADMITTED");
  if (!second.runId) throw new Error("Missing second slice");
  expect((await service(runs).read(id)).enrollments[0]).toMatchObject({
    allocatedCalls: 2,
    remainingCalls: 0,
    state: "running_now",
    deadlineAt: new Date(command.deadlineAt),
  });
  await runs.executeModelCall(second.runId);
  expect((await play.dispatch(true)).code).toBe("BUDGET_EXHAUSTED");
  expect(calls).toBe(2);
  expect(
    (await pool.query("SELECT count(*)::int AS n FROM persistent_work_slices WHERE account_id=$1", [id])).rows[0].n,
  ).toBe(2);
  now = new Date("2026-10-25T01:30:00Z");
  expect((await play.read(id)).enrollments[0]?.state).toBe("deadline_passed");
  expect((await play.dispatch(true)).code).toBe("NO_ENROLLMENT");
  expect(calls).toBe(2);
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  });
  expect(format.format(new Date("2026-10-25T00:30:00Z"))).toContain("GMT+2");
  expect(format.format(now)).toContain("GMT+1");
});
it("revokes exactly, preserves stopped work/deadlines and makes provider failure require the owner", async () => {
  const id = await owner(),
    runs = runner(),
    play = service(runs),
    command = enrollment({ mode: "periodic" });
  await play.command(id, command);
  const first = await play.dispatch(true);
  if (!first.runId) throw new Error(`Expected admission ${first.code}`);
  const revoke = {
    schemaVersion: "pact.enrollment.v2",
    kind: "revoke",
    commandId: randomUUID(),
    enrollmentId: command.enrollmentId,
    expectedVersion: 1,
  };
  expect((await play.command(id, revoke)).code).toBe("COMMITTED");
  expect((await play.command(id, revoke)).code).toBe("ALREADY_COMMITTED");
  expect((await runs.get(first.runId, id)).status).toBe("stopped");
  expect((await play.read(id)).enrollments[0]).toMatchObject({
    state: "stopped",
    allocatedCalls: 1,
    deadlineAt: new Date(command.deadlineAt),
  });
  await expect(play.command(id, { ...revoke, commandId: randomUUID(), expectedVersion: 1 })).rejects.toMatchObject({
    code: "STALE_VERSION",
  });
  const other = await owner();
  await expect(service(runs, async () => false).command(other, enrollment())).rejects.toMatchObject({
    code: "ROUTE_UNAVAILABLE",
  });
  expect((await play.read(other)).enrollments).toEqual([]);
  now = new Date(now.getTime() + 60000);
  const next = enrollment({ provider: "missing-provider" });
  await play.command(other, next);
  const bad = await play.dispatch(true);
  if (!bad.runId) throw new Error(`Expected failed route slice ${bad.code}`);
  expect((await runs.executeModelCall(bad.runId)).status).toBe("failed");
  expect((await play.dispatch(true)).code).toBe("NEEDS_OWNER");
  expect((await play.read(other)).enrollments[0]?.state).toBe("needs_owner");
});
it("serializes simultaneous workers, keeps cooling on restart and fails a partial start atomically", async () => {
  const id = await owner(),
    runs = runner(),
    play = service(runs);
  await play.command(id, enrollment());
  now = new Date(now.getTime() + 60000);
  const results = await Promise.all([play.dispatch(true), service(runs).dispatch(true)]);
  expect(results.filter((x) => x.code === "SLICE_ADMITTED")).toHaveLength(1);
  expect(results.filter((x) => x.code === "RUN_ACTIVE")).toHaveLength(1);
  const admitted = results.find((x) => x.runId);
  if (!admitted?.runId) throw new Error("Missing race slice");
  now = new Date(now.getTime() + 900001);
  expect((await play.dispatch(true)).code).toBe("NEEDS_OWNER");
  expect((await runs.get(admitted.runId, id)).status).toBe("stopped");
  const other = await owner(),
    rollback = service(runs);
  await rollback.command(other, enrollment());
  await pool.query(
    "CREATE FUNCTION deny_enrollment_slice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rollback'; END $$",
  );
  await pool.query(
    "CREATE TRIGGER deny_slice BEFORE INSERT ON persistent_work_slices FOR EACH ROW EXECUTE FUNCTION deny_enrollment_slice()",
  );
  await expect(rollback.dispatch(true)).rejects.toThrow("fixture rollback");
  expect((await rollback.read(other)).enrollments[0]).toMatchObject({ allocatedCalls: 0, activeRun: null });
  expect((await pool.query("SELECT count(*)::int AS n FROM envoy_runs WHERE account_id=$1", [other])).rows[0].n).toBe(
    0,
  );
  await pool.query("DROP TRIGGER deny_slice ON persistent_work_slices");
});
it("requires cookie human consent and CSRF, exposes scoped read-only MCP status and paginates complete history", async () => {
  const identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set(["https://pact.test"]),
    clock,
    guestPlayEnabled: true,
    digester: new TokenDigester(Buffer.alloc(32, 17)),
    secretBox: new AesGcmSecretBox(Buffer.alloc(32, 7)),
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  const login = await identity.joinGuest(randomUUID()),
    play = service(),
    server = Fastify();
  registerEnrollmentRoutes(server, identity, play);
  const headers = {
    cookie: `pact_session=${login.sessionToken}`,
    origin: "https://pact.test",
    "x-csrf-token": login.csrfToken,
  };
  const command = enrollment();
  expect(
    (
      await server.inject({
        method: "POST",
        url: "/v1/runs/enrollment",
        headers: { cookie: headers.cookie },
        payload: command,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await server.inject({
        method: "POST",
        url: "/v1/runs/enrollment",
        headers: { ...headers, origin: "https://foreign.test" },
        payload: command,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await server.inject({
        method: "POST",
        url: "/v1/runs/enrollment",
        headers: { ...headers, authorization: "Bearer agent" },
        payload: command,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await server.inject({
        method: "POST",
        url: "/v1/runs/enrollment",
        headers,
        payload: { ...command, accountId: randomUUID() },
      })
    ).statusCode,
  ).toBe(400);
  const response = await server.inject({ method: "POST", url: "/v1/runs/enrollment", headers, payload: command });
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  const id = (await identity.authenticate(login.sessionToken)).accountId;
  await play.command(id, {
    schemaVersion: "pact.enrollment.v2",
    kind: "revoke",
    commandId: randomUUID(),
    enrollmentId: command.enrollmentId,
    expectedVersion: 1,
  });
  for (let i = 0; i < 7; i++) {
    now = new Date(now.getTime() + 1000);
    const c = enrollment();
    await play.command(id, c);
    await play.command(id, {
      schemaVersion: "pact.enrollment.v2",
      kind: "revoke",
      commandId: randomUUID(),
      enrollmentId: c.enrollmentId,
      expectedVersion: 1,
    });
  }
  let page = await play.read(id),
    seen = page.enrollments.map((x) => x.id);
  expect(page.next).not.toBeNull();
  while (page.next) {
    page = await play.read(id, page.next);
    seen.push(...page.enrollments.map((x) => x.id));
  }
  expect(seen).toHaveLength(8);
  expect(new Set(seen).size).toBe(8);
  expect((await server.inject({ url: "/v1/runs/enrollment?accountId=foreign", headers })).statusCode).toBe(400);
  expect(
    (await server.inject({ url: "/v1/runs/enrollment", headers: { authorization: "Bearer agent" } })).statusCode,
  ).toBe(403);
  const scope = ProductScopeSchema.parse("pact"),
    principal = {
      accountId: id,
      productScope: scope,
      audience: "agent" as const,
      agentScopes: ["world:read" as const],
    };
  const mcp = new McpTransport({
    pool,
    productScope: "pact",
    origin: "https://pact.test",
    clock,
    dispatcher: {} as CommandDispatcher,
    persistentPlay: play,
  });
  const init = await mcp.handlePost(principal, {
    id: 1,
    method: "initialize",
    params: { protocolVersion: MCP_PROTOCOL_PRIMARY },
  });
  expect(
    JSON.stringify((await mcp.handlePost(principal, { id: 2, method: "tools/list" }, init.sessionId)).response),
  ).toContain("pact_persistent_play_status_v2");
  const request = { id: 3, method: "tools/call", params: { name: "pact_persistent_play_status_v2", arguments: {} } };
  expect((await mcp.handlePost(principal, request, init.sessionId)).response).toMatchObject({
    result: { structuredContent: { supportedRoutes: ["api"] } },
  });
  await expect(mcp.handlePost({ ...principal, agentScopes: [] }, request, init.sessionId)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    mcp.handlePost(
      principal,
      { ...request, params: { ...request.params, arguments: { accountId: randomUUID() } } },
      init.sessionId,
    ),
  ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  await server.close();
});
it("exports only the owner, prunes expired objectives and retains exact receipts until their audit window", async () => {
  const id = await owner(),
    other = await owner(),
    play = service(),
    command = enrollment();
  await play.command(id, command);
  const revoke = {
    schemaVersion: "pact.enrollment.v2",
    kind: "revoke",
    commandId: randomUUID(),
    enrollmentId: command.enrollmentId,
    expectedVersion: 1,
  };
  await play.command(id, revoke);
  expect((await withTransaction(pool, (c) => play.retention.exportAccount(c, other))).enrollments).toEqual([]);
  const exported = await withTransaction(pool, (c) => play.retention.exportAccount(c, id));
  expect(exported.enrollments).toHaveLength(1);
  expect(exported.receipts).toHaveLength(2);
  await withTransaction(pool, (c) => play.retention.prune(c, new Date(now.getTime() + 31 * 86400000)));
  expect((await play.read(id)).enrollments[0]?.objectivePruned).toBe(true);
  expect(JSON.stringify(await play.read(id))).not.toContain(command.objective);
  expect((await play.command(id, command)).code).toBe("ALREADY_COMMITTED");
  await withTransaction(pool, (c) => play.retention.prune(c, new Date(now.getTime() + 181 * 86400000)));
  expect((await play.read(id)).enrollments).toEqual([]);
  await withTransaction(pool, (c) => play.retention.forgetAccount(c, id));
  expect((await play.read(id)).enrollments).toEqual([]);
  expect(
    (await pool.query("SELECT count(*)::int n FROM persistent_enrollment_receipts WHERE account_id=$1", [id])).rows[0]
      .n,
  ).toBe(0);
});
it("keeps shared cooling across owners and marks heartbeat loss without triggering calls or acknowledging messages", async () => {
  const first = await owner(),
    second = await owner(),
    runs = runner(),
    play = service(runs);
  await play.command(first, enrollment());
  const run = await play.dispatch(true);
  if (!run.runId) throw new Error("No first run");
  await runs.executeModelCall(run.runId);
  now = new Date(now.getTime() + 1000);
  await play.command(second, enrollment());
  expect((await service(runs).dispatch(true)).code).toBe("COOLING");
  expect(calls).toBe(1);
  now = new Date(now.getTime() + 59000);
  const next = await service(runs).dispatch(true);
  expect(next.code).toBe("SLICE_ADMITTED");
  if (!next.runId) throw new Error("No second run");
  await runs.executeModelCall(next.runId);
  expect(calls).toBe(2);
  now = new Date(now.getTime() + 90001);
  expect((await play.read(second)).host).toMatchObject({
    available: false,
    heartbeatFresh: false,
    executionEnabled: true,
  });
  expect((await play.read(second)).enrollments[0]?.state).toBe("host_unavailable");
  expect((await play.dispatch(false)).code).toBe("HOST_UNAVAILABLE");
  expect((await play.read(first)).host).toMatchObject({
    available: false,
    heartbeatFresh: true,
    executionEnabled: false,
  });
  now = new Date(now.getTime() + 3600000);
  await play.dispatch(true);
  await play.dispatch(true);
  expect((await play.read(first)).enrollments[0]?.state).toBe("waiting_for_event");
  expect(calls).toBe(2);
  const unconsented = await owner();
  await pool.query(
    "INSERT INTO inbox_events(product_scope,event_id,account_id,type,payload,occurred_at) VALUES('pact',$1,$2,'message.sent.v1','{}',$3)",
    [randomUUID(), unconsented, now],
  );
  await play.dispatch(true);
  expect(calls).toBe(2);
  expect(
    (await pool.query("SELECT count(*)::int n FROM envoy_runs WHERE account_id=$1", [unconsented])).rows[0].n,
  ).toBe(0);
  expect(
    (await pool.query("SELECT count(*)::int n FROM inbox_events WHERE account_id=$1", [unconsented])).rows[0].n,
  ).toBe(1);
});
