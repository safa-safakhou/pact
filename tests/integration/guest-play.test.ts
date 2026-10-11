import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import { AesGcmSecretBox, IdentityService, LocalCompromisedPasswordChecker, TokenDigester } from "@pact/identity";
import { KingdomService, WorldViewService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { OAuthService } from "@pact/oauth";
import { OnboardingService } from "@pact/onboarding";
import { WorldClockService } from "@pact/world";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { registerGuestRoutes } from "../../services/api/src/guest-routes.js";
import { registerIdentityRoutes } from "../../services/api/src/identity-routes.js";
import { registerOAuthRoutes } from "../../services/api/src/oauth-authority-routes.js";
import { OperatorPreflight } from "../../services/api/src/operator-preflight.js";

let admin: Pool, pool: Pool, schema: string, identity: IdentityService, kingdom: KingdomService;
let oauth: OAuthService;
const server = Fastify({ genReqId: () => randomUUID() }),
  origin = "https://pact.example";
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
  admin = createPool(url);
  schema = await createTestSchema(admin, "guest");
  pool = createSchemaPool(url, schema);
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set([origin]),
    clock: { now: () => new Date() },
    digester: new TokenDigester(Buffer.alloc(32, 9)),
    secretBox: new AesGcmSecretBox(Buffer.alloc(32, 7)),
    compromisedPasswords: new LocalCompromisedPasswordChecker([]),
    guestPlayEnabled: true,
  });
  const onboarding = new OnboardingService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    now: () => new Date(),
  });
  const world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  await pool.query(
    "UPDATE world_clocks SET next_tick_due_at=clock_timestamp()+interval '5 minutes',last_heartbeat_at=clock_timestamp()",
  );
  kingdom = new KingdomService(pool, { productScope: "pact", onboarding, world, ledger: new ResourceLedger("pact") });
  registerGuestRoutes(server, identity, onboarding, kingdom, origin);
  const register = JSON.parse(
    readFileSync(new URL("../../infra/production/operator-register.mvp-test.json", import.meta.url), "utf8"),
  );
  register.documents.termsVersion = "terms-v1";
  registerIdentityRoutes(server, identity, onboarding, OperatorPreflight.parse(register, "terms-v1"), kingdom);
  oauth = new OAuthService(pool, {
    productScope: "pact",
    issuer: origin,
    mcpResource: `${origin}/mcp`,
    humanResource: `${origin}/native`,
    clock: { now: () => new Date() },
  });
  registerOAuthRoutes(server, oauth, identity);
});

afterAll(async () => {
  await server.close();
  await pool?.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
async function join(entryKey = randomUUID(), nickname = "Professor Potato") {
  const r = await server.inject({
    method: "POST",
    url: "/v1/play/join",
    headers: { origin },
    payload: { entryKey, nickname },
  });
  expect(r.statusCode, r.body).toBe(200);
  return { ...r.json(), entryKey, cookie: r.headers["set-cookie"]?.toString().split(";")[0] ?? "" };
}

it("joins two distinct guests without email, resumes exactly once, restores CSRF, and lists only public neighbors", async () => {
  const a = await join(),
    b = await join();
  expect(a.kingdomId).not.toBe(b.kingdomId);
  expect(a.handle).not.toBe(b.handle);
  const resumed = await join(a.entryKey, "Changed nickname");
  expect(resumed.kingdomId).toBe(a.kingdomId);
  const session = await server.inject({ url: "/v1/play", headers: { cookie: a.cookie } });
  expect(session.json()).toMatchObject({ guest: true, accountId: a.accountId, csrfToken: a.csrfToken });
  const rows = (await pool.query("SELECT email,email_verified_at,is_guest FROM accounts")).rows;
  expect(rows).toEqual([
    { email: null, email_verified_at: null, is_guest: true },
    { email: null, email_verified_at: null, is_guest: true },
  ]);
  expect((await pool.query("SELECT count(*)::int AS n FROM kingdoms")).rows[0].n).toBe(2);
  expect(
    (await pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE type='security.email.requested.v1'")).rows[0]
      .n,
  ).toBe(0);
  const people = (await server.inject({ url: "/v1/play/people", headers: { cookie: a.cookie } })).json();
  expect(people.players).toEqual([{ kingdomId: b.kingdomId, handle: b.handle, displayName: "Professor Potato" }]);
  const views = new WorldViewService(pool, "pact");
  expect((await views.read(a.accountId, a.kingdomId, 15))?.audience).toBe("owner");
  expect((await views.read(a.accountId, b.kingdomId, 15))?.audience).not.toBe("owner");
  await pool.query("UPDATE kingdoms SET moderation_case_id=$1 WHERE id=$2", [randomUUID(), b.kingdomId]);
  expect((await server.inject({ url: "/v1/play/people", headers: { cookie: a.cookie } })).json().players).toEqual([]);
});
it("rejects a cross-origin join and anonymous player listing", async () => {
  expect(
    (
      await server.inject({
        method: "POST",
        url: "/v1/play/join",
        headers: { origin: "https://elsewhere.example" },
        payload: { entryKey: randomUUID() },
      })
    ).statusCode,
  ).toBe(403);
  expect((await server.inject({ url: "/v1/play/people" })).statusCode).toBe(403);
});
it("keeps guest session ownership and CSRF stable across repeat reads", async () => {
  const a = await join(),
    token = decodeURIComponent(a.cookie.split("=")[1]);
  const first = await identity.guestSession(token),
    second = await identity.guestSession(token);
  expect(first).toEqual(second);
  const [x, y] = await Promise.all([join(a.entryKey), join(a.entryKey)]);
  expect(x.kingdomId).toBe(a.kingdomId);
  expect(y.kingdomId).toBe(a.kingdomId);
});

it("paginates a world with 100 more model-free guests without duplicates or private fields", async () => {
  const created = [];
  for (let batch = 0; batch < 10; batch++)
    created.push(...(await Promise.all(Array.from({ length: 10 }, () => join()))));
  const cookie = created[0].cookie,
    ids = new Set<string>();
  for (let offset = 0; offset < 140; offset += 20) {
    const response = await server.inject({ url: `/v1/play/people?offset=${offset}`, headers: { cookie } });
    expect(response.statusCode).toBe(200);
    const page = response.json();
    expect(page.players.length).toBeLessThanOrEqual(20);
    for (const player of page.players) {
      expect(Object.keys(player).sort()).toEqual(["displayName", "handle", "kingdomId"]);
      expect(ids.has(player.kingdomId)).toBe(false);
      ids.add(player.kingdomId);
    }
    if (!page.hasMore) break;
  }
  expect(ids.size).toBe(101);
  expect(ids.has(created[0].kingdomId)).toBe(false);
});

it("resumes an existing guest during a domain move without creating another account or kingdom", async () => {
  const a = await join();
  const before = (
    await pool.query(
      "SELECT (SELECT count(*) FROM accounts)::int AS accounts, (SELECT count(*) FROM kingdoms)::int AS kingdoms",
    )
  ).rows[0];
  const resumed = await server.inject({
    method: "POST",
    url: "/v1/play/join",
    headers: { origin },
    payload: { entryKey: a.entryKey, existingOnly: true },
  });
  expect(resumed.statusCode, resumed.body).toBe(200);
  expect(resumed.json()).toMatchObject({ accountId: a.accountId, kingdomId: a.kingdomId, handle: a.handle });
  expect(
    (
      await pool.query(
        "SELECT (SELECT count(*) FROM accounts)::int AS accounts, (SELECT count(*) FROM kingdoms)::int AS kingdoms",
      )
    ).rows[0],
  ).toEqual(before);
});

it("rejects an unknown recovery key instead of founding a replacement kingdom", async () => {
  const before = (
    await pool.query(
      "SELECT (SELECT count(*) FROM accounts)::int AS accounts, (SELECT count(*) FROM kingdoms)::int AS kingdoms",
    )
  ).rows[0];
  const response = await server.inject({
    method: "POST",
    url: "/v1/play/join",
    headers: { origin },
    payload: { entryKey: randomUUID(), existingOnly: true },
  });
  expect(response.statusCode).toBe(403);
  expect(response.headers["set-cookie"]).toBeUndefined();
  expect(
    (
      await pool.query(
        "SELECT (SELECT count(*) FROM accounts)::int AS accounts, (SELECT count(*) FROM kingdoms)::int AS kingdoms",
      )
    ).rows[0],
  ).toEqual(before);
});

const savedPassword = "A private synthetic recovery password 2026!";
async function claimToken(accountId: string) {
  const row = (
    await pool.query(
      "SELECT payload FROM outbox_events WHERE type='security.email.requested.v1' AND payload->>'accountId'=$1 ORDER BY id DESC LIMIT 1",
      [accountId],
    )
  ).rows[0];
  return Buffer.from(new AesGcmSecretBox(Buffer.alloc(32, 7)).open(row.payload.sealedToken)).toString("utf8");
}
async function save(a: Awaited<ReturnType<typeof join>>, email: string) {
  const response = await server.inject({
    method: "POST",
    url: "/v1/auth/guest/save",
    headers: { cookie: a.cookie, origin, "x-csrf-token": a.csrfToken },
    payload: { email, password: savedPassword, age18Declared: true, acceptedTermsVersion: "terms-v1" },
  });
  expect(response.statusCode, response.body).toBe(200);
  return response;
}
it("bootstraps independent tabs without invalidating existing CSRF and rejects anonymous/cross-origin writes", async () => {
  const a = await join();
  const first = await server.inject({ url: "/v1/auth/session", headers: { cookie: a.cookie } });
  const second = await server.inject({ url: "/v1/auth/session", headers: { cookie: a.cookie } });
  expect(first.headers["cache-control"]).toBe("no-store");
  expect(first.json().csrfToken).toBe(second.json().csrfToken);
  for (const csrf of [a.csrfToken, first.json().csrfToken])
    await expect(identity.authorizeCookieWrite(a.cookie.split("=")[1], csrf, origin)).resolves.toMatchObject({
      accountId: a.accountId,
    });
  expect((await server.inject({ url: "/v1/auth/session" })).statusCode).toBe(403);
  expect(
    (
      await server.inject({
        method: "POST",
        url: "/v1/auth/guest/save",
        headers: { cookie: a.cookie, origin: "https://evil.example", "x-csrf-token": first.json().csrfToken },
        payload: {
          email: "fake@example.test",
          password: savedPassword,
          age18Declared: true,
          acceptedTermsVersion: "terms-v1",
        },
      })
    ).statusCode,
  ).toBe(403);
});
it("verifies guest conversion once, preserves original kingdom and grants, then signs in on another device", async () => {
  const a = await join(),
    email = `save-${randomUUID()}@example.test`;
  const grant = (
    await pool.query(
      "INSERT INTO oauth_grants(product_scope,account_id,client_id,scopes,token_family_id,expires_at) VALUES('pact',$1,'fixture',ARRAY['world:read'],gen_random_uuid(),clock_timestamp()+interval '1 day') RETURNING id",
      [a.accountId],
    )
  ).rows[0].id;
  expect((await save(a, email)).statusCode).toBe(200);
  await expect(identity.login({ email, password: savedPassword, ip: "192.0.2.1" })).rejects.toMatchObject({
    code: "INVALID_CREDENTIALS",
  });
  const token = await claimToken(a.accountId);
  const results = await Promise.all(
    [identity.verifyEmail(token), identity.verifyEmail(token)].map((p) =>
      p.then(
        () => true,
        () => false,
      ),
    ),
  );
  expect(results.sort()).toEqual([false, true]);
  expect((await kingdom.getByAccount(a.accountId))?.kingdomId).toBe(a.kingdomId);
  expect((await pool.query("SELECT revoked_at FROM oauth_grants WHERE id=$1", [grant])).rows[0].revoked_at).toBeNull();
  await expect(identity.joinGuest(a.entryKey, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
  const login = await server.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password: savedPassword },
  });
  expect(login.statusCode, login.body).toBe(200);
  const cookie = String(login.headers["set-cookie"]).split(";")[0] ?? "";
  const boot = await server.inject({ url: "/v1/auth/session", headers: { cookie } });
  expect(boot.json()).toMatchObject({ accountId: a.accountId, guest: false });
  await expect(
    identity.authorizeCookieWrite(cookie.split("=")[1] ?? "", boot.json().csrfToken, origin),
  ).resolves.toMatchObject({ accountId: a.accountId });
  expect((await server.inject({ url: "/v1/kingdom/me", headers: { cookie } })).json().kingdomId).toBe(a.kingdomId);
  const logout = await server.inject({
    method: "POST",
    url: "/v1/auth/logout",
    headers: { cookie, origin, "x-csrf-token": boot.json().csrfToken },
  });
  expect(logout.statusCode).toBe(200);
  expect((await server.inject({ url: "/v1/auth/session", headers: { cookie } })).statusCode).toBe(403);
  expect((await server.inject({ url: "/v1/auth/session", headers: { cookie: a.cookie } })).statusCode).toBe(200);
  expect(
    (
      await pool.query(
        "SELECT pending_password_hash FROM email_verification_tokens WHERE token_hash IS NOT NULL AND account_id=$1",
        [a.accountId],
      )
    ).rows[0].pending_password_hash,
  ).toBeNull();
});
it("fails closed on expired, replaced and conflicting guest claims, without creating a new owner", async () => {
  const a = await join(),
    b = await join(),
    email = `conflict-${randomUUID()}@example.test`;
  expect((await save(a, email)).statusCode).toBe(200);
  const old = await claimToken(a.accountId);
  expect((await save(a, email)).statusCode).toBe(200);
  await expect(identity.verifyEmail(old)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  const newest = await claimToken(a.accountId);
  expect((await save(b, email)).statusCode).toBe(200);
  await identity.verifyEmail(await claimToken(b.accountId));
  await expect(identity.verifyEmail(newest)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  expect(await identity.isGuest(a.accountId)).toBe(true);
  expect((await kingdom.getByAccount(a.accountId))?.kingdomId).toBe(a.kingdomId);
  const c = await join();
  await save(c, `expire-${randomUUID()}@example.test`);
  const expired = await claimToken(c.accountId);
  await pool.query(
    "UPDATE email_verification_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE account_id=$1",
    [c.accountId],
  );
  await expect(identity.verifyEmail(expired)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  expect(await identity.isGuest(c.accountId)).toBe(true);
});

it("replaces recovery codes atomically and retries lost responses without founding new kingdoms", async () => {
  const a = await join(),
    b = await join(),
    newCode = randomUUID();
  const headers = { origin, cookie: a.cookie, "x-csrf-token": a.csrfToken };
  const replace = (currentCode = a.entryKey, replacement = newCode) =>
    server.inject({
      method: "POST",
      url: "/v1/auth/guest/recovery/replace",
      headers,
      payload: { currentCode, newCode: replacement },
    });
  const before = (await pool.query("SELECT count(*)::int AS n FROM accounts")).rows[0].n;
  expect((await replace(b.entryKey)).statusCode).toBe(403);
  const first = await replace();
  expect(first.statusCode, first.body).toBe(200);
  expect(first.json()).toEqual({ recoveryCode: newCode });
  expect((await replace()).json()).toEqual(first.json());
  expect((await replace(a.entryKey, randomUUID())).statusCode).toBe(403);
  for (const existingOnly of [true, false]) {
    const old = await server.inject({
      method: "POST",
      url: "/v1/play/join",
      headers: { origin },
      payload: { entryKey: a.entryKey, existingOnly },
    });
    expect(old.statusCode).toBe(403);
  }
  expect((await join(newCode)).kingdomId).toBe(a.kingdomId);
  expect((await pool.query("SELECT count(*)::int AS n FROM accounts")).rows[0].n).toBe(before);
  const noCsrf = await server.inject({
    method: "POST",
    url: "/v1/auth/guest/recovery/replace",
    headers: { origin, cookie: a.cookie },
    payload: { currentCode: newCode, newCode: randomUUID() },
  });
  expect(noCsrf.statusCode).toBe(403);
});

it("lists current devices and revokes only the authenticated owner's selected session", async () => {
  const a = await join(),
    otherDevice = await join(a.entryKey),
    stranger = await join();
  const token = (cookie: string) => decodeURIComponent(cookie.split("=")[1] ?? "");
  const current = await identity.authenticate(token(a.cookie));
  const other = await identity.authenticate(token(otherDevice.cookie));
  const foreign = await identity.authenticate(token(stranger.cookie));
  const inventory = await identity.connectionInventory(token(a.cookie));
  expect(inventory.sessions.some((s) => s.id === current.sessionId && s.current)).toBe(true);
  const revoke = (sessionId: string) =>
    server.inject({
      method: "POST",
      url: "/v1/auth/sessions/revoke",
      headers: { origin, cookie: a.cookie, "x-csrf-token": a.csrfToken },
      payload: { sessionId },
    });
  expect((await revoke(foreign.sessionId)).statusCode).toBe(200);
  await expect(identity.authenticate(token(stranger.cookie))).resolves.toBeDefined();
  expect((await revoke(other.sessionId)).statusCode).toBe(200);
  await expect(identity.authenticate(token(otherDevice.cookie))).rejects.toThrow();
  await expect(identity.authenticate(token(a.cookie))).resolves.toBeDefined();
  expect((await revoke(current.sessionId)).statusCode).toBe(200);
  await expect(identity.authenticate(token(a.cookie))).rejects.toThrow();
});

function browser() {
  const cookies = new Map<string, string>();
  return {
    cookies,
    async request(url: string, payload?: Record<string, unknown>, csrf?: string, requestOrigin = origin) {
      const r = await server.inject({
        method: payload ? "POST" : "GET",
        url,
        headers: {
          origin: requestOrigin,
          cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(csrf ? { "x-csrf-token": csrf } : {}),
        },
        ...(payload ? { payload } : {}),
      });
      const set = r.headers["set-cookie"];
      for (const value of Array.isArray(set) ? set : set ? [String(set)] : []) {
        const pair = value.split(";")[0] ?? "",
          at = pair.indexOf("=");
        if (value.includes("Max-Age=0")) cookies.delete(pair.slice(0, at));
        else cookies.set(pair.slice(0, at), pair.slice(at + 1));
      }
      return r;
    },
  };
}
it("remembers three independently proved kingdoms, switches without new sessions, and forgets only this browser login", async () => {
  const client = browser();
  const owners: { accountId: string; entryKey: ReturnType<typeof randomUUID> }[] = [];
  for (const nickname of ["Synthetic Amber", "Synthetic Birch", "Synthetic Cedar"]) {
    const entryKey = randomUUID();
    const r = await client.request("/v1/play/join", { entryKey, nickname });
    expect(r.statusCode).toBe(200);
    owners.push({ ...r.json(), entryKey });
    for (const c of r.headers["set-cookie"] as string[]) expect(c).toContain("HttpOnly; SameSite=Lax");
  }
  const list = await client.request("/v1/auth/accounts");
  expect(list.headers["cache-control"]).toBe("no-store");
  const rows = list.json().accounts;
  expect(rows).toHaveLength(3);
  expect(rows.map((a: { displayName: string }) => a.displayName)).toEqual(
    expect.arrayContaining(["Synthetic Amber", "Synthetic Birch", "Synthetic Cedar"]),
  );
  expect(rows.filter((a: { current: boolean }) => a.current)).toHaveLength(1);
  expect(list.body).not.toContain("sessionToken");
  expect(list.body).not.toContain("recoveryCode");
  const firstOwner = owners[0];
  const secondOwner = owners[1];
  if (!firstOwner || !secondOwner) throw Error("Missing synthetic owner fixture");
  const token = decodeURIComponent(client.cookies.get(`__Host-pact_saved_${firstOwner.accountId}`) ?? "");
  const before = await identity.authenticate(token, false);
  const idleBefore = (await pool.query("SELECT idle_expires_at FROM sessions WHERE id=$1", [before.sessionId])).rows[0];
  await client.request("/v1/auth/accounts");
  const idleAfter = (await pool.query("SELECT idle_expires_at FROM sessions WHERE id=$1", [before.sessionId])).rows[0];
  expect(idleAfter).toEqual(idleBefore);
  const a = rows.find((r: { accountId: string }) => r.accountId === firstOwner.accountId);
  expect((await client.request("/v1/auth/accounts/switch", { accountId: a.accountId }, a.csrfToken)).statusCode).toBe(
    200,
  );
  const after = await identity.authenticate(decodeURIComponent(client.cookies.get("pact_session") ?? ""), false);
  expect(after.sessionId).toBe(before.sessionId);
  expect(after.authenticatedAt).toEqual(before.authenticatedAt);
  expect(after.absoluteExpiresAt).toEqual(before.absoluteExpiresAt);
  expect(
    (await client.request("/v1/auth/accounts/recovery-check", { code: firstOwner.entryKey }, a.csrfToken)).json(),
  ).toEqual({ matches: true });
  expect(
    (await client.request("/v1/auth/accounts/recovery-check", { code: secondOwner.entryKey }, a.csrfToken)).json(),
  ).toEqual({ matches: false });
  const secondDevice = await join(secondOwner.entryKey);
  const b = rows.find((r: { accountId: string }) => r.accountId === secondOwner.accountId);
  expect((await client.request("/v1/auth/accounts/forget", { accountId: b.accountId }, b.csrfToken)).statusCode).toBe(
    200,
  );
  expect((await client.request("/v1/auth/accounts")).json().accounts).toHaveLength(2);
  expect((await server.inject({ url: "/v1/play", headers: { cookie: secondDevice.cookie } })).json().guest).toBe(true);
  expect((await client.request("/v1/auth/session")).json().accountId).toBe(a.accountId);
});

it("rejects forged account cookies, foreign or stale CSRF, cross-origin switching and unavailable sessions", async () => {
  const client = browser(),
    a = await join(),
    b = await join();
  await client.request("/v1/play/join", { entryKey: a.entryKey, existingOnly: true });
  await client.request("/v1/play/join", { entryKey: b.entryKey, existingOnly: true });
  const rows = (await client.request("/v1/auth/accounts")).json().accounts;
  const first = rows.find((r: { accountId: string }) => r.accountId === a.accountId),
    second = rows.find((r: { accountId: string }) => r.accountId === b.accountId);
  expect(
    (await client.request("/v1/auth/accounts/switch", { accountId: first.accountId }, second.csrfToken)).statusCode,
  ).toBe(403);
  expect(
    (
      await client.request(
        "/v1/auth/accounts/switch",
        { accountId: first.accountId },
        first.csrfToken,
        "https://foreign.example",
      )
    ).statusCode,
  ).toBe(403);
  expect(
    (await client.request("/v1/auth/accounts/switch", { accountId: randomUUID() }, first.csrfToken)).statusCode,
  ).toBe(403);
  const genuine = client.cookies.get(`__Host-pact_saved_${a.accountId}`) ?? "";
  client.cookies.set(`__Host-pact_saved_${a.accountId}`, client.cookies.get(`__Host-pact_saved_${b.accountId}`) ?? "");
  expect(
    (await client.request("/v1/auth/accounts/switch", { accountId: a.accountId }, second.csrfToken)).statusCode,
  ).toBe(403);
  client.cookies.set(`__Host-pact_saved_${a.accountId}`, genuine);
  expect(
    (await client.request("/v1/auth/accounts/switch", { accountId: first.accountId }, first.csrfToken)).statusCode,
  ).toBe(200);
  expect((await client.request("/v1/auth/logout", {}, second.csrfToken)).statusCode).toBe(403);
  await pool.query("UPDATE sessions SET idle_expires_at=now()-interval '1 second' WHERE account_id=$1", [b.accountId]);
  expect((await client.request("/v1/auth/accounts")).json().accounts).toHaveLength(1);
  expect(
    (await client.request("/v1/auth/accounts/switch", { accountId: second.accountId }, second.csrfToken)).statusCode,
  ).toBe(403);
  await pool.query("UPDATE accounts SET status='closing' WHERE id=$1", [a.accountId]);
  expect((await client.request("/v1/auth/accounts")).json().accounts).toEqual([]);
  expect(
    (await client.request("/v1/auth/accounts/switch", { accountId: first.accountId }, first.csrfToken)).statusCode,
  ).toBe(403);
});

it("binds new OAuth grants to the selected account and keeps old grants across switching and local forgetting", async () => {
  const client = browser();
  await client.request("/v1/play/join", { entryKey: randomUUID(), nickname: "Synthetic Connect A" });
  await client.request("/v1/play/join", { entryKey: randomUUID(), nickname: "Synthetic Connect B" });
  const rows = (await client.request("/v1/auth/accounts")).json().accounts;
  const a = rows.find((r: { current: boolean }) => !r.current),
    b = rows.find((r: { current: boolean }) => r.current);
  const app = await oauth.registerDynamic({
    displayName: "Synthetic chooser",
    audience: "mcp",
    redirectUris: ["https://client.example/callback"],
  });
  const verifier = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const q = {
    client_id: app.clientId,
    redirect_uri: "https://client.example/callback",
    scope: "world:read game:act",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource: `${origin}/mcp`,
    audience: "mcp",
    subject_label: "Selected synthetic kingdom",
  };
  expect(
    (await client.request("/oauth/authorize", { ...q, selected_account_id: a.accountId }, b.csrfToken)).statusCode,
  ).toBe(403);
  await client.request("/v1/auth/accounts/switch", { accountId: a.accountId }, a.csrfToken);
  const authorized = await client.request("/oauth/authorize", { ...q, selected_account_id: a.accountId }, a.csrfToken);
  expect(authorized.statusCode, authorized.body).toBe(200);
  const tokens = await oauth.exchangeAuthorizationCode({
    clientId: app.clientId,
    redirectUri: q.redirect_uri,
    code: authorized.json().code,
    codeVerifier: verifier,
    resource: q.resource,
  });
  expect((await oauth.introspectAccessToken(tokens.accessToken))?.accountId).toBe(a.accountId);
  await client.request("/v1/auth/accounts/switch", { accountId: b.accountId }, b.csrfToken);
  await client.request("/v1/auth/accounts/forget", { accountId: a.accountId }, a.csrfToken);
  expect((await oauth.introspectAccessToken(tokens.accessToken))?.accountId).toBe(a.accountId);
  expect((await client.request("/v1/auth/session")).json().accountId).toBe(b.accountId);
});

it("prunes a globally revoked saved account while preserving other owners on the same browser", async () => {
  const client = browser();
  await client.request("/v1/play/join", { entryKey: randomUUID(), nickname: "Synthetic Revoke A" });
  await client.request("/v1/play/join", { entryKey: randomUUID(), nickname: "Synthetic Revoke B" });
  const rows = (await client.request("/v1/auth/accounts")).json().accounts;
  const a = rows.find((r: { current: boolean }) => !r.current),
    b = rows.find((r: { current: boolean }) => r.current);
  await identity.signOutEverywhere(decodeURIComponent(client.cookies.get(`__Host-pact_saved_${a.accountId}`) ?? ""));
  const list = (await client.request("/v1/auth/accounts")).json();
  expect(list.accounts.map((r: { accountId: string }) => r.accountId)).toEqual([b.accountId]);
  expect(client.cookies.has(`__Host-pact_saved_${a.accountId}`)).toBe(false);
  expect((await client.request("/v1/auth/session")).json().accountId).toBe(b.accountId);
});
