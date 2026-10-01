import { rulesCatalog } from "@pact/domain";
import type { PoolClient } from "pg";

type Resource = "iron" | "silver" | "grain";
export type FortuneBand = "I-II" | "III-IV" | "V-VI";
const weight: Record<Resource, bigint> = { iron: 4n, silver: 8n, grain: 1n };
const denominator = 2400n; // One display point = 600 internal resource units × four quarters.

interface BalanceRow {
  resource: Resource;
  ordinary_units: string;
  locked_units: string;
}
interface CostRow {
  resource: "iron" | "silver";
  kind: "construction" | "training";
  status: "active" | "installed" | "completed" | "canceled";
  ordinary_paid_units: string;
  ordinary_remaining_units: string;
}
interface TroopRow {
  type: keyof typeof rulesCatalog.units;
  count: string;
}
interface KingdomRow {
  id: string;
  handle: string;
  activated_game_time_ms: string;
  hall_level: number;
  marked_value_numerator: string;
  marked_value_denominator: string;
}

export interface WealthBreakdown {
  stockQuarterUnits: bigint;
  activeCostQuarterUnits: bigint;
  installedQuarterUnits: bigint;
  troopsQuarterUnits: bigint;
  totalQuarterUnits: bigint;
}

export interface FortuneStanding {
  kingdomId: string;
  handle: string;
  band: FortuneBand;
  rank: number;
  wealthQuarterUnits: string;
  baselineQuarterUnits: string;
  fortuneQuarterUnits: string;
  denominator: "2400";
  asOfGameTimeMs: number;
  provisional: true;
}

function band(level: number): FortuneBand {
  if (level >= 5) return "V-VI";
  if (level >= 3) return "III-IV";
  return "I-II";
}

function baselineQuarterUnits(row: KingdomRow): bigint {
  const numerator = BigInt(row.marked_value_numerator);
  const sourceDenominator = BigInt(row.marked_value_denominator);
  if (sourceDenominator <= 0n || (numerator * denominator) % sourceDenominator !== 0n)
    throw new Error("INEXACT_FORTUNE_BASELINE");
  return (numerator * denominator) / sourceDenominator;
}

function compareFortune(left: FortuneStanding, right: FortuneStanding): number {
  const leftValue = BigInt(left.fortuneQuarterUnits);
  const rightValue = BigInt(right.fortuneQuarterUnits);
  if (leftValue !== rightValue) return leftValue > rightValue ? -1 : 1;
  return left.kingdomId.localeCompare(right.kingdomId);
}

/** Derived accounting from committed rows; no independent mutable point balance. */
export class FortuneService {
  constructor(
    private readonly productScope: string,
    private readonly seasonKey = "prototype",
  ) {}

  async wealth(client: PoolClient, kingdomId: string): Promise<WealthBreakdown> {
    const balances = (
      await client.query<BalanceRow>(
        "SELECT resource, ordinary_units, locked_units FROM resource_balances WHERE product_scope = $1 AND kingdom_id = $2",
        [this.productScope, kingdomId],
      )
    ).rows;
    if (balances.length !== 3) throw new Error("KINGDOM_BALANCES_INCOMPLETE");
    const costs = (
      await client.query<CostRow>(
        `SELECT resource, kind, status, ordinary_paid_units, ordinary_remaining_units
       FROM resource_cost_provenance WHERE product_scope = $1 AND kingdom_id = $2
         AND (status = 'active' OR (kind = 'construction' AND status = 'installed'))`,
        [this.productScope, kingdomId],
      )
    ).rows;
    const troops = (
      await client.query<TroopRow>(
        `SELECT type, count(*)::text AS count FROM kingdom_troops
       WHERE product_scope = $1 AND owner_kingdom_id = $2 AND home_guard = false GROUP BY type`,
        [this.productScope, kingdomId],
      )
    ).rows;
    const stockQuarterUnits = balances.reduce(
      (sum, row) => sum + (BigInt(row.ordinary_units) + BigInt(row.locked_units)) * weight[row.resource],
      0n,
    );
    const activeCostQuarterUnits = costs
      .filter((row) => row.status === "active")
      .reduce((sum, row) => sum + BigInt(row.ordinary_remaining_units) * weight[row.resource], 0n);
    const installedQuarterUnits = costs
      .filter((row) => row.status === "installed")
      .reduce((sum, row) => sum + BigInt(row.ordinary_paid_units) * weight[row.resource], 0n);
    const troopsQuarterUnits = troops.reduce((sum, row) => {
      const rule = rulesCatalog.units[row.type];
      if (!rule) throw new Error("UNKNOWN_TROOP_TYPE");
      const valuePerTroop = BigInt(rule.iron) * 600n * weight.iron + BigInt(rule.silver) * 600n * weight.silver;
      return sum + BigInt(row.count) * valuePerTroop;
    }, 0n);
    return {
      stockQuarterUnits,
      activeCostQuarterUnits,
      installedQuarterUnits,
      troopsQuarterUnits,
      totalQuarterUnits: stockQuarterUnits + activeCostQuarterUnits + installedQuarterUnits + troopsQuarterUnits,
    };
  }

  async provisional(
    client: PoolClient,
    gameTimeMs: number,
    filter?: FortuneBand,
    limit = 50,
  ): Promise<FortuneStanding[]> {
    if (!Number.isSafeInteger(gameTimeMs) || gameTimeMs < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new Error("INVALID_STANDINGS_QUERY");
    if (filter !== undefined && !["I-II", "III-IV", "V-VI"].includes(filter)) throw new Error("INVALID_HALL_BAND");
    const kingdoms = await this.kingdoms(client);
    const entries: FortuneStanding[] = [];
    for (const row of kingdoms) {
      if (gameTimeMs < Number(row.activated_game_time_ms)) continue;
      const hallBand = band(row.hall_level);
      if (filter && hallBand !== filter) continue;
      const wealth = await this.wealth(client, row.id);
      const baseline = baselineQuarterUnits(row);
      entries.push({
        kingdomId: row.id,
        handle: row.handle,
        band: hallBand,
        rank: 0,
        wealthQuarterUnits: wealth.totalQuarterUnits.toString(),
        baselineQuarterUnits: baseline.toString(),
        fortuneQuarterUnits: (wealth.totalQuarterUnits - baseline).toString(),
        denominator: "2400",
        asOfGameTimeMs: gameTimeMs,
        provisional: true,
      });
    }
    entries.sort(compareFortune);
    let lastValue: string | null = null;
    let rank = 0;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!entry) continue;
      if (entry.fortuneQuarterUnits !== lastValue) rank = index + 1;
      entry.rank = rank;
      lastValue = entry.fortuneQuarterUnits;
    }
    return entries.slice(0, limit);
  }

  async snapshotHour(client: PoolClient, gameTimeMs: number, tickSequence: bigint): Promise<number> {
    if (!Number.isSafeInteger(gameTimeMs) || gameTimeMs < 0 || gameTimeMs % 3_600_000 !== 0 || tickSequence < 0n)
      throw new Error("INVALID_FORTUNE_SNAPSHOT_TIME");
    const kingdoms = await this.kingdoms(client);
    let inserted = 0;
    for (const row of kingdoms) {
      if (gameTimeMs < Number(row.activated_game_time_ms)) continue;
      const wealth = (await this.wealth(client, row.id)).totalQuarterUnits;
      const baseline = baselineQuarterUnits(row);
      const result = await client.query(
        `INSERT INTO fortune_hourly_snapshots(product_scope, season_key, kingdom_id, game_time_ms,
           tick_sequence, wealth_quarter_units, baseline_quarter_units, fortune_quarter_units, hall_band)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [
          this.productScope,
          this.seasonKey,
          row.id,
          gameTimeMs,
          tickSequence.toString(),
          wealth.toString(),
          baseline.toString(),
          (wealth - baseline).toString(),
          band(row.hall_level),
        ],
      );
      inserted += result.rowCount ?? 0;
    }
    return inserted;
  }

  private async kingdoms(client: PoolClient): Promise<KingdomRow[]> {
    return (
      await client.query<KingdomRow>(
        `SELECT k.id, k.handle, k.activated_game_time_ms,
         GREATEST(COALESCE(h.level, 1),COALESCE(e.highest_hall,1)) AS hall_level, b.marked_value_numerator, b.marked_value_denominator
       FROM kingdoms k JOIN kingdom_score_baselines b ON b.product_scope = k.product_scope AND b.kingdom_id = k.id
       LEFT JOIN kingdom_buildings h ON h.product_scope = k.product_scope AND h.kingdom_id = k.id AND h.kind = 'hall'
       LEFT JOIN season_clock s ON s.product_scope=k.product_scope
       LEFT JOIN season_entries e ON e.product_scope=k.product_scope AND e.kingdom_id=k.id AND e.season_number=s.current_number
       WHERE k.product_scope = $1 AND k.status = 'ranked' ORDER BY k.id`,
        [this.productScope],
      )
    ).rows;
  }
}
