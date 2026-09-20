import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
  totpForFixture,
} from "@pact/identity";
import { OnboardingError, OnboardingService } from "@pact/onboarding";
import { Telemetry } from "@pact/telemetry";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../../services/api/src/server.js";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const password = "A long test password 123!";
const nextPassword = "A different long password 456!";
const baseTime = new Date("2026-09-20T10:00:00.000Z");
let now = new Date(baseTime);
let admin: Pool;
let pool: Pool;
let schema: string;
let identity: IdentityService;
let onboarding: OnboardingService;
let secretBox: AesGcmSecretBox;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "identity");
  pool = createSchemaPool(connectionString, schema);
  const clock = { now: () => new Date(now) };
  secretBox = new AesGcmSecretBox(Buffer.alloc(32, 7));
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set(["https://pact.example"]),
    clock,
    digester: new TokenDigester(Buffer.alloc(32, 9)),
    secretBox,
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  onboarding = new OnboardingService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    now: clock.now,
  });
});

beforeEach(() => {
  now = new Date(baseTime);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function signup(email: string): Promise<{ accountId: string; verificationToken: string }> {
  await identity.signup({
    email,
    password,
    age18Declared: true,
    acceptedTermsVersion: "terms-v1",
  });
  const event = await pool.query<{ payload: { accountId: string; sealedToken: string } }>(
    `SELECT payload
     FROM outbox_events WHERE type = 'security.email.requested.v1'
       AND payload->>'template' = 'verify_email' ORDER BY id DESC LIMIT 1`,
  );
  const payload = event.rows[0]?.payload;
  if (!payload) throw new Error("Verification fixture missing");
  const verificationToken = Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8");
  expect(JSON.stringify(payload)).not.toContain(verificationToken);
  return { accountId: payload.accountId, verificationToken };
}

async function securityEmailToken(accountId: string, template: string): Promise<string> {
  const result = await pool.query<{ payload: { sealedToken: string } }>(
    `SELECT payload FROM outbox_events
     WHERE payload->>'accountId' = $1 AND payload->>'template' = $2 ORDER BY id DESC LIMIT 1`,
    [accountId, template],
  );
  const payload = result.rows[0]?.payload;
  if (!payload?.sealedToken) throw new Error(`Security email fixture missing: ${template}`);
  const token = Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8");
  expect(JSON.stringify(payload)).not.toContain(token);
  return token;
}

async function verifiedAccount(email: string): Promise<{ accountId: string; sessionToken: string; csrfToken: string }> {
  const created = await signup(email);
  await identity.verifyEmail(created.verificationToken);
  await onboarding.ensureDraft(created.accountId);
  const session = await identity.login({ email, password, ip: "192.0.2.10", label: "fixture" });
  return { accountId: created.accountId, sessionToken: session.sessionToken, csrfToken: session.csrfToken };
}

describe("signup, verification, and sessions", () => {
  it("normalizes concurrent signup and permits a verification token exactly once", async () => {
    const email = `Concurrent.${randomUUID()}@Example.COM`;
    await Promise.all([
      identity.signup({ email: `  ${email} `, password, age18Declared: true, acceptedTermsVersion: "terms-v1" }),
      identity.signup({ email: email.toLowerCase(), password, age18Declared: true, acceptedTermsVersion: "terms-v1" }),
    ]);
    const normalized = email.trim().toLowerCase();
    const accounts = await pool.query<{ id: string }>("SELECT id FROM accounts WHERE email = $1", [normalized]);
    expect(accounts.rowCount).toBe(1);
    const verificationToken = await securityEmailToken(accounts.rows[0]?.id ?? "", "verify_email");
    const outcomes = await Promise.allSettled([
      identity.verifyEmail(verificationToken),
      identity.verifyEmail(verificationToken),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);

    const expired = await signup(`expired-${randomUUID()}@example.test`);
    now = new Date(baseTime.getTime() + 24 * 60 * 60_000 + 1);
    await expect(identity.verifyEmail(expired.verificationToken)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("enforces password policy, login throttles, cookie-write CSRF, and both session expiries", async () => {
    await expect(
      identity.signup({
        email: `weak-${randomUUID()}@example.test`,
        password: "passwordpassword",
        age18Declared: true,
        acceptedTermsVersion: "terms-v1",
      }),
    ).rejects.toMatchObject({ code: "PASSWORD_REJECTED" });
    const email = `session-${randomUUID()}@example.test`;
    const account = await verifiedAccount(email);
    await expect(
      identity.authorizeCookieWrite(account.sessionToken, account.csrfToken, "https://evil.example"),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      identity.authorizeCookieWrite(account.sessionToken, "wrong", "https://pact.example"),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      identity.authorizeCookieWrite(account.sessionToken, account.csrfToken, "https://pact.example"),
    ).resolves.toMatchObject({
      accountId: account.accountId,
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(identity.login({ email, password: nextPassword, ip: "192.0.2.20" })).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
    }
    await expect(identity.login({ email, password, ip: "192.0.2.20" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    now = new Date(baseTime.getTime() + 16 * 60_000);
    await expect(identity.login({ email, password, ip: "192.0.2.20" })).resolves.toBeDefined();
    now = new Date(baseTime.getTime() + 8 * 24 * 60 * 60_000);
    await expect(identity.authenticate(account.sessionToken)).rejects.toMatchObject({ code: "FORBIDDEN" });

    now = new Date(baseTime.getTime() + 16 * 60_000);
    const absolute = await identity.login({ email, password, ip: "192.0.2.21" });
    const absoluteStart = now.getTime();
    now = new Date(absoluteStart + 29 * 24 * 60 * 60_000);
    await pool.query("UPDATE sessions SET idle_expires_at = $2 WHERE token_hash IS NOT NULL AND account_id = $1", [
      account.accountId,
      new Date(absoluteStart + 31 * 24 * 60 * 60_000),
    ]);
    await expect(identity.authenticate(absolute.sessionToken)).resolves.toBeDefined();
    now = new Date(absoluteStart + 31 * 24 * 60 * 60_000);
    await expect(identity.authenticate(absolute.sessionToken)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("recovery, reauthentication, and account security", () => {
  it("uses reset tokens once, expires them at 15 minutes, and revokes sessions and grants", async () => {
    const email = `reset-${randomUUID()}@example.test`;
    const account = await verifiedAccount(email);
    await pool.query(
      `INSERT INTO oauth_grants(product_scope, account_id, client_id, token_family_id, scopes, expires_at)
       VALUES ('pact', $1, 'fixture', $2, ARRAY['world:read'], $3)`,
      [account.accountId, randomUUID(), new Date(baseTime.getTime() + 86_400_000)],
    );
    const inventory = await identity.connectionInventory(account.sessionToken);
    expect(inventory.sessions).toHaveLength(1);
    expect(inventory.grants).toMatchObject([{ clientId: "fixture", scopes: ["world:read"] }]);
    expect(await identity.requestPasswordReset(email)).toEqual({ accepted: true });
    expect(await identity.requestPasswordReset(`missing-${randomUUID()}@example.test`)).toEqual({ accepted: true });
    const token = await securityEmailToken(account.accountId, "reset_password");
    await identity.resetPassword(token, nextPassword);
    await expect(identity.resetPassword(token, password)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    await expect(identity.authenticate(account.sessionToken)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (await pool.query("SELECT 1 FROM oauth_grants WHERE account_id = $1 AND revoked_at IS NULL", [account.accountId]))
        .rowCount,
    ).toBe(0);
    const cancel = await pool.query(
      "SELECT 1 FROM outbox_events WHERE type = 'access.revoked.v1' AND payload->>'accountId' = $1",
      [account.accountId],
    );
    expect(cancel.rowCount).toBe(1);

    await identity.requestPasswordReset(email);
    const expiring = await securityEmailToken(account.accountId, "reset_password");
    now = new Date(baseTime.getTime() + 15 * 60_000 + 1);
    await expect(identity.resetPassword(expiring, password)).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });

  it("rejects agent sessions for human-only authority and consumes each MFA recovery code once", async () => {
    const email = `mfa-${randomUUID()}@example.test`;
    const account = await verifiedAccount(email);
    const agentToken = randomUUID();
    const digester = new TokenDigester(Buffer.alloc(32, 9));
    await pool.query(
      `INSERT INTO sessions(
         product_scope, account_id, audience, token_hash, expires_at, idle_expires_at, authenticated_at
       ) VALUES ('pact', $1, 'agent', $2, $3, $3, $4)`,
      [account.accountId, digester.digest(agentToken), new Date(baseTime.getTime() + 86_400_000), baseTime],
    );
    for (const action of [
      "password.change",
      "email.change",
      "model-credential.replace",
      "account.delete",
      "account.export",
      "authority.raise",
      "approval.commit",
    ] as const) {
      await expect(identity.requireRecentHumanSession(agentToken, action)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }

    now = new Date(baseTime.getTime() + 5 * 60_000 + 1);
    await expect(identity.requireRecentHumanSession(account.sessionToken, "account.export")).rejects.toMatchObject({
      code: "RECENT_AUTH_REQUIRED",
    });
    now = new Date(baseTime);

    await pool.query("UPDATE accounts SET role = 'staff' WHERE id = $1", [account.accountId]);
    await expect(identity.login({ email, password, ip: "192.0.2.29" })).rejects.toMatchObject({
      code: "MFA_REQUIRED",
    });

    await identity.beginTotp(account.sessionToken);
    const enrollment = await pool.query<{ secret_ciphertext: string }>(
      "SELECT secret_ciphertext FROM totp_enrollments WHERE account_id = $1",
      [account.accountId],
    );
    const code = totpForFixture(secretBox.open(enrollment.rows[0]?.secret_ciphertext ?? ""), now);
    const confirmed = await identity.confirmTotp(account.sessionToken, code);
    expect(confirmed.recoveryCodes).toHaveLength(10);
    const recoveryCode = confirmed.recoveryCodes[0];
    if (!recoveryCode) throw new Error("Recovery code fixture missing");
    await expect(identity.login({ email, password, ip: "192.0.2.30", mfaCode: recoveryCode })).resolves.toBeDefined();
    await expect(identity.login({ email, password, ip: "192.0.2.31", mfaCode: recoveryCode })).rejects.toMatchObject({
      code: "INVALID_MFA",
    });
  });

  it("verifies a requested email change and sends a notice to the previous address", async () => {
    const oldEmail = `old-${randomUUID()}@example.test`;
    const nextEmail = `new-${randomUUID()}@example.test`;
    const account = await verifiedAccount(oldEmail);
    await identity.requestEmailChange({
      sessionToken: account.sessionToken,
      currentPassword: password,
      newEmail: nextEmail,
    });
    const emailChangeToken = await securityEmailToken(account.accountId, "verify_new_email");
    await identity.confirmEmailChange(emailChangeToken);
    expect((await pool.query("SELECT email FROM accounts WHERE id = $1", [account.accountId])).rows[0]?.email).toBe(
      nextEmail,
    );
    const oldAddressNotice = await pool.query<{ recipient: string }>(
      `SELECT payload->>'recipientEmail' AS recipient FROM outbox_events
       WHERE payload->>'accountId' = $1 AND payload->>'template' = 'email_changed_notice'`,
      [account.accountId],
    );
    expect(oldAddressNotice.rows[0]?.recipient).toBe(oldEmail);
  });
});

describe("private resumable setup", () => {
  it("preserves a trusted destination and activates the sandbox fixture exactly once", async () => {
    const email = `draft-${randomUUID()}@example.test`;
    const created = await signup(email);
    await identity.verifyEmail(created.verificationToken);
    const destination = { type: "court" as const, id: randomUUID() };
    const draft = await onboarding.ensureDraft(created.accountId, destination);
    await onboarding.ensureDraft(created.accountId, { type: "story", id: randomUUID() });
    expect((await onboarding.getDraft(created.accountId)).invitationDestination).toEqual(destination);
    const updated = await onboarding.updateDraft(created.accountId, {
      displayName: "Test Kingdom",
      proposedHandle: "test_kingdom",
      portrait: "portrait.wolf",
      expectedVersion: draft.version,
    });
    expect(updated).not.toHaveProperty("stocks");
    expect(updated).not.toHaveProperty("troops");
    expect(updated).not.toHaveProperty("score");
    await onboarding.recordConnectionCheck(created.accountId);
    const [first, second] = await Promise.all([
      onboarding.activateSandboxFixture(created.accountId),
      onboarding.activateSandboxFixture(created.accountId),
    ]);
    expect(second).toEqual(first);
    expect((await pool.query("SELECT to_regclass('kingdoms') AS kingdoms")).rows[0]?.kingdoms).toBeNull();
  });

  it("rejects unverified accounts, expired drafts, and stale connection checks", async () => {
    const unverified = await signup(`unverified-${randomUUID()}@example.test`);
    await pool.query("UPDATE accounts SET created_at = $2 WHERE id = $1", [unverified.accountId, baseTime]);
    await expect(onboarding.ensureDraft(unverified.accountId)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const created = await signup(`stale-${randomUUID()}@example.test`);
    await identity.verifyEmail(created.verificationToken);
    const draft = await onboarding.ensureDraft(created.accountId);
    await onboarding.updateDraft(created.accountId, {
      displayName: "Stale Kingdom",
      proposedHandle: "stale_kingdom",
      portrait: "portrait.owl",
      expectedVersion: draft.version,
    });
    await onboarding.recordConnectionCheck(created.accountId);
    now = new Date(baseTime.getTime() + sevenDaysForTest() + 1);
    await pool.query("UPDATE kingdom_drafts SET expires_at = $2 WHERE account_id = $1", [
      created.accountId,
      new Date(now.getTime() + 60_000),
    ]);
    await expect(onboarding.activateSandboxFixture(created.accountId)).rejects.toBeInstanceOf(OnboardingError);
    await pool.query("UPDATE kingdom_drafts SET expires_at = $2 WHERE account_id = $1", [created.accountId, now]);
    await expect(onboarding.getDraft(created.accountId)).rejects.toMatchObject({ code: "DRAFT_EXPIRED" });
    expect(await onboarding.purgeExpiredDrafts()).toBeGreaterThanOrEqual(1);
    expect((await pool.query("SELECT 1 FROM accounts WHERE id = $1", [created.accountId])).rowCount).toBe(1);

    await identity.purgeExpired();
    expect((await pool.query("SELECT 1 FROM accounts WHERE id = $1", [unverified.accountId])).rowCount).toBe(0);
  });
});

describe("HTTP identity boundary", () => {
  it("sets a hardened session cookie, keeps recovery responses generic, and derives draft ownership from the cookie", async () => {
    const firstEmail = `http-first-${randomUUID()}@example.test`;
    const secondEmail = `http-second-${randomUUID()}@example.test`;
    const first = await signup(firstEmail);
    await identity.verifyEmail(first.verificationToken);
    await onboarding.ensureDraft(first.accountId);
    const second = await signup(secondEmail);
    await identity.verifyEmail(second.verificationToken);
    await onboarding.ensureDraft(second.accountId);
    const dispatcher = new CommandDispatcher({
      pool,
      clock: { now: () => new Date(now) },
      productScope: ProductScopeSchema.parse("pact"),
    });
    const server = buildServer(pool, false, new Telemetry(() => undefined), { identity, onboarding, dispatcher });

    const existingReset = await server.inject({
      method: "POST",
      url: "/v1/auth/reset/request",
      payload: { email: firstEmail },
    });
    const missingReset = await server.inject({
      method: "POST",
      url: "/v1/auth/reset/request",
      payload: { email: `missing-http-${randomUUID()}@example.test` },
    });
    expect(existingReset.statusCode).toBe(200);
    expect(missingReset.statusCode).toBe(200);
    expect(missingReset.body).toBe(existingReset.body);

    const login = await server.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: firstEmail, password },
    });
    expect(login.statusCode).toBe(200);
    expect(login.headers["cache-control"]).toBe("no-store");
    const setCookie = String(login.headers["set-cookie"]);
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const cookie = setCookie.split(";")[0] ?? "";
    const csrfToken = login.json().csrfToken as string;

    const wrongOrigin = await server.inject({
      method: "PATCH",
      url: "/v1/setup/draft",
      headers: { cookie, origin: "https://evil.example", "x-csrf-token": csrfToken },
      payload: {
        displayName: "First Kingdom",
        proposedHandle: "first_kingdom",
        portrait: "portrait.wolf",
        expectedVersion: 0,
      },
    });
    expect(wrongOrigin.statusCode).toBe(403);

    const update = await server.inject({
      method: "PATCH",
      url: "/v1/setup/draft",
      headers: { cookie, origin: "https://pact.example", "x-csrf-token": csrfToken },
      payload: {
        accountId: second.accountId,
        displayName: "First Kingdom",
        proposedHandle: "first_kingdom",
        portrait: "portrait.wolf",
        expectedVersion: 0,
      },
    });
    expect(update.statusCode).toBe(200);
    expect((await onboarding.getDraft(first.accountId)).displayName).toBe("First Kingdom");
    expect((await onboarding.getDraft(second.accountId)).displayName).toBeNull();
    await server.close();
  });
});

function sevenDaysForTest(): number {
  return 7 * 24 * 60 * 60_000;
}
