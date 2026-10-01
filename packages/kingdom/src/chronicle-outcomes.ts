import type { PoolClient } from "pg";
/** Explicitly selected historical completion, never live stocks or a whole private report. */
export class ChronicleOutcomeReader {
  constructor(private readonly scope: string) {}
  async read(client: PoolClient, accountId: string, records: string[]) {
    const outcomes: Record<string, unknown>[] = [];
    for (const record of records) {
      if (!record.startsWith("building:")) continue;
      const id = record.slice(9);
      if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
      const row = (
        await client.query<{
          building_kind: string;
          target_level: number;
          state: string;
          settled_game_time_ms: string | null;
        }>(
          "SELECT building_kind,target_level,state,settled_game_time_ms FROM building_instructions WHERE product_scope=$1 AND account_id=$2 AND id=$3",
          [this.scope, accountId, id],
        )
      ).rows[0];
      if (row)
        outcomes.push({
          record,
          status: row.state,
          consequence:
            row.state === "completed"
              ? `${row.building_kind} level ${row.target_level} completed`
              : row.state === "canceled"
                ? "Construction canceled"
                : `Construction ${row.state}; completion pending`,
          settledGameTimeMs: row.settled_game_time_ms === null ? null : Number(row.settled_game_time_ms),
        });
    }
    return outcomes;
  }
}
