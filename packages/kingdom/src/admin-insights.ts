import type { PoolClient } from "pg";
export async function readKingdomInsights(client: PoolClient, scope: string, now: Date, gameTime: string) {
  const count = async (table: string, condition = "true") =>
    Number(
      (
        await client.query(`SELECT count(*)::int AS count FROM ${table} WHERE product_scope=$1 AND ${condition}`, [
          scope,
        ])
      ).rows[0]?.count ?? 0,
    );
  const society = {
    kingdoms: await count("kingdoms", "status='ranked'"),
    construction: await count("building_instructions", "state IN ('active','waiting')"),
    training: await count("training_batches", "status='active'"),
    contacts: await count("social_contacts"),
    messages: await count("direct_messages"),
    pendingContacts: await count("cold_contact_requests", `status='pending' AND expires_game_time_ms > ${gameTime}`),
    offers: await count("supply_offers", `status='open' AND expires_game_time_ms > ${gameTime}`),
    contracts: await count("supply_contracts", "status='active'"),
    defaults: await count("supply_contracts", "status='defaulted'"),
    raids: await count("raids", "status IN ('declared','locked')"),
    scouts: await count("scout_operations", "status='active'"),
    courts: await count("courts", "status='active'"),
    collectionFailures: await count("collection_processed_events", "failure_code IS NOT NULL"),
  };
  const moderation = (
    await client.query(
      `SELECT count(*) FILTER(WHERE status IN ('open','appealed'))::int AS open,
    count(*) FILTER(WHERE (status='open' AND triage_due_at < $2) OR (status='appealed' AND appeal_review_due_at < $2))::int AS overdue
    FROM moderation_cases WHERE product_scope=$1`,
      [scope, now],
    )
  ).rows[0];
  const collection = (
    await client.query(
      `SELECT last_outbox_id::text AS cursor FROM collection_projection_state WHERE product_scope=$1`,
      [scope],
    )
  ).rows[0] ?? { cursor: "0" };
  return { society, moderation, collection };
}

export async function readAdminKingdoms(client: PoolClient, scope: string, search: string, offset: number) {
  const filter = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const where = "product_scope=$1 AND (handle ILIKE $2 OR display_name ILIKE $2)";
  const total =
    (await client.query(`SELECT count(*)::int AS total FROM kingdoms WHERE ${where}`, [scope, filter])).rows[0]
      ?.total ?? 0;
  const players = (
    await client.query(
      `SELECT id,handle,display_name AS name,status,activated_at AS "joinedAt",
    (SELECT level FROM kingdom_buildings b WHERE b.product_scope=$1 AND b.kingdom_id=k.id AND kind='hall') AS hall,
    (SELECT max(game_time_ms)::text FROM kingdom_action_events a WHERE a.product_scope=$1 AND a.kingdom_id=k.id) AS "lastActionGameTimeMs"
    FROM kingdoms k WHERE ${where} ORDER BY activated_at DESC,id LIMIT 25 OFFSET $3`,
      [scope, filter, offset],
    )
  ).rows;
  return { players, total, offset, pageSize: 25 };
}
