import { randomUUID } from "node:crypto";
import { appendOutbox, withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";

/** Reading acknowledges only delivered incoming IDs, never another owner's or omitted message. */
export async function acknowledgeMessageRead(
  pool: Pool,
  productScope: string,
  recipientKingdomId: string,
  messageIds: readonly string[],
): Promise<void> {
  if (messageIds.length === 0) return;
  await withTransaction(pool, (client) =>
    recordMessageAcknowledgements(client, productScope, recipientKingdomId, messageIds),
  );
}
export async function recordMessageAcknowledgements(
  client: PoolClient,
  productScope: string,
  recipientKingdomId: string,
  messageIds: readonly string[],
): Promise<void> {
  const rows = await client.query<{ id: string }>(
    `UPDATE direct_messages SET read_game_time_ms = GREATEST(sent_game_time_ms,
       (SELECT committed_game_time_ms FROM world_clocks WHERE product_scope = $1))
     WHERE product_scope = $1 AND recipient_kingdom_id = $2 AND id = ANY($3::uuid[])
       AND read_game_time_ms IS NULL RETURNING id`,
    [productScope, recipientKingdomId, messageIds],
  );
  for (const r of rows.rows)
    await appendOutbox(client, {
      productScope,
      eventId: randomUUID(),
      type: "message.acknowledged.v2",
      payload: { messageId: r.id },
    });
}
