import { describe, expect, it } from "vitest";
import { forecastBalances } from "./world-views.js";

const kingdomId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const balances = (["iron", "silver", "grain"] as const).map((resource) => ({
  resource,
  ordinary_units: "1000",
  allowance_units: resource === "grain" ? "100" : "0",
  locked_units: "0",
  storage_cap_units: "100000",
  production_per_minute_units: "100",
  version: "1",
  grant_expires_game_time_ms: "180000",
}));
const contract = {
  id: "00000000-0000-4000-8000-000000000003",
  kingdom_a: kingdomId,
  kingdom_b: otherId,
  terms: {
    aToB: { resource: "iron" as const, wholePerHour: 6 },
    bToA: { resource: "grain" as const, wholePerHour: 12 },
    aBond: null,
    bBond: null,
    durationHours: 1 as const,
    noticeHours: 0 as const,
  },
  end_game_time_ms: "600000",
  notice_end_game_time_ms: null,
};

describe("conditional world forecast", () => {
  it("keeps founding units separate, labels deliveries, and applies a harvest change at its boundary", () => {
    const result = forecastBalances({
      now: 0,
      minutes: 3,
      balances,
      contracts: [contract],
      kingdomId,
      upkeep: 50n,
      harvestPercentAt: (time) => (time < 120_000 ? 100 : 80),
    });
    expect(result.harvestPercentByMinute).toEqual([100, 80, 80]);
    expect(result.assumedDeliveries).toEqual([
      { contractId: contract.id, direction: "outgoing", resource: "iron", units: "180" },
      { contractId: contract.id, direction: "incoming", resource: "grain", units: "360" },
    ]);
    expect(result.expected.grain.foundingAllowanceUnits).toBe("0");
    expect(result.expected.grain.ordinaryUnits).toBe("1470");
    expect(result.expected.iron.ordinaryUnits).toBe("1120");
    expect(result.assumption).toMatch(/assumed funded/);
  });

  it("changes after a committed default or combat loss changes the supplied state", () => {
    const before = forecastBalances({
      now: 0,
      minutes: 1,
      balances,
      contracts: [contract],
      kingdomId,
      upkeep: 50n,
      harvestPercentAt: () => 100,
    });
    const after = forecastBalances({
      now: 0,
      minutes: 1,
      balances: balances.map((balance) =>
        balance.resource === "grain" ? { ...balance, ordinary_units: "500" } : balance,
      ),
      contracts: [],
      kingdomId,
      upkeep: 20n,
      harvestPercentAt: () => 100,
    });
    expect(before.expected.grain.ordinaryUnits).not.toBe(after.expected.grain.ordinaryUnits);
    expect(after.assumedDeliveries).toEqual([]);
    expect(after.expected.iron.ordinaryUnits).toBe("1100");
  });

  it("uses ordinary food before founding allowance and never uses allowance for visitors", () => {
    const lowFood = balances.map((balance) =>
      balance.resource === "grain" ? { ...balance, ordinary_units: "10", production_per_minute_units: "0" } : balance,
    );
    const result = forecastBalances({
      now: 0,
      minutes: 1,
      balances: lowFood,
      contracts: [],
      kingdomId,
      upkeep: 50n,
      visitingUpkeep: 20n,
      harvestPercentAt: () => 100,
    });
    expect(result.expected.grain.ordinaryUnits).toBe("0");
    expect(result.expected.grain.foundingAllowanceUnits).toBe("80");
  });
});
