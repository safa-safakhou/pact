import type { Pool, PoolClient } from "pg";

export interface LeasedJob {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  leaseExpiresAt: Date;
}

export async function enqueueJob(
  client: PoolClient,
  input: { productScope: string; uniqueKey: string; type: string; payload: unknown; availableAt?: Date },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO durable_jobs(product_scope, unique_key, type, payload, available_at)
     VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now()))
     ON CONFLICT(product_scope, unique_key) DO UPDATE SET unique_key = EXCLUDED.unique_key RETURNING id`,
    [input.productScope, input.uniqueKey, input.type, JSON.stringify(input.payload), input.availableAt ?? null],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Failed to enqueue job");
  return id;
}

export async function acquireJob(
  pool: Pool,
  workerId: string,
  leaseMilliseconds: number,
): Promise<LeasedJob | undefined> {
  const result = await pool.query<LeasedJob>(
    `WITH candidate AS (
       SELECT id FROM durable_jobs
       WHERE status = 'ready' AND available_at <= now() AND (lease_expires_at IS NULL OR lease_expires_at <= now())
       ORDER BY available_at, id FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE durable_jobs j SET leased_by = $1, lease_expires_at = now() + ($2 * interval '1 millisecond'), attempts = attempts + 1, updated_at = now()
     FROM candidate WHERE j.id = candidate.id
     RETURNING j.id, j.type, j.payload, j.attempts, j.lease_expires_at AS "leaseExpiresAt"`,
    [workerId, leaseMilliseconds],
  );
  return result.rows[0];
}
