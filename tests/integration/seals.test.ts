import { randomUUID } from "node:crypto";
import { CommandDispatcher, SocialCommandHandler } from "@pact/application";
import { ExposureService } from "@pact/authority";
import { ProductScopeSchema, type SealSelection } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { canonicalJson, sha256, verifyPayload } from "@pact/evidence";
import { IdentityError, type IdentityService } from "@pact/identity";
import {
  ActionLimitService,
  CourtService,
  GameReportReader,
  GarrisonService,
  InvitationService,
  PoliticsService,
  RaidRandomnessService,
  RaidService,
  ScoutService,
  SEAL_DOMAIN,
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
import { registerSealRoutes } from "../../services/api/src/seal-routes.js";
import { SealSigner } from "../../workers/rules/src/seal-signer.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test",
  scope = ProductScopeSchema.parse("pact");
let instant = new Date("2026-10-01T15:00:00Z");
const clock = { now: () => instant };
let admin: Pool,
  pool: Pool,
  schema: string,
  seals: SealService,
  dispatcher: CommandDispatcher,
  signer: SealSigner,
  reports: GameReportReader;
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "seals");
  pool = createSchemaPool(url, schema);
  const world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  await pool.query("UPDATE world_clocks SET next_tick_due_at=clock_timestamp()+interval '1 hour'");
  const ledger = new ResourceLedger("pact"),
    limits = new ActionLimitService("pact"),
    exposure = new ExposureService("pact"),
    troops = new TroopService("pact", ledger),
    scouts = new ScoutService("pact", ledger, troops, limits, exposure),
    raids = new RaidService(
      "pact",
      ledger,
      troops,
      limits,
      exposure,
      new RaidRandomnessService("pact", Buffer.alloc(32, 7)),
      new GarrisonService("pact", ledger, troops, exposure),
    );
  reports = new GameReportReader(pool, scouts, raids);
  seals = new SealService(pool, "pact", clock, reports);
  const social = new SocialService("pact", ledger, limits, clock),
    invitations = new InvitationService(pool, "pact", social, clock);
  dispatcher = new CommandDispatcher({
    pool,
    productScope: scope,
    clock,
    social: new SocialCommandHandler(
      invitations,
      new CourtService(pool, "pact", clock),
      new PoliticsService(pool, "pact", clock),
      seals,
    ),
    game: {
      admit: (op) => world.admitCommand((c, s) => op(c, s.gameTimeMs)),
      execute: async () => {
        throw new Error("UNEXPECTED");
      },
    },
  });
  signer = new SealSigner(pool, "pact", Buffer.alloc(32, 9), clock);
  await Promise.all([signer.initialize(), signer.initialize()]);
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});
async function player() {
  const accountId = randomUUID(),
    kingdomId = randomUUID(),
    handle = `seal_${randomUUID().slice(0, 8)}`;
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture-only',$3,'v1')",
    [accountId, `${accountId}@example.test`, clock.now()],
  );
  await pool.query(
    "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Seal fixture','portrait.wolf',$4,0,0,60000,$5)",
    [kingdomId, accountId, handle, clock.now(), randomUUID()],
  );
  return { accountId, kingdomId, handle };
}
type Player = Awaited<ReturnType<typeof player>>;
async function message(a: Player, b: Player, body = "secret prefix😀 selected proof private tail") {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms,created_at) VALUES($1,'pact',$2,$3,$4,false,$5,0,$6)",
    [id, a.kingdomId, b.kingdomId, body, randomUUID(), clock.now()],
  );
  return id;
}
const human = (id: string) => ({ accountId: id, productScope: scope, audience: "human" as const });
const write = (p: Player, action: Record<string, unknown>, commandId: string = randomUUID()) =>
  dispatcher.dispatchSocial(human(p.accountId), { schemaVersion: "pact.seal-command.v1", commandId, action });
async function queue(p: Player, selection: SealSelection) {
  const preview = await seals.preview(p.accountId, selection),
    response = await write(p, { kind: "seal.publish", selection, previewDigest: preview.previewDigest });
  return { id: (response.result as { sealId: string }).sealId, preview, response };
}
async function drain() {
  for (let n = 0; n < 100; n++) if (!(await signer.signNext())) return;
  throw new Error("UNBOUNDED_SIGNING");
}
describe("source-backed human publication and public evidence", () => {
  it("publishes exact selective Unicode bytes, hides omissions and verifies canonical signatures after worker retries", async () => {
    const a = await player(),
      b = await player(),
      c = await player(),
      id = await message(a, b);
    const selection = { recordType: "message" as const, recordId: id, ranges: [{ start: 17, end: 32 }] };
    const pending = await queue(a, selection);
    expect(await seals.read(pending.id)).toEqual({ found: false });
    expect(await seals.read(pending.id, a.accountId)).toMatchObject({ status: "pending" });
    await expect(new SealSigner(pool, "pact", Buffer.alloc(32, 3), clock).signNext()).rejects.toThrow();
    expect(await seals.read(pending.id, a.accountId)).toMatchObject({ status: "pending" });
    await Promise.all([signer.signNext(), signer.signNext()]);
    const view = await seals.read(pending.id, c.accountId);
    expect(view).toMatchObject({
      status: "published",
      verification: { authentic: true, label: "Authentic excerpt", provesTruth: false, provesCompleteAccount: false },
      payload: {
        segments: [
          { kind: "omitted", start: 0, end: 17 },
          { kind: "excerpt", start: 17, end: 32, text: " selected proof" },
          { kind: "omitted", start: 32, end: 45 },
        ],
      },
    });
    expect(JSON.stringify(view)).not.toContain("secret prefix");
    expect(JSON.stringify(view)).not.toContain("private tail");
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM outbox_events WHERE type='seal.published.v1' AND payload->>'sealId'=$1",
          [pending.id],
        )
      ).rows[0].n,
    ).toBe(1);
    const publicView = view as {
      payload: Record<string, unknown>;
      signature: string;
      verificationKey: Record<string, string>;
    };
    expect(verifyPayload(SEAL_DOMAIN, publicView.payload, publicView.signature, publicView.verificationKey)).toBe(true);
    expect(
      verifyPayload(
        SEAL_DOMAIN,
        { ...publicView.payload, segments: [{ kind: "excerpt", text: "forgery" }] },
        publicView.signature,
        publicView.verificationKey,
      ),
    ).toBe(false);
    await expect(seals.preview(c.accountId, selection)).rejects.toMatchObject({ code: "SOURCE_UNAVAILABLE" });
    await expect(write(a, { kind: "seal.publish", selection, previewDigest: "0".repeat(64) })).rejects.toMatchObject({
      code: "PREVIEW_CHANGED",
    });
    const replay = await write(
      a,
      { kind: "seal.publish", selection, previewDigest: pending.preview.previewDigest },
      pending.response.receipt.commandId,
    );
    expect(replay.receipt).toEqual(pending.response.receipt);
    expect(replay.result).toBeNull();
  });
  it("rejects invalid boundaries/order/overlap and detects changed exact human preview", async () => {
    const a = await player(),
      b = await player(),
      id = await message(a, b, "a😀b");
    for (const ranges of [
      [{ start: 2, end: 5 }],
      [{ start: 0, end: 3 }],
      [
        { start: 1, end: 5 },
        { start: 0, end: 1 },
      ],
      [
        { start: 0, end: 5 },
        { start: 1, end: 5 },
      ],
      [{ start: 0, end: 7 }],
    ])
      await expect(seals.preview(a.accountId, { recordType: "message", recordId: id, ranges })).rejects.toMatchObject({
        code: "INVALID_SELECTION",
      });
    const selection = { recordType: "message" as const, recordId: id },
      preview = await seals.preview(b.accountId, selection);
    expect(preview.payload).toMatchObject({ context: "Complete source excerpt; not a complete account" });
    await pool.query("UPDATE direct_messages SET body='tampered fixture' WHERE id=$1", [id]);
    await expect(
      write(b, { kind: "seal.publish", selection, previewDigest: preview.previewDigest }),
    ).rejects.toMatchObject({ code: "PREVIEW_CHANGED" });
  });
  it("shares the publication allowance across Article/Court/Seal and denies agent publication", async () => {
    const a = await player(),
      b = await player(),
      id = await message(a, b, "Complete message"),
      selection = { recordType: "message" as const, recordId: id };
    for (let n = 0; n < 3; n++)
      await dispatcher.dispatchSocial(human(a.accountId), {
        schemaVersion: "pact.politics-command.v1",
        commandId: randomUUID(),
        action: { kind: "article.publish", title: `Policy ${n}`, body: "Claim" },
      });
    const court = await dispatcher.dispatchSocial(human(a.accountId), {
      schemaVersion: "pact.court-command.v1",
      commandId: randomUUID(),
      action: { kind: "court.create", handle: a.handle, title: "Evidence Court", description: "", joinMode: "open" },
    });
    for (let slot = 1; slot <= 2; slot++)
      await dispatcher.dispatchSocial(human(a.accountId), {
        schemaVersion: "pact.court-command.v1",
        commandId: randomUUID(),
        action: { kind: "court.pin", courtId: (court.result as { courtId: string }).courtId, slot, body: "Pin" },
      });
    await queue(a, selection);
    await expect(queue(a, selection)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect((await pool.query("SELECT 1 FROM evidence_seals WHERE creator_kingdom_id=$1", [a.kingdomId])).rowCount).toBe(
      1,
    );
    const preview = await seals.preview(a.accountId, selection);
    await expect(
      dispatcher.dispatchSocial(
        { ...human(a.accountId), audience: "agent", agentScopes: ["game:act"] },
        {
          schemaVersion: "pact.seal-command.v1",
          commandId: randomUUID(),
          action: { kind: "seal.publish", selection, previewDigest: preview.previewDigest },
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await drain();
  });
  it("seals typed scout and battle fields only for original authorized participants, never information buyers", async () => {
    const a = await player(),
      b = await player(),
      buyer = await player(),
      scoutId = randomUUID();
    const scout = {
      kind: "engine_report",
      operationId: scoutId,
      scoutKingdomId: a.kingdomId,
      targetKingdomId: b.kingdomId,
      observedGameTimeMs: 360000,
      staleAfterObservation: true,
      wallLevel: 2,
      homeTroops: { spearman: "1-10" },
      ordinaryStock: { silver: "1-100", iron: "0", grain: "0" },
    };
    await pool.query(
      "INSERT INTO scout_operations(id,product_scope,scout_kingdom_id,target_kingdom_id,operation_key,status,started_game_time_ms,due_game_time_ms,completed_game_time_ms,completed_at,report) VALUES($1,'pact',$2,$3,$4,'completed',0,360000,360000,$5,$6::jsonb)",
      [scoutId, a.kingdomId, b.kingdomId, randomUUID(), clock.now(), JSON.stringify(scout)],
    );
    await pool.query("INSERT INTO scout_report_shares VALUES('pact',$1,$2,360000)", [scoutId, buyer.kingdomId]);
    expect(await reports.read(buyer.accountId, "scout", scoutId)).toEqual(scout);
    await expect(seals.preview(buyer.accountId, { recordType: "scout", recordId: scoutId })).rejects.toMatchObject({
      code: "SOURCE_UNAVAILABLE",
    });
    const selected = await queue(a, { recordType: "scout", recordId: scoutId, fields: ["wallLevel"] });
    await expect(
      seals.preview(a.accountId, { recordType: "scout", recordId: scoutId, fields: ["wallLevel", "wallLevel"] }),
    ).rejects.toMatchObject({ code: "INVALID_SELECTION" });
    await expect(
      seals.preview(a.accountId, { recordType: "scout", recordId: scoutId, fields: ["notAReportField"] }),
    ).rejects.toMatchObject({ code: "INVALID_SELECTION" });
    const raidId = randomUUID(),
      battle = {
        raidId,
        status: "resolved",
        leaderKingdomId: a.kingdomId,
        targetKingdomId: b.kingdomId,
        gameTimeMs: 1260000,
        lockedWallLevel: 2,
        eligibleUnitIds: [randomUUID()],
        trace: { winner: "attacker", loot: { silver: "600" } },
        commitment: "a".repeat(64),
        seed: "synthetic-revealed-seed",
      };
    await pool.query(
      "INSERT INTO raids(id,product_scope,leader_kingdom_id,target_kingdom_id,rules_version,declared_game_time_ms,lock_game_time_ms,resolution_game_time_ms,status,loot_priority,declaration_terms,resolved_game_time_ms,closed_at,participant_report,public_report) VALUES($1,'pact',$2,$3,'pact-s1-v1',0,60000,1260000,'resolved',ARRAY['silver','iron','grain'],'{}',1260000,$4,$5::jsonb,'{}')",
      [raidId, a.kingdomId, b.kingdomId, clock.now(), JSON.stringify(battle)],
    );
    await pool.query(
      "INSERT INTO raid_contributions(product_scope,raid_id,kingdom_id,role,status,committed_game_time_ms,provision_units,selection) VALUES('pact',$1,$2,'leader','committed',0,0,'[]')",
      [raidId, a.kingdomId],
    );
    await expect(seals.preview(buyer.accountId, { recordType: "battle", recordId: raidId })).rejects.toMatchObject({
      code: "SOURCE_UNAVAILABLE",
    });
    const participant = await queue(b, { recordType: "battle", recordId: raidId, fields: ["trace"] });
    await drain();
    expect(await seals.read(selected.id)).toMatchObject({
      verification: { authentic: true },
      payload: { selected_fields: { wallLevel: 2 }, observed_game_time_ms: 360000 },
    });
    expect(JSON.stringify(await seals.read(selected.id))).not.toContain('"spearman"');
    expect(await seals.read(participant.id)).toMatchObject({
      verification: { authentic: true },
      payload: { selected_fields: { trace: battle.trace }, observed_game_time_ms: 1260000 },
    });
    expect(JSON.stringify(await seals.read(participant.id))).not.toContain(battle.eligibleUnitIds[0]);
  });
  it("hides removed hosted evidence and sources, including pending publications, without resurrecting originals", async () => {
    const a = await player(),
      b = await player(),
      id = await message(a, b, "Hosted removed source"),
      selection = { recordType: "message" as const, recordId: id };
    const first = await queue(a, selection),
      second = await queue(b, selection);
    await drain();
    await expect(write(b, { kind: "seal.remove", sealId: first.id })).rejects.toMatchObject({
      code: "SEAL_UNAVAILABLE",
    });
    await write(a, { kind: "seal.remove", sealId: first.id });
    expect(await seals.read(first.id)).toEqual({ found: true, sealId: first.id, status: "removed" });
    const pending = await queue(a, selection);
    await withTransaction(pool, (c) => seals.hideSource(c, "message", id));
    await drain();
    for (const sealed of [first, second, pending])
      expect(await seals.read(sealed.id, a.accountId)).toEqual({ found: true, sealId: sealed.id, status: "removed" });
    await expect(seals.preview(a.accountId, selection)).rejects.toMatchObject({ code: "SOURCE_UNAVAILABLE" });
  });
  it("exports own publications, erases participant prose, respects source expiry and bounded hosted retention", async () => {
    const a = await player(),
      b = await player(),
      id = await message(a, b, "Erasure fixture"),
      selection = { recordType: "message" as const, recordId: id },
      published = await queue(b, selection);
    await drain();
    expect(await withTransaction(pool, (c) => seals.exportAccount(c, b.accountId))).toMatchObject([
      { id: published.id, status: "published" },
    ]);
    await withTransaction(pool, (c) => seals.forgetAccount(c, a.accountId));
    expect(await seals.read(published.id)).toMatchObject({ status: "removed" });
    expect(
      JSON.stringify(
        (await pool.query("SELECT preview_payload,signed_payload FROM evidence_seals WHERE id=$1", [published.id]))
          .rows,
      ),
    ).not.toContain("Erasure fixture");
    const expired = await message(a, b, "Old original");
    await pool.query("UPDATE direct_messages SET created_at=$2 WHERE id=$1", [
      expired,
      new Date(instant.getTime() - 91 * 86400000),
    ]);
    await expect(seals.preview(a.accountId, { recordType: "message", recordId: expired })).rejects.toMatchObject({
      code: "SOURCE_UNAVAILABLE",
    });
    instant = new Date("2027-04-02T15:00:00Z");
    try {
      expect(await seals.read(published.id)).toMatchObject({ status: "removed" });
      await withTransaction(pool, (c) => seals.prune(c, instant));
      expect(await seals.read(published.id)).toEqual({ found: false });
    } finally {
      instant = new Date("2026-10-01T15:00:00Z");
    }
  });
  it("returns identical HTTP/MCP verification, public-only keys and private authenticated preview", async () => {
    const a = await player(),
      b = await player(),
      id = await message(a, b, "HTTP evidence"),
      published = await queue(a, { recordType: "message", recordId: id });
    await drain();
    const server = Fastify(),
      identity = {
        authenticate: async () => ({ accountId: a.accountId }),
        authorizeCookieWrite: async (_token: string, csrf: string, origin: string) => {
          if (csrf !== "fixture" || origin !== "https://example.test") throw new IdentityError("FORBIDDEN");
          return { accountId: a.accountId };
        },
      } as unknown as IdentityService;
    registerSealRoutes(server, identity, seals);
    const expected = await seals.read(published.id, a.accountId),
      http = await server.inject({
        method: "GET",
        url: `/v1/seals/${published.id}`,
        headers: { cookie: "pact_session=fixture" },
      });
    expect(http.statusCode).toBe(200);
    expect(http.json()).toEqual(expected);
    expect(http.headers["cache-control"]).toBe("no-store");
    expect((await server.inject({ method: "GET", url: `/v1/seals/${published.id}/original` })).statusCode).toBe(404);
    const keys = await server.inject({ method: "GET", url: "/.well-known/pact-signing-keys.json" });
    expect(keys.json().keys.length).toBe(1);
    expect(keys.json().keys[0]).toMatchObject({ kty: "OKP", crv: "Ed25519", alg: "EdDSA" });
    expect(keys.json().keys[0].d).toBeUndefined();
    expect(
      (await pool.query("SELECT encrypted_private_key FROM seal_signing_keys")).rows[0].encrypted_private_key.length,
    ).toBeGreaterThan(48);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/v1/seals/preview",
          payload: { recordType: "message", recordId: id },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/v1/seals/preview",
          headers: { cookie: "pact_session=fixture", origin: "https://example.test", "x-csrf-token": "fixture" },
          payload: { recordType: "message", recordId: id },
        })
      ).json(),
    ).toMatchObject({ previewDigest: sha256(canonicalJson(published.preview.payload)) });
    const mcp = new McpTransport({
        pool,
        dispatcher,
        productScope: scope,
        clock,
        origin: "https://example.test",
        seals: { read: (sealId, account) => seals.read(sealId, account) },
      }),
      agent = { ...human(a.accountId), audience: "agent" as const, agentScopes: ["world:read"] as const };
    const init = await mcp.handlePost(agent, {
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", clientInfo: { name: "fixture", version: "1" }, capabilities: {} },
    });
    const response = await mcp.handlePost(
      agent,
      { id: 2, method: "tools/call", params: { name: "pact_seal_read_v1", arguments: { sealId: published.id } } },
      init.sessionId,
    );
    expect((response.response.result as { structuredContent: unknown }).structuredContent).toEqual(expected);
    const keyId = (await seals.keys()).keys[0] as { kid: string };
    await pool.query("UPDATE seal_signing_keys SET compromised=true WHERE kid=$1", [keyId.kid]);
    expect(await seals.read(published.id)).toEqual({ found: true, sealId: published.id, status: "key_compromised" });
    await pool.query("UPDATE seal_signing_keys SET compromised=false WHERE kid=$1", [keyId.kid]);
    await server.close();
  });
});
