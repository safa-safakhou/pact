import type { OwnerKingdomView } from "@pact/kingdom";
import { expect, it } from "vitest";
import { goalFeasibility, proposedAuthorityMinimum } from "./goal-feasibility.js";

it("derives Hall costs and distinguishes the full ceiling from transient headroom", () => {
  const view = {
    profile: {},
    buildings: [{ kind: "hall", level: 2 }],
    asOfGameTimeMs: 60000,
    authority: {
      mandateVersion: 1,
      resources: {
        iron: { ceilingUnits: "600000", headroomUnits: "60000" },
        silver: { ceilingUnits: "600000", headroomUnits: "0" },
      },
    },
  } as unknown as OwnerKingdomView;
  const result = goalFeasibility(view);
  expect(result.hallUpgrades.map((r) => r.costWhole.iron)).toEqual(["180", "540", "1260", "2700", "4500"]);
  expect(result.hallUpgrades.map((r) => r.exceedsFullCeiling)).toEqual([
    [],
    [],
    ["iron"],
    ["iron", "silver"],
    ["iron", "silver"],
  ]);
  expect(
    goalFeasibility((({ authority: _authority, ...rest }) => rest)(view)).hallUpgrades.every(
      (r) => r.exceedsFullCeiling === null,
    ),
  ).toBe(true);
  expect(result.ownerDecision).toContain("No alternative has been selected");
  expect(result.unsupported).toContain("territory expansion");
});
it("proposes only an explicit bounded 24-game-hour envelope including existing commitments", () => {
  expect(
    proposedAuthorityMinimum({
      rollingSpentUnits: 100n,
      legacySpentUnits: 20n,
      existingReservedUnits: 300n,
      newReservationsUnits: [1260n, 180n],
    }),
  ).toBe(1860n);
  expect(() =>
    proposedAuthorityMinimum({
      rollingSpentUnits: 0n,
      legacySpentUnits: 0n,
      existingReservedUnits: -1n,
      newReservationsUnits: [],
    }),
  ).toThrow("NEGATIVE_AUTHORITY_INPUT");
});
