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
  PoliticsService,
  SocialService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { McpTransport } from "@pact/mcp";
import { WorldClockService } from "@pact/world";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerInvitationRoutes } from "../../services/api/src/invitation-routes.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const scope = ProductScopeSchema.parse("pact"),
  clock = { now: () => new Date("2026-10-01T14:00:00Z") };
let admin: Pool,
  pool: Pool,
  schema: string,
  politics: PoliticsService,
  courts: CourtService,
  dispatcher: CommandDispatcher,
  world: WorldClockService,
  invitations: InvitationService;
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "politics");
  pool = createSchemaPool(url, schema);
  world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  await pool.query("UPDATE world_clocks SET next_tick_due_at=clock_timestamp()+interval '1 hour'");
  politics = new PoliticsService(pool, "pact", clock);
  courts = new CourtService(pool, "pact", clock);
  invitations = new InvitationService(
    pool,
    "pact",
    new SocialService("pact", new ResourceLedger("pact"), new ActionLimitService("pact"), clock),
    clock,
    { court: new CourtInvitationDestination("pact", clock, courts) },
  );
  dispatcher = new CommandDispatcher({
    pool,
    productScope: scope,
    clock,
    social: new SocialCommandHandler(invitations, courts, politics),
    game: {
      admit: (op) => world.admitCommand((c, s) => op(c, s.gameTimeMs)),
      execute: async () => {
        throw new Error("UNEXPECTED");
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
    handle = `polit_${randomUUID().slice(0, 8)}`;
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture-only',$3,'v1')",
    [accountId, `${accountId}@example.test`, clock.now()],
  );
  await pool.query(
    "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Politics fixture','portrait.wolf',$4,0,0,60000,$5)",
    [kingdomId, accountId, handle, clock.now(), randomUUID()],
  );
  return { accountId, kingdomId, handle };
}
const principal = (accountId: string) => ({ accountId, productScope: scope, audience: "human" as const });
const write = (accountId: string, action: Record<string, unknown>, commandId = randomUUID()) =>
  dispatcher.dispatchSocial(principal(accountId), { schemaVersion: "pact.politics-command.v1", commandId, action });
async function propose(a: Awaited<ReturnType<typeof player>>, subject: string, patron: string) {
  return (await write(a.accountId, { kind: "allegiance.propose", subjectKingdomId: subject, patronKingdomId: patron }))
    .result as { recordId: string; version: number };
}
async function agree(a: Awaited<ReturnType<typeof player>>, b: Awaited<ReturnType<typeof player>>) {
  const p = await propose(a, a.kingdomId, b.kingdomId);
  await write(b.accountId, {
    kind: "allegiance.answer",
    proposalId: p.recordId,
    expectedVersion: p.version,
    accept: true,
  });
  return (await pool.query("SELECT id,version FROM allegiance_edges WHERE proposal_id=$1", [p.recordId])).rows[0] as {
    id: string;
    version: number;
  };
}
describe("human political gameplay", () => {
  it("publishes exact Unicode code-point declarations, replaces versions and hides withdrawn prose", async () => {
    const a = await player();
    const published = await write(a.accountId, {
      kind: "article.publish",
      title: "😀".repeat(60),
      body: "Signed exact prose",
    });
    const id = (published.result as { recordId: string }).recordId;
    const replaced = await write(a.accountId, {
      kind: "article.replace",
      articleId: id,
      expectedVersion: 1,
      title: "v2",
      body: "No tribute imposed",
    });
    const next = (replaced.result as { recordId: string }).recordId;
    expect((await pool.query("SELECT status FROM kingdom_articles WHERE id=$1", [id])).rows[0].status).toBe("replaced");
    await expect(
      write(a.accountId, { kind: "article.replace", articleId: id, expectedVersion: 1, title: "old", body: "old" }),
    ).rejects.toMatchObject({ code: "ARTICLE_UNAVAILABLE" });
    await expect(
      write(a.accountId, { kind: "article.withdraw", articleId: next, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    await write(a.accountId, { kind: "article.withdraw", articleId: next, expectedVersion: 2 });
    expect(await politics.read(a.handle, 0, undefined, 0)).toMatchObject({ articles: [] });
    await expect(
      write(a.accountId, { kind: "article.publish", title: "😀".repeat(61), body: "bad" }),
    ).rejects.toMatchObject({ code: "INVALID_COMMAND" });
  });
  it("enforces concurrent three-active limits and shares the six-publication quota with Court pins", async () => {
    const a = await player();
    for (let i = 0; i < 2; i++) await write(a.accountId, { kind: "article.publish", title: "Article", body: "Text" });
    const results = await Promise.allSettled([
      write(a.accountId, { kind: "article.publish", title: "Third", body: "Text" }),
      write(a.accountId, { kind: "article.publish", title: "Fourth", body: "Text" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const created = await dispatcher.dispatchSocial(principal(a.accountId), {
      schemaVersion: "pact.court-command.v1",
      commandId: randomUUID(),
      action: { kind: "court.create", handle: a.handle, title: "Test", description: "", joinMode: "open" },
    });
    const courtId = (created.result as { courtId: string }).courtId;
    for (let slot = 1; slot <= 3; slot++)
      await dispatcher.dispatchSocial(principal(a.accountId), {
        schemaVersion: "pact.court-command.v1",
        commandId: randomUUID(),
        action: { kind: "court.pin", courtId, slot, body: "Pinned public prose" },
      });
    const old = (
      await pool.query(
        "SELECT id,version FROM kingdom_articles WHERE author_kingdom_id=$1 AND status='active' LIMIT 1",
        [a.kingdomId],
      )
    ).rows[0];
    await expect(
      write(a.accountId, {
        kind: "article.replace",
        articleId: old.id,
        expectedVersion: old.version,
        title: "Quota",
        body: "bad",
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await write(a.accountId, { kind: "article.withdraw", articleId: old.id, expectedVersion: old.version });
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM kingdom_action_events WHERE kingdom_id=$1 AND kind='public_post'",
          [a.kingdomId],
        )
      ).rows[0].n,
    ).toBe(6);
  });
  it("requires the second human, invalidates edited signatures and respects game-time expiry", async () => {
    const a = await player(),
      b = await player(),
      c = await player();
    const p = await propose(a, a.kingdomId, b.kingdomId);
    await expect(
      write(a.accountId, { kind: "allegiance.answer", proposalId: p.recordId, expectedVersion: 1, accept: true }),
    ).rejects.toMatchObject({ code: "PROPOSAL_UNAVAILABLE" });
    await write(a.accountId, {
      kind: "allegiance.revise",
      proposalId: p.recordId,
      expectedVersion: 1,
      subjectKingdomId: a.kingdomId,
      patronKingdomId: c.kingdomId,
    });
    await expect(
      write(b.accountId, { kind: "allegiance.answer", proposalId: p.recordId, expectedVersion: 1, accept: true }),
    ).rejects.toMatchObject({ code: "PROPOSAL_UNAVAILABLE" });
    await expect(
      write(c.accountId, { kind: "allegiance.answer", proposalId: p.recordId, expectedVersion: 1, accept: true }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    await withTransaction(pool, async (client) => {
      await client.query("UPDATE allegiance_proposals SET expires_game_time_ms=0 WHERE id=$1", [p.recordId]);
    });
    await expect(
      write(c.accountId, { kind: "allegiance.answer", proposalId: p.recordId, expectedVersion: 2, accept: true }),
    ).rejects.toMatchObject({ code: "EXPIRED" });
  });
  it("rejects racing second patrons and competing cycles", async () => {
    const a = await player(),
      b = await player(),
      c = await player();
    const p1 = await propose(a, a.kingdomId, b.kingdomId),
      p2 = await propose(a, a.kingdomId, c.kingdomId);
    const race = await Promise.allSettled([
      write(b.accountId, { kind: "allegiance.answer", proposalId: p1.recordId, expectedVersion: 1, accept: true }),
      write(c.accountId, { kind: "allegiance.answer", proposalId: p2.recordId, expectedVersion: 1, accept: true }),
    ]);
    expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const x = await player(),
      y = await player();
    const xy = await propose(x, x.kingdomId, y.kingdomId),
      yx = await propose(y, y.kingdomId, x.kingdomId);
    const cycle = await Promise.allSettled([
      write(y.accountId, { kind: "allegiance.answer", proposalId: xy.recordId, expectedVersion: 1, accept: true }),
      write(x.accountId, { kind: "allegiance.answer", proposalId: yx.recordId, expectedVersion: 1, accept: true }),
    ]);
    expect(cycle.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((cycle.find((r) => r.status === "rejected") as PromiseRejectedResult).reason.code).toBe("ALLEGIANCE_CYCLE");
  });
  it("rejects long cycles/self/outsiders/blocks, allows either party to end and rejects stale edge identity", async () => {
    const a = await player(),
      b = await player(),
      c = await player(),
      outsider = await player();
    await expect(propose(a, a.kingdomId, a.kingdomId)).rejects.toMatchObject({ code: "INVALID_ALLEGIANCE" });
    await expect(propose(outsider, a.kingdomId, b.kingdomId)).rejects.toMatchObject({ code: "INVALID_ALLEGIANCE" });
    const edge = await agree(a, b);
    await agree(b, c);
    const loop = await propose(c, c.kingdomId, a.kingdomId);
    await expect(
      write(a.accountId, { kind: "allegiance.answer", proposalId: loop.recordId, expectedVersion: 1, accept: true }),
    ).rejects.toMatchObject({ code: "ALLEGIANCE_CYCLE" });
    const end = { kind: "allegiance.end", edgeId: edge.id, subjectKingdomId: a.kingdomId, expectedVersion: 1 };
    await expect(write(outsider.accountId, end)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const cmd = randomUUID();
    await write(b.accountId, end, cmd);
    expect((await write(b.accountId, end, cmd)).receipt.code).toBe("COMMITTED");
    await agree(a, c);
    await expect(write(a.accountId, end)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const blockA = await player(),
      blockB = await player();
    await pool.query("INSERT INTO social_blocks VALUES('pact',$1,$2,0)", [blockA.kingdomId, blockB.kingdomId]);
    await expect(propose(blockA, blockA.kingdomId, blockB.kingdomId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("does not couple an actual allegiance to Court membership, troops, contracts or resource authority", async () => {
    const a = await player(),
      b = await player();
    const edge = await agree(a, b);
    const create = await dispatcher.dispatchSocial(principal(a.accountId), {
      schemaVersion: "pact.court-command.v1",
      commandId: randomUUID(),
      action: { kind: "court.create", handle: a.handle, title: "Test", description: "", joinMode: "open" },
    });
    const courtId = (create.result as { courtId: string }).courtId;
    for (const kind of ["court.join", "court.leave", "court.join"])
      await dispatcher.dispatchSocial(principal(b.accountId), {
        schemaVersion: "pact.court-command.v1",
        commandId: randomUUID(),
        action: { kind, courtId },
      });
    await dispatcher.dispatchSocial(principal(a.accountId), {
      schemaVersion: "pact.court-command.v1",
      commandId: randomUUID(),
      action: { kind: "court.close", courtId },
    });
    expect((await pool.query("SELECT status FROM allegiance_edges WHERE id=$1", [edge.id])).rows[0].status).toBe(
      "active",
    );
    for (const table of ["supply_contracts", "garrison_contracts", "kingdom_troops", "social_contacts"])
      expect((await pool.query(`SELECT 1 FROM ${table}`)).rowCount).toBe(0);
    await write(a.accountId, {
      kind: "article.publish",
      title: "Tribute demand",
      body: "Give me everything and I command your troops",
    });
    for (const table of ["supply_contracts", "garrison_contracts", "kingdom_troops", "social_contacts"])
      expect((await pool.query(`SELECT 1 FROM ${table}`)).rowCount).toBe(0);
  });
  it("preserves existing stock, troops and a real supply contract across publication and allegiance termination", async () => {
    const a = await player(),
      b = await player();
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
    const offerId = randomUUID(),
      contractId = randomUUID(),
      unitId = randomUUID();
    const terms = JSON.stringify({
      aToB: { resource: "silver", wholePerHour: 8 },
      bToA: null,
      aBond: null,
      bBond: null,
      durationHours: 1,
      noticeHours: 0,
    });
    await pool.query(
      "INSERT INTO supply_offers(id,product_scope,kingdom_a,kingdom_b,version,terms,status,expires_game_time_ms,created_game_time_ms,updated_game_time_ms) VALUES($1,'pact',$2,$3,1,$4::jsonb,'active',60000,0,0)",
      [offerId, a.kingdomId, b.kingdomId, terms],
    );
    await pool.query(
      "INSERT INTO supply_contracts(id,product_scope,offer_id,offer_version,kingdom_a,kingdom_b,terms,start_game_time_ms,end_game_time_ms,status) VALUES($1,'pact',$2,1,$3,$4,$5::jsonb,60000,3660000,'active')",
      [contractId, offerId, a.kingdomId, b.kingdomId, terms],
    );
    await pool.query(
      "INSERT INTO kingdom_troops(id,product_scope,owner_kingdom_id,host_kingdom_id,type,home_guard,placement,created_game_time_ms,created_at) VALUES($1,'pact',$2,$2,'spearman',false,'home',0,$3)",
      [unitId, a.kingdomId, clock.now()],
    );
    const snapshot = async () => ({
      balances: (
        await pool.query(
          "SELECT * FROM resource_balances WHERE kingdom_id=ANY($1::uuid[]) ORDER BY kingdom_id,resource",
          [[a.kingdomId, b.kingdomId]],
        )
      ).rows,
      contract: (await pool.query("SELECT * FROM supply_contracts WHERE id=$1", [contractId])).rows,
      troop: (await pool.query("SELECT * FROM kingdom_troops WHERE id=$1", [unitId])).rows,
    });
    const before = await snapshot(),
      edge = await agree(a, b);
    const article = await write(a.accountId, {
      kind: "article.publish",
      title: "Tribute claim",
      body: "This is only prose, not a permission",
    });
    await write(a.accountId, {
      kind: "article.withdraw",
      articleId: (article.result as { recordId: string }).recordId,
      expectedVersion: 1,
    });
    await write(b.accountId, {
      kind: "allegiance.end",
      edgeId: edge.id,
      subjectKingdomId: a.kingdomId,
      expectedVersion: 1,
    });
    expect(await snapshot()).toEqual(before);
  });
  it("keeps pending proposals private and provides identical safe HTTP/MCP public reads", async () => {
    const a = await player(),
      b = await player(),
      c = await player();
    await propose(a, a.kingdomId, b.kingdomId);
    await write(a.accountId, { kind: "article.publish", title: "Policy", body: "Untrusted prose" });
    expect(await politics.read(a.handle, 0, c.accountId, 0)).toMatchObject({ pending: [] });
    const server = Fastify(),
      identity = {
        authenticate: async () => ({ accountId: a.accountId }),
        authorizeCookieWrite: async () => {
          throw new IdentityError("FORBIDDEN");
        },
      } as unknown as IdentityService;
    registerInvitationRoutes(server, identity, dispatcher, invitations, async () => 0, courts, politics);
    const expected = await politics.read(a.handle, 0, a.accountId, 0);
    const response = await server.inject({
      method: "GET",
      url: `/v1/politics?handle=${a.handle.toUpperCase()}`,
      headers: { cookie: "pact_session=fixture" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expected);
    expect(response.headers["cache-control"]).toBe("no-store");
    const mcp = new McpTransport({
      pool,
      dispatcher,
      productScope: scope,
      clock,
      origin: "https://example.test",
      politics: { read: (h, o, account) => politics.read(h, o, account, 0) },
    });
    const agent = { ...principal(a.accountId), audience: "agent" as const, agentScopes: ["world:read"] as const };
    const init = await mcp.handlePost(agent, {
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", clientInfo: { name: "fixture", version: "1" }, capabilities: {} },
    });
    const result = await mcp.handlePost(
      agent,
      { id: 2, method: "tools/call", params: { name: "pact_politics_read_v1", arguments: { handle: a.handle } } },
      init.sessionId,
    );
    expect((result.response.result as { structuredContent: unknown }).structuredContent).toEqual(expected);
    expect(JSON.stringify(expected)).not.toMatch(/password|stocks|online|account_id|troops/);
    await expect(
      dispatcher.dispatchSocial(
        { ...principal(a.accountId), audience: "agent", agentScopes: ["game:act"] },
        {
          schemaVersion: "pact.politics-command.v1",
          commandId: randomUUID(),
          action: { kind: "article.publish", title: "Forged", body: "Forged" },
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await server.close();
  });
  it("erases owned prose, closes both directions of allegiance and exports/prunes owned data", async () => {
    const a = await player(),
      b = await player();
    await agree(a, b);
    await write(a.accountId, { kind: "article.publish", title: "Own", body: "Own prose" });
    expect(await withTransaction(pool, (c) => politics.exportAccount(c, a.accountId))).toMatchObject({
      articles: [{ body: "Own prose" }],
    });
    await withTransaction(pool, (c) => politics.forgetAccount(c, a.accountId));
    expect(await politics.read(a.handle, 0, undefined, 0)).toMatchObject({ articles: [], allegiance: [] });
    await withTransaction(pool, (c) => politics.prune(c, new Date("2027-04-01T14:00:00Z")));
    expect(
      (await pool.query("SELECT * FROM kingdom_articles WHERE author_kingdom_id=$1", [a.kingdomId])).rowCount,
    ).toBe(0);
  });
});
