export function supplyDeliverySql() {
  return `COALESCE((SELECT jsonb_agg(delivery) FROM(SELECT resource,CASE WHEN payer_kingdom_id=$2 THEN 'sent' ELSE 'received' END AS direction,count(*)::int AS installments,sum(due_units)::text AS "dueMarked",sum(delivered_units)::text AS "deliveredMarked",sum(overflow_units)::text AS "overflowMarked",count(*) FILTER(WHERE failure_reason IS NOT NULL)::int AS "failedInstallments",max(game_time_ms)::text AS "lastGameTimeMs" FROM supply_installments i WHERE i.product_scope=o.product_scope AND i.contract_id=o.id GROUP BY payer_kingdom_id,resource ORDER BY payer_kingdom_id,resource) delivery),'[]'::jsonb)`;
}
// Code-owned SQL only; parameters are authenticated scope/owner and snapshot GAME time.
// Order is urgency/deadline, never a peer's prose volume or a prescribed strategic choice.
export function socialAttentionSourceSql() {
  const offers = (table: string, type: string, left: string, right: string, signatures: string, versions?: string) => `
    SELECT '0:'||lpad(o.expires_game_time_ms::text,20,'0')||':${type}:'||o.id AS key,o.id,
      jsonb_build_object('type','${type}','id',o.id,'ownerKingdomId',$2::uuid,'kingdomA',o.${left},'kingdomB',o.${right},
      'counterpartyKingdomId',CASE WHEN o.${left}=$2 THEN o.${right} ELSE o.${left} END,
      'yourRole',CASE WHEN o.${left}=$2 THEN 'party_a' ELSE 'party_b' END,'version',o.version,'terms',o.terms,'status',o.status,
      'expiresGameTimeMs',o.expires_game_time_ms::text,'expired',false,
      'reason',CASE WHEN EXISTS(SELECT 1 FROM ${signatures} s WHERE s.product_scope=o.product_scope AND s.offer_id=o.id AND s.version=o.version AND s.kingdom_id=$2) THEN 'awaiting_peer_signature' ELSE 'signature_decision' END,
      'proposedBy',${versions ? `(SELECT v.proposed_by FROM ${versions} v WHERE v.product_scope=o.product_scope AND v.offer_id=o.id AND v.version=o.version)` : "NULL"},
      'signedBy',COALESCE((SELECT jsonb_agg(s.kingdom_id ORDER BY s.kingdom_id) FROM ${signatures} s WHERE s.product_scope=o.product_scope AND s.offer_id=o.id AND s.version=o.version),'[]'::jsonb)) AS data
    FROM ${table} o WHERE o.product_scope=$1 AND (o.${left}=$2 OR o.${right}=$2) AND o.status='open' AND o.expires_game_time_ms>$6`;
  const contracts = (table: string, type: string, left: string, right: string) => `
    SELECT '1:'||lpad(o.end_game_time_ms::text,20,'0')||':${type}:'||o.id AS key,o.id,
      jsonb_build_object('type','${type}','id',o.id,'ownerKingdomId',$2::uuid,'kingdomA',o.${left},'kingdomB',o.${right},
      'counterpartyKingdomId',CASE WHEN o.${left}=$2 THEN o.${right} ELSE o.${left} END,'yourRole',CASE WHEN o.${left}=$2 THEN 'party_a' ELSE 'party_b' END,
      'terms',o.terms,'status',o.status,'offerId',o.offer_id,'offerVersion',${type === "SupplyContract" ? "o.offer_version" : "(SELECT version FROM garrison_offers WHERE product_scope=o.product_scope AND id=o.offer_id)"},
      'reason','active_obligation','deliveries',${type === "SupplyContract" ? supplyDeliverySql() : "'[]'::jsonb"},'startGameTimeMs',o.start_game_time_ms::text,'endGameTimeMs',o.end_game_time_ms::text,
      'noticeEndGameTimeMs',${type === "SupplyContract" ? "o.notice_end_game_time_ms::text" : "NULL"}) AS data
    FROM ${table} o WHERE o.product_scope=$1 AND (o.${left}=$2 OR o.${right}=$2) AND ${type === "SupplyContract" ? "o.status='active'" : "o.status IN('active','exit_pending')"}`;
  return [
    `SELECT (CASE WHEN r.recipient_kingdom_id=$2 THEN '0:' ELSE '2:' END)||lpad(r.expires_game_time_ms::text,20,'0')||':ContactRequest:'||r.id AS key,r.id,
      jsonb_build_object('type','ContactRequest','id',r.id,'ownerKingdomId',$2::uuid,'senderKingdomId',r.sender_kingdom_id,'recipientKingdomId',r.recipient_kingdom_id,
        'counterpartyKingdomId',CASE WHEN r.sender_kingdom_id=$2 THEN r.recipient_kingdom_id ELSE r.sender_kingdom_id END,
        'direction',CASE WHEN r.recipient_kingdom_id=$2 THEN 'incoming' ELSE 'outgoing' END,'status',r.status,'expiresGameTimeMs',r.expires_game_time_ms::text,'note',r.note,
        'reason',CASE WHEN r.recipient_kingdom_id=$2 THEN 'incoming_request_decision' ELSE 'awaiting_contact_decision' END) AS data
      FROM cold_contact_requests r WHERE r.product_scope=$1 AND (r.sender_kingdom_id=$2 OR r.recipient_kingdom_id=$2) AND r.status='pending' AND r.expires_game_time_ms>$6`,
    offers(
      "supply_offers",
      "SupplyOffer",
      "kingdom_a",
      "kingdom_b",
      "supply_offer_signatures",
      "supply_offer_versions",
    ),
    offers("garrison_offers", "GarrisonOffer", "lender_kingdom_id", "host_kingdom_id", "garrison_offer_signatures"),
    contracts("supply_contracts", "SupplyContract", "kingdom_a", "kingdom_b"),
    contracts("garrison_contracts", "GarrisonContract", "lender_kingdom_id", "host_kingdom_id"),
  ].join(" UNION ALL ");
}
