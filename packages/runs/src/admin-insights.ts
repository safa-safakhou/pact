import type { PoolClient } from "pg";
export async function readRunInsights(client: PoolClient, scope: string, since: Date, now: Date) {
  const runs = (
    await client.query(
      `SELECT status,count(*)::int AS count FROM envoy_runs WHERE product_scope=$1 GROUP BY status ORDER BY status`,
      [scope],
    )
  ).rows;
  const usage = (
    await client.query(
      `SELECT coalesce(sum(used_calls),0)::text AS calls,coalesce(sum(used_tokens),0)::text AS tokens,
    count(*) FILTER(WHERE status='failed')::int AS failed FROM envoy_runs WHERE product_scope=$1 AND created_at >= $2`,
      [scope, since],
    )
  ).rows[0];
  const leases = (
    await client.query(
      `SELECT holder_kind AS kind,count(*)::int AS count FROM write_leases
    WHERE product_scope=$1 AND released_at IS NULL AND expires_at > $2 GROUP BY holder_kind ORDER BY holder_kind`,
      [scope, now],
    )
  ).rows;
  const external = (
    await client.query(
      `SELECT count(*)::int AS observations,count(DISTINCT account_id)::int AS accounts
    FROM external_agent_activity WHERE product_scope=$1 AND created_at >= $2`,
      [scope, since],
    )
  ).rows[0];
  const hosts = (
    await client.query(
      `SELECT host_id AS id,last_heartbeat_at AS "heartbeatAt",available FROM persistent_execution_hosts WHERE product_scope=$1 ORDER BY host_id LIMIT 20`,
      [scope],
    )
  ).rows;
  return { runs, usage, leases, external, hosts };
}
