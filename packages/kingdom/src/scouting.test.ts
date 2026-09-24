import { describe, expect, it } from "vitest";
import { resourceBand, troopBand } from "./scouting.js";

describe("private scout observation bands", () => {
  it("keeps troop boundaries exact", () => {
    expect([0, 1, 10, 11, 25, 26, 50, 51, 100, 101, 200, 201, 400, 401].map(troopBand)).toEqual([
      "0",
      "1-10",
      "1-10",
      "11-25",
      "11-25",
      "26-50",
      "26-50",
      "51-100",
      "51-100",
      "101-200",
      "101-200",
      "201-400",
      "201-400",
      "over 400",
    ]);
  });

  it("distinguishes fractional positive ordinary stock from zero", () => {
    expect(
      [0n, 1n, 599n, 600n, 60_000n, 60_001n, 300_000n, 300_001n, 900_000n, 900_001n, 3_000_000n, 3_000_001n].map(
        resourceBand,
      ),
    ).toEqual([
      "0",
      "less than 1",
      "less than 1",
      "1-100",
      "1-100",
      "101-500",
      "101-500",
      "501-1500",
      "501-1500",
      "1501-5000",
      "1501-5000",
      "over 5000",
    ]);
  });
});
