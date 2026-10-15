import type { PoolClient } from "pg";

/** Read-only projection of the same permission ledger used at atomic admission. No materialization, locks or mutation. */
export async function readExposureContext(client: PoolClient, scope: string, accountId: string, gameTimeMs: number) {
  if (!Number.isSafeInteger(gameTimeMs) || gameTimeMs < 0) throw new Error("INVALID_GAME_TIME");
  const mandate = (
    await client.query<{
      version: number;
      allowed_actions: string[];
      resource_limits: Record<string, string>;
      reserve_floors: Record<string, string>;
      troop_limit: number;
    }>(
      "SELECT version,allowed_actions,resource_limits,reserve_floors,troop_limit FROM kingdom_mandates WHERE product_scope=$1 AND account_id=$2",
      [scope, accountId],
    )
  ).rows[0];
  const ledgers = (
    await client.query<{ asset: string; spent_units: string; reserved_units: string }>(
      "SELECT asset,spent_units::text,reserved_units::text FROM authority_ledger WHERE product_scope=$1 AND account_id=$2",
      [scope, accountId],
    )
  ).rows;
  const spends = (
    await client.query<{ asset: string; units: string; releases: string }>(
      `SELECT asset,sum(units)::text AS units,(game_time_ms+86400000)::text AS releases FROM authority_spends WHERE product_scope=$1 AND account_id=$2 AND count_against_limit AND game_time_ms>$3 AND game_time_ms<=$4 GROUP BY asset,game_time_ms ORDER BY game_time_ms,asset`,
      [scope, accountId, gameTimeMs - 86400000, gameTimeMs],
    )
  ).rows;
  const reservations = (
    await client.query<{
      ref: string;
      subject_ref: string | null;
      action: string;
      status: string;
      asset: string;
      remaining_units: string;
    }>(
      `SELECT c.id AS ref,c.subject_ref,c.action,c.status,a.asset,a.remaining_units::text FROM authority_commitments c JOIN authority_commitment_assets a ON a.product_scope=c.product_scope AND a.commitment_id=c.id WHERE c.product_scope=$1 AND c.account_id=$2 AND c.actor_kind='agent' AND c.status<>'closed' AND a.remaining_units>0 ORDER BY c.id,a.asset`,
      [scope, accountId],
    )
  ).rows;
  const troops = Number(
    (
      await client.query<{ total: string }>(
        "SELECT COALESCE(sum(troop_count),0)::text AS total FROM authority_commitments WHERE product_scope=$1 AND account_id=$2 AND actor_kind='agent' AND status<>'closed'",
        [scope, accountId],
      )
    ).rows[0]?.total ?? "0",
  );
  const keys = [
    ...new Set([
      ...Object.keys(mandate?.resource_limits ?? {}),
      ...Object.keys(mandate?.reserve_floors ?? {}),
      ...ledgers.map((l) => l.asset),
      ...spends.map((s) => s.asset),
    ]),
  ].sort();
  return {
    schemaVersion: "pact.authority-observation.v1" as const,
    asOfGameTimeMs: gameTimeMs,
    mandateVersion: mandate?.version ?? null,
    allowedActions: mandate?.allowed_actions ?? [],
    troopLimit: mandate?.troop_limit ?? 0,
    troopReserved: troops,
    resources: Object.fromEntries(
      keys.map((asset) => {
        const row = ledgers.find((l) => l.asset === asset),
          ceiling = BigInt(mandate?.resource_limits[asset] ?? "0"),
          legacy = BigInt(row?.spent_units ?? "0"),
          reserved = BigInt(row?.reserved_units ?? "0"),
          rolling = spends.filter((s) => s.asset === asset).reduce((n, s) => n + BigInt(s.units), 0n);
        return [
          asset,
          {
            ceilingUnits: ceiling.toString(),
            legacySpentUnits: legacy.toString(),
            rollingSpentUnits: rolling.toString(),
            reservedUnits: reserved.toString(),
            headroomUnits: (ceiling > legacy + rolling + reserved
              ? ceiling - legacy - rolling - reserved
              : 0n
            ).toString(),
            reserveFloorUnits: mandate?.reserve_floors[asset] ?? "0",
            releaseSchedule: spends
              .filter((s) => s.asset === asset)
              .map((s) => ({ gameTimeMs: Number(s.releases), units: s.units })),
            reservations: reservations
              .filter((r) => r.asset === asset)
              .map((r) => ({
                commitmentId: r.ref,
                subjectRef: r.subject_ref,
                action: r.action,
                status: r.status,
                units: r.remaining_units,
              })),
          },
        ];
      }),
    ),
    meaning:
      "Permission, not resource stock. Rolling spends release after 24 GAME hours; reservations release only through lifecycle settlement/cancellation, never a guessed deadline. Legacy spends have no inferred release. Paused game time freezes release. Snapshot quotes never grant authority; server atomically rechecks.",
  };
}
export type ExposureContext = Awaited<ReturnType<typeof readExposureContext>>;
