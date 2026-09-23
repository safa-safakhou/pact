import { describe, expect, it } from "vitest";
import { addRational, compareRational, multiplyRational, rational, serializeRational } from "./rational.js";
import { hourlyRatePerMinute, rulesCatalog, upgradeCost, wholeResources } from "./rules-catalog.js";

describe("versioned rules catalog", () => {
  it("reproduces published construction values and exact internal units", () => {
    expect(rulesCatalog.rulesId).toBe("pact-s1-v1");
    expect(upgradeCost("hall", 6)).toEqual({ iron: wholeResources(4500), silver: wholeResources(2250) });
    expect(upgradeCost("farm", 2)).toEqual({ iron: wholeResources(40), silver: wholeResources(20) });
    expect(hourlyRatePerMinute(8)).toBe(80n);
  });

  it("reproduces the six-hour food example without floating point", () => {
    const hourlyDeficit = 48n;
    const stored = wholeResources(288);
    expect(stored / hourlyRatePerMinute(hourlyDeficit)).toBe(360n);
  });

  it("normalizes, compares, and serializes exact rational power", () => {
    const hungry = rational(3n, 4n);
    const riderPower = multiplyRational(rational(18n), hungry);
    expect(riderPower).toEqual(rational(27n, 2n));
    expect(addRational(rational(1n, 4n), rational(2n, 4n))).toEqual(rational(3n, 4n));
    expect(compareRational(rational(102n, 100n), rational(1n))).toBe(1);
    expect(serializeRational(riderPower)).toEqual({ numerator: "27", denominator: "2" });
  });

  it("rejects unsafe rational state", () => {
    expect(() => rational(1n, 0n)).toThrow("RATIONAL_ZERO_DENOMINATOR");
    expect(() => upgradeCost("hall", 7)).toThrow("INVALID_TARGET_LEVEL");
  });
});
