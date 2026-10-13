import { randomUUID } from "node:crypto";
import type { CommandDispatcher } from "@pact/application";
import { KingdomDiscoveryQuerySchema, ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import { IdentityError, type IdentityService } from "@pact/identity";
import { KingdomDiscoveryReader, WorldViewService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { MCP_PROTOCOL_PRIMARY, McpTransport } from "@pact/mcp";
import { DeterministicFakeProvider, fakeProviderModel, ProviderRouter } from "@pact/model-provider";
import type { OAuthService } from "@pact/oauth";
import { WorldClockService } from "@pact/world";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerWorldViewRoutes } from "../../services/api/src/world-view-routes.js";
import { createInferenceGameRuntime } from "../../workers/inference/src/game-runtime.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5440/pact_test";
let admin: Pool, pool: Pool, schema: string, reader: KingdomDiscoveryReader;
let viewer: { accountId: string; kingdomId: string };
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "discovery");
  pool = createSchemaPool(url, schema);
  await new WorldClockService(pool, "pact").bootstrap();
  reader = new KingdomDiscoveryReader(pool, "pact");
  viewer = await kingdom("viewer");
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});
async function kingdom(label: string, scope = "pact", level = 2) {
  const accountId = randomUUID(),
    kingdomId = randomUUID(),
    handle = `${label}_${randomUUID().slice(0, 6)}`;
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,$2,$3,'fixture',now(),'terms-v1')",
    [accountId, scope, `${accountId}@example.test`],
  );
  await pool.query(
    "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,$2,$3,$4,$5,'portrait.wolf',now(),0,0,60000,$6)",
    [kingdomId, scope, accountId, handle, label, randomUUID()],
  );
  await pool.query("INSERT INTO kingdom_buildings(product_scope,kingdom_id,kind,level) VALUES($1,$2,'hall',$3)", [
    scope,
    kingdomId,
    level,
  ]);
  return { accountId, kingdomId, handle };
}
async function request(from: string, to: string, expires = 60000) {
  await pool.query(
    "INSERT INTO cold_contact_requests(id,product_scope,sender_kingdom_id,recipient_kingdom_id,note,operation_key,created_game_time_ms,expires_game_time_ms,status) VALUES($1::uuid,'pact',$2,$3,'private fixture note',$1::text,0,$4,'pending')",
    [randomUUID(), from, to, expires],
  );
}
describe("targeted authenticated discovery", () => {
  it("ranks exact handle before prefixes/substring matches and treats search metacharacters literally", async () => {
    const exact = await kingdom("needle"),
      prefix = await kingdom("needles"),
      substring = await kingdom("xneedle");
    await pool.query("UPDATE kingdoms SET handle='needle' WHERE id=$1", [exact.kingdomId]);
    const result = await reader.read(viewer.accountId, { query: " @NEEDLE ", limit: 3 });
    expect(result.kingdoms.map((k) => k.kingdomId)).toEqual([exact.kingdomId, prefix.kingdomId, substring.kingdomId]);
    expect(result.kingdoms[0]?.match).toBe("exact_handle");
    expect((await reader.read(viewer.accountId, { query: "%" })).kingdoms).toEqual([]);
    expect((await reader.read(viewer.accountId, { query: "' OR TRUE --" })).kingdoms).toEqual([]);
  });
  it("returns bounded reproducible varied samples; rotation/exclusions reach beyond the alphabetical prefix", async () => {
    for (let i = 0; i < 25; i++) await kingdom(`sample${i}`);
    const first = await reader.read(viewer.accountId, { query: "sample", limit: 8, rotation: 1 });
    expect(await reader.read(viewer.accountId, { query: "sample", limit: 8, rotation: 1 })).toEqual(first);
    const later = await reader.read(viewer.accountId, { query: "sample", limit: 8, rotation: 2 });
    expect(later.kingdoms).not.toEqual(first.kingdoms);
    const excluded = await reader.read(viewer.accountId, {
      query: "sample",
      excludeKingdomIds: first.kingdoms.map((k) => k.kingdomId),
      limit: 20,
    });
    expect(excluded.kingdoms).toHaveLength(17);
    expect(first.hasMore).toBe(true);
    expect(first.kingdoms).toHaveLength(8);
    expect(first.kingdoms.every((k) => excluded.kingdoms.every((p) => p.kingdomId !== k.kingdomId))).toBe(true);
  });
  it("filters public Hall levels without exposing private buildings or other kingdom information", async () => {
    const low = await kingdom("hallrange", "pact", 1),
      high = await kingdom("hallrange", "pact", 5);
    const result = await reader.read(viewer.accountId, { query: "hallrange", minHallLevel: 4, maxHallLevel: 6 });
    expect(result.kingdoms.map((k) => k.kingdomId)).toEqual([high.kingdomId]);
    expect(result.kingdoms.some((k) => k.kingdomId === low.kingdomId)).toBe(false);
    expect(Object.keys(result.kingdoms[0]!).sort()).toEqual(
      [
        "displayName",
        "hallLevel",
        "handle",
        "kingdomId",
        "match",
        "relationship",
        "publicNotice",
        "sharedCourts",
      ].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(/accountId|stocks|troops|password|lastObserved|online|private fixture/);
  });
  it("derives accepted and both-direction introduction facts only from this viewer, ignoring expired requests", async () => {
    const contact = await kingdom("relations"),
      incoming = await kingdom("relations"),
      outgoing = await kingdom("relations"),
      fresh = await kingdom("relations"),
      other = await kingdom("outsider");
    await pool.query(
      "INSERT INTO social_contacts(product_scope,kingdom_a,kingdom_b,accepted_game_time_ms) VALUES('pact',LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),0)",
      [viewer.kingdomId, contact.kingdomId],
    );
    await request(incoming.kingdomId, viewer.kingdomId);
    await request(viewer.kingdomId, outgoing.kingdomId);
    await request(fresh.kingdomId, other.kingdomId);
    await request(viewer.kingdomId, fresh.kingdomId, 1);
    await pool.query("UPDATE world_clocks SET committed_game_time_ms=60000 WHERE product_scope='pact'");
    // Create future live requests; the previous ones at 60,000 expire exactly at the clock boundary.
    await request(incoming.kingdomId, viewer.kingdomId, 120000);
    await request(viewer.kingdomId, outgoing.kingdomId, 120000);
    for (const [relationship, expected] of [
      ["contacts", contact],
      ["incoming", incoming],
      ["outgoing", outgoing],
      ["new", fresh],
    ] as const) {
      expect(
        (await reader.read(viewer.accountId, { query: "relations", relationship })).kingdoms.map((k) => k.kingdomId),
      ).toEqual([expected.kingdomId]);
    }
    expect((await reader.read(other.accountId, { query: "relations", relationship: "contacts" })).kingdoms).toEqual([]);
  });
  it("omits self, cross-product, closed and inactive identities and blocked pairs in either direction", async () => {
    const blocked = await kingdom("visibility"),
      blocker = await kingdom("visibility"),
      closed = await kingdom("visibility"),
      inactive = await kingdom("visibility"),
      cross = await kingdom("visibility", "other"),
      visible = await kingdom("visibility");
    await pool.query(
      "INSERT INTO social_blocks(product_scope,blocker_kingdom_id,blocked_kingdom_id,created_game_time_ms) VALUES('pact',$1,$2,0),('pact',$3,$1,0)",
      [viewer.kingdomId, blocked.kingdomId, blocker.kingdomId],
    );
    await pool.query("UPDATE kingdoms SET status='retired' WHERE id=$1", [closed.kingdomId]);
    await pool.query("UPDATE accounts SET status='closing' WHERE id=$1", [inactive.accountId]);
    const moderated = await kingdom("visibility");
    await pool.query("UPDATE kingdoms SET moderation_case_id=gen_random_uuid() WHERE id=$1", [moderated.kingdomId]);
    const result = await reader.read(viewer.accountId, { query: "visibility" });
    expect(result.kingdoms.map((k) => k.kingdomId)).toEqual([visible.kingdomId]);
    expect((await reader.read(viewer.accountId, { query: "viewer" })).kingdoms).toEqual([]);
    expect((await reader.read(cross.accountId)).kingdoms).toEqual([]);
    expect((await reader.read(inactive.accountId)).kingdoms).toEqual([]);
    expect((await reader.read(randomUUID())).kingdoms).toEqual([]);
  });
  it("finds current advertised resource opportunities without inventing stock, ignoring removed, expired, retained-old or moderated prose", async () => {
    const advertised = await kingdom("tradefind"),
      hidden = await kingdom("tradefind"),
      blocked = await kingdom("tradefind");
    const post = async (author: string, title: string, extra = "") => {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO chronicle_posts(id,product_scope,author_kingdom_id,type,version,title,commentary,expires_game_time_ms,status,published_at,command_id) VALUES($1,'pact',$2,'notice',1,$3,'Offer grain for iron; this is a player claim',120000,'published',now(),$4)",
        [id, author, title, randomUUID()],
      );
      if (extra) await pool.query("UPDATE chronicle_posts SET " + extra + " WHERE id=$1", [id]);
      return id;
    };
    const valid = await post(advertised.kingdomId, "Grain available");
    await post(hidden.kingdomId, "Grain expired", "expires_game_time_ms=60000");
    await post(hidden.kingdomId, "Grain removed", "status='removed'");
    await post(hidden.kingdomId, "Grain moderated", "moderation_case_id=gen_random_uuid()");
    await post(hidden.kingdomId, "Grain old", "published_at=now()-interval '181 days'");
    await post(blocked.kingdomId, "Grain blocked");
    await pool.query(
      "INSERT INTO social_blocks(product_scope,blocker_kingdom_id,blocked_kingdom_id,created_game_time_ms) VALUES('pact',$1,$2,60000)",
      [viewer.kingdomId, blocked.kingdomId],
    );
    const result = await reader.read(viewer.accountId, {
      query: "tradefind",
      noticeResource: "grain",
      noticeQuery: "available",
      relationship: "new",
    });
    expect(result.kingdoms.map((k) => k.kingdomId)).toEqual([advertised.kingdomId]);
    expect(result.kingdoms[0]?.publicNotice).toMatchObject({
      postId: valid,
      version: 1,
      title: "Grain available",
      untrustedContent: true,
      meaning: "Published player statement, not verified inventory or a signed trade",
    });
    expect((await reader.read(viewer.accountId, { query: "tradefind", noticeResource: "silver" })).kingdoms).toEqual(
      [],
    );
    await pool.query("UPDATE chronicle_posts SET status='removed' WHERE id=$1", [valid]);
    expect((await reader.read(viewer.accountId, { query: "tradefind", noticeResource: "grain" })).kingdoms).toEqual([]);
  });
  it("finds public Court peers and shared communities, excluding archived or moderated Courts and unrelated roster edges", async () => {
    const peer = await kingdom("courtfind"),
      outsider = await kingdom("courtfind");
    const courtId = randomUUID(),
      handle = "court_" + randomUUID().slice(0, 6);
    await pool.query(
      "INSERT INTO courts(id,product_scope,handle,title,owner_kingdom_id,join_mode) VALUES($1,'pact',$2,'Shared fixture court',$3,'open')",
      [courtId, handle, viewer.kingdomId],
    );
    await pool.query(
      "INSERT INTO court_memberships(court_id,kingdom_id,role,joined_game_time_ms) VALUES($1,$2,'owner',0),($1,$3,'member',0)",
      [courtId, viewer.kingdomId, peer.kingdomId],
    );
    const result = await reader.read(viewer.accountId, { query: "courtfind", sharedCourtOnly: true });
    expect(result.kingdoms.map((k) => k.kingdomId)).toEqual([peer.kingdomId]);
    expect(result.kingdoms[0]?.sharedCourts).toEqual([{ id: courtId, handle, title: "Shared fixture court" }]);
    expect(
      (await reader.read(outsider.accountId, { courtHandle: handle })).kingdoms.map((k) => k.kingdomId).sort(),
    ).toEqual([viewer.kingdomId, peer.kingdomId].sort());
    expect((await reader.read(outsider.accountId, { query: "courtfind", sharedCourtOnly: true })).kingdoms).toEqual([]);
    await pool.query("UPDATE courts SET moderation_case_id=gen_random_uuid() WHERE id=$1", [courtId]);
    expect((await reader.read(viewer.accountId, { courtHandle: handle })).kingdoms).toEqual([]);
    await pool.query("UPDATE courts SET moderation_case_id=NULL,status='archived',archived_at=now() WHERE id=$1", [
      courtId,
    ]);
    expect((await reader.read(viewer.accountId, { sharedCourtOnly: true })).kingdoms).toEqual([]);
  });
  it("validates bounds and rejects supplied ownership/offsets before reading", async () => {
    for (const query of [
      { accountId: viewer.accountId },
      { productScope: "other" },
      { offset: 8 },
      { minHallLevel: 5, maxHallLevel: 1 },
      { limit: 21 },
      { rotation: -1 },
      { query: "x".repeat(81) },
      { excludeKingdomIds: ["fake"] },
      { excludeKingdomIds: Array(51).fill(randomUUID()) },
    ]) {
      expect(KingdomDiscoveryQuerySchema.safeParse(query).success).toBe(false);
      await expect(reader.read(viewer.accountId, query)).rejects.toThrow();
    }
  });
  it("the in-app worker offers the same discovery tool and returns owned evidence through a fake model without gameplay changes", async () => {
    const owner = await kingdom("inappowner"),
      peer = await kingdom("inapppeer");
    await pool.query("UPDATE kingdoms SET moderation_case_id=NULL WHERE id=$1", [peer.kingdomId]);
    const ledger = new ResourceLedger("pact");
    const client = await pool.connect();
    try {
      await ledger.initializeKingdom(client, owner.kingdomId, 60000);
    } finally {
      client.release();
    }
    const before = (await pool.query("SELECT count(*)::int n FROM command_receipts")).rows[0];
    const runtime = await createInferenceGameRuntime({
      pool,
      productScope: "pact",
      clock: { now: () => new Date() },
      termsVersion: "terms-v1",
      providerRouter: new ProviderRouter([
        new DeterministicFakeProvider({
          scenario: "success",
          toolName: "pact_kingdom_discover_v2",
          toolArguments: { query: peer.handle },
        }),
      ]),
    });
    const started = await runtime.runs.start({
      accountId: owner.accountId,
      objective: "Find a real public trading partner",
      provider: "fixture",
      model: fakeProviderModel.id,
      limits: { maxCalls: 1 },
    });
    expect(await runtime.runs.executeModelCall(started.runId)).toMatchObject({
      status: "finished",
      lastErrorCode: null,
    });
    const row = (await pool.query("SELECT summary FROM envoy_run_tool_results WHERE run_id=$1", [started.runId]))
      .rows[0];
    expect(JSON.parse(row.summary).kingdoms).toMatchObject([{ kingdomId: peer.kingdomId, handle: peer.handle }]);
    expect((await pool.query("SELECT count(*)::int n FROM command_receipts")).rows[0]).toEqual(before);
  });
  it("HTTP, human session, scoped agent and MCP share equivalent owned results with no mutation or lease", async () => {
    const identity = {
      authenticate: async (token: string) => {
        if (token !== "fixture") throw new IdentityError("FORBIDDEN");
        return { accountId: viewer.accountId };
      },
    } as unknown as IdentityService;
    const oauth = {
      introspectAccessToken: async (token: string) =>
        token === "reader"
          ? { accountId: viewer.accountId, scopes: ["world:read"] }
          : token === "writer"
            ? { accountId: viewer.accountId, scopes: ["game:act"] }
            : null,
    } as unknown as OAuthService;
    const api = Fastify();
    registerWorldViewRoutes(api, identity, new WorldViewService(pool, "pact"), oauth, reader);
    const principal = {
      accountId: viewer.accountId,
      productScope: ProductScopeSchema.parse("pact"),
      audience: "agent" as const,
      agentScopes: ["world:read" as const],
    };
    const transport = new McpTransport({
      pool,
      productScope: "pact",
      dispatcher: {} as CommandDispatcher,
      origin: "https://fixture.example",
      clock: { now: () => new Date() },
      kingdomDiscovery: reader,
    });
    const init = await transport.handlePost(principal, {
      method: "initialize",
      id: 1,
      params: { protocolVersion: MCP_PROTOCOL_PRIMARY },
    });
    const args = { query: "relations", relationship: "new", rotation: 42 };
    try {
      const expected = await reader.read(viewer.accountId, args);
      for (const headers of [{ cookie: "pact_session=fixture" }, { authorization: "Bearer reader" }]) {
        const r = await api.inject({ method: "POST", url: "/v2/kingdoms/discover", headers, payload: args });
        expect(r.statusCode).toBe(200);
        expect(r.json()).toEqual(expected);
        expect(r.headers["cache-control"]).toBe("no-store");
      }
      const r = await transport.handlePost(
        principal,
        { method: "tools/call", id: 2, params: { name: "pact_kingdom_discover_v2", arguments: args } },
        init.sessionId,
      );
      expect((r.response.result as { structuredContent: unknown }).structuredContent).toEqual(expected);
      const listed = await transport.handlePost(principal, { method: "tools/list", id: 3 }, init.sessionId);
      expect(
        (listed.response.result as { tools: { name: string }[] }).tools.some(
          (t) => t.name === "pact_kingdom_discover_v2",
        ),
      ).toBe(true);
      await expect(
        transport.handlePost(
          { ...principal, agentScopes: [] },
          { method: "tools/call", id: 4, params: { name: "pact_kingdom_discover_v2", arguments: {} } },
          init.sessionId,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        transport.handlePost(
          principal,
          {
            method: "tools/call",
            id: 5,
            params: { name: "pact_kingdom_discover_v2", arguments: { accountId: randomUUID() } },
          },
          init.sessionId,
        ),
      ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
      for (const headers of [{}, { authorization: "Bearer writer" }, { authorization: "Bearer revoked" }])
        expect(
          (await api.inject({ method: "POST", url: "/v2/kingdoms/discover", headers, payload: {} })).statusCode,
        ).toBe(403);
      expect(
        (
          await api.inject({
            method: "POST",
            url: "/v2/kingdoms/discover",
            headers: { authorization: "Bearer reader" },
            payload: { accountId: randomUUID() },
          })
        ).statusCode,
      ).toBe(400);
    } finally {
      await api.close();
    }
  });
});
