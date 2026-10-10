import type { Pool } from "pg";
import { acknowledgeMessageRead } from "./message-read-state.js";

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

  /** A selectable thread must already contain an owner-involved message. */
  async assertSelectable(accountId: string, counterpartyKingdomIds: readonly string[]): Promise<boolean> {
    if (counterpartyKingdomIds.length === 0) return true;
    const result = await this.pool.query<{ counterparty_kingdom_id: string }>(
      `SELECT DISTINCT CASE WHEN dm.sender_kingdom_id = k.id
         THEN dm.recipient_kingdom_id ELSE dm.sender_kingdom_id END AS counterparty_kingdom_id
       FROM kingdoms k JOIN direct_messages dm ON dm.product_scope = k.product_scope
         AND (dm.sender_kingdom_id = k.id OR dm.recipient_kingdom_id = k.id)
       WHERE k.product_scope = $1 AND k.account_id = $2 AND k.status = 'ranked'
         AND CASE WHEN dm.sender_kingdom_id = k.id
           THEN dm.recipient_kingdom_id ELSE dm.sender_kingdom_id END = ANY($3::uuid[])`,
      [this.productScope, accountId, counterpartyKingdomIds],
    );
    return result.rows.length === counterpartyKingdomIds.length;
  }

  async read(
    accountId: string,
    counterpartyKingdomId: string,
    limit = 5,
    maxBytes = 36_000,
  ): Promise<ConversationPage | null> {
    const pageByteLimit = Math.min(100_000, Math.max(1_000, maxBytes));
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
       ORDER BY (recipient_kingdom_id = $2 AND read_game_time_ms IS NULL) DESC, sent_game_time_ms DESC, id DESC LIMIT $4`,
      [this.productScope, ownerId, counterpartyKingdomId, Math.min(Math.max(limit, 1), 5)],
    );
    const page: ConversationPage = {
      counterpartyKingdomId,
      messages: rows.rows.map((row) => ({
        messageId: row.id,
        sender: row.sender_kingdom_id === ownerId ? "owner" : "counterparty",
        sentGameTimeMs: row.sent_game_time_ms,
        body: null,
        bodyOmitted: true,
      })),
      untrustedContent: true,
    };
    // Bound the serialized page before acknowledging it, including JSON escaping.
    const messages = [...page.messages];
    for (const [index, row] of rows.rows.entries()) {
      if (Buffer.byteLength(row.body, "utf8") > 16_384) continue;
      const previous = messages[index];
      if (!previous) continue;
      messages[index] = {
        messageId: previous.messageId,
        sender: previous.sender,
        sentGameTimeMs: previous.sentGameTimeMs,
        body: row.body,
      };
      if (Buffer.byteLength(JSON.stringify({ ...page, messages }), "utf8") > pageByteLimit) messages[index] = previous;
    }
    await acknowledgeMessageRead(
      this.pool,
      this.productScope,
      ownerId,
      messages
        .filter((message) => message.sender === "counterparty" && message.body !== null)
        .map((message) => message.messageId),
    );
    return { ...page, messages };
  }
}
