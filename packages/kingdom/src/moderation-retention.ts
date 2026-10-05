import type { PoolClient } from "pg";
export function moderationRetention(productScope: string) {
  return {
    name: "moderation",
    forgetAccount: async (client: PoolClient, accountId: string): Promise<void> => {
      await client.query(
        "UPDATE moderation_cases SET reporter_account_id=NULL WHERE product_scope=$1 AND reporter_account_id=$2",
        [productScope, accountId],
      );
      await client.query(
        "UPDATE moderation_cases SET subject_account_id=NULL WHERE product_scope=$1 AND subject_account_id=$2",
        [productScope, accountId],
      );
      await client.query("DELETE FROM moderation_restrictions WHERE product_scope=$1 AND account_id=$2", [
        productScope,
        accountId,
      ]);
    },
    exportAccount: async (client: PoolClient, accountId: string): Promise<unknown> => {
      return {
        cases: (
          await client.query(
            "SELECT id,target_kind,target_id,status,created_at,resolved_at,appeal_due_at FROM moderation_cases WHERE product_scope=$1 AND (reporter_account_id=$2 OR subject_account_id=$2)",
            [productScope, accountId],
          )
        ).rows,
      };
    },
    prune: async (client: PoolClient, now: Date): Promise<number> => {
      await client.query(
        "DELETE FROM moderation_holds h USING moderation_cases c WHERE h.case_id=c.id AND c.product_scope=$1 AND h.review_at<=$2",
        [productScope, now],
      );
      await client.query("DELETE FROM moderation_restrictions WHERE product_scope=$1 AND until_at<=$2", [
        productScope,
        now,
      ]);
      const removed = await client.query(
        `DELETE FROM moderation_cases c WHERE c.product_scope=$1
    AND c.resolved_at<=$2 AND c.status IN('resolved','appeal_resolved')
    AND NOT EXISTS(SELECT 1 FROM moderation_holds h WHERE h.case_id=c.id AND h.review_at>$3)`,
        [productScope, new Date(now.getTime() - 180 * 86_400_000), now],
      );
      await client.query("DELETE FROM moderation_audit WHERE product_scope=$1 AND case_id IS NULL AND occurred_at<$2", [
        productScope,
        new Date(now.getTime() - 180 * 86_400_000),
      ]);
      return removed.rowCount ?? 0;
    },
  };
}
