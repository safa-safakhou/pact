import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import type { PoolClient } from "pg";
import { GAME_DAY_MS, SeasonService, seasonPosition } from "./seasons.js";

export type HonorCandidate = {
  kingdomId: string;
  handle: string;
  fortuneQuarterUnits: string;
  highestHall: number;
  meaningfulDays: number;
  firstFinalSampleGameTimeMs: number;
  status: string;
};
const hallBand = (level: number) => (level >= 5 ? "V-VI" : level >= 3 ? "III-IV" : "I-II");
const compare = (a: HonorCandidate, b: HonorCandidate) =>
  BigInt(a.fortuneQuarterUnits) === BigInt(b.fortuneQuarterUnits)
    ? a.firstFinalSampleGameTimeMs - b.firstFinalSampleGameTimeMs || a.kingdomId.localeCompare(b.kingdomId)
    : BigInt(a.fortuneQuarterUnits) > BigInt(b.fortuneQuarterUnits)
      ? -1
      : 1;
const rank = (p: HonorCandidate, rows: HonorCandidate[]) =>
  1 + rows.filter((other) => BigInt(other.fortuneQuarterUnits) > BigInt(p.fortuneQuarterUnits)).length;
/** Exact thresholds; cosmetic suggestions remain provisional throughout Alpha. */
export function calculateSeasonHonors(input: HonorCandidate[]) {
  const rows = input.filter((p) => p.status === "ranked").sort(compare);
  const eligible = rows.filter((p) => p.meaningfulDays >= 3);
  return rows.map((p) => {
    const band = hallBand(p.highestHall),
      group = eligible.filter((other) => hallBand(other.highestHall) === band);
    const eligibleOverallRank = p.meaningfulDays >= 3 ? rank(p, eligible) : null;
    let border: "gold" | "silver" | "bronze" | null = null;
    if (p.meaningfulDays >= 3 && group.length >= 100) {
      for (const [percent, tier] of [
        [1, "gold"],
        [10, "silver"],
        [25, "bronze"],
      ] as const) {
        const position = Number((BigInt(percent) * BigInt(group.length) + 99n) / 100n);
        const threshold = group[position - 1];
        if (threshold && BigInt(p.fortuneQuarterUnits) >= BigInt(threshold.fortuneQuarterUnits)) {
          border = tier;
          break;
        }
      }
    }
    return {
      ...p,
      band,
      overallRank: rank(p, rows),
      bandRank: rank(
        p,
        rows.filter((other) => hallBand(other.highestHall) === band),
      ),
      eligible: p.meaningfulDays >= 3,
      eligibleOverallRank,
      eligibleBandPopulation: group.length,
      provisionalBorder: border,
      provisionalPlaque: eligibleOverallRank !== null && eligibleOverallRank <= 3,
      provisional: true as const,
      finalized: false as const,
      denominator: "2400",
    };
  });
}
const types = [
  "building.completed.v1",
  "transfer.completed.v1",
  "supply.delivery.executed.v1",
  "scout.completed.v1",
  "raid.resolved.v1",
];
type Activity = { kingdom_id: string; at: string };
export class SeasonHonorsService {
  private readonly seasons: SeasonService;
  constructor(private readonly scope: string) {
    this.seasons = new SeasonService(scope);
  }
  /** Only trusted engine events with matching durable records count. No event injection endpoint. */
  async processActivity(c: PoolClient, through: number) {
    const clock = await this.seasons.clock(c);
    if (!clock) return;
    const events = (
      await c.query<{ event_id: string; type: string; payload: Record<string, unknown> }>(
        `SELECT e.event_id,e.type,e.payload FROM outbox_events e WHERE e.product_scope=$1 AND e.type=ANY($2::text[]) AND NOT EXISTS(SELECT 1 FROM season_activity_events p WHERE p.product_scope=$1 AND p.event_id=e.event_id) ORDER BY e.id`,
        [this.scope, types],
      )
    ).rows;
    for (const e of events) {
      let rows: Activity[] = [];
      if (e.type === "building.completed.v1")
        rows = (
          await c.query<Activity>(
            "SELECT kingdom_id,settled_game_time_ms::text AS at FROM building_instructions WHERE product_scope=$1 AND id=$2 AND state='completed'",
            [this.scope, e.payload.instructionId],
          )
        ).rows;
      if (e.type === "transfer.completed.v1")
        rows = (
          await c.query<Activity>(
            "SELECT unnest(ARRAY[sender_kingdom_id,recipient_kingdom_id]) AS kingdom_id,game_time_ms::text AS at FROM direct_transfers WHERE product_scope=$1 AND id=$2",
            [this.scope, e.payload.transferId],
          )
        ).rows;
      if (e.type === "supply.delivery.executed.v1")
        rows = (
          await c.query<Activity>(
            "SELECT DISTINCT unnest(ARRAY[payer_kingdom_id,recipient_kingdom_id]) AS kingdom_id,game_time_ms::text AS at FROM supply_installments WHERE product_scope=$1 AND contract_id=$2 AND game_time_ms=$3 AND delivered_units>0",
            [this.scope, e.payload.contractId, e.payload.gameTimeMs],
          )
        ).rows;
      if (e.type === "scout.completed.v1")
        rows = (
          await c.query<Activity>(
            "SELECT scout_kingdom_id AS kingdom_id,completed_game_time_ms::text AS at FROM scout_operations WHERE product_scope=$1 AND id=$2 AND status='completed'",
            [this.scope, e.payload.operationId],
          )
        ).rows;
      if (e.type === "raid.resolved.v1")
        rows = (
          await c.query<Activity>(
            `SELECT DISTINCT unnest(ARRAY[r.target_kingdom_id,r.leader_kingdom_id] || ARRAY(SELECT DISTINCT (u->>'ownerId')::uuid FROM jsonb_array_elements(r.participant_report->'eligibleUnits') u)) AS kingdom_id,r.resolved_game_time_ms::text AS at FROM raids r WHERE r.product_scope=$1 AND r.id=$2 AND r.status='resolved'`,
            [this.scope, e.payload.raidId],
          )
        ).rows;
      if (rows.some((r) => Number(r.at) > through)) continue;
      for (const r of rows) {
        const at = Number(r.at),
          opening = Number(clock.opening_game_time_ms);
        if (!Number.isSafeInteger(at) || at < opening) continue;
        const season = seasonPosition(opening, at).number;
        await c.query(
          `INSERT INTO season_meaningful_days(product_scope,kingdom_id,season_number,game_day,first_game_time_ms,last_game_time_ms) SELECT $1,$2,$3,$4,$5,$5 FROM kingdoms k WHERE k.product_scope=$1 AND k.id=$2 AND k.status='ranked' ON CONFLICT(product_scope,kingdom_id,season_number,game_day) DO UPDATE SET first_game_time_ms=LEAST(season_meaningful_days.first_game_time_ms,EXCLUDED.first_game_time_ms),last_game_time_ms=GREATEST(season_meaningful_days.last_game_time_ms,EXCLUDED.last_game_time_ms)`,
          [this.scope, r.kingdom_id, season, Math.floor(at / GAME_DAY_MS), at],
        );
      }
      await c.query("INSERT INTO season_activity_events(product_scope,event_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [
        this.scope,
        e.event_id,
      ]);
    }
  }
  async closeSeasons(c: PoolClient) {
    const pending = (
      await c.query<{ season_number: number }>(
        "SELECT DISTINCT e.season_number FROM season_entries e WHERE e.product_scope=$1 AND e.closed_game_time_ms IS NOT NULL AND NOT EXISTS(SELECT 1 FROM season_honor_runs r WHERE r.product_scope=$1 AND r.season_number=e.season_number) ORDER BY e.season_number",
        [this.scope],
      )
    ).rows;
    for (const { season_number: season } of pending) {
      const candidates = await this.candidates(c, season);
      for (const result of calculateSeasonHonors(candidates)) {
        await c.query(
          "INSERT INTO season_honor_results(product_scope,season_number,kingdom_id,result) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING",
          [this.scope, season, result.kingdomId, JSON.stringify(result)],
        );
        if (result.eligible) {
          await this.cosmetic(c, result.kingdomId, `banner.season.${season}`, `season:${season}:participation`);
          const owner = (
            await c.query<{ account_id: string }>(
              "SELECT account_id FROM kingdoms WHERE product_scope=$1 AND id=$2 AND status='ranked'",
              [this.scope, result.kingdomId],
            )
          ).rows[0];
          if (owner)
            await appendOutbox(c, {
              productScope: this.scope,
              eventId: randomUUID(),
              type: "season.participation.awarded.v2",
              payload: { accountId: owner.account_id, seasonNumber: season },
            });
        }
      }
      await c.query("INSERT INTO season_honor_runs(product_scope,season_number) VALUES($1,$2) ON CONFLICT DO NOTHING", [
        this.scope,
        season,
      ]);
    }
  }
  private async candidates(c: PoolClient, season: number): Promise<HonorCandidate[]> {
    const rows = (
      await c.query<{
        id: string;
        handle: string;
        status: string;
        highest_hall: number;
        closing_fortune_quarter_units: string;
        first_final_sample_game_time_ms: string;
        days: number;
      }>(
        `SELECT k.id,k.handle,k.status,e.highest_hall,e.closing_fortune_quarter_units,e.first_final_sample_game_time_ms,(SELECT count(*)::int FROM season_meaningful_days d WHERE d.product_scope=e.product_scope AND d.kingdom_id=e.kingdom_id AND d.season_number=e.season_number) AS days FROM season_entries e JOIN kingdoms k ON k.id=e.kingdom_id WHERE e.product_scope=$1 AND e.season_number=$2 AND e.closed_game_time_ms IS NOT NULL`,
        [this.scope, season],
      )
    ).rows;
    return rows.map((r) => ({
      kingdomId: r.id,
      handle: r.handle,
      status: r.status,
      highestHall: r.highest_hall,
      fortuneQuarterUnits: r.closing_fortune_quarter_units,
      firstFinalSampleGameTimeMs: Number(r.first_final_sample_game_time_ms),
      meaningfulDays: r.days,
    }));
  }
  async arrivals(c: PoolClient) {
    const rows = (
      await c.query<{ kingdom_id: string }>(
        `SELECT n.kingdom_id FROM newcomer_snapshots n JOIN kingdoms k ON k.id=n.kingdom_id WHERE n.product_scope=$1 AND n.captured_game_time_ms IS NOT NULL AND k.status='ranked' AND (SELECT count(DISTINCT d.game_day) FROM season_meaningful_days d WHERE d.product_scope=$1 AND d.kingdom_id=n.kingdom_id AND d.first_game_time_ms<n.due_game_time_ms AND d.last_game_time_ms>=k.activated_game_time_ms)>=3`,
        [this.scope],
      )
    ).rows;
    for (const r of rows) await this.cosmetic(c, r.kingdom_id, "medal.arrival", "arrival:participation");
  }
  private async cosmetic(c: PoolClient, kingdomId: string, item: string, source: string) {
    await c.query(
      "INSERT INTO cosmetic_entitlements(product_scope,account_id,item_id,source_achievement_id) SELECT $1,account_id,$3,$4 FROM kingdoms WHERE product_scope=$1 AND id=$2 AND status='ranked' ON CONFLICT DO NOTHING",
      [this.scope, kingdomId, item, source],
    );
  }
  async read(c: PoolClient, accountId?: string) {
    const latest = (
      await c.query<{ season_number: number }>(
        "SELECT max(season_number)::int AS season_number FROM season_honor_runs WHERE product_scope=$1",
        [this.scope],
      )
    ).rows[0]?.season_number;
    const results = latest
      ? (
          await c.query<{ result: ReturnType<typeof calculateSeasonHonors>[number] }>(
            "SELECT r.result FROM season_honor_results r JOIN kingdoms k ON k.id=r.kingdom_id WHERE r.product_scope=$1 AND r.season_number=$2 AND k.status='ranked' ORDER BY (r.result->>'overallRank')::int,(r.result->>'firstFinalSampleGameTimeMs')::bigint,r.kingdom_id LIMIT 100",
            [this.scope, latest],
          )
        ).rows.map((r) => r.result)
      : [];
    const own = accountId
      ? (
          await c.query<{ item_id: string }>(
            "SELECT item_id FROM cosmetic_entitlements WHERE product_scope=$1 AND account_id=$2 AND (item_id LIKE 'banner.season.%' OR item_id='medal.arrival') ORDER BY item_id",
            [this.scope, accountId],
          )
        ).rows.map((r) => r.item_id)
      : [];
    const days = accountId
      ? ((
          await c.query<{ days: number }>(
            "SELECT count(*)::int AS days FROM season_meaningful_days d JOIN kingdoms k ON k.id=d.kingdom_id JOIN season_clock s ON s.product_scope=d.product_scope WHERE d.product_scope=$1 AND k.account_id=$2 AND d.season_number=s.current_number",
            [this.scope, accountId],
          )
        ).rows[0]?.days ?? 0)
      : 0;
    return {
      seasonNumber: latest ?? null,
      results,
      ownCosmetics: own,
      ownMeaningfulDays: days,
      requiredMeaningfulDays: 3,
      competitiveStatus: "provisional",
      finalized: false,
      minimumPercentilePopulation: 100,
    };
  }
  async exportAccount(c: PoolClient, id: string) {
    const q = "SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2";
    return {
      days: (
        await c.query(`SELECT * FROM season_meaningful_days WHERE product_scope=$1 AND kingdom_id IN (${q})`, [
          this.scope,
          id,
        ])
      ).rows,
      results: (
        await c.query(`SELECT * FROM season_honor_results WHERE product_scope=$1 AND kingdom_id IN (${q})`, [
          this.scope,
          id,
        ])
      ).rows,
    };
  }
  async forgetAccount(c: PoolClient, id: string) {
    for (const table of ["season_meaningful_days", "season_honor_results"])
      await c.query(
        `DELETE FROM ${table} WHERE product_scope=$1 AND kingdom_id IN (SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2)`,
        [this.scope, id],
      );
  }
  async prune(c: PoolClient, now: Date) {
    const cutoff = new Date(now.getTime() - 180 * GAME_DAY_MS);
    let deleted = 0;
    for (const table of ["season_activity_events", "season_honor_results", "season_honor_runs"])
      deleted +=
        (
          await c.query(
            `DELETE FROM ${table} WHERE product_scope=$1 AND ${table === "season_activity_events" ? "processed_at" : "recorded_at"}<$2`,
            [this.scope, cutoff],
          )
        ).rowCount ?? 0;
    deleted +=
      (
        await c.query(
          "DELETE FROM season_meaningful_days WHERE product_scope=$1 AND recorded_at<$2 AND season_number<(SELECT current_number FROM season_clock WHERE product_scope=$1)",
          [this.scope, cutoff],
        )
      ).rowCount ?? 0;
    return deleted;
  }
}

/** One overview for HTTP, external MCP and the in-app agent. */
export async function readSeasonOverview(c: PoolClient, scope: string, cohortStart?: number, accountId?: string) {
  return {
    ...(await new SeasonService(scope).readCurrent(c, cohortStart, accountId)),
    honors: await new SeasonHonorsService(scope).read(c, accountId),
  };
}
