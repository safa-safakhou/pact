import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "@pact/application";
import { ApprovalError, ApprovalService } from "@pact/approvals";
import { ProductScopeSchema, SCHEMA_VERSION } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { InboxService } from "@pact/inbox";
import { MCP_PROTOCOL_PRIMARY, McpError, McpTransport } from "@pact/mcp";
import { RunService } from "@pact/runs";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
  dispatcher = new CommandDispatcher({ pool, clock, productScope });
  const runs = new RunService(pool, { productScope: "pact", clock });
  mcp = new McpTransport({
    pool,
    productScope: "pact",
    dispatcher,
    origin,
    clock,
    runLeases: runs,
    worldViews: {
      read: async (viewer, target, minutes) => ({ audience: "public", viewer, target, minutes }),
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
    const lease = await mcp.handlePost(
      principal,
      { method: "tools/call", id: 8, params: { name: "run.open", arguments: {} } },
      init.sessionId,
    );
    expect(JSON.stringify(lease.response)).toContain("leaseId");
    await expect(
      mcp.handlePost(
        principal,
        { method: "tools/call", id: 9, params: { name: "run.open", arguments: {} } },
        init.sessionId,
      ),
    ).rejects.toMatchObject({ code: "RUN_ALREADY_ACTIVE" });

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
    expect(JSON.stringify(readOnlyTools.response)).toContain("pact_world_read_v1");
    expect(JSON.stringify(readOnlyTools.response)).toContain("pact_report_read_v1");
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
    await expect(
      mcp.handlePost(
        readOnly,
        {
          method: "tools/call",
          id: 7,
          params: { name: "pact_world_read_v1", arguments: { targetKingdomId: randomUUID(), forecastMinutes: 61 } },
        },
        init.sessionId,
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
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
    mcp.assertOrigin(origin);
    expect(() => mcp.assertOrigin("https://evil.example")).toThrow(McpError);
  });
});

describe("PACT-020 approvals", () => {
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
