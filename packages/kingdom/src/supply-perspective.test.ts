import { expect, it } from "vitest";
import { type SupplyTerms, supplyPerspective } from "./supply-terms.js";

it("presents the opposite party directions without changing signed terms or inventing an absent flow", () => {
  const terms: SupplyTerms = {
    aToB: { resource: "iron", wholePerHour: 1 },
    bToA: null,
    aBond: null,
    bBond: null,
    durationHours: 1,
    noticeHours: 0,
  };
  expect(supplyPerspective(terms, true)).toEqual({ youSend: terms.aToB, youReceive: null });
  expect(supplyPerspective(terms, false)).toEqual({ youSend: null, youReceive: terms.aToB });
  expect(terms.bToA).toBeNull();
});
