import { createHmac, randomUUID } from "node:crypto";
import { CommandDispatcher, GameCommandHandler } from "@pact/application";
import { ApprovalService } from "@pact/approvals";
import { ProductScopeSchema, SCHEMA_VERSION } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { ActionLimitService, SocialService, SupplyService, WorldViewService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { TelegramService } from "@pact/telegram";
import { WorldClockService } from "@pact/world";
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
    expect(secondBootstrap.linked).toBe(true);
    await expect(telegram.confirmLink(otherAccount, secondBootstrap.bootstrapToken)).rejects.toThrow("ALREADY_LINKED");
    const renewed = await telegram.exchangeBootstrap(renamed, secondBootstrap.bootstrapToken);
    await expect(identity.authenticate(renewed.sessionToken)).resolves.toMatchObject({ accountId: firstAccount });

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

describe("PACT-088 shared web/Telegram exact approvals", () => {
  it("reads the web-created request as the same owner, commits it once, and rejects a revoked channel", async () => {
    const email = `miniapp-${randomUUID()}@example.test`;
    const owner = await account(email);
    const web = await identity.login({ email, password, ip: "127.0.0.1" });
    const launch = initData(551122);
    const bootstrap = await telegram.beginBootstrap(launch);
    await telegram.confirmLink(owner, bootstrap.bootstrapToken);
    const channel = await telegram.exchangeBootstrap(launch, bootstrap.bootstrapToken);
    const dispatcher = new CommandDispatcher({
      pool,
      productScope: ProductScopeSchema.parse("pact"),
      clock: { now: () => clockNow },
    });
    const approvals = new ApprovalService(pool, {
      productScope: "pact",
      identity,
      dispatcher,
      clock: { now: () => clockNow },
      origin: "https://pact.example",
      webBasePath: "/pact/",
    });
    const commandId = randomUUID();
    const command = {
      schemaVersion: SCHEMA_VERSION,
      commandId,
      actor: {
        principalId: owner,
        productScope: ProductScopeSchema.parse("pact"),
        audience: "human" as const,
        subject: { type: "account" as const, id: owner },
      },
      action: { kind: "sandbox.echo" as const, message: "exact current synthetic offer" },
      submittedAt: clockNow.toISOString(),
    };
    const created = await approvals.createRequest({
      accountId: owner,
      command,
      effectsSummary: "Exact synthetic terms",
    });
    const before = await approvals.review(
      created.approvalId,
      (await identity.authenticate(web.sessionToken)).accountId,
    );
    const channelView = await approvals.review(
      created.approvalId,
      (await identity.authenticate(channel.sessionToken)).accountId,
    );
    expect(channelView).toEqual(before);
    expect(channelView.deepLinkPath).toBe(`/pact/?approval=${created.approvalId}`);
    const committed = await approvals.approve(channel.sessionToken, created.approvalId);
    expect(committed.receipt?.code).toBe("COMMITTED");
    await approvals.approve(web.sessionToken, created.approvalId).catch(() => undefined);
    const count = await pool.query("SELECT count(*)::int AS count FROM command_receipts WHERE command_id = $1", [
      commandId,
    ]);
    expect(count.rows[0].count).toBe(1);
    await telegram.unlink(owner);
    await expect(approvals.approve(channel.sessionToken, created.approvalId)).rejects.toThrow("FORBIDDEN");
  });
});

describe("PACT-088 actual shared Supply Offer", () => {
  it("starts a real offer in web, reads owner state through the validated channel, and signs current terms exactly once", async () => {
    const email = "telegram-offer-" + randomUUID() + "@example.test",
      a = await account(email),
      b = await account("counterparty-" + randomUUID() + "@example.test");
    const web = await identity.login({ email, password, ip: "127.0.0.1" }),
      ledger = new ResourceLedger("pact"),
      world = new WorldClockService(pool, "pact");
    await world.bootstrap();
    const limits = new ActionLimitService("pact"),
      social = new SocialService("pact", ledger, limits, { now: () => clockNow });
    const supply = new SupplyService("pact", ledger, limits, social, {
      reserve: async () => randomUUID(),
      release: async () => {},
      activate: async () => {},
    });
    const ka = randomUUID(),
      kb = randomUUID();
    await withTransaction(pool, async (c) => {
      for (const [id, owner] of [
        [ka, a],
        [kb, b],
      ] as const) {
        await c.query(
          `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id)
    VALUES($1,'pact',$2,$3,'Telegram offer fixture','portrait.wolf',$4,0,0,60000,$5)`,
          [id, owner, "tg_" + randomUUID().slice(0, 8), clockNow, randomUUID()],
        );
        await ledger.initializeKingdom(c, id, 0);
        await ledger.creditOrdinary(c, {
          kingdomId: id,
          resource: "silver",
          amount: wholeResources(100),
          operationKey: "fixture-" + randomUUID(),
          reason: "fixture",
          gameTimeMs: 0,
        });
      }
      const left = ka < kb ? ka : kb,
        right = ka < kb ? kb : ka;
      await c.query(
        "INSERT INTO social_contacts(product_scope,kingdom_a,kingdom_b,accepted_game_time_ms) VALUES('pact',$1,$2,0)",
        [left, right],
      );
    });
    const handler = new GameCommandHandler(social, undefined, undefined, undefined, undefined, undefined, supply);
    const dispatcher = new CommandDispatcher({
      pool,
      productScope: ProductScopeSchema.parse("pact"),
      clock: { now: () => clockNow },
      game: {
        admit: (op) => world.admitCommand((c, snapshot) => op(c, snapshot.gameTimeMs)),
        execute: (c, p, command, t) => handler.execute(c, p, command, t),
      },
    });
    const approvals = new ApprovalService(pool, {
      productScope: "pact",
      identity,
      dispatcher,
      clock: { now: () => clockNow },
      origin: "https://pact.example",
      webBasePath: "/pact/",
    });
    const actor = {
      principalId: a,
      productScope: ProductScopeSchema.parse("pact"),
      audience: "human" as const,
      subject: { type: "account" as const, id: a },
    };
    const offerId = randomUUID(),
      terms = {
        aToB: { resource: "silver" as const, wholePerHour: 8 },
        bToA: null,
        aBond: { resource: "silver" as const, wholeAmount: 2 },
        bBond: null,
        durationHours: 6,
        noticeHours: 1,
      };
    await dispatcher.dispatch(
      { accountId: a, productScope: actor.productScope, audience: "human" },
      {
        schemaVersion: SCHEMA_VERSION,
        commandId: offerId,
        actor,
        action: { kind: "game.supply.offer", counterpartyKingdomId: kb, terms },
        submittedAt: clockNow.toISOString(),
      },
    );
    await withTransaction(pool, (c) =>
      supply.signOffer(c, {
        accountId: b,
        offerId,
        version: 1,
        actorKind: "human",
        gameTimeMs: 0,
        operationKey: "fixture-" + randomUUID(),
      }),
    );
    const launch = initData(776655),
      boot = await telegram.beginBootstrap(launch);
    await telegram.confirmLink(a, boot.bootstrapToken);
    const channel = await telegram.exchangeBootstrap(launch, boot.bootstrapToken);
    const channelOwner = (await identity.authenticate(channel.sessionToken)).accountId;
    const views = new WorldViewService(pool, "pact");
    expect(await views.readSelf(channelOwner)).toEqual(
      await views.readSelf((await identity.authenticate(web.sessionToken)).accountId),
    );
    const commandId = randomUUID(),
      request = await approvals.createRequest({
        accountId: a,
        command: {
          schemaVersion: SCHEMA_VERSION,
          commandId,
          actor,
          action: { kind: "game.supply.sign", offerId, version: 1 },
          submittedAt: clockNow.toISOString(),
        },
        effectsSummary: "Sign this current version: 8 Silver/hour for six hours, 2 Silver bond",
      });
    expect((await approvals.review(request.approvalId, channelOwner)).deepLinkPath).toBe(
      "/pact/?approval=" + request.approvalId,
    );
    const first = await approvals.approve(channel.sessionToken, request.approvalId),
      retry = await approvals.approve(web.sessionToken, request.approvalId);
    expect(first.receipt?.code).toBe("COMMITTED");
    expect(retry.receipt?.commandId).toBe(commandId);
    expect(
      (
        await pool.query("SELECT kingdom_id FROM supply_offer_signatures WHERE offer_id=$1 AND kingdom_id=$2", [
          offerId,
          ka,
        ])
      ).rows,
    ).toEqual([{ kingdom_id: ka }]);
    expect((await pool.query("SELECT id FROM supply_contracts WHERE offer_id=$1", [offerId])).rowCount).toBe(1);
    expect(
      (await pool.query("SELECT command_id FROM command_receipts WHERE command_id=$1", [commandId])).rowCount,
    ).toBe(1);
  });
});
