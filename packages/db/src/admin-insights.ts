import type { PoolClient } from "pg";
export async function readPlatformInsights(client: PoolClient, scope: string, since: Date, now: Date) {
  const receipts = (
    await client.query(
      `SELECT code,count(*)::int AS count FROM command_receipts
    WHERE product_scope=$1 AND created_at >= $2 GROUP BY code ORDER BY count(*) DESC,code LIMIT 20`,
      [scope, since],
    )
  ).rows;
  const trend = (
    await client.query(
      `SELECT date_trunc('hour',created_at) AS hour,count(*)::int AS count
    FROM command_receipts WHERE product_scope=$1 AND created_at >= $2 GROUP BY 1 ORDER BY 1`,
      [scope, since],
    )
  ).rows;
  const jobs = (
    await client.query(
      `SELECT count(*) FILTER(WHERE status='failed')::int AS failed,
    count(*) FILTER(WHERE status='ready' AND available_at <= $2)::int AS due,
    count(*) FILTER(WHERE status='ready' AND available_at < $2 - interval '5 minutes')::int AS overdue
    FROM durable_jobs WHERE product_scope=$1`,
      [scope, now],
    )
  ).rows[0];
  const events = (
    await client.query(
      `SELECT id::text,type,created_at AS "occurredAt" FROM outbox_events
    WHERE product_scope=$1 ORDER BY id DESC LIMIT 30`,
      [scope],
    )
  ).rows;
  return { receipts, trend, jobs, events };
}
