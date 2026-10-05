import type { PoolClient } from "pg";
export interface RetainedMilestone {
  recordId: string;
  occurredGameTimeMs: number;
  summary: string;
}
export type FirstRetainedMilestones = Record<"build" | "contact" | "delivery", RetainedMilestone | null>;
/** Inside the existing authorized owner snapshot; queries all retained rows, never a latest-page guess. */
export async function readFirstRetainedMilestones(
  client: PoolClient,
  scope: string,
  owner: string,
): Promise<FirstRetainedMilestones> {
  const rows = await client.query<RetainedMilestone & { kind: "build" | "contact" | "delivery" }>(
    `
 SELECT 'build' AS kind, id::text AS "recordId", settled_game_time_ms::float8 AS "occurredGameTimeMs",
 building_kind || ' level ' || target_level::text || ' completed' AS summary
 FROM (SELECT * FROM building_instructions WHERE product_scope=$1 AND kingdom_id=$2 AND state='completed'
 AND settled_game_time_ms IS NOT NULL ORDER BY settled_game_time_ms,id LIMIT 1) b
 UNION ALL
 SELECT 'contact', peer::text || ':' || accepted_game_time_ms::text, accepted_game_time_ms::float8,
 'Contact accepted with @' || k.handle
 FROM (SELECT accepted_game_time_ms,CASE WHEN kingdom_a=$2 THEN kingdom_b ELSE kingdom_a END AS peer
 FROM social_contacts WHERE product_scope=$1 AND (kingdom_a=$2 OR kingdom_b=$2)
 ORDER BY accepted_game_time_ms,kingdom_a,kingdom_b LIMIT 1) c
 JOIN kingdoms k ON k.product_scope=$1 AND k.id=c.peer
 UNION ALL
 SELECT 'delivery', contract_id::text, game_time_ms::float8,
 CASE WHEN payer_kingdom_id=$2 THEN 'Sent ' ELSE 'Received ' END || delivered_units::text || ' marked ' || resource ||
 '; overflow ' || overflow_units::text || ' marked (not credited)'
 FROM (SELECT i.* FROM supply_installments i JOIN supply_contracts c ON c.product_scope=i.product_scope AND c.id=i.contract_id
 WHERE i.product_scope=$1 AND (c.kingdom_a=$2 OR c.kingdom_b=$2) AND i.delivered_units>0
 ORDER BY i.game_time_ms,i.contract_id,i.payer_kingdom_id LIMIT 1) d
 `,
    [scope, owner],
  );
  const result: FirstRetainedMilestones = { build: null, contact: null, delivery: null };
  for (const { kind, ...record } of rows.rows) result[kind] = record;
  return result;
}
