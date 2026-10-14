import type { PoolClient } from "pg";
export async function readWorldInsights(client: PoolClient, scope: string) {
  return (
    (
      await client.query(
        `SELECT status,rules_id AS "rulesId",tick_sequence::text AS tick,
    committed_game_time_ms::text AS "gameTimeMs",next_tick_due_at AS "nextTickDueAt",
    last_heartbeat_at AS "heartbeatAt",paused_at AS "pausedAt"
    FROM world_clocks WHERE product_scope=$1`,
        [scope],
      )
    ).rows[0] ?? null
  );
}
