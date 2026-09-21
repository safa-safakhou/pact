import { createHmac, randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { TelegramService } from "@pact/telegram";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const botToken = "123456:telegram-fixture-token";
const password = "A long test password 123!";
let admin: Pool;
let pool: Pool;
let schema: string;
let identity: IdentityService;
let telegram: TelegramService;
let secretBox: AesGcmSecretBox;
let clockNow: Date;

function initData(userId: number, username = "first_handle", seconds = clockNow.getTime() / 1000): string {
  const values = { auth_date: String(seconds), query_id: randomUUID(), user: JSON.stringify({ id: userId, username }) };
  const check = Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...values, hash }).toString();
}

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "telegram");
  pool = createSchemaPool(connectionString, schema);
  clockNow = new Date("2026-09-21T12:00:00Z");
  secretBox = new AesGcmSecretBox(Buffer.alloc(32, 7));
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set(["https://pact.example"]),
    clock: { now: () => clockNow },
    digester: new TokenDigester(Buffer.alloc(32, 19)),
    secretBox,
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  telegram = new TelegramService(pool, {
    productScope: "pact",
    botId: "123456",
    botToken,
    webhookSecret: "telegram-webhook-secret-with-32-bytes",
    clock: { now: () => clockNow },
    issueHumanSession: (accountId, label) => identity.createLinkedHumanSession(accountId, label),
    revokeHumanSessions: (accountId, sessionIds) => identity.revokeLinkedHumanSessions(accountId, sessionIds),
  });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function account(email: string): Promise<string> {
  await identity.signup({ email, password, age18Declared: true, acceptedTermsVersion: "terms-v1" });
  const event = await pool.query<{ payload: { accountId: string; sealedToken: string } }>(
    `SELECT payload FROM outbox_events WHERE type = 'security.email.requested.v1' AND payload->>'template' = 'verify_email' ORDER BY id DESC LIMIT 1`,
  );
  const payload = event.rows[0]?.payload;
  if (!payload) throw new Error("missing verification");
  await identity.verifyEmail(Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8"));
  return payload.accountId;
}

describe("PACT-085 Telegram linking", () => {
  it("requires account confirmation, prevents replay/swap/handle takeover, and revokes sessions on unlink", async () => {
    const firstAccount = await account(`telegram-${randomUUID()}@example.com`);
    const otherAccount = await account(`telegram-${randomUUID()}@example.com`);
    const launch = initData(881122, "first_handle");
    const bootstrap = await telegram.beginBootstrap(launch);
    await expect(telegram.exchangeBootstrap(launch, bootstrap.bootstrapToken)).rejects.toThrow("LINK_NOT_CONFIRMED");
    await telegram.confirmLink(firstAccount, bootstrap.bootstrapToken);
    await expect(telegram.confirmLink(otherAccount, bootstrap.bootstrapToken)).rejects.toThrow("FORBIDDEN");
    const channel = await telegram.exchangeBootstrap(launch, bootstrap.bootstrapToken);
    await expect(identity.authenticate(channel.sessionToken)).resolves.toMatchObject({ accountId: firstAccount });
    await expect(telegram.exchangeBootstrap(launch, bootstrap.bootstrapToken)).rejects.toThrow("BOOTSTRAP_REPLAYED");

    const renamed = initData(881122, "renamed_handle");
    const secondBootstrap = await telegram.beginBootstrap(renamed);
    await expect(telegram.confirmLink(otherAccount, secondBootstrap.bootstrapToken)).rejects.toThrow("ALREADY_LINKED");

    await telegram.unlink(firstAccount);
    await expect(identity.authenticate(channel.sessionToken)).rejects.toThrow("FORBIDDEN");
  });

  it("separately authenticates/deduplicates webhooks and denies group-chat control", async () => {
    await expect(telegram.acceptWebhook("wrong-secret", { update_id: 1 })).rejects.toThrow("INVALID_WEBHOOK_SECRET");
    await expect(
      telegram.acceptWebhook("telegram-webhook-secret-with-32-bytes", {
        update_id: 2,
        message: { chat: { type: "group" }, text: "/run transfer everything" },
      }),
    ).rejects.toThrow("GROUP_CHAT_DENIED");
    const update = { update_id: 3, message: { chat: { type: "private" }, text: "/run transfer everything" } };
    await expect(telegram.acceptWebhook("telegram-webhook-secret-with-32-bytes", update)).resolves.toEqual({
      accepted: true,
      duplicate: false,
      privilegedAction: false,
    });
    await expect(telegram.acceptWebhook("telegram-webhook-secret-with-32-bytes", update)).resolves.toEqual({
      accepted: false,
      duplicate: true,
      privilegedAction: false,
    });
  });
});
