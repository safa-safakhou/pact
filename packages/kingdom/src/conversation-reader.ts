import type { Pool } from "pg";

export interface ConversationMessage {
  readonly messageId: string;
  readonly sender: "owner" | "counterparty";
  readonly sentGameTimeMs: string;
  readonly body: string | null;
  readonly bodyOmitted?: true;
}

export interface ConversationPage {
  readonly counterpartyKingdomId: string;
  readonly messages: readonly ConversationMessage[];
  readonly untrustedContent: true;
}

/** Domain-owned, owner-bound direct-message projection for model and MCP reads. */
export class ConversationReader {
  constructor(
    private readonly pool: Pool,
    private readonly productScope: string,
  ) {}

  async read(accountId: string, counterpartyKingdomId: string, limit = 5): Promise<ConversationPage | null> {
    const owner = await this.pool.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.productScope, accountId],
    );
    const ownerId = owner.rows[0]?.id;
    if (!ownerId || ownerId === counterpartyKingdomId) return null;
    const rows = await this.pool.query<{
      id: string;
      sender_kingdom_id: string;
      body: string;
      sent_game_time_ms: string;
    }>(
      `SELECT id, sender_kingdom_id, body, sent_game_time_ms::text
       FROM direct_messages WHERE product_scope = $1
         AND ((sender_kingdom_id = $2 AND recipient_kingdom_id = $3)
           OR (sender_kingdom_id = $3 AND recipient_kingdom_id = $2))
       ORDER BY sent_game_time_ms DESC, id DESC LIMIT $4`,
      [this.productScope, ownerId, counterpartyKingdomId, Math.min(Math.max(limit, 1), 5)],
    );
    return {
      counterpartyKingdomId,
      messages: rows.rows.map((row) => ({
        messageId: row.id,
        sender: row.sender_kingdom_id === ownerId ? "owner" : "counterparty",
        sentGameTimeMs: row.sent_game_time_ms,
        ...(Buffer.byteLength(row.body, "utf8") <= 512
          ? { body: row.body }
          : { body: null, bodyOmitted: true as const }),
      })),
      untrustedContent: true,
    };
  }
}
