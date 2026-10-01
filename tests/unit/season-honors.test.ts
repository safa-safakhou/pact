import { calculateSeasonHonors, type HonorCandidate } from "@pact/kingdom";
import { describe, expect, it } from "vitest";

const candidate = (i: number, overrides: Partial<HonorCandidate> = {}): HonorCandidate => ({
  kingdomId: `kingdom-${i.toString().padStart(3, "0")}`,
  handle: `player_${i}`,
  fortuneQuarterUnits: (1000 - i).toString(),
  highestHall: 1,
  meaningfulDays: 3,
  firstFinalSampleGameTimeMs: i,
  status: "ranked",
  ...overrides,
});
describe("exact provisional honors", () => {
  it("small bands expose truthful tied ranks but never claim a percentile honor", () => {
    const results = calculateSeasonHonors([
      candidate(0, { fortuneQuarterUnits: "0", firstFinalSampleGameTimeMs: 2 }),
      candidate(1, { fortuneQuarterUnits: "0", firstFinalSampleGameTimeMs: 1 }),
      candidate(2, { fortuneQuarterUnits: "-1", meaningfulDays: 2 }),
      candidate(3, { status: "closing" }),
    ]);
    expect(results.map((r) => r.kingdomId)).toEqual(["kingdom-001", "kingdom-000", "kingdom-002"]);
    expect(results.map((r) => r.overallRank)).toEqual([1, 1, 3]);
    expect(results.every((r) => r.provisionalBorder === null && r.finalized === false)).toBe(true);
    expect(results[2]?.eligible).toBe(false);
    expect(results[2]?.provisionalPlaque).toBe(false);
  });
  it("counts eligible highest bands, ceil thresholds, expanded ties and only the highest tier", () => {
    const players = Array.from({ length: 100 }, (_, i) => candidate(i));
    players[1] = candidate(1, { fortuneQuarterUnits: "1000" });
    players[10] = candidate(10, { fortuneQuarterUnits: "991" });
    players[25] = candidate(25, { fortuneQuarterUnits: "976" });
    const results = calculateSeasonHonors([
      ...players,
      candidate(101, { highestHall: 6 }),
      candidate(102, { meaningfulDays: 2 }),
    ]);
    expect(results.filter((r) => r.provisionalBorder === "gold")).toHaveLength(2);
    expect(results.find((r) => r.kingdomId === "kingdom-010")?.provisionalBorder).toBe("silver");
    expect(results.find((r) => r.kingdomId === "kingdom-025")?.provisionalBorder).toBe("bronze");
    expect(results.find((r) => r.kingdomId === "kingdom-101")).toMatchObject({
      band: "V-VI",
      eligibleBandPopulation: 1,
      provisionalBorder: null,
    });
    const ties = calculateSeasonHonors(
      Array.from({ length: 5 }, (_, i) => candidate(i, { fortuneQuarterUnits: "-2" })),
    );
    expect(ties.every((r) => r.eligibleOverallRank === 1 && r.provisionalPlaque)).toBe(true);
    expect(calculateSeasonHonors(players.slice(0, 99)).every((r) => r.provisionalBorder === null)).toBe(true);
  });
});
