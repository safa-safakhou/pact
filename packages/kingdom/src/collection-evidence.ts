import type { PoolClient } from "pg";
/** Called inside the Court/retirement command transaction. No reads or model calls create intervals. */
export async function recordCourtCollectionInterval(client: PoolClient, scope: string, courtId: string, at: number) {
  if (!Number.isSafeInteger(at) || at < 0) throw Error("INVALID_COLLECTION_TIME");
  const members = await client.query<{ id: string; account_id: string }>(
    `SELECT k.id,k.account_id FROM courts c JOIN court_memberships m ON m.court_id=c.id
     JOIN kingdoms k ON k.id=m.kingdom_id AND k.product_scope=c.product_scope
     WHERE c.product_scope=$1 AND c.id=$2 AND c.status='active' AND k.status='ranked' ORDER BY k.id`,
    [scope, courtId],
  );
  const eligible = new Set(members.rows.map((r) => r.account_id)).size >= 2 ? members.rows.map((r) => r.id) : [];
  await client.query(
    `UPDATE collection_court_intervals SET end_game_time_ms=$3,closed_at=clock_timestamp()
     WHERE product_scope=$1 AND court_id=$2 AND end_game_time_ms IS NULL AND NOT kingdom_id=ANY($4::uuid[])`,
    [scope, courtId, at, eligible],
  );
  for (const id of eligible)
    await client.query(
      `INSERT INTO collection_court_intervals(product_scope,court_id,kingdom_id,start_game_time_ms)
       VALUES($1,$2,$3,$4) ON CONFLICT(product_scope,court_id,kingdom_id) WHERE end_game_time_ms IS NULL DO NOTHING`,
      [scope, courtId, id, at],
    );
}
