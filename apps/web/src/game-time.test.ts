import { describe, expect, it } from "vitest";
import { remainingGameTime } from "./game-time.js";

describe("committed game deadlines", () => {
  it("uses game time even when wall time is an hour ahead", () => {
    expect(remainingGameTime(3_600_000, { asOfGameTimeMs: 0, worldStatus: "active" })).toBe(
      "1h 0m game time remaining · as of last refresh",
    );
  });
  it("holds paused projections and does not promise realtime completion", () => {
    expect(remainingGameTime(180_000, { asOfGameTimeMs: 60_000, worldStatus: "paused" })).toBe(
      "2m game time remaining · clock paused",
    );
    expect(remainingGameTime(60_000, { asOfGameTimeMs: 60_000, worldStatus: "active" })).toContain(
      "refresh for settlement",
    );
    expect(remainingGameTime(60_000, null)).toContain("unavailable");
  });
});
