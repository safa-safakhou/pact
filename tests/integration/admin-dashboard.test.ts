import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AdminProvisioning,
  AesGcmSecretBox,
  adminEmail,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
  totpForFixture,
} from "@pact/identity";
import { WorldClockService } from "@pact/world";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AdminReader } from "../../services/api/src/admin-reader.js";
import { registerAdminRoutes } from "../../services/api/src/admin-routes.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool, pool: Pool, schema: string, identity: IdentityService, provision: AdminProvisioning;
let now = new Date("2026-10-14T12:00:00Z");
const password = "Synthetic administrator password 2026",
  digester = new TokenDigester(Buffer.alloc(32, 4)),
  box = new AesGcmSecretBox(Buffer.alloc(32, 8)),
  checker = new LocalCompromisedPasswordChecker([]);
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "admin_dashboard");
  pool = createSchemaPool(url, schema);
  identity = new IdentityService(pool, {
    productScope: "pact",
    clock: { now: () => now },
    digester,
    secretBox: box,
    compromisedPasswords: checker,
    currentTermsVersion: "fixture",
    allowedOrigins: new Set(["https://pact.example"]),
  });
  provision = new AdminProvisioning(pool, "pact", box, digester, checker);
  await new WorldClockService(pool, "pact").bootstrap();
});
afterAll(async () => {
  await pool?.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
describe("administrator provisioning and projections", () => {
  it("creates exactly one independent administrator under a race, then enforces actual MFA/revocation and one-use recovery", async () => {
    expect(await provision.available()).toBe(true);
    await expect(
      identity.signup({ email: adminEmail("admin"), password, age18Declared: true, acceptedTermsVersion: "fixture" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const enrollment = provision.begin(),
      secret = Buffer.from(enrollment.secret, "base64url"),
      code = totpForFixture(secret, now);
    await expect(
      provision.complete({ username: "admin", password, secret: enrollment.secret, code: "invalid" }, now),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const results = await Promise.allSettled([
      provision.complete({ username: "admin", password, secret: enrollment.secret, code }, now),
      provision.complete({ username: "second", password, secret: enrollment.secret, code }, now),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await provision.available()).toBe(false);
    const result = results.find((r) => r.status === "fulfilled");
    if (!result || result.status !== "fulfilled") throw Error("No admin created");
    const username = result.value.username,
      email = adminEmail(username);
    expect((await pool.query("SELECT count(*)::int AS count FROM kingdoms")).rows[0]?.count).toBe(0);
    expect((await pool.query("SELECT count(*)::int AS count FROM kingdom_drafts")).rows[0]?.count).toBe(0);
    await expect(identity.login({ email, password, ip: "192.0.2.1" })).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    const session = await identity.login({ email, password, mfaCode: code, ip: "192.0.2.1" });
    const server = Fastify({ genReqId: () => randomUUID() });
    registerAdminRoutes(server, identity, new AdminReader(pool, "pact", () => now), provision, undefined, () => now);
    const login = await server.inject({
      method: "POST",
      url: "/v1/admin/login",
      headers: { origin: "https://pact.example" },
      payload: { username, password, mfaCode: code },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().csrfToken).toBeTypeOf("string");
    const cookies = login.headers["set-cookie"] as string[];
    const cookie = cookies.find((c) => c.startsWith("pact_session="))?.split(";")[0];
    expect((await server.inject({ url: "/v1/admin/overview", headers: { cookie } })).statusCode).toBe(200);
    await expect(identity.requireStaffSession(session.sessionToken)).resolves.toMatchObject({
      accountId: session.accountId,
    });
    now = new Date(now.getTime() + 300001);
    expect((await server.inject({ url: "/v1/admin/overview", headers: { cookie } })).statusCode).toBe(403);
    await server.close();
    await expect(identity.requireStaffSession(session.sessionToken)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const recovery = result.value.recoveryCodes[0];
    if (!recovery) throw new Error("Missing recovery code");
    const fresh = await identity.login({ email, password, mfaCode: recovery, ip: "192.0.2.1" });
    await expect(identity.login({ email, password, mfaCode: recovery, ip: "192.0.2.1" })).rejects.toMatchObject({
      code: "INVALID_MFA",
    });
    await identity.signOutSession(fresh.sessionToken);
    await expect(identity.requireStaffSession(fresh.sessionToken)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("returns scoped totals, exact 1/600 resources, metadata-only events, reporting windows and literal bounded search", async () => {
    const owner = randomUUID(),
      kingdom = randomUUID();
    await pool.query(
      "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,created_at) VALUES($1,'pact','player@example.test','fixture',$2,$2)",
      [owner, now],
    );
    await pool.query(
      `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,'literal_name','Synthetic player','portrait.wolf',$3,0,0,60000,$4)`,
      [kingdom, owner, now, randomUUID()],
    );
    await pool.query(
      "INSERT INTO ledger_kingdoms(product_scope,kingdom_id,grant_expires_game_time_ms) VALUES('pact',$1,60000)",
      [kingdom],
    );
    await pool.query(
      "INSERT INTO resource_balances(product_scope,kingdom_id,resource,ordinary_units,allowance_units,locked_units,storage_cap_units,allowance_cap_units,production_per_minute_units) VALUES('pact',$1,'grain',601,0,1,100000,100000,11)",
      [kingdom],
    );
    await pool.query(
      "INSERT INTO resource_balances(product_scope,kingdom_id,resource,ordinary_units,storage_cap_units,allowance_cap_units,production_per_minute_units) SELECT 'other',gen_random_uuid(),'grain',0,0,0,0 WHERE false",
    );
    await pool.query(
      "INSERT INTO command_receipts(product_scope,command_id,canonical_payload_hash,code,receipt,created_at) VALUES('pact',$1,'fixture','OK','{}',$2),('other',$3,'fixture','PRIVATE_OTHER','{}',$2),('pact',$4,'fixture','OLD','{}',$5)",
      [randomUUID(), now, randomUUID(), randomUUID(), new Date(now.getTime() - 48 * 3600000)],
    );
    await pool.query(
      "INSERT INTO outbox_events(product_scope,event_id,type,payload,created_at) VALUES('pact',$1,'synthetic.public.v1',$2,$3)",
      [randomUUID(), JSON.stringify({ privateMessage: "DO_NOT_DISCLOSE" }), now],
    );
    const reader = new AdminReader(pool, "pact", () => now),
      view = await reader.overview(24);
    expect(view.identity.players).toBe(1);
    expect(view.game.society.kingdoms).toBe(1);
    expect(view.economy[0]).toMatchObject({ ordinary: "1 + 1/600", locked: "0 + 1/600", production: "0 + 11/600" });
    expect(view.platform.receipts).toEqual([{ code: "OK", count: 1 }]);
    expect(JSON.stringify(view)).not.toContain("DO_NOT_DISCLOSE");
    expect(JSON.stringify(view)).not.toContain("PRIVATE_OTHER");
    expect((await reader.overview(72)).platform.receipts).toHaveLength(2);
    expect((await reader.kingdoms("literal_", 0)).total).toBe(1);
    expect((await reader.kingdoms("%", 0)).total).toBe(0);
    expect((await reader.kingdoms("", 25)).players).toHaveLength(0);
    expect((await reader.kingdoms("' OR 1=1 --", 0)).total).toBe(0);
  });
  it("releases its transaction after an error and cannot mutate domain state", async () => {
    const reader = new AdminReader(pool, "pact", () => new Date(Number.NaN));
    await expect(reader.overview(24)).rejects.toThrow();
    expect((await pool.query("SELECT count(*)::int AS count FROM kingdoms")).rows[0]?.count).toBe(1);
    const normal = await new AdminReader(pool, "pact", () => now).overview(24);
    expect(normal.game.society.kingdoms).toBe(1);
  });
});
