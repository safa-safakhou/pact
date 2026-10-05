import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import { AesGcmSecretBox } from "@pact/identity";
import { RunService } from "@pact/runs";
import {
  type BotReply,
  type BotRunSettings,
  botRetention,
  TelegramBotDelivery,
  TelegramBotService,
  TelegramService,
} from "@pact/telegram";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test",
  start = new Date("2026-10-04T08:00:00Z"),
  secret = "telegram-webhook-secret-with-32-bytes",
  box = new AesGcmSecretBox(Buffer.alloc(32, 7));
let admin: Pool,
  pool: Pool,
  schema: string,
  now = new Date(start),
  bot: TelegramBotService,
  telegram: TelegramService,
  delivery: TelegramBotDelivery,
  runs: RunService,
  updateId = 0,
  messageId = 1000,
  userId = 100000;
const read = vi.fn(async () => "Committed fixture state, tick 7"),
  validate = vi.fn(async () => {}),
  sent: { user: string; reply: BotReply; messageId: number }[] = [];
const settings: BotRunSettings = {
  credentialId: "00000000-0000-4000-8000-000000000001",
  provider: "fixture",
  model: "fixture-small",
  maxCalls: 2,
  maxTokens: 10000,
  maxMessages: 2,
  maxConversations: 1,
};
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "telegram_bot");
  pool = createSchemaPool(url, schema);
  const clock = { now: () => now };
  runs = new RunService(pool, { productScope: "pact", clock });
  bot = new TelegramBotService(pool, {
    productScope: "pact",
    clock,
    secretBox: box,
    miniAppUrl: "https://pact.example/pact/telegram/",
    botId: "123456",
    ports: {
      read,
      validateSettings: validate,
      start: (c, id, objective, s) =>
        runs.start(
          { accountId: id, objective, provider: s.provider, model: s.model, credentialId: s.credentialId, limits: s },
          c,
        ),
      stop: async (c, id, ids) => {
        if (ids) {
          for (const r of ids) await runs.stop(id, r, c);
        } else await runs.takeover(id, id, c);
      },
    },
  });
  telegram = new TelegramService(pool, {
    productScope: "pact",
    botId: "123456",
    botToken: "123456:fixture-token",
    webhookSecret: secret,
    clock,
    issueHumanSession: async () => {
      throw new Error("not a bot login");
    },
    revokeHumanSessions: async () => {},
    processBotUpdate: (c, u) => bot.process(c, u),
    unlinkBot: (c, id) => bot.unlink(c, id),
  });
  delivery = new TelegramBotDelivery(pool, { productScope: "pact", clock, secretBox: box });
});
beforeEach(() => {
  now = new Date(start);
  read.mockClear();
  validate.mockClear();
});
afterAll(async () => {
  await pool?.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
async function owner(linked = true) {
  const id = randomUUID(),
    user = ++userId;
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at) VALUES($1,'pact',$2,'fixture',$3)",
    [id, id + "@example.test", now],
  );
  if (linked)
    await pool.query(
      "INSERT INTO telegram_account_links(id,product_scope,account_id,telegram_user_id,linked_at) VALUES($1,'pact',$2,$3,$4)",
      [randomUUID(), id, String(user), now],
    );
  return { id, user };
}
function message(user: number, text: string) {
  return {
    update_id: ++updateId,
    message: { message_id: ++messageId, chat: { id: user, type: "private" }, from: { id: user, is_bot: false }, text },
  };
}
function callback(user: number, data: string, id: number) {
  return {
    update_id: ++updateId,
    callback_query: {
      id: "callback-" + updateId,
      from: { id: user, is_bot: false },
      data,
      message: { message_id: id, chat: { id: user, type: "private" }, from: { id: 123456, is_bot: true } },
    },
  };
}
async function drain() {
  for (let i = 0; i < 60; i++) {
    const n = await delivery.deliver(
      {
        send: async (user, reply) => {
          const id = ++messageId;
          sent.push({ user, reply, messageId: id });
          return { messageId: id };
        },
      },
      "fixture-delivery",
    );
    if (!n) break;
  }
}
async function preview(user: number) {
  await telegram.acceptWebhook(secret, message(user, "/run Find a safe trade"));
  await drain();
  const p = sent.filter((s) => s.user === String(user) && s.reply.buttons?.some((b) => b.callbackData)).at(-1);
  if (!p) throw new Error("missing preview");
  return { data: p.reply.buttons!.find((b) => b.callbackData)!.callbackData!, id: p.messageId, reply: p.reply };
}
async function runCount(id: string) {
  return (await pool.query("SELECT run_id FROM envoy_runs WHERE account_id=$1", [id])).rowCount;
}
describe("PACT-089 deterministic private bot controls", () => {
  it("reads factual commands and previews objectives without any model job; rejects unlinked/group/bot/forwarded/approval commands", async () => {
    const a = await owner(),
      unlinked = await owner(false);
    for (const text of ["/world", "/inbox", "/status"]) await telegram.acceptWebhook(secret, message(a.user, text));
    expect(read).toHaveBeenCalledTimes(3);
    await telegram.acceptWebhook(secret, message(a.user, "Hello envoy"));
    expect(await runCount(a.id)).toBe(0);
    expect((await pool.query("SELECT id FROM durable_jobs WHERE type='envoy.run.tick'")).rowCount).toBe(0);
    await telegram.acceptWebhook(secret, message(unlinked.user, "/run Do something"));
    const group = message(a.user, "/run test");
    group.message.chat.type = "group";
    await expect(telegram.acceptWebhook(secret, group)).rejects.toMatchObject({ code: "GROUP_CHAT_DENIED" });
    const agent = message(a.user, "/run test");
    agent.message.from.is_bot = true;
    await expect(telegram.acceptWebhook(secret, agent)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const forward = {
      ...message(a.user, "/run forwarded"),
      message: { ...message(a.user, "x").message, forward_origin: { type: "user" } },
    };
    await expect(telegram.acceptWebhook(secret, forward)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await telegram.acceptWebhook(secret, message(a.user, "/approve any-financial-command"));
    expect(await runCount(a.id)).toBe(0);
  });
  it("binds exact objective/model/allowance/account to one short-lived delivered button and starts only one shared run on retries", async () => {
    const a = await owner(),
      other = await owner();
    await bot.saveSettings(a.id, settings);
    const p = await preview(a.user);
    expect(p.reply.text).toContain(settings.model);
    expect(p.reply.text).toContain("10000 tokens");
    expect(p.reply.text).toContain(a.id);
    expect(await runCount(a.id)).toBe(0);
    await telegram.acceptWebhook(secret, callback(other.user, p.data, p.id));
    expect(await runCount(a.id)).toBe(0);
    await telegram.acceptWebhook(secret, callback(a.user, p.data, p.id + 1));
    expect(await runCount(a.id)).toBe(0);
    const u = callback(a.user, p.data, p.id);
    await Promise.all([telegram.acceptWebhook(secret, u), telegram.acceptWebhook(secret, u)]);
    await telegram.acceptWebhook(secret, callback(a.user, p.data, p.id));
    expect(await runCount(a.id)).toBe(1);
    const run = (await runs.list(a.id)).runs[0]!;
    expect(run).toMatchObject({
      objective: "Find a safe trade",
      model: settings.model,
      maxCalls: 2,
      maxTokens: 10000,
      usedCalls: 0,
      status: "running",
    });
    expect(
      (
        await pool.query("SELECT id FROM durable_jobs WHERE type='envoy.run.tick' AND payload->>'runId'=$1", [
          run.runId,
        ])
      ).rowCount,
    ).toBe(1);
    expect((await pool.query("SELECT id FROM command_receipts")).rowCount).toBe(0);
  });
  it("blocks expired and revoked-link callbacks and respects an existing MCP lease; /stop stops the same global run", async () => {
    const a = await owner();
    await bot.saveSettings(a.id, settings);
    const expired = await preview(a.user);
    now = new Date(now.getTime() + 300001);
    await telegram.acceptWebhook(secret, callback(a.user, expired.data, expired.id));
    expect(await runCount(a.id)).toBe(0);
    const p = await preview(a.user);
    await runs.openMcpLease({ accountId: a.id, holderId: "external-fixture" });
    await telegram.acceptWebhook(secret, callback(a.user, p.data, p.id));
    expect(await runCount(a.id)).toBe(0);
    await telegram.acceptWebhook(secret, message(a.user, "/stop"));
    await telegram.acceptWebhook(secret, callback(a.user, p.data, p.id));
    expect(await runCount(a.id)).toBe(1);
    const run = (await runs.list(a.id)).runs[0]!;
    await telegram.acceptWebhook(secret, message(a.user, "/stop"));
    expect((await runs.get(run.runId, a.id)).status).toBe("stopped");
    const next = await preview(a.user);
    await telegram.unlink(a.id);
    await telegram.acceptWebhook(secret, callback(a.user, next.data, next.id));
    expect(await runCount(a.id)).toBe(1);
  });
  it("rolls back webhook consumption and run creation together on failed confirmation, allowing a safe transport retry", async () => {
    const a = await owner();
    await bot.saveSettings(a.id, settings);
    const p = await preview(a.user),
      update = callback(a.user, p.data, p.id);
    validate.mockRejectedValueOnce(new Error("fixture transient failure"));
    await expect(telegram.acceptWebhook(secret, update)).rejects.toThrow("fixture transient failure");
    expect(await runCount(a.id)).toBe(0);
    expect(
      (await pool.query("SELECT update_id FROM telegram_webhook_updates WHERE update_id=$1", [update.update_id]))
        .rowCount,
    ).toBe(0);
    await telegram.acceptWebhook(secret, update);
    expect(await runCount(a.id)).toBe(1);
  });
  it("retries delivery offline, binds button to acknowledged message and removes private previews on deletion", async () => {
    const a = await owner();
    await bot.saveSettings(a.id, settings);
    await telegram.acceptWebhook(secret, message(a.user, "/run Offline fixture"));
    // Drain replies for other accounts before targeting this one.
    await pool.query(
      "UPDATE telegram_bot_replies SET status='cancelled' WHERE account_id IS DISTINCT FROM $1 AND status='ready'",
      [a.id],
    );
    const fail = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await delivery.deliver({ send: fail }, "offline")).toBe(0);
    expect(fail).toHaveBeenCalledOnce();
    expect(
      (await pool.query("SELECT message_id FROM telegram_run_previews WHERE account_id=$1", [a.id])).rows[0].message_id,
    ).toBeNull();
    now = new Date(now.getTime() + 120000);
    await drain();
    expect(
      (await pool.query("SELECT message_id FROM telegram_run_previews WHERE account_id=$1", [a.id])).rows[0].message_id,
    ).not.toBeNull();
    const hook = botRetention("pact");
    const client = await pool.connect();
    try {
      await hook.forgetAccount(client, a.id);
    } finally {
      client.release();
    }
    expect((await bot.settings(a.id)).settings).toBeNull();
    expect((await pool.query("SELECT id FROM telegram_run_previews WHERE account_id=$1", [a.id])).rowCount).toBe(0);
  });
});
