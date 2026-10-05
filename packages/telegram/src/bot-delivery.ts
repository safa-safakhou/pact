import { withTransaction } from "@pact/db";
import type { Pool } from "pg";
import type { BotReply } from "./bot.js";
export interface BotDeliveryPort {
  send(userId: string, reply: BotReply): Promise<{ messageId: number }>;
}
type Box = { open(value: string): Uint8Array };
export class TelegramBotDelivery {
  constructor(
    private readonly pool: Pool,
    private readonly options: { productScope: string; clock: { now(): Date }; secretBox: Box },
  ) {}
  async deliver(port: BotDeliveryPort, workerId: string): Promise<number> {
    const now = this.options.clock.now(),
      scope = this.options.productScope;
    const row = (
      await this.pool.query<{
        id: string;
        account_id: string | null;
        telegram_user_id: string;
        sealed_reply: string;
        preview_id: string | null;
        attempts: number;
      }>(
        `WITH candidate AS(SELECT id FROM telegram_bot_replies
   WHERE product_scope=$1 AND status='ready' AND available_at<=$2 AND (lease_expires_at IS NULL OR lease_expires_at<=$2) ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED)
   UPDATE telegram_bot_replies r SET leased_by=$3,lease_expires_at=$2+interval '60 seconds',attempts=attempts+1 FROM candidate c WHERE r.id=c.id RETURNING r.*`,
        [scope, now, workerId],
      )
    ).rows[0];
    if (!row) return 0;
    const valid = await this.pool.query(
      `SELECT 1 WHERE ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM telegram_account_links l JOIN accounts a ON a.id=l.account_id AND a.product_scope=l.product_scope
    WHERE l.product_scope=$1 AND l.account_id=$2 AND l.telegram_user_id=$3 AND l.revoked_at IS NULL AND a.status='active'))
    AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM telegram_run_previews p WHERE p.id=$4 AND p.used_at IS NULL AND p.expires_at>$5))`,
      [scope, row.account_id, row.telegram_user_id, row.preview_id, now],
    );
    if (!valid.rowCount) {
      await this.pool.query(
        "UPDATE telegram_bot_replies SET status='cancelled',sealed_reply='' WHERE id=$1 AND leased_by=$2",
        [row.id, workerId],
      );
      return 0;
    }
    try {
      const reply = JSON.parse(Buffer.from(this.options.secretBox.open(row.sealed_reply)).toString("utf8")) as BotReply;
      const result = await port.send(row.telegram_user_id, reply);
      if (!Number.isSafeInteger(result.messageId) || result.messageId < 1) throw new Error("INVALID_BOT_REPLY");
      await withTransaction(this.pool, async (client) => {
        const updated = await client.query(
          "UPDATE telegram_bot_replies SET status='delivered',sealed_reply='',leased_by=NULL,lease_expires_at=NULL WHERE id=$1 AND leased_by=$2 RETURNING id",
          [row.id, workerId],
        );
        if (updated.rowCount && row.preview_id)
          await client.query("UPDATE telegram_run_previews SET message_id=$2 WHERE id=$1 AND message_id IS NULL", [
            row.preview_id,
            result.messageId,
          ]);
      });
      return 1;
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
      const cancel = status === 403 || row.attempts >= 8;
      await this.pool.query(
        "UPDATE telegram_bot_replies SET status=$3,sealed_reply=CASE WHEN $3='cancelled' THEN '' ELSE sealed_reply END,available_at=$4,leased_by=NULL,lease_expires_at=NULL WHERE id=$1 AND leased_by=$2",
        [
          row.id,
          workerId,
          cancel ? "cancelled" : "ready",
          new Date(now.getTime() + Math.min(3600000, 60000 * 2 ** Math.min(row.attempts, 6))),
        ],
      );
      return 0;
    }
  }
}
export function botRetention(scope: string) {
  return {
    name: "telegramBot",
    forgetAccount: async (client: import("pg").PoolClient, id: string) => {
      for (const table of [
        "telegram_bot_replies",
        "telegram_run_previews",
        "telegram_run_preferences",
        "telegram_started_runs",
      ])
        await client.query("DELETE FROM " + table + " WHERE product_scope=$1 AND account_id=$2", [scope, id]);
    },
    exportAccount: async (client: import("pg").PoolClient, id: string) => ({
      settings: (
        await client.query("SELECT settings FROM telegram_run_preferences WHERE product_scope=$1 AND account_id=$2", [
          scope,
          id,
        ])
      ).rows,
    }),
    prune: async (client: import("pg").PoolClient, now: Date) => {
      const previews = await client.query(
        "DELETE FROM telegram_run_previews WHERE product_scope=$1 AND expires_at<=$2",
        [scope, now],
      );
      const replies = await client.query(
        "DELETE FROM telegram_bot_replies WHERE product_scope=$1 AND (created_at<$2 OR (status<>'ready' AND created_at<$3))",
        [scope, new Date(now.getTime() - 86400000), new Date(now.getTime() - 3600000)],
      );
      await client.query("DELETE FROM telegram_started_runs WHERE product_scope=$1 AND created_at<$2", [
        scope,
        new Date(now.getTime() - 30 * 86400000),
      ]);
      return (previews.rowCount ?? 0) + (replies.rowCount ?? 0);
    },
  };
}
