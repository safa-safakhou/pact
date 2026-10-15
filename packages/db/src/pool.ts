import { Pool } from "pg";

export function createPool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 20_000,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: 30_000,
  });
  pool.on("error", () => console.error("database connection unavailable"));
  return pool;
}
