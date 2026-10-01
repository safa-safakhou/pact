import { randomUUID } from "node:crypto";
import { CommandDispatcher, SocialCommandHandler } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { IdentityError, type IdentityService } from "@pact/identity";
import {
  ActionLimitService,
  CourtInvitationDestination,
  CourtService,
  InvitationService,
  SocialService,
  SupplySettlementService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { McpTransport } from "@pact/mcp";
import { WorldClockService } from "@pact/world";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerInvitationRoutes } from "../../services/api/src/invitation-routes.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const scope = ProductScopeSchema.parse("pact");
const clock = { now: () => new Date("2026-10-01T12:00:00Z") };
let admin: Pool;
let pool: Pool;
let schema: string;
let courts: CourtService;
let dispatcher: CommandDispatcher;
let invitations: InvitationService;
let destination: CourtInvitationDestination;
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "court");
  pool = createSchemaPool(url, schema);
  const world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  await pool.query("UPDATE world_clocks SET next_tick_due_at=clock_timestamp()+interval '1 hour'");
  courts = new CourtService(pool, "pact", clock);
  destination = new CourtInvitationDestination("pact", clock, courts);
  invitations = new InvitationService(
    pool,
    "pact",
    new SocialService("pact", new ResourceLedger("pact"), new ActionLimitService("pact"), clock),
    clock,
    { court: destination },
  );
  dispatcher = new CommandDispatcher({
    pool,
    productScope: scope,
    clock,
    social: new SocialCommandHandler(invitations, courts),
    game: {
      admit: (op) => world.admitCommand((client, snapshot) => op(client, snapshot.gameTimeMs)),
      execute: async () => {
        throw new Error("UNEXPECTED_GAME");
      },
    },
  });
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});
async function player() {
  const accountId = randomUUID(),
    kingdomId = randomUUID(),
    handle = `court_${randomUUID().slice(0, 8)}`;
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture-only',$3,'v1')",
    [accountId, `${accountId}@example.test`, clock.now()],
  );
  await pool.query(
    "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Court Fixture','portrait.wolf',$4,0,0,60000,$5)",
    [kingdomId, accountId, handle, clock.now(), randomUUID()],
  );
  return { accountId, kingdomId, handle };
}
const principal = (accountId: string) => ({ accountId, productScope: scope, audience: "human" as const });
function command(accountId: string, action: Record<string, unknown>, commandId = randomUUID()) {
  return dispatcher.dispatchSocial(principal(accountId), { schemaVersion: "pact.court-command.v1", commandId, action });
}
async function create(p: Awaited<ReturnType<typeof player>>, joinMode = "open", handle = p.handle) {
  const result = await command(p.accountId, {
    kind: "court.create",
    handle,
    title: "Test Court",
    description: "No shared armies",
    joinMode,
  });
  return (result.result as { courtId: string }).courtId;
}
async function members(id: string) {
  return (await pool.query("SELECT kingdom_id,role FROM court_memberships WHERE court_id=$1 ORDER BY kingdom_id", [id]))
    .rows;
}

describe("Court community commands", () => {
  it("preserves real contacts, resources, troop ownership and continuing supply delivery when leaving/removing/closing", async () => {
    const a = await player(),
      b = await player();
    const id = await create(a);
    const ledger = new ResourceLedger("pact");
    await withTransaction(pool, async (client) => {
      for (const p of [a, b]) await ledger.initializeKingdom(client, p.kingdomId, 0);
      await ledger.creditOrdinary(client, {
        kingdomId: a.kingdomId,
        resource: "silver",
        amount: 4800n,
        operationKey: randomUUID(),
        reason: "fixture",
        gameTimeMs: 0,
      });
    });
    const parties = [a.kingdomId, b.kingdomId].sort();
    await pool.query(
      "INSERT INTO social_contacts(product_scope,kingdom_a,kingdom_b,accepted_game_time_ms) VALUES('pact',$1,$2,0)",
      parties,
    );
    const offerId = randomUUID(),
      contractId = randomUUID();
    const terms = {
      aToB: { resource: "silver", wholePerHour: 8 },
      bToA: null,
      aBond: null,
      bBond: null,
      durationHours: 1,
      noticeHours: 0,
    };
    await pool.query(
      "INSERT INTO supply_offers(id,product_scope,kingdom_a,kingdom_b,version,terms,status,expires_game_time_ms,created_game_time_ms,updated_game_time_ms) VALUES($1,'pact',$2,$3,1,$4::jsonb,'active',60000,0,0)",
      [offerId, a.kingdomId, b.kingdomId, JSON.stringify(terms)],
    );
    await pool.query(
      "INSERT INTO supply_contracts(id,product_scope,offer_id,offer_version,kingdom_a,kingdom_b,terms,start_game_time_ms,end_game_time_ms,status) VALUES($1,'pact',$2,1,$3,$4,$5::jsonb,60000,3660000,'active')",
      [contractId, offerId, a.kingdomId, b.kingdomId, JSON.stringify(terms)],
    );
    const unitId = randomUUID();
    await pool.query(
      "INSERT INTO kingdom_troops(id,product_scope,owner_kingdom_id,host_kingdom_id,type,home_guard,placement,created_game_time_ms,created_at) VALUES($1,'pact',$2,$2,'spearman',false,'home',0,$3)",
      [unitId, b.kingdomId, clock.now()],
    );
    async function independentState() {
      return {
        stocks: (
          await pool.query(
            "SELECT * FROM resource_balances WHERE kingdom_id=ANY($1::uuid[]) ORDER BY kingdom_id,resource",
            [[a.kingdomId, b.kingdomId]],
          )
        ).rows,
        contact: (await pool.query("SELECT * FROM social_contacts WHERE kingdom_a=$1 AND kingdom_b=$2", parties)).rows,
        contract: (await pool.query("SELECT * FROM supply_contracts WHERE id=$1", [contractId])).rows,
        troops: (await pool.query("SELECT * FROM kingdom_troops WHERE id=$1", [unitId])).rows,
      };
    }
    const before = await independentState();
    await command(b.accountId, { kind: "court.join", courtId: id });
    await command(b.accountId, { kind: "court.leave", courtId: id });
    expect(await independentState()).toEqual(before);
    await command(b.accountId, { kind: "court.join", courtId: id });
    await command(a.accountId, { kind: "court.remove", courtId: id, kingdomId: b.kingdomId });
    expect(await independentState()).toEqual(before);
    await command(b.accountId, { kind: "court.join", courtId: id });
    await command(a.accountId, { kind: "court.close", courtId: id });
    expect(await independentState()).toEqual(before);
    const settlement = new SupplySettlementService("pact", ledger, { read: async () => 0n });
    await withTransaction(pool, async (client) => {
      await settlement.capture(client, 60000);
      await settlement.settleDeliveries(client, 60000);
    });
    expect(
      (
        await pool.query("SELECT ordinary_units FROM resource_balances WHERE kingdom_id=$1 AND resource='silver'", [
          b.kingdomId,
        ])
      ).rows[0].ordinary_units,
    ).toBe("80");
    expect((await independentState()).contract[0].status).toBe("active");
  });
  it("leaves a requested admission pending when the applicant fills their capacity elsewhere", async () => {
    const owner = await player(),
      p = await player();
    const id = await create(owner, "request");
    await command(p.accountId, { kind: "court.request", courtId: id });
    for (let i = 0; i < 3; i++) {
      const other = await player();
      const joined = await create(other);
      await command(p.accountId, { kind: "court.join", courtId: joined });
    }
    const commandId = randomUUID();
    await expect(
      command(
        owner.accountId,
        { kind: "court.answer-request", courtId: id, kingdomId: p.kingdomId, accept: true },
        commandId,
      ),
    ).rejects.toMatchObject({ code: "COURT_MEMBERSHIP_LIMIT" });
    expect(
      (await pool.query("SELECT * FROM court_requests WHERE court_id=$1 AND kingdom_id=$2", [id, p.kingdomId]))
        .rowCount,
    ).toBe(1);
    expect(await dispatcher.lookupReceipt(principal(owner.accountId), commandId)).toBeNull();
    await command(owner.accountId, {
      kind: "court.answer-request",
      courtId: id,
      kingdomId: p.kingdomId,
      accept: false,
    });
  });
  it("rolls the Court, owner membership, audit and shared receipt back together on a persistence fault", async () => {
    const p = await player();
    const commandId = randomUUID();
    await pool.query(
      "CREATE FUNCTION reject_court_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture fault'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER reject_court_audit BEFORE INSERT ON court_audit FOR EACH ROW EXECUTE FUNCTION reject_court_audit()",
    );
    try {
      await expect(
        command(
          p.accountId,
          { kind: "court.create", handle: p.handle, title: "Fault fixture", description: "", joinMode: "open" },
          commandId,
        ),
      ).rejects.toThrow("fixture fault");
    } finally {
      await pool.query("DROP TRIGGER reject_court_audit ON court_audit");
      await pool.query("DROP FUNCTION reject_court_audit()");
    }
    expect((await pool.query("SELECT * FROM courts WHERE owner_kingdom_id=$1", [p.kingdomId])).rowCount).toBe(0);
    expect(await dispatcher.lookupReceipt(principal(p.accountId), commandId)).toBeNull();
    await command(
      p.accountId,
      { kind: "court.create", handle: p.handle, title: "Fault fixture", description: "", joinMode: "open" },
      commandId,
    );
  });
  it("creates in a separate handle namespace, validates payload and shares receipts", async () => {
    const p = await player();
    const commandId = randomUUID();
    const action = { kind: "court.create", handle: p.handle, title: "Test Court", description: "", joinMode: "open" };
    const result = await command(p.accountId, action, commandId);
    const id = (result.result as { courtId: string }).courtId;
    expect(id[14]).toBe("7");
    expect((await members(id))[0]).toEqual({ kingdom_id: p.kingdomId, role: "owner" });
    expect((await command(p.accountId, action, commandId)).receipt).toEqual(result.receipt);
    expect((await command(p.accountId, { ...action, title: "changed" }, commandId)).receipt.code).toBe(
      "IDEMPOTENCY_CONFLICT",
    );
    await expect(create(p)).rejects.toMatchObject({ code: "COURT_OWNERSHIP_LIMIT" });
    await expect(command(p.accountId, { kind: "court.join", courtId: id, ownerId: p.kingdomId })).rejects.toMatchObject(
      { code: "INVALID_COMMAND" },
    );
    await expect(
      dispatcher.dispatchSocial(
        { ...principal(p.accountId), audience: "agent", agentScopes: ["game:act"] },
        { schemaVersion: "pact.court-command.v1", commandId: randomUUID(), action },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects colliding Court handles concurrently without losing receipts", async () => {
    const a = await player(),
      b = await player();
    const handle = `unique_${randomUUID().slice(0, 8)}`;
    const results = await Promise.allSettled([create(a, "open", handle), create(b, "open", handle)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((x) => x.status === "rejected")).toHaveLength(1);
  });
  it("enforces three active memberships under concurrent direct and invitation joins", async () => {
    const owners = await Promise.all(Array.from({ length: 4 }, () => player()));
    const ids: string[] = [];
    for (const p of owners) ids.push(await create(p));
    const p = await player();
    for (const id of ids.slice(0, 2)) await command(p.accountId, { kind: "court.join", courtId: id });
    const invitationOwner = owners[3];
    const invitationCourt = ids[3];
    if (!invitationOwner || !invitationCourt) throw new Error("MISSING_FIXTURE");
    const link = await withTransaction(pool, (client) =>
      invitations.issue(
        client,
        invitationOwner.accountId,
        { destinationType: "court", destinationId: invitationCourt },
        0,
      ),
    );
    const results = await Promise.allSettled([
      command(p.accountId, { kind: "court.join", courtId: ids[2] }),
      dispatcher.dispatchSocial(principal(p.accountId), {
        schemaVersion: "pact.social-command.v1",
        commandId: randomUUID(),
        action: { kind: "invitation.accept", token: link.token },
      }),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await pool.query("SELECT * FROM court_memberships WHERE kingdom_id=$1", [p.kingdomId])).rowCount).toBe(3);
    await expect(create(p)).rejects.toMatchObject({ code: "COURT_MEMBERSHIP_LIMIT" });
  });
  it("requires requests, rechecks capacity and distinguishes invitation-only membership", async () => {
    const owner = await player(),
      p = await player();
    const id = await create(owner, "request");
    await expect(command(p.accountId, { kind: "court.join", courtId: id })).rejects.toMatchObject({
      code: "REQUEST_REQUIRED",
    });
    await command(p.accountId, { kind: "court.request", courtId: id });
    expect(await courts.read(owner.handle, 0, p.accountId)).toMatchObject({
      requested: true,
      viewerRole: null,
      requests: [],
    });
    await command(owner.accountId, { kind: "court.answer-request", courtId: id, kingdomId: p.kingdomId, accept: true });
    expect(await courts.read(owner.handle, 0, p.accountId)).toMatchObject({ requested: false, viewerRole: "member" });
    const privateOwner = await player();
    const privateId = await create(privateOwner, "invitation_only");
    await expect(command(p.accountId, { kind: "court.request", courtId: privateId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const link = await withTransaction(pool, (client) =>
      invitations.issue(client, privateOwner.accountId, { destinationType: "court", destinationId: privateId }, 0),
    );
    await dispatcher.dispatchSocial(principal(p.accountId), {
      schemaVersion: "pact.social-command.v1",
      commandId: randomUUID(),
      action: { kind: "invitation.accept", token: link.token },
    });
    expect((await members(privateId)).find((m) => m.kingdom_id === p.kingdomId)?.role).toBe("member");
    expect(
      (await pool.query("SELECT * FROM social_contacts WHERE kingdom_a=$1 OR kingdom_b=$1", [p.kingdomId])).rowCount,
    ).toBe(0);
  });
  it("bounds moderators, forbids moderator seizure/removal of peers, and audits roles/removal", async () => {
    const owner = await player(),
      p = await player(),
      peer = await player();
    const id = await create(owner);
    for (const x of [p, peer]) {
      await command(x.accountId, { kind: "court.join", courtId: id });
      await command(owner.accountId, { kind: "court.role", courtId: id, kingdomId: x.kingdomId, role: "moderator" });
    }
    for (const target of [owner, peer])
      await expect(
        command(p.accountId, { kind: "court.remove", courtId: id, kingdomId: target.kingdomId }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      command(p.accountId, { kind: "court.role", courtId: id, kingdomId: peer.kingdomId, role: "member" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (let i = 0; i < 8; i++) {
      const x = await player();
      await command(x.accountId, { kind: "court.join", courtId: id });
      await command(owner.accountId, { kind: "court.role", courtId: id, kingdomId: x.kingdomId, role: "moderator" });
    }
    const extra = await player();
    await command(extra.accountId, { kind: "court.join", courtId: id });
    await expect(
      command(owner.accountId, { kind: "court.role", courtId: id, kingdomId: extra.kingdomId, role: "moderator" }),
    ).rejects.toMatchObject({ code: "COURT_MODERATOR_LIMIT" });
    await command(p.accountId, { kind: "court.remove", courtId: id, kingdomId: extra.kingdomId });
    expect((await pool.query("SELECT * FROM court_audit WHERE court_id=$1 AND kind='court.role'", [id])).rowCount).toBe(
      10,
    );
    expect(
      (await pool.query("SELECT * FROM court_audit WHERE court_id=$1 AND kind='court.remove'", [id])).rowCount,
    ).toBe(1);
  });
  it("requires the current target's explicit consent and invalidates replaced or removed transfer proposals", async () => {
    const a = await player(),
      b = await player(),
      c = await player();
    const id = await create(a);
    for (const p of [b, c]) await command(p.accountId, { kind: "court.join", courtId: id });
    await expect(command(a.accountId, { kind: "court.leave", courtId: id })).rejects.toMatchObject({
      code: "OWNER_MUST_TRANSFER_OR_CLOSE",
    });
    await command(a.accountId, { kind: "court.transfer-propose", courtId: id, kingdomId: b.kingdomId });
    const old = (await pool.query("SELECT id FROM court_transfers WHERE court_id=$1", [id])).rows[0].id;
    await expect(
      command(a.accountId, { kind: "court.transfer-answer", courtId: id, proposalId: old, accept: true }),
    ).rejects.toMatchObject({ code: "TRANSFER_UNAVAILABLE" });
    await command(a.accountId, { kind: "court.transfer-propose", courtId: id, kingdomId: c.kingdomId });
    await expect(
      command(b.accountId, { kind: "court.transfer-answer", courtId: id, proposalId: old, accept: true }),
    ).rejects.toMatchObject({ code: "TRANSFER_UNAVAILABLE" });
    await command(c.accountId, { kind: "court.leave", courtId: id });
    expect((await pool.query("SELECT * FROM court_transfers WHERE court_id=$1", [id])).rowCount).toBe(0);
    await command(a.accountId, { kind: "court.transfer-propose", courtId: id, kingdomId: b.kingdomId });
    const proposalId = (await pool.query("SELECT id FROM court_transfers WHERE court_id=$1", [id])).rows[0].id;
    const body = { kind: "court.transfer-answer", courtId: id, proposalId, accept: true };
    const commandId = randomUUID();
    const result = await command(b.accountId, body, commandId);
    expect((await command(b.accountId, body, commandId)).receipt).toEqual(result.receipt);
    expect((await members(id)).find((x) => x.kingdom_id === b.kingdomId)?.role).toBe("owner");
    await command(a.accountId, { kind: "court.leave", courtId: id });
  });
  it("forbids a second active ownership via transfer and replays closure safely", async () => {
    const a = await player(),
      b = await player();
    const id = await create(a);
    await create(b);
    await command(b.accountId, { kind: "court.join", courtId: id });
    await command(a.accountId, { kind: "court.transfer-propose", courtId: id, kingdomId: b.kingdomId });
    const proposalId = (await pool.query("SELECT id FROM court_transfers WHERE court_id=$1", [id])).rows[0].id;
    await expect(
      command(b.accountId, { kind: "court.transfer-answer", courtId: id, proposalId, accept: true }),
    ).rejects.toMatchObject({ code: "COURT_OWNERSHIP_LIMIT" });
    const commandId = randomUUID(),
      action = { kind: "court.close", courtId: id };
    await command(a.accountId, action, commandId);
    expect((await command(a.accountId, action, commandId)).receipt.code).toBe("COMMITTED");
    await expect(command(b.accountId, { kind: "court.join", courtId: id })).rejects.toMatchObject({
      code: "COURT_UNAVAILABLE",
    });
    await command(b.accountId, { kind: "court.leave", courtId: id });
    expect(await courts.read(a.handle)).toMatchObject({ court: { status: "archived" } });
  });
  it("edits with source versions, publishes at most three Court-local pins, rolls back invalid attempts", async () => {
    const a = await player(),
      b = await player();
    const id = await create(a);
    for (let slot = 1; slot <= 3; slot++)
      await command(a.accountId, { kind: "court.pin", courtId: id, slot, body: `Public notice ${slot}` });
    await expect(command(a.accountId, { kind: "court.pin", courtId: id, slot: 4, body: "bad" })).rejects.toMatchObject({
      code: "INVALID_COMMAND",
    });
    await expect(command(b.accountId, { kind: "court.pin", courtId: id, slot: 1, body: "bad" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const edit = {
      kind: "court.edit",
      courtId: id,
      expectedVersion: 1,
      title: "Changed",
      description: "",
      joinMode: "request",
    };
    await expect(command(a.accountId, edit)).rejects.toMatchObject({ code: "STALE_VERSION" });
    const v = (await pool.query("SELECT version FROM courts WHERE id=$1", [id])).rows[0].version;
    await command(a.accountId, { ...edit, expectedVersion: v });
    expect(await courts.read(a.handle)).toMatchObject({
      pins: [{ slot: 1 }, { slot: 2 }, { slot: 3 }],
      court: { title: "Changed", join_mode: "request" },
    });
    await command(a.accountId, { kind: "court.unpin", courtId: id, slot: 2 });
  });
  it("archives deleted owners, clears their private pointers/prose and removes archives after 30 real days", async () => {
    const a = await player(),
      b = await player();
    const id = await create(a);
    await command(b.accountId, { kind: "court.join", courtId: id });
    await command(a.accountId, { kind: "court.pin", courtId: id, slot: 1, body: "Owned public prose" });
    expect(await withTransaction(pool, (c) => destination.exportAccount(c, a.accountId))).toMatchObject({
      memberships: [{ role: "owner" }],
      pins: [{ body: "Owned public prose" }],
    });
    await withTransaction(pool, (c) => destination.forgetAccount(c, a.accountId));
    expect(await courts.read(a.handle)).toMatchObject({ court: { status: "archived" }, pins: [] });
    expect((await members(id)).find((x) => x.kingdom_id === b.kingdomId)).toBeDefined();
    await withTransaction(pool, async (c) => {
      await destination.prune(c, new Date("2026-10-30T12:00:00Z"));
    });
    expect((await members(id)).length).toBe(1);
    await withTransaction(pool, async (c) => {
      await destination.prune(c, new Date("2026-10-31T12:00:00Z"));
    });
    expect(await courts.read(a.handle)).toEqual({ found: false });
  });
  it("uses the same paginated private-safe projection over HTTP and MCP", async () => {
    const a = await player(),
      b = await player();
    const id = await create(a, "request");
    await command(b.accountId, { kind: "court.request", courtId: id });
    // Additional synthetic roster fixtures test pagination only, not gameplay admission.
    for (let i = 0; i < 51; i++) {
      const p = await player();
      await pool.query(
        "INSERT INTO court_memberships(court_id,kingdom_id,role,joined_game_time_ms) VALUES($1,$2,'member',0)",
        [id, p.kingdomId],
      );
    }
    const first = (await courts.read(a.handle, 0, a.accountId)) as { roster: unknown[]; nextOffset: number };
    expect(first.roster).toHaveLength(50);
    expect(first.nextOffset).toBe(50);
    const second = (await courts.read(a.handle, 50)) as { roster: unknown[]; nextOffset: null };
    expect(second.roster).toHaveLength(2);
    expect(second.nextOffset).toBeNull();
    const server = Fastify();
    const identity = {
      authenticate: async () => ({ accountId: a.accountId }),
      authorizeCookieWrite: async (_s: string, csrf: string, origin: string) => {
        if (csrf !== "fixture" || origin !== "https://example.test") throw new IdentityError("FORBIDDEN");
        return { accountId: a.accountId };
      },
    } as unknown as IdentityService;
    registerInvitationRoutes(server, identity, dispatcher, invitations, async () => 0, courts);
    const http = await server.inject({
      method: "GET",
      url: `/v1/courts?handle=${a.handle}`,
      headers: { cookie: "pact_session=fixture" },
    });
    expect(http.statusCode).toBe(200);
    expect(http.headers["cache-control"]).toBe("no-store");
    expect(http.json()).toEqual(first);
    const mcp = new McpTransport({
      pool,
      origin: "https://example.test",
      dispatcher,
      productScope: scope,
      clock,
      courts: { read: (h, o, accountId) => courts.read(h, o, accountId) },
    });
    const agent = { ...principal(a.accountId), audience: "agent" as const, agentScopes: ["world:read"] as const };
    const init = await mcp.handlePost(agent, {
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "fixture", version: "1" } },
    });
    const read = await mcp.handlePost(
      agent,
      { id: 2, method: "tools/call", params: { name: "pact_court_read_v1", arguments: { handle: a.handle } } },
      init.sessionId,
    );
    expect((read.response.result as { structuredContent: unknown }).structuredContent).toEqual(first);
    const publicPage = await courts.read(a.handle);
    expect(publicPage).toMatchObject({ requests: [], transfers: [] });
    expect(JSON.stringify(publicPage)).not.toMatch(/password|stocks|balances|online|account_id/);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/v1/social/commands",
          headers: { cookie: "pact_session=fixture" },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await server.inject({ method: "GET", url: `/v1/courts?handle=${a.handle}&accountId=${b.accountId}` }))
        .statusCode,
    ).toBe(400);
    await server.close();
  });
});
