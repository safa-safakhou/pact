import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import { RULES_ID, rulesCatalog } from "@pact/domain";
import type { TickContext } from "@pact/world";
import type { PoolClient } from "pg";
import { FortuneService } from "./fortune.js";

export const GAME_DAY_MS = 86_400_000;
export const GAME_WEEK_MS = 7 * GAME_DAY_MS;
export const SEASON_MS = 6 * GAME_WEEK_MS;
export function seasonPosition(opening: number, at: number) {
  if (![opening, at].every((v) => Number.isSafeInteger(v) && v >= 0) || opening % 60_000 !== 0 || at < opening)
    throw new Error("INVALID_SEASON_TIME");
  const number = Math.floor((at - opening) / SEASON_MS) + 1;
  const start = opening + (number - 1) * SEASON_MS;
  const week = Math.floor((at - start) / GAME_WEEK_MS) + 1;
  const next = start + week * GAME_WEEK_MS;
  if (!Number.isSafeInteger(next) || !Number.isSafeInteger(start + SEASON_MS)) throw new Error("INVALID_SEASON_TIME");
  return {
    number,
    week,
    startGameTimeMs: start,
    endGameTimeMs: start + SEASON_MS,
    nextTransitionGameTimeMs: next,
    harvestPercent: rulesCatalog.harvestPercentByWeek[week - 1] ?? 100,
    schedule: [...rulesCatalog.harvestPercentByWeek],
  };
}
export function newcomerCohort(at: number) {
  if (!Number.isSafeInteger(at) || at < 0) throw new Error("INVALID_GAME_TIME");
  // Unix epoch was Thursday; Monday 00:00 UTC is epoch + four days.
  return Math.floor((at - 4 * GAME_DAY_MS) / GAME_WEEK_MS) * GAME_WEEK_MS + 4 * GAME_DAY_MS;
}
type ClockRow = {
  opening_game_time_ms: string;
  current_number: number;
  last_processed_game_time_ms: string;
  rules_id: string;
};
type Player = {
  id: string;
  handle: string;
  activated_game_time_ms: string;
  level: number;
  marked_value_numerator: string;
  marked_value_denominator: string;
};

/** Runs in the authoritative tick transaction. Reads never initialize or reset a season. */
export class SeasonService {
  private readonly fortune: FortuneService;
  constructor(
    private readonly scope: string,
    private readonly configuredOpening?: number,
  ) {
    this.fortune = new FortuneService(scope);
  }
  async clock(c: PoolClient) {
    return (await c.query<ClockRow>("SELECT * FROM season_clock WHERE product_scope=$1", [this.scope])).rows[0];
  }
  async position(c: PoolClient, at: number) {
    const row = await this.clock(c);
    return row
      ? { configured: true as const, rulesId: row.rules_id, ...seasonPosition(Number(row.opening_game_time_ms), at) }
      : { configured: false as const };
  }
  private async players(c: PoolClient) {
    return (
      await c.query<Player>(
        `SELECT k.id,k.handle,k.activated_game_time_ms,COALESCE(h.level,1) AS level,b.marked_value_numerator,b.marked_value_denominator
      FROM kingdoms k JOIN kingdom_score_baselines b ON b.kingdom_id=k.id AND b.product_scope=k.product_scope
      LEFT JOIN kingdom_buildings h ON h.kingdom_id=k.id AND h.product_scope=k.product_scope AND h.kind='hall'
      WHERE k.product_scope=$1 AND k.status='ranked' ORDER BY k.id`,
        [this.scope],
      )
    ).rows;
  }
  async beforeTick(c: PoolClient, context: TickContext) {
    if (
      context.productScope !== this.scope ||
      !Number.isSafeInteger(context.gameTimeMs) ||
      context.gameTimeMs < 60_000 ||
      context.gameTimeMs % 60_000 !== 0
    )
      throw new Error("INVALID_SEASON_TICK");
    let row = await this.clock(c);
    if (!row) {
      const opening = this.configuredOpening ?? context.gameTimeMs - 60_000;
      // No retroactive seasons or unannounced clock edits. Install at an opening, not midway through historical time.
      if (opening !== context.gameTimeMs - 60_000) throw new Error("SEASON_OPENING_MUST_MATCH_COMMITTED_CLOCK");
      seasonPosition(opening, opening);
      await c.query(
        "INSERT INTO season_clock(product_scope,opening_game_time_ms,current_number,rules_id,last_processed_game_time_ms) VALUES($1,$2,1,$3,$2)",
        [this.scope, opening, RULES_ID],
      );
      row = await this.clock(c);
      if (!row) throw new Error("SEASON_CLOCK_UNAVAILABLE");
      for (const p of await this.players(c)) {
        // Preserve newcomer activation baseline before the season baseline is reset.
        await this.arrival(c, p);
        const wealth = (await this.fortune.wealth(c, p.id)).totalQuarterUnits;
        await this.entry(c, p, 1, wealth, opening);
      }
      await this.emit(c, "season.opened.v1", { seasonNumber: 1, openingGameTimeMs: opening, rulesId: RULES_ID });
    }
    if (
      row.rules_id !== RULES_ID ||
      (this.configuredOpening !== undefined && Number(row.opening_game_time_ms) !== this.configuredOpening)
    )
      throw new Error("SEASON_CONFIGURATION_CHANGED");
    const previous = Number(row.last_processed_game_time_ms);
    if (context.gameTimeMs <= previous) return;
    if (context.gameTimeMs !== previous + 60_000) throw new Error("SEASON_TICK_GAP");
    const position = seasonPosition(Number(row.opening_game_time_ms), context.gameTimeMs);
    const players = await this.players(c);
    for (const p of players) {
      await this.arrival(c, p);
      const baseline = (BigInt(p.marked_value_numerator) * 2400n) / BigInt(p.marked_value_denominator);
      await c.query(
        "INSERT INTO season_entries(product_scope,season_number,kingdom_id,baseline_quarter_units,highest_hall) VALUES($1,$2,$3,$4,$5) ON CONFLICT(product_scope,season_number,kingdom_id) DO UPDATE SET highest_hall=GREATEST(season_entries.highest_hall,EXCLUDED.highest_hall)",
        [this.scope, row.current_number, p.id, baseline.toString(), p.level],
      );
    }
    if (position.number !== row.current_number) {
      for (const p of players) {
        const wealth = (await this.fortune.wealth(c, p.id)).totalQuarterUnits;
        await c.query(
          `UPDATE season_entries SET closing_wealth_quarter_units=$4::bigint,closing_fortune_quarter_units=$4::bigint-baseline_quarter_units,closed_game_time_ms=$5::bigint,closed_at=clock_timestamp(),
          first_final_sample_game_time_ms=COALESCE((SELECT min(game_time_ms) FROM fortune_hourly_snapshots f WHERE f.product_scope=$1 AND f.season_key=$6 AND f.kingdom_id=$3 AND f.fortune_quarter_units=$4::bigint-season_entries.baseline_quarter_units),$5::bigint-60000)
          WHERE product_scope=$1 AND season_number=$2 AND kingdom_id=$3`,
          [this.scope, row.current_number, p.id, wealth.toString(), context.gameTimeMs, `season-${row.current_number}`],
        );
        await this.entry(c, p, position.number, wealth, context.gameTimeMs);
      }
      await this.emit(c, "season.closed.v1", {
        seasonNumber: row.current_number,
        boundaryGameTimeMs: context.gameTimeMs,
        preBoundaryGameTimeMs: context.gameTimeMs - 60_000,
      });
      await this.emit(c, "season.opened.v1", {
        seasonNumber: position.number,
        openingGameTimeMs: context.gameTimeMs,
        rulesId: row.rules_id,
      });
      await c.query("UPDATE season_clock SET current_number=$2 WHERE product_scope=$1", [this.scope, position.number]);
    }
    for (const p of players) {
      await this.arrival(c, p);
      const b = (BigInt(p.marked_value_numerator) * 2400n) / BigInt(p.marked_value_denominator);
      await c.query(
        "INSERT INTO season_entries(product_scope,season_number,kingdom_id,baseline_quarter_units,highest_hall) VALUES($1,$2,$3,$4,$5) ON CONFLICT(product_scope,season_number,kingdom_id) DO UPDATE SET highest_hall=GREATEST(season_entries.highest_hall,EXCLUDED.highest_hall)",
        [this.scope, position.number, p.id, b.toString(), p.level],
      );
    }
  }
  private async entry(c: PoolClient, p: Player, number: number, wealth: bigint, at: number) {
    await c.query(
      "INSERT INTO season_entries(product_scope,season_number,kingdom_id,baseline_quarter_units,highest_hall) VALUES($1,$2,$3,$4,$5)",
      [this.scope, number, p.id, wealth.toString(), p.level],
    );
    await c.query(
      "UPDATE kingdom_score_baselines SET game_time_ms=$3,marked_value_numerator=$4,marked_value_denominator=2400 WHERE product_scope=$1 AND kingdom_id=$2",
      [this.scope, p.id, at, wealth.toString()],
    );
  }
  private async arrival(c: PoolClient, p: Player) {
    const at = Number(p.activated_game_time_ms);
    const value = (BigInt(p.marked_value_numerator) * 2400n) / BigInt(p.marked_value_denominator);
    await c.query(
      "INSERT INTO newcomer_snapshots(product_scope,kingdom_id,cohort_start_game_time_ms,due_game_time_ms,activation_baseline_quarter_units) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [this.scope, p.id, newcomerCohort(at), at + GAME_WEEK_MS, value.toString()],
    );
  }
  async afterTick(c: PoolClient, context: TickContext) {
    const row = await this.clock(c);
    if (!row || context.gameTimeMs <= Number(row.last_processed_game_time_ms)) return;
    const players = await this.players(c);
    for (const p of players) {
      await c.query(
        "UPDATE season_entries SET highest_hall=GREATEST(highest_hall,$4) WHERE product_scope=$1 AND season_number=$2 AND kingdom_id=$3",
        [this.scope, row.current_number, p.id, p.level],
      );
      const arrival = (
        await c.query<{ due_game_time_ms: string }>(
          "SELECT due_game_time_ms FROM newcomer_snapshots WHERE product_scope=$1 AND kingdom_id=$2 AND captured_game_time_ms IS NULL",
          [this.scope, p.id],
        )
      ).rows[0];
      if (arrival && Number(arrival.due_game_time_ms) === context.gameTimeMs) {
        const wealth = (await this.fortune.wealth(c, p.id)).totalQuarterUnits;
        await c.query(
          "UPDATE newcomer_snapshots SET fortune_quarter_units=$3-activation_baseline_quarter_units,captured_game_time_ms=$4,captured_at=clock_timestamp() WHERE product_scope=$1 AND kingdom_id=$2 AND captured_game_time_ms IS NULL",
          [this.scope, p.id, wealth.toString(), context.gameTimeMs],
        );
      }
    }
    if (context.gameTimeMs % 3_600_000 === 0)
      await new FortuneService(this.scope, `season-${row.current_number}`).snapshotHour(
        c,
        context.gameTimeMs,
        context.sequence,
      );
    const pos = seasonPosition(Number(row.opening_game_time_ms), context.gameTimeMs);
    if ((context.gameTimeMs - Number(row.opening_game_time_ms)) % GAME_WEEK_MS === 0) {
      const old = seasonPosition(Number(row.opening_game_time_ms), context.gameTimeMs - 60_000);
      if ([3, 4, 5].includes(old.week))
        for (const p of players)
          await this.emit(c, "season.low_harvest_week.completed.v1", {
            kingdomId: p.id,
            week: old.week,
            startGameTimeMs: context.gameTimeMs - GAME_WEEK_MS,
            endGameTimeMs: context.gameTimeMs,
          });
      await this.emit(c, "season.harvest.changed.v1", {
        seasonNumber: pos.number,
        week: pos.week,
        harvestPercent: pos.harvestPercent,
        nextTransitionGameTimeMs: pos.nextTransitionGameTimeMs,
      });
    }
    await c.query("UPDATE season_clock SET last_processed_game_time_ms=$2 WHERE product_scope=$1", [
      this.scope,
      context.gameTimeMs,
    ]);
  }
  async readCurrent(c: PoolClient, cohortStart?: number, accountId?: string) {
    const row = await this.clock(c);
    if (!row) return { current: { configured: false as const }, standings: [], cohorts: [] };
    if (cohortStart === undefined && accountId) {
      const own = (
        await c.query<{ cohort_start_game_time_ms: string }>(
          "SELECT n.cohort_start_game_time_ms FROM newcomer_snapshots n JOIN kingdoms k ON k.id=n.kingdom_id WHERE n.product_scope=$1 AND k.account_id=$2",
          [this.scope, accountId],
        )
      ).rows[0];
      if (own) cohortStart = Number(own.cohort_start_game_time_ms);
    }
    return this.read(c, Number(row.last_processed_game_time_ms), cohortStart);
  }
  async read(c: PoolClient, at: number, cohortStart?: number) {
    const current = await this.position(c, at);
    if (!current.configured) return { current, standings: [], cohorts: [] };
    const standings = await this.fortune.provisional(c, at);
    const rows = (
      await c.query<{
        handle: string;
        kingdom_id: string;
        due_game_time_ms: string;
        fortune_quarter_units: string | null;
        cohort_start_game_time_ms: string;
        rank: string;
      }>(
        `SELECT n.*,k.handle,rank() OVER (ORDER BY n.fortune_quarter_units DESC NULLS LAST)::text AS rank FROM newcomer_snapshots n JOIN kingdoms k ON k.id=n.kingdom_id WHERE n.product_scope=$1 AND k.status='ranked' AND n.cohort_start_game_time_ms=$2 ORDER BY n.fortune_quarter_units DESC NULLS LAST,n.kingdom_id LIMIT 100`,
        [this.scope, cohortStart ?? newcomerCohort(at)],
      )
    ).rows;
    return {
      current: { ...current, asOfGameTimeMs: at },
      standings: standings.map(({ kingdomId, handle, band, rank, fortuneQuarterUnits, denominator, provisional }) => ({
        kingdomId,
        handle,
        band,
        rank,
        fortuneQuarterUnits,
        denominator,
        provisional,
      })),
      cohorts: rows.map((r) => ({
        kingdomId: r.kingdom_id,
        handle: r.handle,
        cohortStartGameTimeMs: Number(r.cohort_start_game_time_ms),
        dueGameTimeMs: Number(r.due_game_time_ms),
        status:
          r.fortune_quarter_units === null ? (at > Number(r.due_game_time_ms) ? "unavailable" : "pending") : "captured",
        rank: r.fortune_quarter_units === null ? null : Number(r.rank),
        fortuneQuarterUnits: r.fortune_quarter_units,
        denominator: "2400",
        finalized: at >= Number(r.cohort_start_game_time_ms) + 2 * GAME_WEEK_MS,
      })),
    };
  }
  async exportAccount(c: PoolClient, id: string) {
    const q = "SELECT id FROM kingdoms WHERE account_id=$2 AND product_scope=$1";
    return {
      seasons: (
        await c.query(`SELECT * FROM season_entries WHERE product_scope=$1 AND kingdom_id IN (${q})`, [this.scope, id])
      ).rows,
      newcomer: (
        await c.query(`SELECT * FROM newcomer_snapshots WHERE product_scope=$1 AND kingdom_id IN (${q})`, [
          this.scope,
          id,
        ])
      ).rows,
    };
  }
  async forgetAccount(c: PoolClient, id: string) {
    for (const table of ["season_entries", "newcomer_snapshots"])
      await c.query(
        `DELETE FROM ${table} WHERE product_scope=$1 AND kingdom_id IN (SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2)`,
        [this.scope, id],
      );
  }
  async prune(c: PoolClient, now: Date) {
    const cutoff = new Date(now.getTime() - 180 * GAME_DAY_MS);
    const closed = await c.query("DELETE FROM season_entries WHERE product_scope=$1 AND closed_at<$2", [
      this.scope,
      cutoff,
    ]);
    const arrivals = await c.query(
      "DELETE FROM newcomer_snapshots WHERE product_scope=$1 AND COALESCE(captured_at,created_at)<$2 AND due_game_time_ms<(SELECT last_processed_game_time_ms FROM season_clock WHERE product_scope=$1)",
      [this.scope, cutoff],
    );
    return (closed.rowCount ?? 0) + (arrivals.rowCount ?? 0);
  }
  private emit(c: PoolClient, type: string, payload: Record<string, unknown>) {
    return appendOutbox(c, { productScope: this.scope, eventId: randomUUID(), type, payload });
  }
}
