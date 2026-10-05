import type { PoolClient } from "pg";
import { ModerationError } from "./moderation-content.js";
/** Read-only game admission policy; this grants no access to case evidence. */
export async function assertModerationAllowed(
  client: PoolClient,
  scope: string,
  accountId: string,
  kind: "play" | "messaging",
  now: Date,
): Promise<void> {
  const result = await client.query(
    "SELECT case_id FROM moderation_restrictions WHERE product_scope=$1 AND account_id=$2 AND kind=$3 AND until_at>$4",
    [scope, accountId, kind, now],
  );
  if (result.rowCount) throw new ModerationError("FORBIDDEN");
}
