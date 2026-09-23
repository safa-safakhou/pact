import { describe, expect, it } from "vitest";
import { allocateSpend, creditToCap } from "./policy.js";

describe("exact resource policy", () => {
  it("conserves every requested credit across stored and overflow units", () => {
    let seed = 123456789n;
    for (let index = 0; index < 2_000; index += 1) {
      seed = (seed * 1103515245n + 12345n) % 2147483648n;
      const cap = seed % 10_000n;
      seed = (seed * 1103515245n + 12345n) % 2147483648n;
      const current = seed % (cap + 1n);
      seed = (seed * 1103515245n + 12345n) % 2147483648n;
      const requested = seed % 10_000n;
      const result = creditToCap(current, cap, requested);
      expect(result.credited + result.overflow).toBe(requested);
      expect(current + result.credited).toBeLessThanOrEqual(cap);
      expect(result.credited).toBeGreaterThanOrEqual(0n);
      expect(result.overflow).toBeGreaterThanOrEqual(0n);
    }
  });

  it("spends construction allowance first and upkeep allowance last", () => {
    expect(
      allocateSpend({ resource: "iron", purpose: "construction", ordinary: 30n, allowance: 40n, requested: 50n }),
    ).toEqual({
      ordinarySpent: 10n,
      allowanceSpent: 40n,
      fullyFunded: true,
    });
    expect(
      allocateSpend({ resource: "grain", purpose: "upkeep", ordinary: 30n, allowance: 40n, requested: 50n }),
    ).toEqual({
      ordinarySpent: 30n,
      allowanceSpent: 20n,
      fullyFunded: true,
    });
    expect(
      allocateSpend({ resource: "grain", purpose: "upkeep", ordinary: 10n, allowance: 5n, requested: 20n }),
    ).toEqual({
      ordinarySpent: 10n,
      allowanceSpent: 5n,
      fullyFunded: false,
    });
  });

  it("conserves each randomized debit across ordinary and restricted provenance", () => {
    let seed = 987654321n;
    for (let index = 0; index < 2_000; index += 1) {
      seed = (seed * 1664525n + 1013904223n) % 4294967296n;
      const ordinary = seed % 10_000n;
      seed = (seed * 1664525n + 1013904223n) % 4294967296n;
      const allowance = seed % 10_000n;
      seed = (seed * 1664525n + 1013904223n) % 4294967296n;
      const requested = seed % 20_000n;
      for (const [resource, purpose] of [
        ["iron", "construction"],
        ["grain", "upkeep"],
      ] as const) {
        if (purpose === "construction" && requested > ordinary + allowance) continue;
        const result = allocateSpend({ resource, purpose, ordinary, allowance, requested });
        expect(result.ordinarySpent).toBeLessThanOrEqual(ordinary);
        expect(result.allowanceSpent).toBeLessThanOrEqual(allowance);
        expect(result.ordinarySpent + result.allowanceSpent).toBe(
          result.fullyFunded ? requested : ordinary + allowance,
        );
        expect(ordinary - result.ordinarySpent).toBeGreaterThanOrEqual(0n);
        expect(allowance - result.allowanceSpent).toBeGreaterThanOrEqual(0n);
      }
      if (requested <= ordinary) {
        const result = allocateSpend({ resource: "silver", purpose: "trade", ordinary, allowance, requested });
        expect(result.ordinarySpent).toBe(requested);
        expect(result.allowanceSpent).toBe(0n);
      }
    }
  });

  it("never lets grants finance transfers, training, bonds, scouts, or raids", () => {
    for (const purpose of ["trade", "transfer", "training", "bond", "scout", "raid_provisions"] as const) {
      expect(() =>
        allocateSpend({ resource: "iron", purpose, ordinary: 0n, allowance: 1_000n, requested: 1n }),
      ).toThrow("INSUFFICIENT_STOCK");
    }
    expect(() =>
      allocateSpend({ resource: "grain", purpose: "construction", ordinary: 1n, allowance: 1n, requested: 1n }),
    ).toThrow("ALLOWANCE_PURPOSE_FORBIDDEN");
    expect(() =>
      allocateSpend({ resource: "silver", purpose: "upkeep", ordinary: 1n, allowance: 1n, requested: 1n }),
    ).toThrow("ALLOWANCE_PURPOSE_FORBIDDEN");
    expect(() => creditToCap(0n, 100n, -1n)).toThrow("NEGATIVE_RESOURCE_AMOUNT");
    expect(() =>
      allocateSpend({ resource: "iron", purpose: "trade", ordinary: -1n, allowance: 0n, requested: 1n }),
    ).toThrow("NEGATIVE_RESOURCE_AMOUNT");
  });
});
