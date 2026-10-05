import { randomUUID } from "node:crypto";
import { ExposureService } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { AesGcmSecretBox } from "@pact/identity";
import {
  ActionLimitService,
  assertModerationAllowed,
  BuildingEngine,
  ConstructionExposureAdapter,
  GarrisonService,
  KingdomRetirementService,
  ModerationService,
  SocialService,
  type StaffIdentity,
  SupplyService,
  SupplySettlementService,
  TroopService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { PrivacyService } from "@pact/privacy";
import { WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test",
  start = new Date("2026-10-04T08:00:00Z"),
  day = 86400000;
let admin: Pool,
  pool: Pool,
  schema: string,
  now = new Date(start),
  service: ModerationService;
const box = new AesGcmSecretBox(Buffer.alloc(32, 7));
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "moderation");
  pool = createSchemaPool(url, schema);
  const world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  const ledger = new ResourceLedger("pact"),
    exposure = new ExposureService("pact"),
    limits = new ActionLimitService("pact"),
    troops = new TroopService("pact", ledger),
    social = new SocialService("pact", ledger, limits, { now: () => now }),
    supply = new SupplyService("pact", ledger, limits, social);
  const retirement = new KingdomRetirementService(
    "pact",
    world,
    ledger,
    supply,
    new SupplySettlementService("pact", ledger, { read: async () => 0n }),
    new GarrisonService("pact", ledger, troops, exposure),
    new BuildingEngine("pact", ledger, new ConstructionExposureAdapter("pact", exposure, ledger)),
    troops,
  );
  service = new ModerationService(pool, {
    productScope: "pact",
    clock: { now: () => now },
    secretBox: box,
    closeAccount: (id) =>
      new PrivacyService(pool, {
        productScope: "pact",
        clock: { now: () => now },
        retirement,
        ownedData: [service.retention],
      }).requestDeletion(id),
  });
});
beforeEach(() => {
  now = new Date(start);
});
afterAll(async () => {
  await pool?.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
async function owner(role = "player") {
  const id = randomUUID(),
    kingdom = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,role,totp_secret_ciphertext) VALUES($1,'pact',$2,'fixture',$3,$4,$5)",
    [id, id + "@example.test", now, role, role === "staff" ? "encrypted-fixture" : null],
  );
  await pool.query(
    `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Fixture','portrait.wolf',$4,0,0,60000,$5)`,
    [kingdom, id, "mod_" + randomUUID().slice(0, 8), now, randomUUID()],
  );
  return { id, kingdom };
}
async function staff(mfa = true, role = "staff"): Promise<StaffIdentity> {
  const a = await owner(role),
    id = randomUUID();
  await pool.query(
    "INSERT INTO sessions(id,product_scope,account_id,audience,token_hash,expires_at,idle_expires_at,mfa_authenticated_at) VALUES($1,'pact',$2,'human',$3,$4,$4,$5)",
    [id, a.id, randomUUID(), new Date(now.getTime() + 7 * day), mfa ? now : null],
  );
  return { accountId: a.id, sessionId: id };
}
async function message() {
  const a = await owner(),
    b = await owner(),
    id = randomUUID();
  await pool.query(
    "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms,created_at) VALUES($1,'pact',$2,$3,'selected private fixture',false,$4,0,$5)",
    [id, a.kingdom, b.kingdom, randomUUID(), now],
  );
  return { a, b, id };
}
async function report(reporter: string, id: string, category: "doxxing" | "abuse" = "abuse") {
  return service.report(reporter, {
    reportKey: randomUUID(),
    kind: "message",
    targetId: id,
    category,
    details: "Synthetic context",
  });
}
describe("PACT-063 case scoped moderation", () => {
  it("limits reports to visible content, encrypts evidence, preserves retry and urgent/ordinary deadlines", async () => {
    const m = await message(),
      stranger = await owner();
    await expect(report(stranger.id, m.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const key = randomUUID(),
      input = {
        reportKey: key,
        kind: "message" as const,
        targetId: m.id,
        category: "doxxing" as const,
        details: "Synthetic context",
      };
    const r = await service.report(m.b.id, input);
    expect(r.triageDueAt).toEqual(new Date(now.getTime() + day));
    expect(await service.report(m.b.id, input)).toEqual(r);
    await expect(service.report(m.b.id, { ...input, details: "different" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    const ordinary = await report(m.b.id, m.id);
    expect(ordinary.triageDueAt).toEqual(new Date(now.getTime() + 3 * day));
    expect(
      JSON.stringify((await pool.query("SELECT * FROM moderation_evidence WHERE case_id=$1", [r.caseId])).rows),
    ).not.toContain("selected private fixture");
  });
  it("requires recent staff MFA and assigned case access; Court-style player powers confer no staff rights", async () => {
    const m = await message(),
      r = await report(m.b.id, m.id),
      s = await staff(),
      other = await staff(),
      noMfa = await staff(false),
      player = await staff(true, "player");
    await expect(service.queue(noMfa)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.queue(player)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.read(s, r.caseId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await service.claim(s, r.caseId);
    await expect(service.read(other, r.caseId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const view = await service.read(s, r.caseId);
    expect(view.evidence.content.body).toBe("selected private fixture");
    expect(view.audit.map((a) => a.action)).toContain("evidence.read");
    now = new Date(now.getTime() + 300001);
    await expect(service.read(s, r.caseId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("hides only selected content, records reasons, and permits one appeal with a different reviewer within seven days", async () => {
    const m = await message(),
      r = await report(m.b.id, m.id),
      s = await staff(),
      other = await staff();
    await service.claim(s, r.caseId);
    await service.action(s, r.caseId, { action: "hide", reason: "Synthetic abuse" });
    expect((await pool.query("SELECT body FROM direct_messages WHERE id=$1", [m.id])).rows[0].body).toBe(
      "[Removed by moderation]",
    );
    await expect(service.action(s, r.caseId, { action: "dismiss", reason: "repeat" })).rejects.toMatchObject({
      code: "ALREADY_RESOLVED",
    });
    expect((await service.myCases(m.a.id)).cases[0]?.decisions[0]?.reason).toBe("Synthetic abuse");
    const submitted = await service.appeal(m.a.id, r.caseId, "Wrong context");
    expect(submitted.reviewDueAt).toEqual(new Date(now.getTime() + 7 * day));
    await expect(service.appeal(m.a.id, r.caseId, "repeat")).rejects.toMatchObject({ code: "ALREADY_RESOLVED" });
    await expect(service.claim(s, r.caseId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await service.claim(other, r.caseId);
    await service.action(other, r.caseId, { action: "overturn", reason: "Context changes decision" });
    expect((await pool.query("SELECT body FROM direct_messages WHERE id=$1", [m.id])).rows[0].body).toBe(
      "selected private fixture",
    );
    expect((await pool.query("SELECT id FROM command_receipts")).rowCount).toBe(0);
  });
  it("enforces messaging/play sanctions through shared admission policy without transferring game assets", async () => {
    const m = await message(),
      s = await staff();
    for (const action of ["suspend-messaging", "suspend-play"] as const) {
      const r = await report(m.b.id, m.id);
      await service.claim(s, r.caseId);
      await service.action(s, r.caseId, { action, reason: "Synthetic sanction", until: new Date(now.getTime() + day) });
    }
    for (const kind of ["messaging", "play"] as const)
      await expect(
        withTransaction(pool, (c) => assertModerationAllowed(c, "pact", m.a.id, kind, now)),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await withTransaction(pool, (c) => assertModerationAllowed(c, "pact", m.b.id, "play", now));
    expect((await pool.query("SELECT * FROM resource_balances")).rowCount).toBe(0);
    now = new Date(now.getTime() + day);
    await withTransaction(pool, (c) => assertModerationAllowed(c, "pact", m.a.id, "play", now));
  });
  it("closes through the existing privacy process and accepts a limited one-use appeal after closure", async () => {
    const m = await message(),
      r = await report(m.b.id, m.id),
      s = await staff();
    await service.claim(s, r.caseId);
    await service.action(s, r.caseId, { action: "close", reason: "Synthetic verified underage fixture" });
    const mail = (
      await pool.query<{ payload: { sealedToken: string } }>(
        "SELECT payload FROM outbox_events WHERE type='security.email.requested.v1' AND payload->>'accountId'=$1 AND payload->>'template'='moderation_decision'",
        [m.a.id],
      )
    ).rows[0];
    expect(mail).toBeDefined();
    const token = Buffer.from(box.open(mail!.payload.sealedToken)).toString("utf8");
    expect(await service.processClosures("closure-fixture")).toBe(1);
    expect(await service.processClosures("closure-fixture")).toBe(0);
    expect((await pool.query("SELECT status FROM accounts WHERE id=$1", [m.a.id])).rows[0].status).toBe("closing");
    await service.appealByToken(token, "I dispute this decision");
    await expect(service.appealByToken(token, "repeat")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("expires appeal capabilities, purges resolved evidence after 180 days and preserves only an explicit scoped hold", async () => {
    const m = await message(),
      s = await staff(),
      other = await staff(),
      first = await report(m.b.id, m.id),
      held = await report(m.b.id, m.id);
    for (const r of [first, held]) {
      await service.claim(s, r.caseId);
      await service.action(s, r.caseId, { action: "dismiss", reason: "No breach in fixture" });
    }
    now = new Date(start.getTime() + 15 * day);
    await expect(service.appeal(m.a.id, first.caseId, "late")).rejects.toMatchObject({ code: "EXPIRED" });
    now = new Date(start.getTime() + 179 * day);
    await pool.query("UPDATE sessions SET mfa_authenticated_at=$1,expires_at=$2,idle_expires_at=$2 WHERE id=$3", [
      now,
      new Date(now.getTime() + 7 * day),
      s.sessionId,
    ]);
    await service.claim(s, held.caseId);
    await service.hold(s, held.caseId, {
      basis: "Specific synthetic safety review",
      reviewAt: new Date(now.getTime() + 30 * day),
    });
    await pool.query("UPDATE sessions SET mfa_authenticated_at=$1,expires_at=$2,idle_expires_at=$2 WHERE id=$3", [
      now,
      new Date(now.getTime() + 7 * day),
      other.sessionId,
    ]);
    await expect(service.claim(other, held.caseId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    now = new Date(start.getTime() + 181 * day);
    await withTransaction(pool, (c) => service.retention.prune(c, now));
    expect(
      (await pool.query("SELECT case_id FROM moderation_evidence WHERE case_id=$1", [first.caseId])).rowCount,
    ).toBe(0);
    expect((await pool.query("SELECT case_id FROM moderation_evidence WHERE case_id=$1", [held.caseId])).rowCount).toBe(
      1,
    );
    now = new Date(start.getTime() + 210 * day);
    await withTransaction(pool, (c) => service.retention.prune(c, now));
    expect((await pool.query("SELECT case_id FROM moderation_evidence WHERE case_id=$1", [held.caseId])).rowCount).toBe(
      0,
    );
  });
});

describe("PACT-063 public content coverage", () => {
  it("hides and overturns seeded doxxing and abuse reports on profiles, posts, Articles, Court profiles, pins and hosted Seals", async () => {
    const m = await message(),
      reviewer = await staff(),
      appealReviewer = await staff(),
      post = randomUUID(),
      article = randomUUID(),
      court = randomUUID(),
      pin = randomUUID(),
      seal = randomUUID();
    await pool.query(
      "INSERT INTO chronicle_posts(id,product_scope,author_kingdom_id,type,version,title,commentary,expires_game_time_ms,status,published_at,command_id) VALUES($1,'pact',$2,'notice',1,'Fixture post','Synthetic exposed data',60000,'published',$3,$4)",
      [post, m.a.kingdom, now, randomUUID()],
    );
    await pool.query(
      "INSERT INTO kingdom_articles(id,product_scope,author_kingdom_id,version,title,body,created_at,published_at,status,signed_command_id,content_digest) VALUES($1,'pact',$2,1,'Fixture Article','Synthetic abuse',$3,$3,'active',$4,'fixture-digest')",
      [article, m.a.kingdom, now, randomUUID()],
    );
    await pool.query(
      "INSERT INTO courts(id,product_scope,handle,title,description,owner_kingdom_id,join_mode,created_at) VALUES($1,'pact',$2,'Fixture Court','Synthetic exposed data',$3,'open',$4)",
      [court, "fixture_" + randomUUID().slice(0, 8), m.a.kingdom, now],
    );
    await pool.query(
      "INSERT INTO court_pins(id,court_id,slot,author_kingdom_id,body,created_at) VALUES($1,$2,1,$3,'Synthetic pin abuse',$4)",
      [pin, court, m.a.kingdom, now],
    );
    const kid = "fixture-" + randomUUID();
    await pool.query(
      "INSERT INTO seal_signing_keys(kid,product_scope,public_jwk,encrypted_private_key,created_at) VALUES($1,'pact','{}',$2,$3)",
      [kid, Buffer.alloc(32), now],
    );
    await pool.query(
      "INSERT INTO evidence_seals(id,product_scope,creator_kingdom_id,record_type,record_id,preview_payload,signed_payload,signature,kid,status,created_at,published_at,command_id) VALUES($1,'pact',$2,'message',$3,'{}','{}','fixture-signature',$4,'published',$5,$5,$6)",
      [seal, m.a.kingdom, m.id, kid, now, randomUUID()],
    );
    for (const [kind, id] of [
      ["profile", m.a.kingdom],
      ["post", post],
      ["article", article],
      ["court", court],
      ["pin", pin],
      ["seal", seal],
    ] as const) {
      for (const category of ["doxxing", "abuse"] as const) {
        const r = await service.report(m.b.id, {
          reportKey: randomUUID(),
          kind,
          targetId: id,
          category,
          details: "Synthetic public report",
        });
        await service.claim(reviewer, r.caseId);
        await service.action(reviewer, r.caseId, { action: "hide", reason: "Synthetic " + category + " removal" });
        await service.appeal(m.a.id, r.caseId, "Synthetic appeal");
        await service.claim(appealReviewer, r.caseId);
        await service.action(appealReviewer, r.caseId, {
          action: "overturn",
          reason: "Synthetic review with different staff",
        });
        expect((await service.read(appealReviewer, r.caseId)).audit.map((a) => a.action)).toContain("overturn");
      }
    }
    expect((await pool.query("SELECT status FROM chronicle_posts WHERE id=$1", [post])).rows[0].status).toBe(
      "published",
    );
    expect((await pool.query("SELECT status FROM kingdom_articles WHERE id=$1", [article])).rows[0].status).toBe(
      "active",
    );
    expect((await pool.query("SELECT signature,status FROM evidence_seals WHERE id=$1", [seal])).rows[0]).toEqual({
      signature: "fixture-signature",
      status: "published",
    });
    expect((await pool.query("SELECT id FROM command_receipts")).rowCount).toBe(0);
  });
});
