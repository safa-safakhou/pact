import { GAME_DAY_MS, GAME_WEEK_MS, newcomerCohort, SEASON_MS, seasonPosition } from "@pact/kingdom";
import { describe, expect, it } from "vitest";

describe("six-week game-time schedule", () => {
  it("assigns every accelerated minute and exact rollover to its new week/season", () => {
    const opening = 4 * GAME_DAY_MS;
    const totals = Array<bigint>(6).fill(0n);
    for (let i = 0; i < SEASON_MS / 60000; i++) {
      const p = seasonPosition(opening, opening + i * 60000);
      totals[p.week - 1] = (totals[p.week - 1] ?? 0n) + (300n * BigInt(p.harvestPercent)) / 100n;
    }
    expect(totals).toEqual([100, 100, 90, 80, 80, 100].map((p) => (10080n * 300n * BigInt(p)) / 100n));
    expect(seasonPosition(opening, opening + SEASON_MS)).toMatchObject({ number: 2, week: 1, harvestPercent: 100 });
    for (let week = 1; week <= 6; week++)
      expect(seasonPosition(opening, opening + (week - 1) * GAME_WEEK_MS).week).toBe(week);
  });
  it("uses UTC Monday cohorts and rejects invalid clock inputs", () => {
    const monday = 4 * GAME_DAY_MS;
    expect(newcomerCohort(monday - 1)).toBe(monday - GAME_WEEK_MS);
    expect(newcomerCohort(monday + GAME_WEEK_MS - 1)).toBe(monday);
    expect(newcomerCohort(monday + GAME_WEEK_MS)).toBe(monday + GAME_WEEK_MS);
    expect(() => seasonPosition(1, 60000)).toThrow("INVALID_SEASON_TIME");
    expect(() => seasonPosition(60000, 0)).toThrow("INVALID_SEASON_TIME");
    expect(() => newcomerCohort(-1)).toThrow("INVALID_GAME_TIME");
  });
});
