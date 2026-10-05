import type { PoolClient } from "pg";
export function notificationRetention(productScope: string) {
  return {
    name: "optionalNotifications",
    forgetAccount: async (client: PoolClient, accountId: string): Promise<void> => {
      for (const table of [
        "notification_preferences",
        "notification_subscriptions",
        "notification_windows",
        "notification_seen_events",
        "notification_deliveries",
      ])
        await client.query(`DELETE FROM ${table} WHERE product_scope=$1 AND account_id=$2`, [productScope, accountId]);
    },
    exportAccount: async (client: PoolClient, accountId: string): Promise<unknown> => {
      const result = await client.query(
        "SELECT category,channel,enabled FROM notification_preferences WHERE product_scope=$1 AND account_id=$2",
        [productScope, accountId],
      );
      return { preferences: result.rows };
    },
    prune: async (client: PoolClient, now: Date): Promise<number> => {
      let count = 0;
      for (const [table, column] of [
        ["notification_seen_events", "processed_at"],
        ["notification_windows", "opened_at"],
        ["notification_deliveries", "created_at"],
      ])
        count +=
          (
            await client.query(`DELETE FROM ${table} WHERE product_scope=$1 AND ${column}< $2`, [
              productScope,
              new Date(now.getTime() - 30 * 86_400_000),
            ])
          ).rowCount ?? 0;
      return count;
    },
  };
}
