import { describe, expect, it } from "vitest";
import { type CombatUnit, type CombatUnitType, calculateCombat } from "./combat.js";
import { INTERNAL_UNITS_PER_RESOURCE } from "./rules-catalog.js";

const id = (number: number) => `00000000-0000-7000-8000-${number.toString(16).padStart(12, "0")}`;
const units: CombatUnit[] = [];
let nextId = 1;
function add(ownerId: string, side: "attacker" | "defender", type: CombatUnitType, count: number): void {
  for (let index = 0; index < count; index += 1) units.push({ id: id(nextId++), ownerId, side, type, hungry: false });
}
add("attacker", "attacker", "spearman", 20);
add("attacker", "attacker", "archer", 10);
add("attacker", "attacker", "rider", 5);
add("defender", "defender", "spearman", 15);
add("defender", "defender", "archer", 15);

const base = {
  rulesVersion: "pact-s1-v1" as const,
  units,
  wallPower: 40,
  attackerDie: 4,
  defenderDie: 4,
  ordinaryStock: {
    iron: 200n * INTERNAL_UNITS_PER_RESOURCE,
    silver: 400n * INTERNAL_UNITS_PER_RESOURCE,
    grain: 100n * INTERNAL_UNITS_PER_RESOURCE,
  },
  lootPriority: ["silver", "iron", "grain"] as const,
};

describe("pure combat calculation", () => {
  it("matches the worked battle and 26 of 36 die-pair wins", () => {
    const result = calculateCombat(base);
    expect(result.winner).toBe("attacker");
    expect(result.attackerTroopPower).toEqual({ numerator: 665n, denominator: 2n });
    expect(result.defenderTroopPower).toEqual({ numerator: 1935n, denominator: 7n });
    expect(result.wallAfterSuppression).toEqual({ numerator: 40n, denominator: 1n });
    expect(result.casualtyGroups).toMatchObject([
      { side: "attacker", casualties: 7, byType: { spearman: 4, archer: 2, rider: 1, ram: 0 } },
      { side: "defender", casualties: 14, byType: { spearman: 7, archer: 7, rider: 0, ram: 0 } },
    ]);
    expect(result.casualtyGroups[0]?.lostUnitIds).toEqual([id(1), id(2), id(3), id(4), id(21), id(22), id(31)]);
    expect(result.casualtyGroups[1]?.lostUnitIds).toEqual([
      id(36),
      id(37),
      id(38),
      id(39),
      id(40),
      id(41),
      id(42),
      id(51),
      id(52),
      id(53),
      id(54),
      id(55),
      id(56),
      id(57),
    ]);
    expect(result.carryingCapacity).toBe(144n * INTERNAL_UNITS_PER_RESOURCE);
    expect(result.lootTaken).toEqual({
      silver: 100n * INTERNAL_UNITS_PER_RESOURCE,
      iron: 44n * INTERNAL_UNITS_PER_RESOURCE,
      grain: 0n,
    });
    let wins = 0;
    for (let attackerDie = 1; attackerDie <= 6; attackerDie += 1) {
      for (let defenderDie = 1; defenderDie <= 6; defenderDie += 1) {
        if (calculateCombat({ ...base, attackerDie, defenderDie }).winner === "attacker") wins += 1;
        const trace = calculateCombat({ ...base, attackerDie, defenderDie });
        for (const group of trace.casualtyGroups) {
          expect(group.casualties).toBeGreaterThanOrEqual(0);
          expect(group.casualties).toBeLessThanOrEqual(group.participating);
        }
      }
    }
    expect(wins).toBe(26);
  });

  it("is invariant to formation order and keeps same-owner troops on opposite sides separate", () => {
    const baseline = calculateCombat(base);
    expect(calculateCombat({ ...base, units: [...units].reverse() })).toEqual(baseline);
    expect(
      calculateCombat({
        ...base,
        units: units.map((unit, index) => ({ ...unit, detachmentId: `formation-${index % 7}` })),
      }),
    ).toEqual(baseline);
    const mixed = calculateCombat({ ...base, units: units.map((unit) => ({ ...unit, ownerId: "same-owner" })) });
    expect(mixed.casualtyGroups).toHaveLength(2);
    expect(mixed.casualtyGroups.map((group) => group.side)).toEqual(["attacker", "defender"]);
    expect(mixed.casualtyGroups.map((group) => group.casualties)).toEqual([7, 14]);
  });

  it("preserves exact losses and loot through 32 seeded detachment splits across all 36 die pairs", () => {
    let seed = 0x51de7ac;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    const types: CombatUnitType[] = ["spearman", "archer", "rider", "ram"];
    for (let scenario = 0; scenario < 32; scenario++) {
      const roster: CombatUnit[] = [];
      for (const side of ["attacker", "defender"] as const) {
        const count = 1 + (next() % 48);
        for (let i = 0; i < count; i++) {
          roster.push({
            id: id(1000 + scenario * 100 + roster.length),
            ownerId: `owner-${i % 3}`, // The same owner may be present on both sides.
            side,
            type: types[next() % types.length] ?? "spearman",
            hungry: next() % 3 === 0,
          });
        }
      }
      const split = roster.map((unit) => ({ ...unit, detachmentId: `detachment-${next() % 13}` }));
      for (let i = split.length - 1; i > 0; i--) {
        const j = next() % (i + 1);
        const current = split[i];
        const other = split[j];
        if (current && other) [split[i], split[j]] = [other, current];
      }
      const stock = {
        iron: BigInt(next() % 200_000),
        silver: BigInt(next() % 200_000),
        grain: BigInt(next() % 200_000),
      };
      const capacity = {
        iron: BigInt(next() % 10_000),
        silver: BigInt(next() % 10_000),
        grain: BigInt(next() % 10_000),
      };
      const wallPower = next() % 200;
      for (let attackerDie = 1; attackerDie <= 6; attackerDie++) {
        for (let defenderDie = 1; defenderDie <= 6; defenderDie++) {
          const input = {
            ...base,
            units: roster,
            wallPower,
            attackerDie,
            defenderDie,
            ordinaryStock: stock,
            leaderFreeCapacity: capacity,
          };
          const combined = calculateCombat(input);
          expect(calculateCombat({ ...input, units: split })).toEqual(combined);
          const lost = new Set<string>();
          for (const group of combined.casualtyGroups) {
            expect(group.lostUnitIds).toHaveLength(group.casualties);
            for (const unitId of group.lostUnitIds) {
              expect(lost.has(unitId)).toBe(false);
              lost.add(unitId);
              expect(roster.find((unit) => unit.id === unitId)).toMatchObject({
                ownerId: group.ownerId,
                side: group.side,
              });
            }
          }
          for (const resource of ["iron", "silver", "grain"] as const) {
            expect(combined.lootTaken[resource]).toBeLessThanOrEqual(stock[resource] / 4n);
            expect(combined.leaderReceived[resource]).toBeLessThanOrEqual(capacity[resource]);
            expect(combined.leaderReceived[resource] + combined.leaderOverflow[resource]).toBe(
              combined.lootTaken[resource],
            );
          }
        }
      }
    }
  });

  it("handles zero power, Ram suppression, hungry power, and storage overflow without negatives", () => {
    const noDefender = calculateCombat({
      ...base,
      units: units.filter((unit) => unit.side === "attacker"),
      wallPower: 0,
    });
    expect(noDefender).toMatchObject({ winner: "attacker", branch: "zero_defender" });
    expect(noDefender.casualtyGroups[0]?.casualties).toBe(0);
    const noAttacker = calculateCombat({ ...base, units: units.filter((unit) => unit.side === "defender") });
    expect(noAttacker).toMatchObject({ winner: "defender", branch: "zero_attacker" });
    expect(noAttacker.lootTaken).toEqual({ iron: 0n, silver: 0n, grain: 0n });
    const tie = calculateCombat({
      ...base,
      units: [
        { id: id(600), ownerId: "a", side: "attacker", type: "ram", hungry: false },
        { id: id(601), ownerId: "d", side: "defender", type: "ram", hungry: false },
      ],
      wallPower: 0,
    });
    expect(tie.winner).toBe("defender");
    const hungrySpearman = calculateCombat({
      ...base,
      units: [{ id: id(602), ownerId: "a", side: "attacker", type: "spearman", hungry: true }],
      wallPower: 0,
    });
    expect(hungrySpearman.attackerTroopPower).toEqual({ numerator: 9n, denominator: 2n });
    const ram: CombatUnit = { id: id(500), ownerId: "attacker", side: "attacker", type: "ram", hungry: true };
    const hungry = calculateCombat({
      ...base,
      units: [...units, ram],
      leaderFreeCapacity: { iron: 0n, silver: 10n * INTERNAL_UNITS_PER_RESOURCE, grain: 0n },
    });
    expect(hungry.wallSuppression).toEqual({ numerator: 45n, denominator: 2n });
    expect(hungry.wallAfterSuppression).toEqual({ numerator: 35n, denominator: 2n });
    for (const resource of ["iron", "silver", "grain"] as const) {
      expect(hungry.lootTaken[resource]).toBeGreaterThanOrEqual(0n);
      expect(hungry.leaderReceived[resource] + hungry.leaderOverflow[resource]).toBe(hungry.lootTaken[resource]);
    }
    expect(() => calculateCombat({ ...base, ordinaryStock: { ...base.ordinaryStock, iron: -1n } })).toThrow(
      "COMBAT_NEGATIVE_STOCK",
    );
  });
});
