import type { MemorySourceSchema } from "@pact/contracts";
import type { PoolClient } from "pg";
import type { z } from "zod";

type Source = z.infer<typeof MemorySourceSchema>;

/** Metadata only. Linked prose/terms/reports must be read through their existing participant projections. */
export class MemorySourceReader {
  constructor(private readonly scope: string) {}
  async read(client: PoolClient, accountId: string, source: Source) {
    const kingdoms = `SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2`;
    let sql: string;
    switch (source.kind) {
      case "message":
        sql = `SELECT m.id,'recorded'::text AS status,m.sent_game_time_ms::text AS "recordGameTimeMs",m.agent_originated AS "agentOriginated",m.sender_kingdom_id AS "senderKingdomId",CASE WHEN m.sender_kingdom_id IN(${kingdoms}) THEN m.recipient_kingdom_id ELSE m.sender_kingdom_id END AS "peerKingdomId" FROM direct_messages m WHERE m.product_scope=$1 AND m.id=$3 AND (m.sender_kingdom_id IN(${kingdoms}) OR m.recipient_kingdom_id IN(${kingdoms}))`;
        break;
      case "supply-offer":
        sql = `SELECT o.id,o.status,o.version AS "currentVersion",o.updated_game_time_ms::text AS "recordGameTimeMs",CASE WHEN o.kingdom_a IN(${kingdoms}) THEN o.kingdom_b ELSE o.kingdom_a END AS "peerKingdomId" FROM supply_offers o WHERE o.product_scope=$1 AND o.id=$3 AND (o.kingdom_a IN(${kingdoms}) OR o.kingdom_b IN(${kingdoms})) AND ($4::int IS NULL OR EXISTS(SELECT 1 FROM supply_offer_versions v WHERE v.product_scope=o.product_scope AND v.offer_id=o.id AND v.version=$4))`;
        break;
      case "supply-contract":
        sql = `SELECT o.id,o.status,o.start_game_time_ms::text AS "recordGameTimeMs",o.offer_id AS "offerId",o.close_reason AS "closeReason",CASE WHEN o.kingdom_a IN(${kingdoms}) THEN o.kingdom_b ELSE o.kingdom_a END AS "peerKingdomId" FROM supply_contracts o WHERE o.product_scope=$1 AND o.id=$3 AND (o.kingdom_a IN(${kingdoms}) OR o.kingdom_b IN(${kingdoms}))`;
        break;
      case "garrison-offer":
      case "garrison-contract": {
        const offer = source.kind === "garrison-offer";
        sql = `SELECT o.id,o.status,${offer ? 'o.version AS "currentVersion",' : ""}o.${offer ? "created" : "start"}_game_time_ms::text AS "recordGameTimeMs",CASE WHEN o.lender_kingdom_id IN(${kingdoms}) THEN o.host_kingdom_id ELSE o.lender_kingdom_id END AS "peerKingdomId" FROM ${offer ? "garrison_offers" : "garrison_contracts"} o WHERE o.product_scope=$1 AND o.id=$3 AND (o.lender_kingdom_id IN(${kingdoms}) OR o.host_kingdom_id IN(${kingdoms}))${offer ? " AND ($4::int IS NULL OR o.version=$4)" : ""}`;
        break;
      }
      case "building":
        sql = `SELECT id,state AS status,building_kind AS building,target_level AS "targetLevel",queued_game_time_ms::text AS "recordGameTimeMs" FROM building_instructions WHERE product_scope=$1 AND account_id=$2 AND id=$3`;
        break;
      case "scout":
        sql = `SELECT o.id,o.status,o.started_game_time_ms::text AS "recordGameTimeMs" FROM scout_operations o WHERE o.product_scope=$1 AND o.id=$3 AND o.scout_kingdom_id IN(${kingdoms})`;
        break;
      case "raid":
        sql = `SELECT o.id,o.status,o.declared_game_time_ms::text AS "recordGameTimeMs" FROM raids o WHERE o.product_scope=$1 AND o.id=$3 AND (o.leader_kingdom_id IN(${kingdoms}) OR o.target_kingdom_id IN(${kingdoms}) OR EXISTS(SELECT 1 FROM raid_contributions c WHERE c.product_scope=o.product_scope AND c.raid_id=o.id AND c.kingdom_id IN(${kingdoms})))`;
        break;
      case "receipt":
        sql = `SELECT command_id AS id,code AS status,receipt->>'gameTimeMs' AS "recordGameTimeMs" FROM command_receipts WHERE product_scope=$1 AND account_id=$2 AND command_id=$3`;
        break;
    }
    const args: unknown[] = [this.scope, accountId, source.id];
    if (source.kind === "supply-offer" || source.kind === "garrison-offer") args.push(source.version ?? null);
    const row = (await client.query(sql, args)).rows[0];
    if (!row) return null;
    return {
      ...source,
      ...row,
      classification: "engine_record",
      meaning:
        "Current retained database metadata, not an actionable quote. Read the current projection for effective expiry/permissions. Player statements and notes remain claims; this pointer grants no access beyond the existing source reader.",
      read:
        source.kind === "message"
          ? { tool: "pact_council_thread_v1", args: { kingdomId: row.peerKingdomId } }
          : source.kind.startsWith("supply-") || source.kind.startsWith("garrison-")
            ? { tool: "pact_conversation_history_v2", args: { kingdomId: row.peerKingdomId } }
            : source.kind === "raid"
              ? { tool: "pact_report_read_v1", args: { kind: "raid_participant", recordId: source.id } }
              : source.kind === "scout"
                ? { tool: "pact_report_read_v1", args: { kind: "scout", recordId: source.id } }
                : source.kind === "receipt"
                  ? { tool: "pact_receipt_read_v1", args: { commandId: source.id } }
                  : { tool: "pact_world_read_v1", args: {} },
    };
  }
}
