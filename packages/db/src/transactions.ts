import type { CorrelationIds, TraceReporter } from "@pact/telemetry";
import { safeErrorCode } from "@pact/telemetry";
import type { Pool, PoolClient } from "pg";

const retryableCodes = new Set(["40001", "40P01"]);

export interface TransactionOptions {
  maxRetries?: number;
  isolation?: "SERIALIZABLE" | "REPEATABLE READ" | "READ COMMITTED";
  trace?: TraceReporter;
  correlation?: CorrelationIds;
}

export function stableLockOrder(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right, "en"));
}

export async function lockRows(
  client: PoolClient,
  table: "accounts" | "kingdom_drafts" | "durable_jobs",
  ids: readonly string[],
): Promise<void> {
  const ordered = stableLockOrder(ids);
  if (ordered.length === 0) return;
  await client.query(`SELECT id FROM ${table} WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [ordered]);
}

export async function withTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const isolation = options.isolation ?? "SERIALIZABLE";
  for (let attempt = 0; ; attempt += 1) {
    const client = await pool.connect();
    if (options.trace && options.correlation) {
      options.trace.recordStage("transaction", "started", options.correlation, { attempt });
    }
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
      const result = await operation(client);
      await client.query("COMMIT");
      if (options.trace && options.correlation) {
        options.trace.recordStage("transaction", "succeeded", options.correlation, { attempt });
      }
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (!retryableCodes.has(code) || attempt >= maxRetries) {
        if (options.trace && options.correlation) {
          options.trace.recordStage("transaction", "failed", options.correlation, {
            attempt,
            errorCode: safeErrorCode(error),
          });
        }
        throw error;
      }
    } finally {
      client.release();
    }
  }
}
