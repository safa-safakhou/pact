import { createHash, randomUUID } from "node:crypto";
import { withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
import {
  type BrowserSubscription,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationDeliveryPort,
  NotificationError,
  validateSubscription,
} from "./notification-policy.js";
import { notificationRetention } from "./notification-retention.js";

type SecretBox = { seal(data: Uint8Array): string; open(value: string): Uint8Array };
const WINDOW_MS = 10 * 60_000;
export class NotificationService {
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      clock: { now(): Date };
      categories: readonly NotificationCategory[];
      secretBox: SecretBox;
      publicBaseUrl: string;
    },
  ) {}
  private category(id: string) {
    const category = this.options.categories.find((c) => c.id === id);
    if (!category) throw new NotificationError("INVALID_INPUT");
    return category;
  }
  async preferences(accountId: string) {
    const preferences = await this.pool.query(
      "SELECT category,channel,enabled FROM notification_preferences WHERE product_scope=$1 AND account_id=$2 ORDER BY category,channel",
      [this.options.productScope, accountId],
    );
    const subscriptions = await this.pool.query(
      "SELECT id,created_at FROM notification_subscriptions WHERE product_scope=$1 AND account_id=$2 AND revoked_at IS NULL",
      [this.options.productScope, accountId],
    );
    return { categories: this.options.categories, preferences: preferences.rows, subscriptions: subscriptions.rows };
  }
  async setPreference(accountId: string, categoryId: string, channel: NotificationChannel, enabled: boolean) {
    const category = this.category(categoryId);
    if (
      !["email", "webpush", "native", "telegram"].includes(channel) ||
      (channel === "email" && !category.critical && enabled)
    )
      throw new NotificationError("INVALID_INPUT");
    await withTransaction(this.pool, async (client) => {
      await this.lockAccount(client, accountId);
      await client.query(
        `INSERT INTO notification_preferences(product_scope,account_id,category,channel,enabled,updated_at)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(product_scope,account_id,category,channel)
        DO UPDATE SET enabled=EXCLUDED.enabled,updated_at=EXCLUDED.updated_at`,
        [this.options.productScope, accountId, categoryId, channel, enabled, this.options.clock.now()],
      );
      if (!enabled)
        await client.query(
          `UPDATE notification_deliveries SET status='cancelled'
        WHERE product_scope=$1 AND account_id=$2 AND category=$3 AND channel=$4 AND status='ready'`,
          [this.options.productScope, accountId, categoryId, channel],
        );
    });
    return this.preferences(accountId);
  }
  async subscribe(accountId: string, subscription: BrowserSubscription, permission: string): Promise<{ id: string }> {
    if (permission !== "granted") throw new NotificationError("FORBIDDEN");
    validateSubscription(subscription);
    const hash = createHash("sha256").update(subscription.endpoint).digest("hex");
    return withTransaction(this.pool, async (client) => {
      await this.lockAccount(client, accountId);
      const count = await client.query(
        "SELECT count(*)::int AS count FROM notification_subscriptions WHERE product_scope=$1 AND account_id=$2 AND revoked_at IS NULL",
        [this.options.productScope, accountId],
      );
      const existing = await client.query<{ id: string; account_id: string; revoked_at: Date | null }>(
        "SELECT id,account_id,revoked_at FROM notification_subscriptions WHERE product_scope=$1 AND endpoint_hash=$2 FOR UPDATE",
        [this.options.productScope, hash],
      );
      const row = existing.rows[0];
      if (row && row.account_id !== accountId) throw new NotificationError("ENDPOINT_CONFLICT");
      if ((!row || row.revoked_at) && count.rows[0].count >= 10) throw new NotificationError("INVALID_INPUT");
      const id = row?.id ?? randomUUID();
      await client.query(
        `INSERT INTO notification_subscriptions(id,product_scope,account_id,endpoint_hash,sealed_subscription,created_at)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET sealed_subscription=EXCLUDED.sealed_subscription,revoked_at=NULL`,
        [
          id,
          this.options.productScope,
          accountId,
          hash,
          this.options.secretBox.seal(Buffer.from(JSON.stringify(subscription))),
          this.options.clock.now(),
        ],
      );
      return { id };
    });
  }
  async unsubscribe(accountId: string, id: string): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      const revoked = await client.query(
        `UPDATE notification_subscriptions SET revoked_at=$4,sealed_subscription=NULL
        WHERE product_scope=$1 AND account_id=$2 AND id=$3 RETURNING id`,
        [this.options.productScope, accountId, id, this.options.clock.now()],
      );
      if (!revoked.rowCount) throw new NotificationError("NOT_FOUND");
      await client.query(
        "UPDATE notification_deliveries SET status='cancelled' WHERE product_scope=$1 AND endpoint_id=$2 AND status='ready'",
        [this.options.productScope, id],
      );
    });
  }
  /** Called in the inbox event transaction. No delivery or model work occurs here. */
  async enqueue(
    client: PoolClient,
    input: { accountId: string; subjectId: string; eventId: string; category: string; occurredAt: Date },
  ): Promise<void> {
    const category = this.category(input.category);
    await this.lockAccount(client, input.accountId);
    const seen = await client.query(
      `INSERT INTO notification_seen_events(product_scope,account_id,event_id,processed_at)
      VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING event_id`,
      [this.options.productScope, input.accountId, input.eventId, this.options.clock.now()],
    );
    if (!seen.rowCount) return;
    const preferences = await client.query<{ channel: NotificationChannel }>(
      `SELECT channel FROM notification_preferences WHERE product_scope=$1 AND account_id=$2 AND category=$3
       AND enabled AND updated_at <= $4`,
      [this.options.productScope, input.accountId, input.category, input.occurredAt],
    );
    if (!preferences.rowCount || this.options.clock.now().getTime() - input.occurredAt.getTime() >= 7 * 86_400_000)
      return;
    const now = this.options.clock.now();
    const found = await client.query<{ window_id: string; opened_at: Date }>(
      "SELECT window_id,opened_at FROM notification_windows WHERE product_scope=$1 AND account_id=$2 AND subject_id=$3 AND category=$4",
      [this.options.productScope, input.accountId, input.subjectId, input.category],
    );
    const window = found.rows[0];
    const fresh = !window || now.getTime() >= window.opened_at.getTime() + WINDOW_MS;
    const windowId = fresh ? randomUUID() : window.window_id;
    const openedAt = fresh ? now : window.opened_at;
    if (fresh)
      await client.query(
        `INSERT INTO notification_windows(product_scope,account_id,subject_id,category,window_id,opened_at)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(product_scope,account_id,subject_id,category)
      DO UPDATE SET window_id=EXCLUDED.window_id,opened_at=EXCLUDED.opened_at`,
        [this.options.productScope, input.accountId, input.subjectId, input.category, windowId, openedAt],
      );
    for (const preference of preferences.rows) {
      if (preference.channel === "email" && !category.critical) continue;
      const endpoints =
        preference.channel === "webpush"
          ? (
              await client.query<{ id: string }>(
                "SELECT id FROM notification_subscriptions WHERE product_scope=$1 AND account_id=$2 AND revoked_at IS NULL AND created_at<=$3",
                [this.options.productScope, input.accountId, input.occurredAt],
              )
            ).rows.map((r) => r.id)
          : [null];
      for (const endpoint of endpoints) {
        const immediate = category.critical && fresh;
        const key = [windowId, immediate ? "first" : "group", preference.channel, endpoint ?? input.accountId].join(
          ":",
        );
        await client.query(
          `INSERT INTO notification_deliveries(product_scope,account_id,subject_id,category,channel,endpoint_id,dedup_key,available_at,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(product_scope,dedup_key)
          DO UPDATE SET event_count=notification_deliveries.event_count+1 WHERE notification_deliveries.status='ready'`,
          [
            this.options.productScope,
            input.accountId,
            input.subjectId,
            input.category,
            preference.channel,
            endpoint,
            key,
            immediate ? now : new Date(openedAt.getTime() + WINDOW_MS),
            now,
          ],
        );
      }
    }
  }
  private async lockAccount(client: PoolClient, accountId: string) {
    const active = await client.query(
      "SELECT id FROM accounts WHERE product_scope=$1 AND id=$2 AND status='active' AND email_verified_at IS NOT NULL FOR UPDATE",
      [this.options.productScope, accountId],
    );
    if (!active.rowCount) throw new NotificationError("FORBIDDEN");
  }

  /** Claim/prepare on PostgreSQL; send only after locks are released. Providers never receive inbox payloads. */
  async deliverBatch(ports: readonly NotificationDeliveryPort[], workerId: string, limit = 20): Promise<number> {
    let delivered = 0;
    for (let n = 0; n < Math.min(limit, 100); n++) {
      const now = this.options.clock.now();
      const claimed = await this.pool.query<{
        id: string;
        account_id: string;
        channel: NotificationChannel;
        category: string;
        endpoint_id: string | null;
        dedup_key: string;
        attempts: number;
        created_at: Date;
      }>(
        `WITH candidate AS (SELECT id FROM notification_deliveries WHERE product_scope=$1 AND status='ready'
         AND channel=ANY($2::text[]) AND available_at<=$3 AND (lease_expires_at IS NULL OR lease_expires_at<=$3)
         ORDER BY available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED)
         UPDATE notification_deliveries d SET leased_by=$4,lease_expires_at=$3+interval '60 seconds',attempts=attempts+1
         FROM candidate c WHERE d.id=c.id RETURNING d.*`,
        [this.options.productScope, ports.map((p) => p.channel), now, workerId],
      );
      const job = claimed.rows[0];
      if (!job) break;
      const destination = await this.pool.query<{ email: string; sealed_subscription: string | null }>(
        `SELECT a.email,s.sealed_subscription FROM accounts a
         JOIN notification_preferences p ON p.product_scope=a.product_scope AND p.account_id=a.id
          AND p.category=$3 AND p.channel=$4 AND p.enabled AND p.updated_at<=$6
         LEFT JOIN notification_subscriptions s ON s.id=$5 AND s.product_scope=a.product_scope
          AND s.account_id=a.id AND s.revoked_at IS NULL
         WHERE a.product_scope=$1 AND a.id=$2 AND a.status='active' AND a.email_verified_at IS NOT NULL`,
        [this.options.productScope, job.account_id, job.category, job.channel, job.endpoint_id, job.created_at],
      );
      const target = destination.rows[0];
      if (
        !target ||
        (job.channel === "webpush" && !target.sealed_subscription) ||
        now.getTime() - job.created_at.getTime() >= 7 * 86_400_000
      ) {
        await this.finish(job.id, workerId, "cancelled");
        continue;
      }
      const category = this.category(job.category);
      const preview = {
        title: "PACT" as const,
        body: `${category.label}. Open PACT to review your inbox.`,
        url: new URL("?inbox", this.options.publicBaseUrl).href,
        tag: createHash("sha256").update(job.dedup_key).digest("base64url").slice(0, 32),
      };
      const recipient =
        job.channel === "webpush"
          ? (JSON.parse(
              Buffer.from(this.options.secretBox.open(target.sealed_subscription as string)).toString("utf8"),
            ) as BrowserSubscription)
          : job.channel === "email"
            ? target.email
            : job.account_id;
      try {
        await ports
          .find((p) => p.channel === job.channel)
          ?.deliver({ idempotencyKey: job.dedup_key, recipient, preview });
        await this.finish(job.id, workerId, "delivered");
        delivered++;
      } catch (error) {
        const status =
          typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
        if (job.channel === "webpush" && (status === 404 || status === 410) && job.endpoint_id)
          await this.unsubscribe(job.account_id, job.endpoint_id);
        else if (job.attempts >= 8) await this.finish(job.id, workerId, "cancelled");
        else
          await this.pool.query(
            `UPDATE notification_deliveries SET leased_by=NULL,lease_expires_at=NULL,available_at=$4
          WHERE product_scope=$1 AND id=$2 AND leased_by=$3 AND status='ready'`,
            [
              this.options.productScope,
              job.id,
              workerId,
              new Date(now.getTime() + Math.min(60_000 * 2 ** (job.attempts - 1), 3_600_000)),
            ],
          );
      }
    }
    return delivered;
  }
  private async finish(id: string, workerId: string, status: "cancelled" | "delivered") {
    await this.pool.query(
      `UPDATE notification_deliveries SET status=$4,delivered_at=$5,leased_by=NULL,lease_expires_at=NULL
      WHERE product_scope=$1 AND id=$2 AND leased_by=$3 AND status='ready'`,
      [this.options.productScope, id, workerId, status, this.options.clock.now()],
    );
  }
  get retention() {
    return notificationRetention(this.options.productScope);
  }

  async projectInbox(categoriesByType: Readonly<Record<string, string>>, limit = 100): Promise<number> {
    return withTransaction(this.pool, async (client) => {
      const events = (
        await client.query<{ account_id: string; event_id: string; type: string; occurred_at: Date }>(
          `SELECT i.account_id,i.event_id,i.type,i.occurred_at FROM inbox_events i
         JOIN accounts a ON a.product_scope=i.product_scope AND a.id=i.account_id AND a.status='active'
         WHERE i.product_scope=$1 AND i.occurred_at>=$4 AND i.type=ANY($2::text[]) AND NOT EXISTS
          (SELECT 1 FROM notification_seen_events n WHERE n.product_scope=i.product_scope AND n.account_id=i.account_id AND n.event_id=i.event_id)
         ORDER BY i.sequence LIMIT $3`,
          [
            this.options.productScope,
            Object.keys(categoriesByType),
            Math.min(limit, 1000),
            new Date(this.options.clock.now().getTime() - 30 * 86_400_000),
          ],
        )
      ).rows;
      for (const event of events)
        await this.enqueue(client, {
          accountId: event.account_id,
          subjectId: event.account_id,
          eventId: event.event_id,
          category: categoriesByType[event.type] as string,
          occurredAt: event.occurred_at,
        });
      return events.length;
    });
  }
}
