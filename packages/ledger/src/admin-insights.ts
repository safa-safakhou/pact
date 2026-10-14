import { INTERNAL_UNITS_PER_RESOURCE } from "@pact/domain";
import type { PoolClient } from "pg";

function whole(units: string): string {
  const value = BigInt(units);
  const remainder = value % INTERNAL_UNITS_PER_RESOURCE;
  return `${value / INTERNAL_UNITS_PER_RESOURCE}${remainder ? ` + ${remainder}/${INTERNAL_UNITS_PER_RESOURCE}` : ""}`;
}
export async function readLedgerInsights(client: PoolClient, scope: string) {
  const rows = (
    await client.query(
      `SELECT resource,sum(ordinary_units)::text AS ordinary,
    sum(allowance_units)::text AS allowance,sum(locked_units)::text AS locked,
    sum(production_per_minute_units)::text AS production,
    count(*) FILTER(WHERE ordinary_units=storage_cap_units)::int AS "atCapacity"
    FROM resource_balances WHERE product_scope=$1 GROUP BY resource ORDER BY resource`,
      [scope],
    )
  ).rows;
  return rows.map((r) => ({
    resource: String(r.resource),
    ordinary: whole(r.ordinary),
    allowance: whole(r.allowance),
    locked: whole(r.locked),
    production: whole(r.production),
    atCapacity: Number(r.atCapacity),
  }));
}
