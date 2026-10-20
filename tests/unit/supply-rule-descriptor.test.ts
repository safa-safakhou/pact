import { describe, expect, it } from "vitest";
import { AgentGuideReader } from "../../packages/application/src/agent-guide.js";
import * as supply from "../../packages/kingdom/src/supply-terms.js";

describe("authoritative read-only supply rules", () => {
  it("publishes the same relative bond limits used by validation", () => {
    expect(supply.supplyTermsRules()).toEqual({
      schemaVersion: "pact.supply-terms.v1",
      durationHours: [1, 6, 24, 72],
      noticeHours: [0, 1, 6],
      maxBondFlowHours: 6,
      valueUnitsPerWhole: { iron: "4", silver: "8", grain: "1" },
      minOfferExpiryMinutes: 5,
      maxOfferExpiryMinutes: 60,
      outgoingRateLimit: "storage_capacity_whole_per_hour",
    });
    const terms = {
      aToB: { resource: "iron", wholePerHour: 5 },
      bToA: null,
      aBond: { resource: "grain", wholeAmount: 120 },
      bBond: null,
      durationHours: 6,
      noticeHours: 1,
    } as supply.SupplyTerms;
    expect(() => supply.validateSupplyTerms(terms)).not.toThrow();
    expect(() => supply.validateSupplyTerms({ ...terms, aBond: { resource: "grain", wholeAmount: 121 } })).toThrow(
      "BOND_EXCEEDS_FLOW",
    );
  });
  it("delivers these rules with explicit creator-relative directions without any owned state mutation", async () => {
    const reader = new AgentGuideReader({} as never, {} as never, {} as never);
    const guide = await reader.read("synthetic", "diplomacy");
    expect(guide.contractRules).toMatchObject({
      aIsOfferCreator: true,
      aToBMeaning: "Offer creator A sends to B",
      bToAMeaning: "B sends to offer creator A",
      termsValidation: supply.supplyTermsRules(),
    });
  });
});

it("checks large flow-relative bonds with exact integer multiplication", () => {
  const terms: supply.SupplyTerms = {
    aToB: { resource: "grain", wholePerHour: 9007199254740989 },
    bToA: null,
    aBond: { resource: "silver", wholeAmount: 6755399441055741 },
    bBond: null,
    durationHours: 6,
    noticeHours: 0,
  };
  expect(() => supply.validateSupplyTerms(terms)).not.toThrow();
  expect(() =>
    supply.validateSupplyTerms({ ...terms, aBond: { resource: "silver", wholeAmount: 6755399441055742 } }),
  ).toThrow("BOND_EXCEEDS_FLOW");
});
