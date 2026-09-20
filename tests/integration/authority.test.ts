import { randomUUID } from "node:crypto";
import { AuthorityError, AuthorityService } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const password = "A long test password 123!";
let admin: Pool;
let pool: Pool;
let schema: string;
let identity: IdentityService;
let authority: AuthorityService;
let secretBox: AesGcmSecretBox;
let now = new Date("2026-09-20T18:00:00.000Z");

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "authority");
  pool = createSchemaPool(connectionString, schema);
  const clock = { now: () => new Date(now) };
  secretBox = new AesGcmSecretBox(Buffer.alloc(32, 7));
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set(["https://pact.example"]),
    clock,
    digester: new TokenDigester(Buffer.alloc(32, 11)),
    secretBox,
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  authority = new AuthorityService(pool, { productScope: "pact", identity, now: clock.now });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function login(email: string): Promise<{ accountId: string; sessionToken: string }> {
  await identity.signup({ email, password, age18Declared: true, acceptedTermsVersion: "terms-v1" });
  const event = await pool.query<{ payload: { accountId: string; sealedToken: string } }>(
    `SELECT payload FROM outbox_events
     WHERE type = 'security.email.requested.v1' AND payload->>'template' = 'verify_email'
     ORDER BY id DESC LIMIT 1`,
  );
  const payload = event.rows[0]?.payload;
  if (!payload) throw new Error("verification missing");
  await identity.verifyEmail(Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8"));
  const tokens = await identity.login({ email, password, ip: "127.0.0.1" });
  return { accountId: payload.accountId, sessionToken: tokens.sessionToken };
}

describe("mandate authority", () => {
  it("blocks agent mandate mutation via audience and payload-style human-only actions", async () => {
    const { accountId, sessionToken } = await login(`mandate-${randomUUID()}@example.com`);
    await authority.ensureMandate(accountId);
    await expect(authority.assertAgentCannotMutateMandate("agent")).rejects.toBeInstanceOf(AuthorityError);
    await expect(authority.assertAgentCannotMutateMandate("mcp")).rejects.toBeInstanceOf(AuthorityError);
    await expect(authority.assertActionAllowed(accountId, "authority.raise")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(authority.assertActionAllowed(accountId, "credential.read")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Stale human session cannot raise authority.
    now = new Date(now.getTime() + 6 * 60_000);
    await expect(
      authority.raiseMandate(sessionToken, {
        allowedActions: ["world.read", "sandbox.spend"],
        resourceLimits: { grain: "10" },
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "RECENT_AUTH_REQUIRED" });
  });

  it("serializes shared allowance spend and bumps version on recent-auth raise", async () => {
    now = new Date("2026-09-20T19:00:00.000Z");
    const { accountId, sessionToken } = await login(`spend-${randomUUID()}@example.com`);
    await authority.ensureMandate(accountId);
    const raised = await authority.raiseMandate(sessionToken, {
      allowedActions: ["world.read", "sandbox.spend"],
      resourceLimits: { grain: "5" },
      expectedVersion: 1,
    });
    expect(raised.version).toBe(2);
    expect(raised.resourceLimits.grain).toBe("5");

    const first = await authority.spendImmediate(accountId, "grain", 3n);
    expect(first.spent).toBe(3n);
    await expect(authority.spendImmediate(accountId, "grain", 3n)).rejects.toMatchObject({
      code: "INSUFFICIENT_ALLOWANCE",
    });
    const second = await authority.spendImmediate(accountId, "grain", 2n);
    expect(second.spent).toBe(5n);

    const concurrent = await Promise.allSettled([
      authority.spendImmediate(accountId, "grain", 1n),
      authority.spendImmediate(accountId, "grain", 1n),
    ]);
    const rejected = concurrent.filter((result) => result.status === "rejected");
    expect(rejected.length).toBe(2);
  });
});
