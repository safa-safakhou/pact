import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "@pact/application";
import { ApprovalError, ApprovalService } from "@pact/approvals";
import { ProductScopeSchema, SCHEMA_VERSION } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { InboxService } from "@pact/inbox";
import { MCP_PROTOCOL_PRIMARY, McpError, McpTransport } from "@pact/mcp";
import { OAuthService } from "@pact/oauth";
import { ExternalAgentActivity, RunError, RunService } from "@pact/runs";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerApprovalRoutes, registerMcpRoutes } from "../../services/api/src/mcp-approval-inbox-routes.js";
import { registerRunRoutes } from "../../services/api/src/run-routes.js";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const password = "A long test password 123!";
const origin = "https://pact.example";
let admin: Pool;
let pool: Pool;
let schema: string;
let identity: IdentityService;
let dispatcher: CommandDispatcher;
let mcp: McpTransport;
let approvals: ApprovalService;
let inbox: InboxService;
let secretBox: AesGcmSecretBox;
let activity: ExternalAgentActivity;
const productScope = ProductScopeSchema.parse("pact");

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "mcpbatch");
  pool = createSchemaPool(connectionString, schema);
  const clock = { now: () => new Date("2026-09-20T20:00:00.000Z") };
  secretBox = new AesGcmSecretBox(Buffer.alloc(32, 7));
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set([origin]),
    clock,
    digester: new TokenDigester(Buffer.alloc(32, 13)),
    secretBox,
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  activity = new ExternalAgentActivity(pool, "pact", clock);
  dispatcher = new CommandDispatcher({
    pool,
    clock,
    productScope,
    onCommittedReceipt: async (client, principal, _command, receipt) => {
      if (principal.agentOrigin === "external" && principal.sessionId)
        await activity.record(client, {
          accountId: principal.accountId,
          sessionId: principal.sessionId,
          summary: { ...receipt },
        });
    },
  });
  const runs = new RunService(pool, { productScope: "pact", clock });
  mcp = new McpTransport({
    pool,
    productScope: "pact",
    dispatcher,
    origin,
    clock,
    playView: {
      read: async (accountId, query) => ({
        world: { viewer: accountId },
        interactions: { messages: [] },
        players: { players: [] },
        discovery: query,
      }),
    },
    notes: {
      read: async (accountId) => ({ text: "Any workflow", version: 1, viewer: accountId }),
      write: async (accountId, text, expectedVersion) => ({
        saved: true,
        text,
        version: expectedVersion + 1,
        viewer: accountId,
      }),
    },
    runLeases: runs,
    activity: { record: (accountId, sessionId, summary) => activity.record(pool, { accountId, sessionId, summary }) },
    approvalProposals: {
      proposeAgent: async () => {
        throw new RunError("FORBIDDEN");
      },
    },
    worldViews: {
      read: async (viewer, target, minutes) => ({ audience: "public", viewer, target, minutes }),
      readSelf: async (viewer, minutes) => ({ audience: "owner", viewer, minutes }),
    },
    seasons: {
      read: async (query, accountId) => ({
        current: { configured: true, week: 3, harvestPercent: 90 },
        viewer: accountId,
        query,
      }),
    },
    reports: {
      read: async (viewer, kind, recordId) => (viewer === "missing" ? null : { viewer, kind, recordId }),
    },
  });
  approvals = new ApprovalService(pool, {
    productScope: "pact",
    identity,
    dispatcher,
    clock,
    origin,
  });
  inbox = new InboxService(pool, { productScope: "pact", clock, retentionFloorSequence: 0 });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function verifiedAccount(email: string): Promise<{ accountId: string; sessionToken: string }> {
  await identity.signup({ email, password, age18Declared: true, acceptedTermsVersion: "terms-v1" });
  const event = await pool.query<{ payload: { accountId: string; sealedToken: string } }>(
    `SELECT payload FROM outbox_events WHERE type = 'security.email.requested.v1' AND payload->>'template' = 'verify_email' ORDER BY id DESC LIMIT 1`,
  );
  const payload = event.rows[0]?.payload;
  if (!payload) throw new Error("missing verification");
  await identity.verifyEmail(Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8"));
  const tokens = await identity.login({ email, password, ip: "127.0.0.1" });
  return { accountId: payload.accountId, sessionToken: tokens.sessionToken };
}

describe("PACT-017 MCP transport", () => {
  it("resumes reconnects only within one authenticated OAuth grant and keeps its bounded lease", async () => {
    const { accountId } = await verifiedAccount(`mcp-reconnect-${randomUUID()}@example.test`);
    const grants = [randomUUID(), randomUUID()] as const;
    for (const grantId of grants) {
      await pool.query(
        `INSERT INTO oauth_grants(id, product_scope, account_id, client_id, token_family_id, scopes, expires_at)
         VALUES ($1, 'pact', $2, 'synthetic-host', $3, ARRAY['world:read','game:act'], '2027-01-01')`,
        [grantId, accountId, randomUUID()],
      );
    }
    const principal = {
      accountId,
      productScope,
      audience: "agent" as const,
      agentScopes: ["world:read" as const, "game:act" as const],
      agentGrantId: grants[0],
    };
    const init = { method: "initialize", id: 1, params: { protocolVersion: MCP_PROTOCOL_PRIMARY } };
    const first = await mcp.handlePost(principal, init);
    const sessionId = first.sessionId as string;
    await mcp.handlePost(
      principal,
      { method: "tools/call", id: 2, params: { name: "run.open", arguments: {} } },
      sessionId,
    );
    const reconnects = await Promise.all(Array.from({ length: 4 }, () => mcp.handlePost(principal, init)));
    expect(reconnects.map((r) => r.sessionId)).toEqual(Array(4).fill(sessionId));
    const runs = new RunService(pool, {
      productScope: "pact",
      clock: { now: () => new Date("2026-09-20T20:00:00.000Z") },
    });
    await withTransaction(pool, (client) =>
      runs.assertMcpWriteLease(client, accountId, reconnects[0]?.sessionId as string),
    );
    const other = { ...principal, agentGrantId: grants[1] };
    const otherSession = (await mcp.handlePost(other, init)).sessionId as string;
    expect(otherSession).not.toBe(sessionId);
    await expect(mcp.openStream(other, sessionId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(mcp.closeSession(other, sessionId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { agentGrantId: _grant, ...unboundPrincipal } = principal;
    await expect(mcp.openStream(unboundPrincipal, sessionId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      withTransaction(pool, (client) => runs.assertMcpWriteLease(client, accountId, otherSession)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await mcp.closeSession(principal, sessionId);
    await expect(
      withTransaction(pool, (client) => runs.assertMcpWriteLease(client, accountId, sessionId)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await mcp.handlePost(principal, init)).sessionId).not.toBe(sessionId);
    await expect(mcp.openStream(other, otherSession)).resolves.toBeDefined();
  });

  it("persists owner-only external activity atomically, deduplicates receipts and survives session closure", async () => {
    const { accountId, sessionToken } = await verifiedAccount(`activity-${randomUUID()}@example.test`);
    const other = await verifiedAccount(`activity-other-${randomUUID()}@example.test`);
    const principal = { accountId, productScope, audience: "agent" as const, agentScopes: ["game:act" as const] };
    const init = await mcp.handlePost(principal, {
      method: "initialize",
      id: 1,
      params: { protocolVersion: MCP_PROTOCOL_PRIMARY },
    });
    const commandId = randomUUID();
    const command = {
      schemaVersion: SCHEMA_VERSION,
      commandId,
      actor: { principalId: accountId, productScope, audience: "human", subject: { type: "account", id: accountId } },
      action: { kind: "sandbox.echo", message: "private payload must not be journaled" },
      submittedAt: new Date().toISOString(),
    };
    const call = { method: "tools/call", id: 2, params: { name: "pact_command_v1", arguments: command } };
    await mcp.handlePost(principal, call, init.sessionId);
    await mcp.handlePost(principal, call, init.sessionId);
    await expect(
      mcp.handlePost(
        principal,
        { method: "tools/call", id: 3, params: { name: "unknown", arguments: { secret: "do not store" } } },
        init.sessionId,
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await mcp.closeSession(principal, init.sessionId as string);
    const report = await activity.read(accountId);
    expect(report.entries.map((entry) => entry.category)).toEqual(["committed", "failed"]);
    expect(report.entries[0]?.commandId).toBe(commandId);
    const server = Fastify();
    registerRunRoutes(
      server,
      identity,
      new RunService(pool, { productScope: "pact", clock: { now: () => new Date() } }),
      activity,
    );
    const response = await server.inject({
      method: "GET",
      url: "/v1/runs/external-activity",
      headers: { cookie: `pact_session=${sessionToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().entries).toEqual(report.entries);
    const foreign = await server.inject({
      method: "GET",
      url: "/v1/runs/external-activity",
      headers: { cookie: `pact_session=${other.sessionToken}` },
    });
    expect(foreign.json().entries).toEqual([]);
    expect((await server.inject({ method: "GET", url: "/v1/runs/external-activity" })).statusCode).toBe(403);
    await server.close();
    expect((await activity.read(other.accountId)).entries).toEqual([]);
    expect(JSON.stringify(report)).not.toMatch(/private payload|do not store|secret/);
    const rows = await withTransaction(pool, (client) => activity.retention.exportAccount(client, accountId));
    expect(JSON.stringify(rows)).not.toContain("private payload");
    const failing = new CommandDispatcher({
      pool,
      productScope,
      clock: { now: () => new Date() },
      onCommittedReceipt: async () => {
        throw new Error("Synthetic observer rollback");
      },
    });
    const rollbackId = randomUUID();
    await expect(
      failing.dispatch(
        { ...principal, agentOrigin: "external", sessionId: randomUUID() },
        { ...command, commandId: rollbackId },
      ),
    ).rejects.toThrow("Synthetic observer rollback");
    expect(await dispatcher.lookupReceipt(principal, rollbackId)).toBeNull();
    await pool.query("UPDATE external_agent_activity SET created_at='2020-01-01' WHERE account_id=$1", [accountId]);
    expect(
      await withTransaction(pool, (client) => activity.retention.prune(client, new Date())),
    ).toBeGreaterThanOrEqual(2);
    expect((await activity.read(accountId)).entries).toEqual([]);
  });

  it("advertises the PACT subpath OAuth discovery URL to unauthenticated Codex clients", async () => {
    const server = Fastify();
    const oauth = new OAuthService(pool, {
      productScope: "pact",
      issuer: `${origin}/pact`,
      mcpResource: `${origin}/pact/mcp`,
      humanResource: `${origin}/pact/native`,
      clock: { now: () => new Date("2026-09-20T20:00:00.000Z") },
    });
    registerMcpRoutes(server, mcp, oauth, origin);
    const response = await server.inject({ method: "GET", url: "/mcp" });
    expect(response.statusCode).toBe(401);
    expect(response.headers["www-authenticate"]).toBe(
      `Bearer resource_metadata="${origin}/pact/.well-known/oauth-protected-resource"`,
    );
    await server.close();
  });

  it("accepts an authorized MCP initialize request without attempting a human-only approval", async () => {
    const { accountId } = await verifiedAccount(`mcp-route-${randomUUID()}@example.com`);
    const server = Fastify();
    const oauth = {
      authorizationServerMetadata: () => ({ issuer: `${origin}/pact` }),
      introspectAccessToken: async () => ({
        accountId,
        audience: "mcp",
        scopes: ["world:read", "messages:write", "game:act"],
      }),
      assertNotHumanOnly: () => {
        throw new Error("MCP initialization must not attempt a human-only approval");
      },
    } as unknown as OAuthService;
    registerMcpRoutes(server, mcp, oauth, origin);
    const response = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: { origin, authorization: "Bearer synthetic-test-token" },
      payload: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: MCP_PROTOCOL_PRIMARY } },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ result: { protocolVersion: MCP_PROTOCOL_PRIMARY } });
    expect(response.headers["mcp-session-id"]).toBeTruthy();
    const initialized = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        origin,
        authorization: "Bearer synthetic-test-token",
        "mcp-session-id": String(response.headers["mcp-session-id"]),
      },
      payload: { jsonrpc: "2.0", method: "notifications/initialized" },
    });
    expect(initialized.statusCode).toBe(202);
    expect(initialized.body).toBe("");
    const denied = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        origin,
        authorization: "Bearer synthetic-test-token",
        "mcp-session-id": String(response.headers["mcp-session-id"]),
      },
      payload: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "unknown.tool", arguments: {} } },
    });
    expect(denied.statusCode).toBe(200);
    expect(denied.json()).toMatchObject({ result: { isError: true } });
    expect(JSON.stringify(denied.json())).toContain("input schema");
    const malformed = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        origin,
        authorization: "Bearer synthetic-test-token",
        "mcp-session-id": String(response.headers["mcp-session-id"]),
      },
      payload: { jsonrpc: "2.0", id: 22, method: "tools/call", params: { name: "run.open", arguments: null } },
    });
    expect(malformed.statusCode).toBe(200);
    expect(malformed.json()).toMatchObject({ result: { isError: true } });
    expect(JSON.stringify(malformed.json())).toContain("INVALID_REQUEST");
    const noLeaseProposal = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        origin,
        authorization: "Bearer synthetic-test-token",
        "mcp-session-id": String(response.headers["mcp-session-id"]),
      },
      payload: {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "pact_approval_propose_v1",
          arguments: {
            commandId: randomUUID(),
            action: { kind: "game.building.queue", building: "storehouse", targetLevel: 2, slot: 2 },
          },
        },
      },
    });
    expect(noLeaseProposal.statusCode).toBe(200);
    expect(noLeaseProposal.json()).toMatchObject({ result: { isError: true } });
    expect(JSON.stringify(noLeaseProposal.json())).toContain("FORBIDDEN");
    const ping = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        origin,
        authorization: "Bearer synthetic-test-token",
        "mcp-session-id": String(response.headers["mcp-session-id"]),
      },
      payload: { jsonrpc: "2.0", id: 3, method: "ping" },
    });
    expect(ping.statusCode).toBe(200);
    expect(ping.json()).toMatchObject({ result: {} });
    const sessionId = String(response.headers["mcp-session-id"]);
    const opened = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: { origin, authorization: "Bearer synthetic-test-token", "mcp-session-id": sessionId },
      payload: { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "run.open", arguments: {} } },
    });
    expect(opened.statusCode).toBe(200);
    expect(JSON.stringify(opened.json())).toContain("leaseId");
    const closed = await server.inject({
      method: "DELETE",
      url: "/mcp",
      headers: { origin, authorization: "Bearer synthetic-test-token", "mcp-session-id": sessionId },
    });
    expect(closed.statusCode).toBe(204);
    const released = await pool.query<{ released_at: Date | null }>(
      `SELECT released_at FROM write_leases WHERE product_scope = 'pact' AND subject_id = $1`,
      [accountId],
    );
    expect(released.rows[0]?.released_at).not.toBeNull();
    expect((await pool.query("SELECT 1 FROM mcp_sessions WHERE id = $1", [sessionId])).rowCount).toBe(0);
    const second = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: { origin, authorization: "Bearer synthetic-test-token" },
      payload: { jsonrpc: "2.0", id: 5, method: "initialize", params: { protocolVersion: MCP_PROTOCOL_PRIMARY } },
    });
    const reopened = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        origin,
        authorization: "Bearer synthetic-test-token",
        "mcp-session-id": String(second.headers["mcp-session-id"]),
      },
      payload: { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "run.open", arguments: {} } },
    });
    expect(reopened.statusCode).toBe(200);
    expect(JSON.stringify(reopened.json())).toContain("leaseId");
    await server.close();
  });

  it("initializes supported protocols, isolates sessions, and binds tools to the actor", async () => {
    const { accountId } = await verifiedAccount(`mcp-${randomUUID()}@example.com`);
    const other = await verifiedAccount(`mcp-other-${randomUUID()}@example.com`);
    const principal = { accountId, productScope, audience: "agent" as const, agentScopes: ["game:act" as const] };
    const otherPrincipal = {
      accountId: other.accountId,
      productScope,
      audience: "agent" as const,
      agentScopes: ["game:act" as const],
    };

    await expect(
      mcp.handlePost(principal, { method: "initialize", id: 1, params: { protocolVersion: "1999-01-01" } }),
    ).rejects.toBeInstanceOf(McpError);

    const init = await mcp.handlePost(principal, {
      method: "initialize",
      id: 1,
      params: { protocolVersion: MCP_PROTOCOL_PRIMARY },
    });
    expect(init.sessionId).toBeTruthy();
    expect(init.response).toMatchObject({ result: { protocolVersion: MCP_PROTOCOL_PRIMARY } });

    const listed = await mcp.handlePost(principal, { method: "tools/list", id: 2 }, init.sessionId);
    expect(JSON.stringify(listed.response)).toContain("sandbox.echo");
    expect(JSON.stringify(listed.response)).toContain("run.open");
    expect(listed.response).toMatchObject({
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({
            name: "run.open",
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
            securitySchemes: [{ type: "oauth2", scopes: ["game:act"] }],
          }),
        ]),
      },
    });
    const lease = await mcp.handlePost(
      principal,
      { method: "tools/call", id: 8, params: { name: "run.open", arguments: {} } },
      init.sessionId,
    );
    expect(JSON.stringify(lease.response)).toContain("leaseId");
    const renewed = await mcp.handlePost(
      principal,
      { method: "tools/call", id: 9, params: { name: "run.open", arguments: {} } },
      init.sessionId,
    );
    expect(renewed.response).toMatchObject({ result: lease.response.result });

    const called = await mcp.handlePost(
      principal,
      {
        method: "tools/call",
        id: 3,
        params: { name: "sandbox.echo", arguments: { message: "hello" } },
      },
      init.sessionId,
    );
    expect(JSON.stringify(called.response)).toContain("COMMITTED");

    const readOnly = { accountId, productScope, audience: "agent" as const, agentScopes: ["world:read" as const] };
    const readOnlyTools = await mcp.handlePost(readOnly, { method: "tools/list", id: 4 }, init.sessionId);
    expect(JSON.stringify(readOnlyTools.response)).not.toContain('"name":"run.open"');
    expect(JSON.stringify(readOnlyTools.response)).toContain("pact_world_read_v1");
    expect(JSON.stringify(readOnlyTools.response)).toContain("pact_report_read_v1");
    expect(JSON.stringify(readOnlyTools.response)).toContain("pact_season_read_v1");
    const seasonal = await mcp.handlePost(
      readOnly,
      { method: "tools/call", id: 31, params: { name: "pact_season_read_v1", arguments: {} } },
      init.sessionId,
    );
    expect(seasonal.response).toMatchObject({
      result: { structuredContent: { viewer: accountId, current: { week: 3, harvestPercent: 90 } } },
    });
    await expect(
      mcp.handlePost(
        readOnly,
        {
          method: "tools/call",
          id: 32,
          params: { name: "pact_season_read_v1", arguments: { accountId: randomUUID() } },
        },
        init.sessionId,
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      mcp.handlePost(
        { ...readOnly, agentScopes: [] },
        { method: "tools/call", id: 33, params: { name: "pact_season_read_v1", arguments: {} } },
        init.sessionId,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(JSON.stringify(readOnlyTools.response)).not.toContain("pact_command_v1");
    const readOnlyView = await mcp.handlePost(
      readOnly,
      {
        method: "tools/call",
        id: 6,
        params: { name: "pact_world_read_v1", arguments: { targetKingdomId: randomUUID(), forecastMinutes: 3 } },
      },
      init.sessionId,
    );
    expect(readOnlyView.response).toMatchObject({ result: { structuredContent: { viewer: accountId, minutes: 3 } } });
    const reportId = randomUUID();
    const report = await mcp.handlePost(
      readOnly,
      {
        method: "tools/call",
        id: 10,
        params: { name: "pact_report_read_v1", arguments: { kind: "scout", recordId: reportId } },
      },
      init.sessionId,
    );
    expect(report.response).toMatchObject({
      result: { structuredContent: { viewer: accountId, kind: "scout", recordId: reportId } },
    });
    await expect(
      mcp.handlePost(
        principal,
        {
          method: "tools/call",
          id: 11,
          params: { name: "pact_report_read_v1", arguments: { kind: "scout", recordId: reportId } },
        },
        init.sessionId,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const invalid = await mcp.handlePost(
      readOnly,
      {
        method: "tools/call",
        id: 7,
        params: { name: "pact_world_read_v1", arguments: { forecastMinutes: 61, kingdomId: "PRIVATE_BAD_TEXT" } },
      },
      init.sessionId,
    );
    expect(invalid.response).toMatchObject({
      result: { isError: true, structuredContent: { code: "INVALID_REQUEST", receiptExists: false } },
    });
    expect(JSON.stringify(invalid.response)).not.toContain("PRIVATE_BAD_TEXT");
    const self = await mcp.handlePost(
      readOnly,
      { method: "tools/call", id: 71, params: { name: "pact_world_read_v1", arguments: {} } },
      init.sessionId,
    );
    expect(self.response).toMatchObject({
      result: { structuredContent: { audience: "owner", viewer: accountId, minutes: 60 } },
    });
    await expect(
      mcp.handlePost(
        readOnly,
        { method: "tools/call", id: 5, params: { name: "sandbox.echo", arguments: { message: "no" } } },
        init.sessionId,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(init.sessionId).toBeTruthy();
    const sessionId = init.sessionId as string;
    await expect(mcp.openStream(otherPrincipal, sessionId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(mcp.closeSession(otherPrincipal, sessionId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    mcp.assertOrigin(origin);
    expect(() => mcp.assertOrigin("https://evil.example")).toThrow(McpError);
  });

  it("derives the actor for agent game actions and rejects caller-supplied identity", async () => {
    const { accountId } = await verifiedAccount(`mcp-action-${randomUUID()}@example.com`);
    let captured: { principal: unknown; command: unknown } | undefined;
    const actionMcp = new McpTransport({
      pool,
      productScope: "pact",
      origin,
      clock: { now: () => new Date("2026-09-20T20:00:00.000Z") },
      agentGuide: { read: async (owner, topic) => ({ owner, topic, state: "active" }) },
      profile: { read: async () => ({ nickname: "aster — PACT kingdom" }) },
      dispatcher: {
        dispatch: async (principal: unknown, command: unknown) => {
          captured = { principal, command };
          return { code: "COMMITTED", commandId: (command as { commandId: string }).commandId };
        },
      } as unknown as CommandDispatcher,
    });
    const principal = { accountId, productScope, audience: "agent" as const, agentScopes: ["game:act" as const] };
    const initialized = await actionMcp.handlePost(principal, {
      method: "initialize",
      id: 1,
      params: { protocolVersion: MCP_PROTOCOL_PRIMARY },
    });
    const sessionId = initialized.sessionId;
    const listed = await actionMcp.handlePost(principal, { method: "tools/list", id: 2 }, sessionId);
    expect(JSON.stringify(listed.response)).toContain("pact_game_action_v1");
    const reader = { accountId, productScope, audience: "agent" as const, agentScopes: ["world:read" as const] };
    const guideTools = await actionMcp.handlePost(reader, { method: "tools/list", id: 20 }, sessionId);
    expect(JSON.stringify(guideTools.response)).toContain("pact_agent_guide_v1");
    expect(JSON.stringify(guideTools.response)).not.toContain("pact_game_action_v1");
    const tools = (guideTools.response.result as { tools: { name: string; _meta?: Record<string, unknown> }[] }).tools;
    expect(tools.find((tool) => tool.name === "pact_profile_v1")?._meta).toMatchObject({
      "openai/profile": true,
      securitySchemes: [{ type: "oauth2", scopes: ["world:read"] }],
    });
    const profile = await actionMcp.handlePost(
      reader,
      { method: "tools/call", id: 23, params: { name: "pact_profile_v1", arguments: {} } },
      sessionId,
    );
    expect(profile.response).toMatchObject({
      result: { structuredContent: { id: accountId, nickname: "aster — PACT kingdom" } },
    });
    const repeated = await actionMcp.handlePost(
      reader,
      { method: "tools/call", id: 24, params: { name: "pact_profile_v1", arguments: {} } },
      sessionId,
    );
    expect(repeated.response).toMatchObject({ result: { structuredContent: { id: accountId } } });
    const reconnected = await actionMcp.handlePost(reader, {
      method: "initialize",
      id: 27,
      params: { protocolVersion: MCP_PROTOCOL_PRIMARY },
    });
    const afterReconnect = await actionMcp.handlePost(
      reader,
      { method: "tools/call", id: 28, params: { name: "pact_profile_v1", arguments: {} } },
      reconnected.sessionId,
    );
    expect(afterReconnect.response).toMatchObject({ result: { structuredContent: { id: accountId } } });
    const { accountId: otherAccountId } = await verifiedAccount(`mcp-profile-${randomUUID()}@example.com`);
    const otherReader = { ...reader, accountId: otherAccountId };
    const otherSession = await actionMcp.handlePost(otherReader, {
      method: "initialize",
      id: 29,
      params: { protocolVersion: MCP_PROTOCOL_PRIMARY },
    });
    const otherProfile = await actionMcp.handlePost(
      otherReader,
      { method: "tools/call", id: 30, params: { name: "pact_profile_v1", arguments: {} } },
      otherSession.sessionId,
    );
    expect(otherProfile.response).toMatchObject({ result: { structuredContent: { id: otherAccountId } } });
    await expect(
      actionMcp.handlePost(
        otherReader,
        { method: "tools/call", id: 31, params: { name: "pact_profile_v1", arguments: {} } },
        sessionId,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      actionMcp.handlePost(
        reader,
        { method: "tools/call", id: 25, params: { name: "pact_profile_v1", arguments: { accountId: randomUUID() } } },
        sessionId,
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      actionMcp.handlePost(
        principal,
        { method: "tools/call", id: 26, params: { name: "pact_profile_v1", arguments: {} } },
        sessionId,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const guide = await actionMcp.handlePost(
      reader,
      { method: "tools/call", id: 21, params: { name: "pact_agent_guide_v1", arguments: {} } },
      sessionId,
    );
    expect(guide.response).toMatchObject({ result: { structuredContent: { owner: accountId, topic: "start" } } });
    await expect(
      actionMcp.handlePost(
        reader,
        {
          method: "tools/call",
          id: 22,
          params: { name: "pact_agent_guide_v1", arguments: { accountId: randomUUID() } },
        },
        sessionId,
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    const commandId = randomUUID();
    const args = {
      commandId,
      action: { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 },
    };
    const result = await actionMcp.handlePost(
      principal,
      { method: "tools/call", id: 3, params: { name: "pact_game_action_v1", arguments: args } },
      sessionId,
    );
    expect(result.response).toMatchObject({ result: { structuredContent: { code: "COMMITTED", commandId } } });
    expect(captured).toMatchObject({
      principal: { accountId, sessionId },
      command: {
        commandId,
        actor: { principalId: accountId, audience: "agent", subject: { type: "account", id: accountId } },
      },
    });
    await expect(
      actionMcp.handlePost(
        principal,
        {
          method: "tools/call",
          id: 4,
          params: { name: "pact_game_action_v1", arguments: { ...args, accountId: randomUUID() } },
        },
        sessionId,
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});

describe("PACT-020 approvals", () => {
  it("deduplicates concurrent equivalent requests and preserves the first exact command and deadline", async () => {
    const { accountId } = await verifiedAccount(`dedup-${randomUUID()}@example.test`);
    const command = {
      schemaVersion: SCHEMA_VERSION,
      commandId: randomUUID(),
      actor: {
        principalId: accountId,
        productScope,
        audience: "agent" as const,
        subject: { type: "account" as const, id: accountId },
      },
      action: { kind: "sandbox.echo" as const, message: "Equivalent request" },
      submittedAt: "2026-09-20T20:00:00.000Z",
    };
    const first = await approvals.createRequest({ accountId, command, effectsSummary: "Echo" });
    const duplicates = await Promise.all(
      Array.from({ length: 3 }, () =>
        approvals.createRequest({
          accountId,
          command: { ...command, commandId: randomUUID() },
          effectsSummary: "Echo",
        }),
      ),
    );
    expect(
      duplicates.every(
        (v) =>
          v.approvalId === first.approvalId &&
          v.commandId === first.commandId &&
          v.expiresAt.getTime() === first.expiresAt.getTime(),
      ),
    ).toBe(true);
    expect((await approvals.pendingForAccount(accountId)).approvals).toHaveLength(1);
    await pool.query("UPDATE approval_requests SET expires_at='2026-09-20T19:00:00Z' WHERE approval_id=$1", [
      first.approvalId,
    ]);
    const next = await approvals.createRequest({
      accountId,
      command: { ...command, commandId: randomUUID() },
      effectsSummary: "Echo",
    });
    expect(next.approvalId).not.toBe(first.approvalId);
    expect((await approvals.review(first.approvalId, accountId)).status).toBe("expired");
  });
  it("lists only this human's live approvals with a ten-record bound and no command admission", async () => {
    const owner = await verifiedAccount(`pending-owner-${randomUUID()}@example.com`);
    const other = await verifiedAccount(`pending-other-${randomUUID()}@example.com`);
    const create = (accountId: string) =>
      approvals.createRequest({
        accountId,
        command: {
          schemaVersion: SCHEMA_VERSION,
          commandId: randomUUID(),
          actor: {
            principalId: accountId,
            productScope,
            audience: "human",
            subject: { type: "account", id: accountId },
          },
          action: { kind: "sandbox.echo", message: `synthetic pending fixture ${randomUUID()}` },
          submittedAt: "2026-09-20T20:00:00.000Z",
        },
        effectsSummary: "Read-only fixture",
      });
    const expired = await create(owner.accountId),
      foreign = await create(other.accountId);
    await pool.query("UPDATE approval_requests SET expires_at='2026-09-20T19:00:00Z' WHERE approval_id=$1", [
      expired.approvalId,
    ]);
    for (let n = 0; n < 12; n++) await create(owner.accountId);
    const server = Fastify();
    registerApprovalRoutes(server, identity, approvals);
    try {
      const response = await server.inject({
        method: "GET",
        url: `/v1/approvals?accountId=${other.accountId}`,
        headers: { cookie: `pact_session=${owner.sessionToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      const listed = response.json() as {
        approvals: { approvalId: string; status: string; deepLinkPath: string }[];
        truncated: boolean;
      };
      expect(listed.truncated).toBe(true);
      expect(listed.approvals).toHaveLength(10);
      expect(listed.approvals.every((a) => a.status === "pending" && a.deepLinkPath.includes(a.approvalId))).toBe(true);
      expect(JSON.stringify(listed)).not.toContain(expired.approvalId);
      expect(JSON.stringify(listed)).not.toContain(foreign.approvalId);
      expect(
        (await server.inject({ method: "GET", url: "/v1/approvals", headers: { authorization: "Bearer agent-token" } }))
          .statusCode,
      ).toBe(403);
      const ids = listed.approvals.map((a) => a.approvalId);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM approval_requests WHERE approval_id=ANY($1::uuid[]) AND status='pending'",
            [ids],
          )
        ).rows,
      ).toEqual([{ count: 10 }]);
      expect(JSON.stringify(listed)).not.toMatch(/canonical_command_hash|requesting_client_id|action/);
    } finally {
      await server.close();
    }
  });

  it("keeps an exact request pending when the world cannot commit its approved command", async () => {
    const { accountId, sessionToken } = await verifiedAccount(`approval-paused-${randomUUID()}@example.com`);
    const pausedDispatcher = new CommandDispatcher({
      pool,
      clock: { now: () => new Date("2026-09-20T20:00:00.000Z") },
      productScope,
      game: {
        admit: async () => ({ kind: "paused" }),
        execute: async () => {
          throw new Error("Paused game command must not execute");
        },
      },
    });
    const pausedApprovals = new ApprovalService(pool, {
      productScope: "pact",
      identity,
      dispatcher: pausedDispatcher,
      clock: { now: () => new Date("2026-09-20T20:00:00.000Z") },
    });
    const commandId = randomUUID();
    const created = await pausedApprovals.createRequest({
      accountId,
      command: {
        schemaVersion: SCHEMA_VERSION,
        commandId,
        actor: {
          principalId: accountId,
          productScope,
          audience: "agent",
          subject: { type: "account", id: accountId },
        },
        action: { kind: "game.contact.request", recipientKingdomId: randomUUID(), note: "Wait for world" },
        submittedAt: "2026-09-20T20:00:00.000Z",
      },
      effectsSummary: "Pending world command",
    });
    await expect(pausedApprovals.approve(sessionToken, created.approvalId)).rejects.toMatchObject({
      code: "NOT_COMMITTED",
    });
    expect((await pausedApprovals.review(created.approvalId, accountId)).status).toBe("pending");
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM command_receipts WHERE command_id = $1", [commandId])).rows,
    ).toEqual([{ count: 0 }]);
  });

  it("rejects GET-as-commit, commits once on double POST, and keeps status after disconnect", async () => {
    const { accountId, sessionToken } = await verifiedAccount(`approval-${randomUUID()}@example.com`);
    const commandId = randomUUID();
    const command = {
      schemaVersion: SCHEMA_VERSION,
      commandId,
      actor: {
        principalId: accountId,
        productScope,
        audience: "human" as const,
        subject: { type: "account" as const, id: accountId },
      },
      action: { kind: "sandbox.echo" as const, message: "needs approval" },
      submittedAt: "2026-09-20T20:00:00.000Z",
    };
    const created = await approvals.createRequest({
      accountId,
      command,
      effectsSummary: "Echo sandbox message",
    });
    expect(
      (await approvals.createRequest({ accountId, command, effectsSummary: "Echo sandbox message" })).approvalId,
    ).toBe(created.approvalId);
    await expect(
      approvals.createRequest({
        accountId,
        command: { ...command, action: { kind: "sandbox.echo", message: "changed terms" } },
        effectsSummary: "Changed",
      }),
    ).rejects.toMatchObject({ code: "INVALID_TERMS" });
    const outsider = await verifiedAccount(`approval-outsider-${randomUUID()}@example.com`);
    await expect(
      approvals.createRequest({
        accountId: outsider.accountId,
        command: {
          ...command,
          actor: {
            ...command.actor,
            principalId: outsider.accountId,
            subject: { type: "account", id: outsider.accountId },
          },
        },
        effectsSummary: "Outsider",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const reviewed = await approvals.review(created.approvalId, accountId);
    expect(reviewed.status).toBe("pending");
    expect(reviewed.deepLinkPath).toContain(created.approvalId);

    const first = await approvals.approve(sessionToken, created.approvalId);
    expect(first.status).toBe("approved");
    expect(first.receipt?.code).toBe("COMMITTED");
    const second = await approvals.approve(sessionToken, created.approvalId);
    expect(second.receipt).toEqual(first.receipt);

    const afterDisconnect = await approvals.review(created.approvalId, accountId);
    expect(afterDisconnect.status).toBe("approved");
    expect(afterDisconnect.receipt?.commandId).toBe(commandId);

    await expect(approvals.approve(sessionToken, randomUUID())).rejects.toBeInstanceOf(ApprovalError);

    const expired = await approvals.createRequest({
      accountId,
      command: {
        ...command,
        commandId: randomUUID(),
        action: { kind: "sandbox.echo", message: "expired" },
      },
      effectsSummary: "Expired",
    });
    await pool.query(`UPDATE approval_requests SET expires_at = $2 WHERE approval_id = $1`, [
      expired.approvalId,
      new Date("2026-09-20T19:00:00.000Z"),
    ]);
    await expect(approvals.approve(sessionToken, expired.approvalId)).rejects.toMatchObject({ code: "EXPIRED" });
    expect(
      (
        await pool.query(
          "SELECT status, resolved_at IS NOT NULL AS resolved FROM approval_requests WHERE approval_id = $1",
          [expired.approvalId],
        )
      ).rows,
    ).toEqual([{ status: "expired", resolved: true }]);
    await expect(approvals.approve(sessionToken, expired.approvalId)).rejects.toMatchObject({ code: "EXPIRED" });
    const expiredRejection = await approvals.createRequest({
      accountId,
      command: {
        ...command,
        commandId: randomUUID(),
        action: { kind: "sandbox.echo", message: "too late to reject" },
      },
      effectsSummary: "Expired rejection",
    });
    await pool.query("UPDATE approval_requests SET expires_at = $2 WHERE approval_id = $1", [
      expiredRejection.approvalId,
      new Date("2026-09-20T19:00:00.000Z"),
    ]);
    await expect(approvals.reject(sessionToken, expiredRejection.approvalId)).rejects.toMatchObject({
      code: "EXPIRED",
    });
    expect(
      (
        await pool.query(
          "SELECT status, resolved_at IS NOT NULL AS resolved FROM approval_requests WHERE approval_id = $1",
          [expiredRejection.approvalId],
        )
      ).rows,
    ).toEqual([{ status: "expired", resolved: true }]);
  });

  it("serializes rejection behind an in-flight human approval", async () => {
    const { accountId, sessionToken } = await verifiedAccount(`approval-race-${randomUUID()}@example.com`);
    const commandId = randomUUID();
    let releaseDispatch = () => {};
    let signalDispatch = () => {};
    const dispatchGate = new Promise<void>((resolve) => {
      releaseDispatch = resolve;
    });
    const dispatchEntered = new Promise<void>((resolve) => {
      signalDispatch = resolve;
    });
    const pausedDispatcher = {
      dispatch: async (...args: Parameters<CommandDispatcher["dispatch"]>) => {
        signalDispatch();
        await dispatchGate;
        return dispatcher.dispatch(...args);
      },
    } as CommandDispatcher;
    const racingApprovals = new ApprovalService(pool, {
      productScope: "pact",
      identity,
      dispatcher: pausedDispatcher,
      clock: { now: () => new Date("2026-09-20T20:00:00.000Z") },
      inbox,
    });
    const created = await racingApprovals.createRequest({
      accountId,
      command: {
        schemaVersion: SCHEMA_VERSION,
        commandId,
        actor: { principalId: accountId, productScope, audience: "human", subject: { type: "account", id: accountId } },
        action: { kind: "sandbox.echo", message: "one resolution" },
        submittedAt: "2026-09-20T20:00:00.000Z",
      },
      effectsSummary: "Echo once",
    });
    const approving = racingApprovals.approve(sessionToken, created.approvalId);
    await dispatchEntered;
    const rejecting = racingApprovals.reject(sessionToken, created.approvalId);
    const approvingAgain = racingApprovals.approve(sessionToken, created.approvalId);
    try {
      const early = await Promise.race([
        rejecting.then(
          () => "resolved",
          () => "resolved",
        ),
        new Promise<string>((resolve) => setTimeout(() => resolve("waiting"), 75)),
      ]);
      expect(early).toBe("waiting");
    } finally {
      releaseDispatch();
    }
    const first = await approving;
    expect(first.status).toBe("approved");
    expect((await approvingAgain).receipt).toEqual(first.receipt);
    await expect(rejecting).rejects.toMatchObject({ code: "ALREADY_RESOLVED" });
    expect(
      (await pool.query("SELECT status FROM approval_requests WHERE approval_id = $1", [created.approvalId])).rows,
    ).toEqual([{ status: "approved" }]);
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM command_receipts WHERE command_id = $1", [commandId])).rows,
    ).toEqual([{ count: 1 }]);
    expect(
      (
        await pool.query(
          "SELECT payload->>'status' AS status FROM outbox_events WHERE type = 'approval.resolved.v1' AND payload->>'approvalId' = $1",
          [created.approvalId],
        )
      ).rows,
    ).toEqual([{ status: "approved" }]);
    expect(
      (
        await pool.query(
          "SELECT payload->'payload'->>'status' AS status FROM inbox_events WHERE type = 'approval.resolved.v1' AND account_id = $1 AND payload->'payload'->>'approvalId' = $2",
          [accountId, created.approvalId],
        )
      ).rows,
    ).toEqual([{ status: "approved" }]);
  });
});

describe("PACT-022 inbox", () => {
  it("returns ordered events on reconnect without duplicates and never touches providers", async () => {
    const { accountId } = await verifiedAccount(`inbox-${randomUUID()}@example.com`);
    const firstId = await inbox.publish(accountId, "approval.requested.v1", { n: 1 });
    const secondId = await inbox.publish(accountId, "approval.resolved.v1", { n: 2 });
    const client = await pool.connect();
    try {
      await inbox.publishForAccount(client, {
        accountId,
        type: "approval.requested.v1",
        payload: { n: 1 },
        eventId: firstId,
      });
    } finally {
      client.release();
    }

    const page1 = await inbox.list(accountId, undefined, 10);
    expect(page1.events.map((e) => e.eventId)).toEqual([firstId, secondId]);
    const firstEvent = page1.events[0];
    const secondEvent = page1.events[1];
    expect(firstEvent).toBeDefined();
    expect(secondEvent).toBeDefined();
    if (!firstEvent || !secondEvent) throw new Error("expected two inbox events");
    const ack = await inbox.acknowledge(accountId, firstEvent.sequence);
    expect(ack.lastSequence).toBe(firstEvent.sequence);

    const page2 = await inbox.list(accountId, firstEvent.sequence, 10);
    expect(page2.events.map((e) => e.eventId)).toEqual([secondId]);

    const expired = await new InboxService(pool, {
      productScope: "pact",
      clock: { now: () => new Date() },
      retentionFloorSequence: Number(secondEvent.sequence) + 1,
    }).list(accountId, "1", 10);
    expect(expired.resyncRequired).toBe(true);

    inbox.assertNoProviderInvocation();
  });
});

describe("ChatGPT MCP App boundary", () => {
  it("serves the UI and private notes only through an owner-bound session and scope", async () => {
    const { accountId } = await verifiedAccount(`chatgpt-${randomUUID()}@example.test`);
    const principal = { accountId, productScope, audience: "agent" as const, agentScopes: ["world:read" as const] };
    const init = await mcp.handlePost(principal, {
      method: "initialize",
      id: 1,
      params: { protocolVersion: MCP_PROTOCOL_PRIMARY },
    });
    const session = init.sessionId;
    const list = await mcp.handlePost(principal, { method: "tools/list", id: 2 }, session);
    const tools = (list.response.result as { tools: { name: string; _meta: unknown; annotations: unknown }[] }).tools;
    expect(tools.find((t) => t.name === "pact_play_view_v1")).toMatchObject({
      _meta: {
        ui: { resourceUri: expect.stringMatching(/^ui:\/\/pact\/play-[a-f0-9]{16}\.html$/) },
        "openai/outputTemplate": expect.stringMatching(/^ui:\/\/pact\/play-[a-f0-9]{16}\.html$/),
      },
      annotations: { readOnlyHint: true },
    });
    expect(tools.some((t) => t.name === "pact_notes_write_v1")).toBe(false);
    const view = await mcp.handlePost(
      principal,
      { method: "tools/call", id: 3, params: { name: "pact_play_view_v1", arguments: {} } },
      session,
    );
    expect(view.response.result).toMatchObject({
      structuredContent: { world: { viewer: accountId }, untrustedContent: true },
    });
    const searched = await mcp.handlePost(
      principal,
      {
        method: "tools/call",
        id: 33,
        params: { name: "pact_play_view_v1", arguments: { search: "Cinder", offset: 8 } },
      },
      session,
    );
    expect(searched.response.result).toMatchObject({
      structuredContent: { discovery: { search: "Cinder", offset: 8 }, world: { viewer: accountId } },
    });
    for (const arguments_ of [
      { search: "x".repeat(81) },
      { offset: -1 },
      { offset: 1.5 },
      { offset: 10001 },
      { accountId: randomUUID() },
    ]) {
      await expect(
        mcp.handlePost(
          principal,
          { method: "tools/call", id: 34, params: { name: "pact_play_view_v1", arguments: arguments_ } },
          session,
        ),
      ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    }
    const html = await mcp.handlePost(
      principal,
      { method: "resources/read", id: 4, params: { uri: "ui://pact/play-v1.html" } },
      session,
    );
    expect(html.response.result).toMatchObject({
      contents: [{ mimeType: "text/html;profile=mcp-app", text: expect.stringContaining("ui/initialize") }],
    });
    const resourceList = await mcp.handlePost(principal, { method: "resources/list", id: 40 }, session);
    const uri = (resourceList.response.result as { resources: { uri: string }[] }).resources[0]?.uri;
    expect(uri).not.toBe("ui://pact/play-v1.html");
    const currentHtml = await mcp.handlePost(principal, { method: "resources/read", id: 41, params: { uri } }, session);
    expect(currentHtml.response.result).toMatchObject({
      contents: [{ uri, text: expect.stringContaining("Your negotiations") }],
    });
    await expect(
      mcp.handlePost(
        principal,
        { method: "resources/read", id: 42, params: { uri: "ui://pact/not-registered.html" } },
        session,
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      mcp.handlePost(
        principal,
        {
          method: "tools/call",
          id: 5,
          params: { name: "pact_notes_write_v1", arguments: { text: "anything", expectedVersion: 1 } },
        },
        session,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const writer = { ...principal, agentScopes: ["world:read" as const, "game:act" as const] };
    const save = await mcp.handlePost(
      writer,
      {
        method: "tools/call",
        id: 6,
        params: { name: "pact_notes_write_v1", arguments: { text: "anything", expectedVersion: 1 } },
      },
      session,
    );
    expect(save.response.result).toMatchObject({
      structuredContent: { text: "anything", viewer: accountId, saved: true },
    });
    await expect(
      mcp.handlePost(
        writer,
        {
          method: "tools/call",
          id: 7,
          params: {
            name: "pact_notes_write_v1",
            arguments: { text: "anything", expectedVersion: 1, accountId: randomUUID() },
          },
        },
        session,
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      mcp.handlePost(
        { ...writer, accountId: randomUUID() },
        { method: "resources/read", id: 8, params: { uri: "ui://pact/play-v1.html" } },
        session,
      ),
    ).rejects.toBeInstanceOf(McpError);
  });
});
