import type { Pool } from "pg";

/** Reading acknowledges only delivered incoming IDs, never another owner's or omitted message. */
export async function acknowledgeMessageRead(
  pool: Pool,
  productScope: string,
  recipientKingdomId: string,
  messageIds: readonly string[],
): Promise<void> {
  if (messageIds.length === 0) return;
  await pool.query(
    `UPDATE direct_messages SET read_game_time_ms = GREATEST(sent_game_time_ms,
       (SELECT committed_game_time_ms FROM world_clocks WHERE product_scope = $1))
     WHERE product_scope = $1 AND recipient_kingdom_id = $2 AND id = ANY($3::uuid[])
       AND read_game_time_ms IS NULL`,
    [productScope, recipientKingdomId, messageIds],
  );
}
