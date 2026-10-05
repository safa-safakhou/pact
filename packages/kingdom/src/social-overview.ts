import type { Pool } from "pg";
import { acknowledgeMessageRead } from "./message-read-state.js";
import { type SupplyTerms, supplyPerspective } from "./supply-terms.js";

export interface SocialParty {
  kingdomId: string;
  handle: string;
  displayName: string;
}

export interface SocialOverview {
  kingdomId: string;
  contacts: (SocialParty & { acceptedGameTimeMs: string })[];
  requests: (SocialParty & {
    id: string;
    direction: "incoming" | "outgoing";
    humanAcceptance?: "your_owner" | "counterparty_owner";
    note: string;
    expiresGameTimeMs: string;
  })[];
  requestHistory: (SocialParty & { id: string; status: string; expiresGameTimeMs: string })[];
  messages: (SocialParty & {
    id: string;
    senderKingdomId: string;
    body: string;
    sentGameTimeMs: string;
  })[];
  supplyOffers: (SocialParty & {
    id: string;
    kingdomA: string;
    kingdomB: string;
    version: number;
    terms: SupplyTerms;
    youSend?: SupplyTerms["aToB"];
    youReceive?: SupplyTerms["bToA"];
    status: string;
    expiresGameTimeMs: string;
    signedBy: string[];
  })[];
  supplyContracts: (SocialParty & {
    id: string;
    kingdomA: string;
    kingdomB: string;
    terms: SupplyTerms;
    youSend?: SupplyTerms["aToB"];
    youReceive?: SupplyTerms["bToA"];
    status: string;
    startGameTimeMs: string;
    endGameTimeMs: string;
  })[];
  garrisonOffers: (SocialParty & {
    id: string;
    lenderKingdomId: string;
    hostKingdomId: string;
    version: number;
    terms: unknown;
    status: string;
    expiresGameTimeMs: string;
    signedBy: string[];
  })[];
  garrisonContracts: (SocialParty & {
    id: string;
    lenderKingdomId: string;
    hostKingdomId: string;
    terms: unknown;
    status: string;
    startGameTimeMs: string;
    endGameTimeMs: string;
  })[];
}

type PartyRow = { kingdom_id: string; handle: string; display_name: string };
type ContactRow = PartyRow & { accepted_game_time_ms: string };
type RequestRow = PartyRow & {
  id: string;
  sender_kingdom_id: string;
  note: string;
  expires_game_time_ms: string;
};
type MessageRow = PartyRow & {
  id: string;
  sender_kingdom_id: string;
  body: string;
  sent_game_time_ms: string;
};
type SupplyOfferRow = PartyRow & {
  id: string;
  kingdom_a: string;
  kingdom_b: string;
  version: number;
  terms: SupplyTerms;
  status: string;
  expires_game_time_ms: string;
  signed_by: string[] | null;
};
type SupplyContractRow = PartyRow & {
  id: string;
  kingdom_a: string;
  kingdom_b: string;
  terms: SupplyTerms;
  status: string;
  start_game_time_ms: string;
  end_game_time_ms: string;
};
type GarrisonOfferRow = PartyRow & {
  id: string;
  lender_kingdom_id: string;
  host_kingdom_id: string;
  version: number;
  terms: unknown;
  status: string;
  expires_game_time_ms: string;
  signed_by: string[] | null;
};
type GarrisonContractRow = PartyRow & {
  id: string;
  lender_kingdom_id: string;
  host_kingdom_id: string;
  terms: unknown;
  status: string;
  start_game_time_ms: string;
  end_game_time_ms: string;
};

function party(row: PartyRow): SocialParty {
  return { kingdomId: row.kingdom_id, handle: row.handle, displayName: row.display_name };
}

/** Owner-only, bounded social reads. The account-to-kingdom lookup is server-side. */
export class SocialOverviewReader {
  constructor(
    private readonly pool: Pool,
    private readonly productScope: string,
  ) {}

  async read(
    accountId: string,
    options: { acknowledgeDeliveredMessages?: boolean } = {},
  ): Promise<SocialOverview | null> {
    const owner = await this.pool.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.productScope, accountId],
    );
    const kingdomId = owner.rows[0]?.id;
    if (!kingdomId) return null;
    const args = [this.productScope, kingdomId];
    const [
      contacts,
      requests,
      messages,
      supplyOffers,
      supplyContracts,
      garrisonOffers,
      garrisonContracts,
      requestHistory,
    ] = await Promise.all([
      this.pool.query<ContactRow>(
        `SELECT peer.id AS kingdom_id, peer.handle, peer.display_name,
             c.accepted_game_time_ms::text
           FROM social_contacts c
           JOIN kingdoms peer ON peer.product_scope = c.product_scope
             AND peer.id = CASE WHEN c.kingdom_a = $2 THEN c.kingdom_b ELSE c.kingdom_a END
           WHERE c.product_scope = $1 AND (c.kingdom_a = $2 OR c.kingdom_b = $2)
           ORDER BY c.accepted_game_time_ms DESC LIMIT 50`,
        args,
      ),
      this.pool.query<RequestRow>(
        `SELECT r.id, r.sender_kingdom_id, r.note, r.expires_game_time_ms::text,
             peer.id AS kingdom_id, peer.handle, peer.display_name
           FROM cold_contact_requests r
           JOIN kingdoms peer ON peer.product_scope = r.product_scope
             AND peer.id = CASE WHEN r.sender_kingdom_id = $2 THEN r.recipient_kingdom_id
               ELSE r.sender_kingdom_id END
           WHERE r.product_scope = $1 AND r.status = 'pending'
             AND (r.sender_kingdom_id = $2 OR r.recipient_kingdom_id = $2)
           ORDER BY r.created_game_time_ms DESC LIMIT 50`,
        args,
      ),
      this.pool.query<MessageRow>(
        `SELECT m.id, m.sender_kingdom_id, m.body, m.sent_game_time_ms::text,
             peer.id AS kingdom_id, peer.handle, peer.display_name
           FROM direct_messages m
           JOIN kingdoms peer ON peer.product_scope = m.product_scope
             AND peer.id = CASE WHEN m.sender_kingdom_id = $2 THEN m.recipient_kingdom_id
               ELSE m.sender_kingdom_id END
           WHERE m.product_scope = $1 AND (m.sender_kingdom_id = $2 OR m.recipient_kingdom_id = $2)
           ORDER BY m.sent_game_time_ms DESC, m.id DESC LIMIT 50`,
        args,
      ),
      this.pool.query<SupplyOfferRow>(
        `SELECT o.id, o.kingdom_a, o.kingdom_b, o.version, o.terms, o.status,
             o.expires_game_time_ms::text, peer.id AS kingdom_id, peer.handle, peer.display_name,
             (SELECT array_agg(s.kingdom_id::text) FROM supply_offer_signatures s
               WHERE s.product_scope = o.product_scope AND s.offer_id = o.id AND s.version = o.version) AS signed_by
           FROM supply_offers o
           JOIN kingdoms peer ON peer.product_scope = o.product_scope
             AND peer.id = CASE WHEN o.kingdom_a = $2 THEN o.kingdom_b ELSE o.kingdom_a END
           WHERE o.product_scope = $1 AND o.status = 'open'
             AND (o.kingdom_a = $2 OR o.kingdom_b = $2)
           ORDER BY o.updated_game_time_ms DESC LIMIT 50`,
        args,
      ),
      this.pool.query<SupplyContractRow>(
        `SELECT c.id, c.kingdom_a, c.kingdom_b, c.terms, c.status,
             c.start_game_time_ms::text, c.end_game_time_ms::text,
             peer.id AS kingdom_id, peer.handle, peer.display_name
           FROM supply_contracts c
           JOIN kingdoms peer ON peer.product_scope = c.product_scope
             AND peer.id = CASE WHEN c.kingdom_a = $2 THEN c.kingdom_b ELSE c.kingdom_a END
           WHERE c.product_scope = $1 AND (c.kingdom_a = $2 OR c.kingdom_b = $2)
           ORDER BY c.start_game_time_ms DESC LIMIT 50`,
        args,
      ),
      this.pool.query<GarrisonOfferRow>(
        `SELECT o.id, o.lender_kingdom_id, o.host_kingdom_id, o.version, o.terms, o.status,
             o.expires_game_time_ms::text, peer.id AS kingdom_id, peer.handle, peer.display_name,
             (SELECT array_agg(s.kingdom_id::text) FROM garrison_offer_signatures s
               WHERE s.product_scope = o.product_scope AND s.offer_id = o.id AND s.version = o.version) AS signed_by
           FROM garrison_offers o
           JOIN kingdoms peer ON peer.product_scope = o.product_scope
             AND peer.id = CASE WHEN o.lender_kingdom_id = $2 THEN o.host_kingdom_id
               ELSE o.lender_kingdom_id END
           WHERE o.product_scope = $1 AND o.status = 'open'
             AND (o.lender_kingdom_id = $2 OR o.host_kingdom_id = $2)
           ORDER BY o.created_game_time_ms DESC LIMIT 50`,
        args,
      ),
      this.pool.query<GarrisonContractRow>(
        `SELECT c.id, c.lender_kingdom_id, c.host_kingdom_id, c.terms, c.status,
             c.start_game_time_ms::text, c.end_game_time_ms::text,
             peer.id AS kingdom_id, peer.handle, peer.display_name
           FROM garrison_contracts c
           JOIN kingdoms peer ON peer.product_scope = c.product_scope
             AND peer.id = CASE WHEN c.lender_kingdom_id = $2 THEN c.host_kingdom_id
               ELSE c.lender_kingdom_id END
           WHERE c.product_scope = $1 AND (c.lender_kingdom_id = $2 OR c.host_kingdom_id = $2)
           ORDER BY c.start_game_time_ms DESC LIMIT 50`,
        args,
      ),
      this.pool.query<PartyRow & { id: string; status: string; expires_game_time_ms: string }>(
        `SELECT r.id,r.status,r.expires_game_time_ms::text,peer.id AS kingdom_id,peer.handle,peer.display_name
           FROM cold_contact_requests r JOIN kingdoms peer ON peer.product_scope=r.product_scope AND peer.id=r.recipient_kingdom_id
           WHERE r.product_scope=$1 AND r.sender_kingdom_id=$2 ORDER BY r.created_game_time_ms DESC,r.id DESC LIMIT 10`,
        args,
      ),
    ]);
    if (options.acknowledgeDeliveredMessages)
      await acknowledgeMessageRead(
        this.pool,
        this.productScope,
        kingdomId,
        messages.rows.filter((row) => row.sender_kingdom_id !== kingdomId).map((row) => row.id),
      );
    return {
      kingdomId,
      requestHistory: requestHistory.rows.map((row) => ({
        ...party(row),
        id: row.id,
        status: row.status,
        expiresGameTimeMs: row.expires_game_time_ms,
      })),
      contacts: contacts.rows.map((row) => ({ ...party(row), acceptedGameTimeMs: row.accepted_game_time_ms })),
      requests: requests.rows.map((row) => ({
        ...party(row),
        id: row.id,
        direction: row.sender_kingdom_id === kingdomId ? "outgoing" : "incoming",
        humanAcceptance: row.sender_kingdom_id === kingdomId ? "counterparty_owner" : "your_owner",
        note: row.note,
        expiresGameTimeMs: row.expires_game_time_ms,
      })),
      messages: messages.rows.map((row) => ({
        ...party(row),
        id: row.id,
        senderKingdomId: row.sender_kingdom_id,
        body: row.body,
        sentGameTimeMs: row.sent_game_time_ms,
      })),
      supplyOffers: supplyOffers.rows.map((row) => ({
        ...party(row),
        id: row.id,
        kingdomA: row.kingdom_a,
        kingdomB: row.kingdom_b,
        version: row.version,
        terms: row.terms,
        ...supplyPerspective(row.terms, row.kingdom_a === kingdomId),
        status: row.status,
        expiresGameTimeMs: row.expires_game_time_ms,
        signedBy: row.signed_by ?? [],
      })),
      supplyContracts: supplyContracts.rows.map((row) => ({
        ...party(row),
        id: row.id,
        kingdomA: row.kingdom_a,
        kingdomB: row.kingdom_b,
        terms: row.terms,
        ...supplyPerspective(row.terms, row.kingdom_a === kingdomId),
        status: row.status,
        startGameTimeMs: row.start_game_time_ms,
        endGameTimeMs: row.end_game_time_ms,
      })),
      garrisonOffers: garrisonOffers.rows.map((row) => ({
        ...party(row),
        id: row.id,
        lenderKingdomId: row.lender_kingdom_id,
        hostKingdomId: row.host_kingdom_id,
        version: row.version,
        terms: row.terms,
        status: row.status,
        expiresGameTimeMs: row.expires_game_time_ms,
        signedBy: row.signed_by ?? [],
      })),
      garrisonContracts: garrisonContracts.rows.map((row) => ({
        ...party(row),
        id: row.id,
        lenderKingdomId: row.lender_kingdom_id,
        hostKingdomId: row.host_kingdom_id,
        terms: row.terms,
        status: row.status,
        startGameTimeMs: row.start_game_time_ms,
        endGameTimeMs: row.end_game_time_ms,
      })),
    };
  }
}
