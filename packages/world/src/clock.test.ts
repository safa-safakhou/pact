import { describe, expect, it } from "vitest";
import { nextGameMinuteStrict, TICK_PHASES, timedJobDeadline } from "./clock.js";

describe("game minute boundaries", () => {
  it("rounds strictly past an exact boundary before adding duration", () => {
    const boundary = Date.parse("2026-09-23T12:00:00.000Z");
    expect(nextGameMinuteStrict(boundary)).toBe(Date.parse("2026-09-23T12:01:00.000Z"));
    expect(nextGameMinuteStrict(boundary - 1)).toBe(boundary);
    expect(timedJobDeadline(boundary, 20)).toBe(Date.parse("2026-09-23T12:21:00.000Z"));
    expect(timedJobDeadline(boundary + 1, 20)).toBe(Date.parse("2026-09-23T12:21:00.000Z"));
    expect(() => nextGameMinuteStrict(Number.MAX_SAFE_INTEGER)).toThrow("INVALID_GAME_TIME");
    expect(() => timedJobDeadline(boundary, -1)).toThrow("INVALID_DURATION");
  });

  it("publishes the rulebook phase order as a stable contract", () => {
    expect(TICK_PHASES).toEqual([
      "season_rollover",
      "boundaries_and_completions",
      "production",
      "upkeep",
      "capture_obligations",
      "settle_deliveries",
      "defaults_and_bonds",
      "battle_and_scouts",
      "views_and_achievements",
    ]);
  });
});
