import type { PoolClient } from "pg";

export async function readIdentityInsights(client: PoolClient, scope: string, since: Date) {
  const totals = (
    await client.query(
      `SELECT count(*) FILTER(WHERE role='player' AND status='active')::int AS players,
    count(*) FILTER(WHERE role='staff' AND status='active')::int AS administrators,
    count(*) FILTER(WHERE role='player' AND created_at >= $2)::int AS joined,
    count(*) FILTER(WHERE status='closing')::int AS closing FROM accounts WHERE product_scope=$1`,
      [scope, since],
    )
  ).rows[0];
  const activity = (
    await client.query(
      `SELECT count(DISTINCT account_id)::int AS active FROM sessions
    WHERE product_scope=$1 AND audience='human' AND last_seen_at >= $2
    AND account_id IN(SELECT id FROM accounts WHERE product_scope=$1 AND role='player')`,
      [scope, since],
    )
  ).rows[0];
  const security = (
    await client.query(
      `SELECT type,count(*)::int AS count FROM security_events
    WHERE product_scope=$1 AND occurred_at >= $2 GROUP BY type ORDER BY count(*) DESC,type LIMIT 12`,
      [scope, since],
    )
  ).rows;
  return { ...totals, ...activity, security };
}
