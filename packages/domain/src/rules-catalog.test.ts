import { AssetAmountSchema } from "@pact/contracts";
import { describe, expect, it } from "vitest";
import {
  addRational,
  compareRational,
  compareUuidBytes,
  multiplyRational,
  parseRational,
  rational,
  serializeRational,
} from "./rational.js";
import {
  constructionAffordability,
  counterAdjustedPower,
  harvestProductionPerMinute,
  hourlyRatePerMinute,
  loadRulesFixture,
  parseInternalUnits,
  roundDownPercent,
  rulesCatalog,
  serializeInternalUnits,
  upgradeCost,
  wholeResources,
} from "./rules-catalog.js";

describe("versioned rules catalog", () => {
  it("reproduces published construction values and exact internal units", () => {
    expect(rulesCatalog.rulesId).toBe("pact-s1-v1");
    expect(upgradeCost("hall", 6)).toEqual({ iron: wholeResources(4500), silver: wholeResources(2250) });
    expect(upgradeCost("farm", 2)).toEqual({ iron: wholeResources(40), silver: wholeResources(20) });
    expect(hourlyRatePerMinute(8)).toBe(80n);
    expect(
      constructionAffordability("farm", 2, {
        ordinaryIron: 0n,
        ordinarySilver: 0n,
        grantIron: wholeResources(200),
        grantSilver: wholeResources(100),
      }),
    ).toMatchObject({
      affordable: true,
      grantIronSpent: wholeResources(40),
      grantSilverSpent: wholeResources(20),
      ordinaryIronSpent: 0n,
      ordinarySilverSpent: 0n,
    });
    expect(
      constructionAffordability("hall", 6, {
        ordinaryIron: 0n,
        ordinarySilver: 0n,
        grantIron: wholeResources(200),
        grantSilver: wholeResources(100),
      }).affordable,
    ).toBe(false);
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
    expect(
      counterAdjustedPower({ count: 10n, baseStat: 8n, opposingCountered: 15n, opposingNonRam: 30n, hungry: false }),
    ).toEqual(rational(100n));
    expect(
      counterAdjustedPower({ count: 5n, baseStat: 18n, opposingCountered: 15n, opposingNonRam: 30n, hungry: false }),
    ).toEqual(rational(225n, 2n));
    expect(
      counterAdjustedPower({ count: 5n, baseStat: 18n, opposingCountered: 15n, opposingNonRam: 30n, hungry: true }),
    ).toEqual(rational(675n, 8n));
    const attack = addRational(
      addRational(rational(120n), rational(100n)),
      counterAdjustedPower({ count: 5n, baseStat: 18n, opposingCountered: 15n, opposingNonRam: 30n, hungry: false }),
    );
    expect(attack).toEqual(rational(665n, 2n));
  });

  it("rejects unsafe rational state", () => {
    expect(() => rational(1n, 0n)).toThrow("RATIONAL_ZERO_DENOMINATOR");
    expect(() => upgradeCost("hall", 7)).toThrow("INVALID_TARGET_LEVEL");
  });

  it("covers season harvest and catalog fixture validation", () => {
    expect(rulesCatalog.harvestPercentByWeek).toEqual([100, 100, 90, 80, 80, 100]);
    expect(harvestProductionPerMinute(4, 4)).toBe(hourlyRatePerMinute(72));
    expect(loadRulesFixture(JSON.stringify(rulesCatalog))).toEqual(rulesCatalog);
    expect(() => loadRulesFixture(JSON.stringify({ ...rulesCatalog, rulesId: "unknown" }))).toThrow();
    expect(() => harvestProductionPerMinute(7, 1)).toThrow("INVALID_HARVEST_LEVEL_OR_WEEK");
  });

  it("keeps exact amounts as canonical decimal strings across JSON", () => {
    const large = (BigInt(Number.MAX_SAFE_INTEGER) + 1n) * 600n;
    const wire = JSON.parse(
      JSON.stringify({ amount: serializeInternalUnits(large), power: serializeRational(rational(27n, 2n)) }),
    ) as { amount: unknown; power: unknown };
    expect(parseInternalUnits(wire.amount)).toBe(large);
    expect(parseRational(wire.power)).toEqual(rational(27n, 2n));
    const apiAmount = AssetAmountSchema.parse(JSON.parse(JSON.stringify({ asset: "grain", units: "9600000" })));
    expect(parseInternalUnits(apiAmount.units)).toBe(wholeResources(16000));
    expect(() => parseInternalUnits(Number.MAX_SAFE_INTEGER)).toThrow("INVALID_INTERNAL_UNITS");
    expect(() => wholeResources(Number.MAX_SAFE_INTEGER + 1)).toThrow("UNSAFE_RESOURCE_AMOUNT");
    expect(() => wholeResources(1.25)).toThrow("UNSAFE_RESOURCE_AMOUNT");
  });

  it("rounds internal units down and orders UUIDs by immutable bytes", () => {
    expect(roundDownPercent(3n, 25)).toBe(0n);
    expect(roundDownPercent(401n, 25)).toBe(100n);
    expect(compareUuidBytes("00000000-0000-7000-8000-00000000000A", "00000000-0000-7000-8000-00000000000b")).toBe(-1);
    expect(compareUuidBytes("00000000-0000-7000-8000-00000000000A", "00000000-0000-7000-8000-00000000000a")).toBe(0);
    expect(() => compareUuidBytes("not-a-uuid", "00000000-0000-7000-8000-00000000000a")).toThrow("INVALID_UUID");
  });
});
