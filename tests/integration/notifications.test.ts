import { createECDH, randomUUID } from "node:crypto";
import {
  appendOutbox,
  createPool,
  createSchemaPool,
  createTestSchema,
  dropTestSchema,
  withTransaction,
} from "@pact/db";
import { AesGcmSecretBox } from "@pact/identity";
import {
  type BrowserSubscription,
  InboxService,
  type NotificationDeliveryPort,
  NotificationService,
} from "@pact/inbox";
import { GameNotificationProjector, gameNotificationCategories } from "@pact/kingdom";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool, pool: Pool, schema: string, service: NotificationService, inbox: InboxService;
const start = new Date("2026-10-04T08:00:00Z");
let now = new Date(start);
beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "notifications");
  pool = createSchemaPool(connectionString, schema);
  service = new NotificationService(pool, {
    productScope: "pact",
    clock: { now: () => now },
    secretBox: new AesGcmSecretBox(Buffer.alloc(32, 7)),
    categories: gameNotificationCategories,
    publicBaseUrl: "https://pact.example/pact/",
  });
  inbox = new InboxService(pool, { productScope: "pact", clock: { now: () => now } });
});
beforeEach(() => {
  now = new Date(start);
});
afterAll(async () => {
  await pool?.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
async function owner() {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at) VALUES($1,'pact',$2,'fixture',$3)",
    [id, id + "@example.test", now],
  );
  return id;
}
function subscription(): BrowserSubscription {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/" + randomUUID(),
    keys: { auth: Buffer.alloc(16, 7).toString("base64url"), p256dh: ecdh.getPublicKey().toString("base64url") },
  };
}
async function event(accountId: string, category = "raid", eventId = randomUUID()) {
  await withTransaction(pool, async (client) => {
    await inbox.publishForAccount(client, {
      accountId,
      eventId,
      type: "fixture." + category,
      payload: { amount: 99999, message: "private body" },
    });
    await service.enqueue(client, { accountId, subjectId: accountId, eventId, category, occurredAt: now });
  });
  return eventId;
}
describe("PACT-060 optional delivery", () => {
  it("retains the inbox with no opt-in, rejects ungranted push and routine email, and leaves security email alone", async () => {
    const id = await owner();
    await event(id);
    expect((await inbox.list(id, undefined)).events).toHaveLength(1);
    expect((await pool.query("SELECT id FROM notification_deliveries WHERE account_id=$1", [id])).rowCount).toBe(0);
    await expect(service.subscribe(id, subscription(), "denied")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.setPreference(id, "completion", "email", true)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await withTransaction(pool, (c) =>
      appendOutbox(c, {
        productScope: "pact",
        eventId: randomUUID(),
        type: "security.email.requested.v1",
        payload: { accountId: id, template: "password_reset" },
      }),
    );
    expect(
      (
        await pool.query(
          "SELECT id FROM outbox_events WHERE type='security.email.requested.v1' AND payload->>'accountId'=$1",
          [id],
        )
      ).rowCount,
    ).toBe(1);
  });
  it("sends the first critical alert promptly, groups subsequent events at ten minutes and deduplicates retry", async () => {
    const id = await owner(),
      sent: unknown[] = [];
    const port: NotificationDeliveryPort = {
      channel: "email",
      deliver: async (input) => {
        sent.push(input);
      },
    };
    await service.setPreference(id, "raid", "email", true);
    const first = await event(id);
    await event(id, "raid", first);
    expect(await service.deliverBatch([port], "worker")).toBe(1);
    now = new Date(start.getTime() + 60_000);
    await event(id);
    await event(id);
    expect(await service.deliverBatch([port], "worker")).toBe(0);
    now = new Date(start.getTime() + 10 * 60_000);
    expect(await service.deliverBatch([port], "worker")).toBe(1);
    expect(await service.deliverBatch([port], "worker")).toBe(0);
    expect(sent).toHaveLength(2);
    const encoded = JSON.stringify(sent);
    expect(encoded).not.toContain("99999");
    expect(encoded).not.toContain("private body");
    expect(encoded).toContain("https://pact.example/pact/?inbox");
    const grouped = await pool.query(
      "SELECT event_count FROM notification_deliveries WHERE account_id=$1 AND dedup_key LIKE '%group%'",
      [id],
    );
    expect(grouped.rows[0].event_count).toBe(2);
  });
  it("groups routine push, encrypts endpoints, applies per-category preferences and invalidates 410", async () => {
    const id = await owner(),
      sub = subscription();
    const registered = await service.subscribe(id, sub, "granted");
    await service.setPreference(id, "completion", "webpush", true);
    const row = await pool.query("SELECT sealed_subscription FROM notification_subscriptions WHERE id=$1", [
      registered.id,
    ]);
    expect(JSON.stringify(row.rows)).not.toContain(sub.endpoint);
    expect(JSON.stringify(row.rows)).not.toContain(sub.keys.auth);
    await event(id, "completion");
    await event(id, "completion");
    await event(id, "reply");
    const jobs = await pool.query("SELECT id FROM notification_deliveries WHERE account_id=$1", [id]);
    expect(jobs.rowCount).toBe(1);
    const port: NotificationDeliveryPort = {
      channel: "webpush",
      deliver: async () => {
        throw { statusCode: 410 };
      },
    };
    expect(await service.deliverBatch([port], "push-worker")).toBe(0);
    now = new Date(start.getTime() + 10 * 60_000);
    await service.deliverBatch([port], "push-worker");
    expect((await service.preferences(id)).subscriptions).toHaveLength(0);
    expect(
      (await pool.query("SELECT sealed_subscription FROM notification_subscriptions WHERE id=$1", [registered.id]))
        .rows[0].sealed_subscription,
    ).toBeNull();
  });
  it("retries offline delivery without game jobs, suppresses revocation and never delivers historic pre-opt-in events", async () => {
    const id = await owner();
    const oldId = await event(id, "approval");
    now = new Date(start.getTime() + 1000);
    await service.setPreference(id, "approval", "email", true);
    await event(id, "approval", oldId);
    let attempts = 0;
    const port: NotificationDeliveryPort = {
      channel: "email",
      deliver: async () => {
        attempts++;
        throw new Error("OFFLINE");
      },
    };
    await event(id, "approval");
    await service.deliverBatch([port], "offline");
    expect(attempts).toBe(1);
    expect((await pool.query("SELECT id FROM durable_jobs")).rowCount).toBe(0);
    expect((await pool.query("SELECT id FROM command_receipts")).rowCount).toBe(0);
    await service.setPreference(id, "approval", "email", false);
    now = new Date(start.getTime() + 61_000);
    await service.deliverBatch([port], "offline");
    expect(attempts).toBe(1);
  });
  it("revokes only owned endpoints and exports preferences without tokens; deletion removes optional deliveries", async () => {
    const id = await owner(),
      other = await owner();
    const registered = await service.subscribe(id, subscription(), "granted");
    await expect(service.unsubscribe(other, registered.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await service.setPreference(id, "raid", "webpush", true);
    await event(id);
    const exported = await withTransaction(pool, (c) => service.retention.exportAccount(c, id));
    expect(JSON.stringify(exported)).not.toContain("keys");
    expect(JSON.stringify(exported)).not.toContain("endpoint");
    await withTransaction(pool, (c) => service.retention.forgetAccount(c, id));
    expect((await service.preferences(id)).subscriptions).toHaveLength(0);
    expect((await pool.query("SELECT id FROM notification_deliveries WHERE account_id=$1", [id])).rowCount).toBe(0);
  });
  it("projects actual gameplay event types to their owners once and projects approval inbox events", async () => {
    const id = await owner(),
      kingdom = randomUUID();
    await pool.query(
      `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,
    activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Fixture','portrait.wolf',$4,0,0,60000,$5)`,
      [kingdom, id, "notif_" + randomUUID().slice(0, 8), now, randomUUID()],
    );
    const projector = new GameNotificationProjector(pool, {
      productScope: "pact",
      clock: { now: () => now },
      readGameTime: async () => 0,
      ports: {
        publishForAccount: (c, input) => inbox.publishForAccount(c, input),
        enqueue: (c, input) => service.enqueue(c, input),
      },
    });
    for (const type of [
      "building.completed.v1",
      "training.unit.completed.v1",
      "upkeep.hungry.v1",
      "message.sent.v1",
      "rank.changed.v1",
    ])
      await withTransaction(pool, (c) =>
        appendOutbox(c, {
          productScope: "pact",
          eventId: randomUUID(),
          type,
          payload: { kingdomId: kingdom, payerKingdomId: kingdom, recipientKingdomId: kingdom, alert: true },
        }),
      );
    await projector.project();
    await projector.project();
    const types = (await inbox.list(id, undefined)).events.map((e) => e.type);
    expect(types).toEqual([
      "building.completed.v1",
      "training.unit.completed.v1",
      "upkeep.hungry.v1",
      "message.sent.v1",
    ]);
    await inbox.publish(id, "approval.requested.v1", { approvalId: randomUUID() });
    expect(await service.projectInbox({ "approval.requested.v1": "approval" })).toBe(1);
    expect(await service.projectInbox({ "approval.requested.v1": "approval" })).toBe(0);
  });

  it("routes raid/default to both parties and issues one expiry notice without changing contract deadlines", async () => {
    const a = await owner(),
      b = await owner(),
      ka = randomUUID(),
      kb = randomUUID();
    for (const [id, account] of [
      [ka, a],
      [kb, b],
    ])
      await pool.query(
        `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,
      activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Fixture','portrait.wolf',$4,0,0,60000,$5)`,
        [id, account, "notif_" + randomUUID().slice(0, 8), now, randomUUID()],
      );
    const offer = randomUUID(),
      contract = randomUUID();
    await pool.query(
      `INSERT INTO supply_offers(id,product_scope,kingdom_a,kingdom_b,version,terms,status,expires_game_time_ms,created_game_time_ms,updated_game_time_ms)
     VALUES($1,'pact',$2,$3,1,'{}','active',60000,0,0)`,
      [offer, ka, kb],
    );
    await pool.query(
      `INSERT INTO supply_contracts(id,product_scope,offer_id,offer_version,kingdom_a,kingdom_b,terms,start_game_time_ms,end_game_time_ms,status)
     VALUES($1,'pact',$2,1,$3,$4,'{}',0,3600000,'active')`,
      [contract, offer, ka, kb],
    );
    const projector = new GameNotificationProjector(pool, {
      productScope: "pact",
      clock: { now: () => now },
      readGameTime: async () => 0,
      ports: {
        publishForAccount: (c, input) => inbox.publishForAccount(c, input),
        enqueue: (c, input) => service.enqueue(c, input),
      },
    });
    for (const type of ["raid.declared.v1", "supply.contract.defaulted.v1"])
      await withTransaction(pool, (c) =>
        appendOutbox(c, {
          productScope: "pact",
          eventId: randomUUID(),
          type,
          payload: { leaderKingdomId: ka, targetKingdomId: kb, kingdomA: ka, kingdomB: kb, contractId: contract },
        }),
      );
    await projector.project();
    expect(await projector.expiryNotices()).toBe(1);
    expect(await projector.expiryNotices()).toBe(0);
    for (const id of [a, b])
      expect((await inbox.list(id, undefined)).events.map((e) => e.type)).toEqual([
        "raid.declared.v1",
        "supply.contract.defaulted.v1",
        "contract.nearing_expiry.v1",
      ]);
    expect(
      (await pool.query("SELECT end_game_time_ms::text,status FROM supply_contracts WHERE id=$1", [contract])).rows[0],
    ).toEqual({ end_game_time_ms: "3600000", status: "active" });
  });
});
