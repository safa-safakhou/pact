import { randomUUID } from "node:crypto";
import { ChronicleFactReader, CommandDispatcher, SocialCommandHandler } from "@pact/application";
import { ExposureService } from "@pact/authority";
import { ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import type { IdentityService } from "@pact/identity";
import {
  ActionLimitService,
  ChronicleOutcomeReader,
  ChronicleService,
  CourtService,
  GameReportReader,
  InvitationService,
  ScoutService,
  SealService,
  SocialService,
  TroopService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { McpTransport } from "@pact/mcp";
import { WorldClockService } from "@pact/world";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerChronicleRoutes } from "../../services/api/src/chronicle-routes.js";
import { SealSigner } from "../../workers/rules/src/seal-signer.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test",
  scope = ProductScopeSchema.parse("pact");
const clock = { now: () => new Date("2026-10-01T15:00:00Z") };
let admin: Pool,
  pool: Pool,
  schema: string,
  chronicle: ChronicleService,
  dispatcher: CommandDispatcher,
  seals: SealService,
  signer: SealSigner,
  invitations: InvitationService,
  social: SocialService,
  courts: CourtService;
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "chronicle");
  pool = createSchemaPool(url, schema);
  const world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  await pool.query("UPDATE world_clocks SET next_tick_due_at=clock_timestamp()+interval '1 hour'");
  const ledger = new ResourceLedger("pact"),
    limits = new ActionLimitService("pact"),
    troops = new TroopService("pact", ledger);
  seals = new SealService(
    pool,
    "pact",
    clock,
    new GameReportReader(pool, new ScoutService("pact", ledger, troops, limits, new ExposureService("pact"))),
  );
  social = new SocialService("pact", ledger, limits, clock);
  courts = new CourtService(pool, "pact", clock);
  chronicle = new ChronicleService(
    pool,
    "pact",
    clock,
    seals,
    new ChronicleFactReader("pact", clock, new ChronicleOutcomeReader("pact")),
    social,
  );
  invitations = new InvitationService(pool, "pact", social, clock, {
    notice: chronicle.destination("notice"),
    story: chronicle.destination("story"),
  });
  dispatcher = new CommandDispatcher({
    pool,
    productScope: scope,
    clock,
    social: new SocialCommandHandler(invitations, courts, undefined, seals, chronicle),
    game: {
      admit: (op) => world.admitCommand((c, s) => op(c, s.gameTimeMs)),
      execute: async () => {
        throw new Error("UNEXPECTED");
      },
    },
  });
  signer = new SealSigner(pool, "pact", Buffer.alloc(32, 7), clock);
  await signer.initialize();
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});
async function player() {
  const accountId = randomUUID(),
    kingdomId = randomUUID(),
    handle = `story_${randomUUID().slice(0, 8)}`;
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture-only',$3,'v1')",
    [accountId, `${accountId}@example.test`, clock.now()],
  );
  await pool.query(
    "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Story fixture','portrait.wolf',$4,0,0,60000,$5)",
    [kingdomId, accountId, handle, clock.now(), randomUUID()],
  );
  return { accountId, kingdomId, handle };
}
type Player = Awaited<ReturnType<typeof player>>;
function write(
  p: Player,
  action: Record<string, unknown>,
  id: string = randomUUID(),
  schemaVersion = "pact.chronicle-command.v1",
) {
  return dispatcher.dispatchSocial(
    { accountId: p.accountId, productScope: scope, audience: "human" },
    { schemaVersion, commandId: id, action },
  );
}
const notice = {
  type: "notice" as const,
  title: "Grain wanted",
  commentary: "Looking for a willing trade partner.",
  durationHours: 24,
};
async function publish(p: Player, s: Parameters<ChronicleService["preview"]>[1]) {
  const preview = await chronicle.preview(p.accountId, s);
  const response = await write(p, { kind: "chronicle.publish", selection: s, previewDigest: preview.previewDigest });
  return { id: (response.result as { postId: string }).postId, response, preview };
}
async function receipt(p: Player) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO command_receipts(product_scope,account_id,command_id,canonical_payload_hash,code,receipt,created_at) VALUES('pact',$1,$2,'fixture','COMMITTED',$3::jsonb,$4)",
    [
      p.accountId,
      id,
      JSON.stringify({
        code: "COMMITTED",
        committedAt: clock.now().toISOString(),
        recordVersions: { [`construction:${randomUUID()}`]: 1 },
        charged: [{ resource: "silver", amount: "PRIVATE_STOCK" }],
        privateObjective: "SECRET_OBJECTIVE",
      }),
      clock.now(),
    ],
  );
  return id;
}
async function evidence(a: Player, b: Player) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms,created_at) VALUES($1,'pact',$2,$3,'hidden selected hidden',false,$4,0,$5)",
    [id, a.kingdomId, b.kingdomId, randomUUID(), clock.now()],
  );
  const selection = { recordType: "message" as const, recordId: id, ranges: [{ start: 7, end: 15 }] },
    preview = await seals.preview(a.accountId, selection);
  const result = await write(
    a,
    { kind: "seal.publish", selection, previewDigest: preview.previewDigest },
    randomUUID(),
    "pact.seal-command.v1",
  );
  await signer.signNext();
  return { id: (result.result as { sealId: string }).sealId, source: id };
}
describe("deliberate Chronicle publication", () => {
  it("publishes a real completed build consequence, not live levels or stock", async () => {
    const a = await player(),
      id = randomUUID(),
      commandId = await receipt(a);
    await pool.query(
      "INSERT INTO building_instructions(id,product_scope,kingdom_id,account_id,builder_slot,building_kind,target_level,actor_kind,authority_ref,state,queued_game_time_ms,settled_game_time_ms) VALUES($1,'pact',$2,$3,1,'farm',2,'human','fixture','completed',0,3600000)",
      [id, a.kingdomId, a.accountId],
    );
    await pool.query(
      "UPDATE command_receipts SET receipt=jsonb_set(receipt,'{recordVersions}',$2::jsonb) WHERE command_id=$1",
      [commandId, JSON.stringify({ [`building:${id}`]: 1 })],
    );
    const s = {
      type: "story" as const,
      title: "Farm done",
      commentary: "A real first consequence",
      factCommandId: commandId,
      sealIds: [],
    };
    const p = await chronicle.preview(a.accountId, s);
    expect(p.fact?.consequences).toEqual([
      {
        record: `building:${id}`,
        status: "completed",
        consequence: "farm level 2 completed",
        settledGameTimeMs: 3600000,
      },
    ]);
    const published = await publish(a, s);
    expect(JSON.stringify(await chronicle.read({ postId: published.id, offset: 0 }, 0))).toContain(
      "farm level 2 completed",
    );
  });
  it("discovers actual notices, identity and exact recorded facts without private receipt expansion", async () => {
    const a = await player();
    const n = await publish(a, notice);
    const commandId = await receipt(a);
    const story = await publish(a, {
      type: "story",
      title: "Our first instruction",
      commentary: "I think this was wise.",
      factCommandId: commandId,
      sealIds: [],
    });
    const feed = await chronicle.read({ authorHandle: a.handle, offset: 0 }, 0);
    expect(feed.posts).toHaveLength(2);
    expect(feed.posts.find((p) => p.id === story.id)).toMatchObject({
      fact: { code: "COMMITTED", commandId },
      destination: { id: story.id, path: `/pact/?post=${story.id}` },
      author: { handle: a.handle },
    });
    expect(JSON.stringify(feed)).not.toMatch(/PRIVATE_STOCK|SECRET_OBJECTIVE/);
    expect((await chronicle.read({ postId: n.id, offset: 0 }, 0)).posts[0]).toMatchObject({
      status: "published",
      version: 1,
    });
    expect((await chronicle.ownFacts(a.accountId)).facts.length).toBeGreaterThan(0);
  });
  it("rejects forged, other-account and changed-preview sources; failed attempts consume nothing", async () => {
    const a = await player(),
      b = await player(),
      commandId = await receipt(b);
    await expect(
      chronicle.preview(a.accountId, {
        type: "story",
        title: "Forgery",
        commentary: "False",
        factCommandId: commandId,
        sealIds: [],
      }),
    ).rejects.toThrow("SOURCE_UNAVAILABLE");
    const p = await chronicle.preview(a.accountId, notice);
    await expect(
      write(a, {
        kind: "chronicle.publish",
        selection: { ...notice, title: "Changed" },
        previewDigest: p.previewDigest,
      }),
    ).rejects.toThrow("PREVIEW_CHANGED");
    expect((await chronicle.read({ authorHandle: a.handle, offset: 0 }, 0)).posts).toEqual([]);
  });
  it("replay commits once, agent publication denied and notice cap/expiry/version enforced", async () => {
    const a = await player();
    const s = await publish(a, notice);
    const command = (s.response.receipt as { commandId: string }).commandId;
    const repeat = await write(
      a,
      { kind: "chronicle.publish", selection: notice, previewDigest: s.preview.previewDigest },
      command,
    );
    expect(repeat.receipt.code).toBe("COMMITTED");
    await publish(a, { ...notice, title: "Second" });
    await expect(publish(a, { ...notice, title: "Third" })).rejects.toThrow("NOTICE_LIMIT");
    const changed = await publish(a, { ...notice, postId: s.id, expectedVersion: 1, title: "Updated" });
    expect(changed.response.receipt.recordVersions[`chronicle:${s.id}`]).toBe(2);
    await expect(publish(a, { ...notice, postId: s.id, expectedVersion: 1 })).rejects.toThrow("STALE_VERSION");
    const deadline = Number(
      (await pool.query("SELECT expires_game_time_ms FROM chronicle_posts WHERE id=$1", [s.id])).rows[0]
        .expires_game_time_ms,
    );
    expect((await chronicle.read({ postId: s.id, offset: 0 }, deadline)).posts[0]?.status).toBe("expired");
    expect((await chronicle.read({ authorHandle: a.handle, offset: 0 }, deadline)).posts).toEqual([]);
    await expect(
      dispatcher.dispatchSocial(
        { accountId: a.accountId, productScope: scope, audience: "agent" },
        {
          schemaVersion: "pact.chronicle-command.v1",
          commandId: randomUUID(),
          action: { kind: "chronicle.remove", postId: s.id, expectedVersion: 2 },
        },
      ),
    ).rejects.toThrow("FORBIDDEN");
  });
  it("selected authentic evidence remains live: omitted bytes never leak and removed Seal is not cached in stories", async () => {
    const a = await player(),
      b = await player(),
      e = await evidence(a, b);
    const s = await publish(a, {
      type: "story",
      title: "Selected evidence",
      commentary: "An interpretation, not truth.",
      factCommandId: await receipt(a),
      sealIds: [e.id],
    });
    const view = await chronicle.read({ postId: s.id, offset: 0 }, 0);
    expect(JSON.stringify(view)).toContain("selected");
    expect(JSON.stringify(view)).not.toContain("hidden");
    await write(a, { kind: "seal.remove", sealId: e.id }, randomUUID(), "pact.seal-command.v1");
    const removed = await chronicle.read({ postId: s.id, offset: 0 }, 0);
    expect(removed.posts[0]?.evidence).toEqual([{ found: true, sealId: e.id, status: "removed" }]);
    await expect(
      chronicle.preview(a.accountId, {
        type: "story",
        title: "Copy",
        commentary: "No resurrection",
        factCommandId: await receipt(a),
        sealIds: [e.id],
      }),
    ).rejects.toThrow("SOURCE_UNAVAILABLE");
  });
  it("notice invitations establish only explicit conversations, expire with notices and never sign a contract", async () => {
    const a = await player(),
      b = await player(),
      n = await publish(a, notice);
    const issued = await write(
        a,
        { kind: "invitation.issue", destinationType: "notice", destinationId: n.id, redemptionLimit: 10 },
        randomUUID(),
        "pact.social-command.v1",
      ),
      token = (issued.result as { token: string }).token;
    expect((await invitations.withRead((c) => invitations.read(c, token, 0))).destination).toMatchObject({
      id: n.id,
      type: "notice",
    });
    await write(b, { kind: "invitation.accept", token }, randomUUID(), "pact.social-command.v1");
    expect(
      (
        await pool.query("SELECT 1 FROM social_contacts WHERE kingdom_a IN($1,$2) AND kingdom_b IN($1,$2)", [
          a.kingdomId,
          b.kingdomId,
        ])
      ).rowCount,
    ).toBe(1);
    expect((await pool.query("SELECT 1 FROM supply_contracts")).rowCount).toBe(0);
    const deadline = Number(
      (await pool.query("SELECT expires_game_time_ms FROM chronicle_posts WHERE id=$1", [n.id])).rows[0]
        .expires_game_time_ms,
    );
    expect((await invitations.withRead((c) => invitations.read(c, token, deadline))).status).toBe("expired");
  });
  it("public story invitations, blocked prose, exact removal, retirement and retention are truthful", async () => {
    const a = await player(),
      b = await player(),
      s = await publish(a, {
        type: "story",
        title: "Public result",
        commentary: "collapse me",
        factCommandId: await receipt(a),
        sealIds: [],
      });
    const issued = await write(
      a,
      { kind: "invitation.issue", destinationType: "story", destinationId: s.id, redemptionLimit: 10000 },
      randomUUID(),
      "pact.social-command.v1",
    );
    const token = (issued.result as { token: string }).token;
    await write(b, { kind: "invitation.accept", token }, randomUUID(), "pact.social-command.v1");
    expect(
      (await pool.query("SELECT 1 FROM social_contacts WHERE kingdom_a IN($1,$2)", [a.kingdomId, b.kingdomId]))
        .rowCount,
    ).toBe(0);
    await withTransaction(pool, (c) => social.setBlock(c, b.accountId, a.kingdomId, true, 0));
    expect((await chronicle.read({ postId: s.id, offset: 0 }, 0, b.accountId)).posts[0]).toMatchObject({
      proseCollapsed: true,
      commentary: "",
    });
    await expect(write(b, { kind: "chronicle.remove", postId: s.id, expectedVersion: 1 })).rejects.toThrow(
      "STALE_VERSION",
    );
    await withTransaction(pool, (c) => chronicle.forgetAccount(c, a.accountId));
    expect((await chronicle.read({ postId: s.id, offset: 0 }, 0)).posts).toEqual([{ id: s.id, status: "removed" }]);
    expect((await invitations.withRead((c) => invitations.read(c, token, 0))).status).toBe("unavailable");
    await withTransaction(pool, (c) => chronicle.prune(c, new Date("2027-05-01T00:00:00Z")));
    expect((await chronicle.read({ postId: s.id, offset: 0 }, 0)).posts).toEqual([]);
  });
  it("public HTTP is no-store; owner preview requires authenticated human CSRF and rejects expansions", async () => {
    const a = await player(),
      n = await publish(a, notice),
      server = Fastify();
    registerChronicleRoutes(
      server,
      {
        authenticate: async () => ({ accountId: a.accountId }),
        authorizeCookieWrite: async () => ({ accountId: a.accountId }),
      } as unknown as IdentityService,
      chronicle,
      async () => 0,
    );
    await server.ready();
    const response = await server.inject({ url: `/v1/chronicle?postId=${n.id}` });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect((await server.inject({ method: "POST", url: "/v1/chronicle/preview", payload: notice })).statusCode).toBe(
      403,
    );
    expect((await server.inject({ url: "/v1/chronicle?expand=private" })).statusCode).toBe(400);
    expect((await server.inject({ url: "/v1/chronicle/facts" })).statusCode).toBe(403);
    await server.close();
  });
  it("agent discovers real notices via scoped MCP tool without internal UUID coaching", async () => {
    const a = await player(),
      n = await publish(a, notice),
      principal = {
        accountId: a.accountId,
        productScope: scope,
        audience: "agent" as const,
        grantId: randomUUID(),
        agentScopes: ["world:read"] as "world:read"[],
      };
    const mcp = new McpTransport({
      pool,
      productScope: "pact",
      dispatcher,
      origin: "https://pact.example",
      clock,
      chronicle: { read: (q, id) => chronicle.read(q, 0, id) },
    });
    const init = await mcp.handlePost(principal, {
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", clientInfo: { name: "fixture", version: "1" }, capabilities: {} },
    });
    const tools = await mcp.handlePost(principal, { id: 2, method: "tools/list" }, init.sessionId);
    expect(JSON.stringify(tools)).toContain("pact_chronicle_read_v1");
    const result = await mcp.handlePost(
      principal,
      {
        id: 3,
        method: "tools/call",
        params: { name: "pact_chronicle_read_v1", arguments: { type: "notice", authorHandle: a.handle } },
      },
      init.sessionId,
    );
    expect(JSON.stringify(result)).toContain(n.id);
    expect(JSON.stringify(result)).toContain(a.handle);
  });
});
