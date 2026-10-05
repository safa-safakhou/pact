import { describe, expect, it } from "vitest";
import { resourceRateFacts, wholeUnitText } from "./resource-facts.js";

describe("canonical whole-unit facts", () => {
  it("keeps gross/upkeep/net minute and hourly rates distinct", () => {
    expect(resourceRateFacts("450", "150")).toMatchObject({
      gross: { label: "0.75/min = 45/hour" },
      upkeep: { label: "0.25/min = 15/hour" },
      net: { label: "0.5/min = 30/hour" },
    });
  });
  it("handles exact large integers, negative net and labelled nonterminating fractions", () => {
    expect(wholeUnitText("5400000000000000600")).toBe("9000000000000001");
    expect(wholeUnitText("-1")).toBe("≈-0.001666");
    expect(resourceRateFacts("0", "600").net.label).toBe("-1/min = -60/hour");
  });
});
