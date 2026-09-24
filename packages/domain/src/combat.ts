import {
  addRational,
  ceilRational,
  compareRational,
  compareUuidBytes,
  floorRational,
  multiplyRational,
  type Rational,
  rational,
} from "./rational.js";
import { INTERNAL_UNITS_PER_RESOURCE, rulesCatalog } from "./rules-catalog.js";

export type CombatSide = "attacker" | "defender";
export type CombatUnitType = "spearman" | "archer" | "rider" | "ram";
export type LootResource = "iron" | "silver" | "grain";

export interface CombatUnit {
  id: string;
  ownerId: string;
  side: CombatSide;
  type: CombatUnitType;
  hungry: boolean;
  detachmentId?: string;
}

export interface CombatInput {
  rulesVersion: "pact-s1-v1";
  units: readonly CombatUnit[];
  wallPower: number;
  attackerDie: number;
  defenderDie: number;
  ordinaryStock: Readonly<Record<LootResource, bigint>>;
  lootPriority: readonly [LootResource, LootResource, LootResource];
  leaderFreeCapacity?: Readonly<Record<LootResource, bigint>>;
}

export interface CombatCasualtyGroup {
  ownerId: string;
  side: CombatSide;
  participating: number;
  casualties: number;
  byType: Readonly<Record<CombatUnitType, number>>;
  lostUnitIds: readonly string[];
}

export interface CombatTrace {
  rulesVersion: "pact-s1-v1";
  winner: CombatSide;
  branch: "zero_attacker" | "zero_defender" | "normal";
  attackerDie: number;
  defenderDie: number;
  attackerTroopPower: Rational;
  defenderTroopPower: Rational;
  wallBeforeSuppression: Rational;
  wallSuppression: Rational;
  wallAfterSuppression: Rational;
  attackerModifiedPower: Rational;
  defenderModifiedPower: Rational;
  winnerToLoserRatio: Rational | null;
  winnerCasualtyFraction: Rational;
  loserCasualtyFraction: Rational;
  casualtyGroups: readonly CombatCasualtyGroup[];
  survivingAttackerUnitIds: readonly string[];
  carryingCapacity: bigint;
  lootTaken: Readonly<Record<LootResource, bigint>>;
  leaderReceived: Readonly<Record<LootResource, bigint>>;
  leaderOverflow: Readonly<Record<LootResource, bigint>>;
}

const types: readonly CombatUnitType[] = ["spearman", "archer", "rider", "ram"];
const resources: readonly LootResource[] = ["iron", "silver", "grain"];
const counters: Readonly<Partial<Record<CombatUnitType, CombatUnitType>>> = {
  spearman: "rider",
  archer: "spearman",
  rider: "archer",
};
const zero = rational(0n);

function divide(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) throw new Error("COMBAT_ZERO_DIVISION");
  return rational(left.numerator * right.denominator, left.denominator * right.numerator);
}

function minBigint(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

function emptyLoot(): Record<LootResource, bigint> {
  return { iron: 0n, silver: 0n, grain: 0n };
}

function unitPower(unit: CombatUnit, opponents: readonly CombatUnit[]): Rational {
  const stats = rulesCatalog.units[unit.type];
  const base = BigInt(unit.side === "attacker" ? stats.attack : stats.defense);
  const eligible = opponents.filter((other) => other.type !== "ram");
  const countered = eligible.filter((other) => other.type === counters[unit.type]).length;
  const counter =
    eligible.length > 0 ? rational(BigInt(eligible.length * 2 + countered), BigInt(eligible.length * 2)) : rational(1n);
  const hunger = unit.hungry ? rational(3n, 4n) : rational(1n);
  return multiplyRational(multiplyRational(rational(base), counter), hunger);
}

function casualtiesForGroup(units: readonly CombatUnit[], fraction: Rational): CombatCasualtyGroup {
  const ordered = [...units].sort((left, right) => compareUuidBytes(left.id, right.id));
  const count = ordered.length;
  const casualties = Number(
    minBigint(BigInt(count), ceilRational(multiplyRational(rational(BigInt(count)), fraction))),
  );
  const typeCounts = Object.fromEntries(
    types.map((type) => [type, ordered.filter((unit) => unit.type === type).length]),
  ) as Record<CombatUnitType, number>;
  const byType = Object.fromEntries(types.map((type) => [type, 0])) as Record<CombatUnitType, number>;
  if (count > 0) {
    for (const type of types) byType[type] = Math.floor((casualties * typeCounts[type]) / count);
    let remaining = casualties - types.reduce((sum, type) => sum + byType[type], 0);
    const remainders = [...types].sort((left, right) => {
      const l = (casualties * typeCounts[left]) % count;
      const r = (casualties * typeCounts[right]) % count;
      return r - l || types.indexOf(left) - types.indexOf(right);
    });
    for (const type of remainders) {
      if (remaining === 0) break;
      if (byType[type] < typeCounts[type]) {
        byType[type] += 1;
        remaining -= 1;
      }
    }
    if (remaining !== 0) throw new Error("COMBAT_CASUALTY_ALLOCATION");
  }
  const lostUnitIds = types.flatMap((type) =>
    ordered
      .filter((unit) => unit.type === type)
      .slice(0, byType[type])
      .map((unit) => unit.id),
  );
  return {
    ownerId: ordered[0]?.ownerId ?? "",
    side: ordered[0]?.side ?? "attacker",
    participating: count,
    casualties,
    byType,
    lostUnitIds,
  };
}

/** Pure combat calculation: caller supplies the locked, eligible snapshot and exact dice. */
export function calculateCombat(input: CombatInput): CombatTrace {
  if (input.rulesVersion !== rulesCatalog.rulesId) throw new Error("COMBAT_RULES_VERSION");
  if (!Number.isSafeInteger(input.wallPower) || input.wallPower < 0) throw new Error("COMBAT_WALL_POWER");
  if (![input.attackerDie, input.defenderDie].every((die) => Number.isInteger(die) && die >= 1 && die <= 6))
    throw new Error("COMBAT_DIE");
  if (new Set(input.lootPriority).size !== 3 || resources.some((resource) => !input.lootPriority.includes(resource)))
    throw new Error("COMBAT_LOOT_PRIORITY");
  for (const resource of resources) {
    if (input.ordinaryStock[resource] < 0n || (input.leaderFreeCapacity && input.leaderFreeCapacity[resource] < 0n))
      throw new Error("COMBAT_NEGATIVE_STOCK");
  }
  const ids = new Set<string>();
  for (const unit of input.units) {
    compareUuidBytes(unit.id, unit.id);
    if (ids.has(unit.id)) throw new Error("COMBAT_DUPLICATE_UNIT");
    ids.add(unit.id);
    if (!unit.ownerId || !types.includes(unit.type) || !["attacker", "defender"].includes(unit.side))
      throw new Error("COMBAT_INVALID_UNIT");
  }
  const attackers = input.units.filter((unit) => unit.side === "attacker");
  const defenders = input.units.filter((unit) => unit.side === "defender");
  const attackerTroopPower = attackers.reduce((power, unit) => addRational(power, unitPower(unit, defenders)), zero);
  const defenderTroopPower = defenders.reduce((power, unit) => addRational(power, unitPower(unit, attackers)), zero);
  const wallBeforeSuppression = rational(BigInt(input.wallPower));
  const rawSuppression = attackers
    .filter((unit) => unit.type === "ram")
    .reduce((power, unit) => addRational(power, unit.hungry ? rational(45n, 2n) : rational(30n)), zero);
  const wallSuppression =
    compareRational(rawSuppression, wallBeforeSuppression) > 0 ? wallBeforeSuppression : rawSuppression;
  const wallAfterSuppression = addRational(
    wallBeforeSuppression,
    rational(-wallSuppression.numerator, wallSuppression.denominator),
  );
  const defenderBase = addRational(defenderTroopPower, wallAfterSuppression);
  const attackerModifiedPower = multiplyRational(
    attackerTroopPower,
    rational(BigInt(rulesCatalog.combat.dicePercent[input.attackerDie - 1] ?? 0), 100n),
  );
  const defenderModifiedPower = multiplyRational(
    defenderBase,
    rational(BigInt(rulesCatalog.combat.dicePercent[input.defenderDie - 1] ?? 0), 100n),
  );
  const branch =
    attackerTroopPower.numerator === 0n ? "zero_attacker" : defenderBase.numerator === 0n ? "zero_defender" : "normal";
  const winner: CombatSide =
    branch === "zero_attacker"
      ? "defender"
      : branch === "zero_defender" || compareRational(attackerModifiedPower, defenderModifiedPower) > 0
        ? "attacker"
        : "defender";
  const winnerPower = winner === "attacker" ? attackerModifiedPower : defenderModifiedPower;
  const loserPower = winner === "attacker" ? defenderModifiedPower : attackerModifiedPower;
  const winnerToLoserRatio = branch === "normal" ? divide(winnerPower, loserPower) : null;
  const winnerCasualtyFraction = winnerToLoserRatio
    ? addRational(rational(5n, 100n), divide(rational(15n, 100n), winnerToLoserRatio))
    : zero;
  const uncappedLoserFraction = winnerToLoserRatio
    ? addRational(rational(25n, 100n), multiplyRational(rational(20n, 100n), winnerToLoserRatio))
    : zero;
  const loserCasualtyFraction =
    compareRational(uncappedLoserFraction, rational(80n, 100n)) > 0 ? rational(80n, 100n) : uncappedLoserFraction;
  const grouped = new Map<string, CombatUnit[]>();
  for (const unit of input.units) {
    const key = `${unit.side}:${unit.ownerId}`;
    const group = grouped.get(key) ?? [];
    group.push(unit);
    grouped.set(key, group);
  }
  const casualtyGroups = [...grouped.values()]
    .map((group) =>
      casualtiesForGroup(group, group[0]?.side === winner ? winnerCasualtyFraction : loserCasualtyFraction),
    )
    .sort((left, right) => left.side.localeCompare(right.side) || left.ownerId.localeCompare(right.ownerId));
  const lost = new Set(casualtyGroups.flatMap((group) => group.lostUnitIds));
  const survivingAttackers = attackers.filter((unit) => !lost.has(unit.id));
  const survivingAttackerUnitIds = survivingAttackers.map((unit) => unit.id).sort(compareUuidBytes);
  const carryingCapacity =
    winner === "attacker"
      ? survivingAttackers.reduce(
          (sum, unit) => sum + BigInt(rulesCatalog.units[unit.type].lootCapacity) * INTERNAL_UNITS_PER_RESOURCE,
          0n,
        )
      : 0n;
  const lootTaken = emptyLoot();
  const leaderReceived = emptyLoot();
  const leaderOverflow = emptyLoot();
  let remainingCapacity = carryingCapacity;
  if (winner === "attacker") {
    for (const resource of input.lootPriority) {
      const quarter = floorRational(rational(input.ordinaryStock[resource], 4n));
      lootTaken[resource] = minBigint(quarter, remainingCapacity);
      remainingCapacity -= lootTaken[resource];
      leaderReceived[resource] = input.leaderFreeCapacity
        ? minBigint(lootTaken[resource], input.leaderFreeCapacity[resource])
        : lootTaken[resource];
      leaderOverflow[resource] = lootTaken[resource] - leaderReceived[resource];
    }
  }
  return {
    rulesVersion: input.rulesVersion,
    winner,
    branch,
    attackerDie: input.attackerDie,
    defenderDie: input.defenderDie,
    attackerTroopPower,
    defenderTroopPower,
    wallBeforeSuppression,
    wallSuppression,
    wallAfterSuppression,
    attackerModifiedPower,
    defenderModifiedPower,
    winnerToLoserRatio,
    winnerCasualtyFraction,
    loserCasualtyFraction,
    casualtyGroups,
    survivingAttackerUnitIds,
    carryingCapacity,
    lootTaken,
    leaderReceived,
    leaderOverflow,
  };
}
