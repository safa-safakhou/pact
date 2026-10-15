import type { ObservationSectionQuery } from "@pact/contracts";
import type { PoolClient } from "pg";
import { type SupplyTerms, supplyPerspective } from "./supply-terms.js";
import type { OwnerKingdomView } from "./world-views.js";

export class ObservationSectionError extends Error {
  constructor(readonly code: "FORBIDDEN" | "STALE_OBSERVATION" | "INVALID_REQUEST") {
    super(code);
  }
}
// One repeatable-read snapshot. Private records are selected by authenticated
// ownership in SQL; cursors page a snapshot and never select an account.
export async function readObservationSection(
  client: PoolClient,
  scope: string,
  accountId: string,
  query: ObservationSectionQuery,
  readWorld: (ownerId: string, minutes: number) => Promise<OwnerKingdomView | null>,
): Promise<Record<string, unknown>> {
  const owner = (
    await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2 AND status='ranked'",
      [scope, accountId],
    )
  ).rows[0];
  if (!owner) throw new ObservationSectionError("FORBIDDEN");
  const clock = (
    await client.query<{ game: string; tick: string; event: string; status: string }>(
      `SELECT committed_game_time_ms::text AS game,tick_sequence::text AS tick,status,
    (SELECT COALESCE(max(id),0)::text FROM outbox_events WHERE product_scope=$1) AS event
    FROM world_clocks WHERE product_scope=$1`,
      [scope],
    )
  ).rows[0];
  if (!clock) throw new ObservationSectionError("FORBIDDEN");
  const cursor = query.cursor;
  if (cursor && (cursor.ownerKingdomId !== owner.id || cursor.section !== query.section))
    throw new ObservationSectionError("FORBIDDEN");
  if (cursor && (cursor.committedTickSequence !== clock.tick || cursor.lastCommittedEventId !== clock.event))
    throw new ObservationSectionError("STALE_OBSERVATION");
  if (
    (cursor && query.recordId) ||
    (["forecast", "construction"].includes(query.section) && (cursor || query.recordId))
  )
    throw new ObservationSectionError("INVALID_REQUEST");
  const header = {
    schemaVersion: "pact.observation-section.v1",
    section: query.section,
    ownerKingdomId: owner.id,
    asOfGameTimeMs: Number(clock.game),
    committedTickSequence: clock.tick,
    lastCommittedEventId: clock.event,
    worldStatus: clock.status,
  };
  if (query.section === "forecast" || query.section === "construction") {
    const world = await readWorld(owner.id, query.forecastMinutes ?? 60);
    if (!world) throw new ObservationSectionError("FORBIDDEN");
    return {
      ...header,
      ...(query.section === "forecast"
        ? { forecast: world.forecast }
        : {
            authority: world.authority,
            balances: world.balances,
            buildings: world.buildings,
            builders: world.builders,
            nextUpgradeChecks: world.nextUpgradeChecks,
            consequences: world.consequences,
          }),
      coverage: { complete: true, meaning: "Complete selected section, not a complete world observation." },
      next: null,
    };
  }
  const args = [
    scope,
    owner.id,
    query.recordId ?? null,
    cursor?.afterKey ?? "",
    (query.limit ?? 10) + 1,
    Number(clock.game),
  ];
  let source: string;
  if (query.section === "units")
    source = `SELECT 'Unit:'||t.id AS key,t.id,
    jsonb_build_object('type','Unit','id',t.id,'ownerKingdomId',t.owner_kingdom_id,'hostKingdomId',t.host_kingdom_id,
      'unitType',t.type,'placement',t.placement,'homeGuard',t.home_guard,'asOfGameTimeMs',$6::bigint,
      'battleLocked',EXISTS(SELECT 1 FROM battle_unit_eligibility e WHERE e.product_scope=t.product_scope AND e.troop_id=t.id AND e.locked_until_game_time_ms>$6),
      'scoutEligible',t.type='spearman' AND NOT t.home_guard AND t.host_kingdom_id=t.owner_kingdom_id AND t.placement='home'
        AND NOT EXISTS(SELECT 1 FROM battle_unit_eligibility e WHERE e.product_scope=t.product_scope AND e.troop_id=t.id AND e.locked_until_game_time_ms>$6)) AS data
      FROM kingdom_troops t WHERE t.product_scope=$1 AND t.owner_kingdom_id=$2`;
  else if (query.section === "requests")
    source = `SELECT 'ContactRequest:'||r.id AS key,r.id,
    jsonb_build_object('type','ContactRequest','id',r.id,'ownerKingdomId',$2::uuid,'senderKingdomId',r.sender_kingdom_id,'recipientKingdomId',r.recipient_kingdom_id,
      'kingdomId',CASE WHEN r.sender_kingdom_id=$2 THEN r.recipient_kingdom_id ELSE r.sender_kingdom_id END,
      'direction',CASE WHEN r.recipient_kingdom_id=$2 THEN 'incoming' ELSE 'outgoing' END,'status',r.status,
      'expiresGameTimeMs',r.expires_game_time_ms::text,'expired',r.expires_game_time_ms<=$6,'note',r.note) AS data
      FROM cold_contact_requests r WHERE r.product_scope=$1 AND (r.sender_kingdom_id=$2 OR r.recipient_kingdom_id=$2)`;
  else {
    const offer = (
      table: string,
      prefix: string,
      left: string,
      right: string,
      signatures: string,
    ) => `SELECT '${prefix}:'||o.id AS key,o.id,
      jsonb_build_object('type','${prefix}','id',o.id,'ownerKingdomId',$2::uuid,'kingdomA',o.${left},'kingdomB',o.${right},
      'counterpartyKingdomId',CASE WHEN o.${left}=$2 THEN o.${right} ELSE o.${left} END,'version',o.version,'terms',o.terms,'status',o.status,
      'expiresGameTimeMs',o.expires_game_time_ms::text,'expired',o.expires_game_time_ms<=$6,
      'signedBy',COALESCE((SELECT jsonb_agg(s.kingdom_id ORDER BY s.kingdom_id) FROM ${signatures} s WHERE s.product_scope=o.product_scope AND s.offer_id=o.id AND s.version=o.version),'[]'::jsonb)) AS data
      FROM ${table} o WHERE o.product_scope=$1 AND (o.${left}=$2 OR o.${right}=$2)`;
    const contract = (
      table: string,
      prefix: string,
      left: string,
      right: string,
    ) => `SELECT '${prefix}:'||o.id AS key,o.id,
      jsonb_build_object('type','${prefix}','id',o.id,'ownerKingdomId',$2::uuid,'kingdomA',o.${left},'kingdomB',o.${right},
      'counterpartyKingdomId',CASE WHEN o.${left}=$2 THEN o.${right} ELSE o.${left} END,'terms',o.terms,'status',o.status,
      'offerId',o.offer_id,'offerVersion',${prefix === "SupplyContract" ? "o.offer_version" : "(SELECT version FROM garrison_offers WHERE id=o.offer_id AND product_scope=o.product_scope)"},'startGameTimeMs',o.start_game_time_ms::text,'endGameTimeMs',o.end_game_time_ms::text) AS data
      FROM ${table} o WHERE o.product_scope=$1 AND (o.${left}=$2 OR o.${right}=$2)`;
    // Identifiers are code-owned, never interpolated from the request.
    source = [
      offer("supply_offers", "SupplyOffer", "kingdom_a", "kingdom_b", "supply_offer_signatures"),
      contract("supply_contracts", "SupplyContract", "kingdom_a", "kingdom_b"),
      offer("garrison_offers", "GarrisonOffer", "lender_kingdom_id", "host_kingdom_id", "garrison_offer_signatures"),
      contract("garrison_contracts", "GarrisonContract", "lender_kingdom_id", "host_kingdom_id"),
    ].join(" UNION ALL ");
  }
  const rows = (
    await client.query<{ key: string; id: string; data: Record<string, unknown> }>(
      `SELECT * FROM (${source}) selected WHERE ($3::uuid IS NULL OR id=$3) AND key>$4 ORDER BY key LIMIT $5`,
      args,
    )
  ).rows;
  const limit = query.limit ?? 10,
    kept = rows.slice(0, limit),
    more = rows.length > limit;
  const records = kept.map((r) =>
    r.data.type === "SupplyOffer" || r.data.type === "SupplyContract"
      ? { ...r.data, ...supplyPerspective(r.data.terms as SupplyTerms, r.data.kingdomA === owner.id) }
      : r.data,
  );
  return {
    ...header,
    records,
    coverage: {
      complete: !more,
      delivered: records.length,
      meaning: "Whole scoped records. Further pages are unknown when next is present; no messages acknowledged.",
    },
    next: more
      ? {
          ownerKingdomId: owner.id,
          section: query.section,
          committedTickSequence: clock.tick,
          lastCommittedEventId: clock.event,
          afterKey: kept.at(-1)?.key,
        }
      : null,
    untrustedContent: query.section === "requests",
  };
}
