import { z } from "zod";
import { type Rational, rational } from "./rational.js";

export const RULES_ID = "pact-s1-v1" as const;
export const INTERNAL_UNITS_PER_RESOURCE = 600n;

const LevelSchema = z.object({
  level: z.number().int().min(1).max(6),
  grainPerHour: z.number().int().nonnegative(),
  ironPerHour: z.number().int().nonnegative(),
  silverPerHour: z.number().int().nonnegative(),
  storagePerResource: z.number().int().positive(),
  ownedTroopSlots: z.number().int().positive(),
  visitingTroopSlots: z.number().int().positive(),
  wallPower: z.number().int().nonnegative(),
});
const UnitSchema = z.object({
  iron: z.number().int().nonnegative(),
  silver: z.number().int().nonnegative(),
  trainingMinutes: z.number().int().positive(),
  grainPerHour: z.number().int().nonnegative(),
  attack: z.number().int().nonnegative(),
  defense: z.number().int().nonnegative(),
  lootCapacity: z.number().int().nonnegative(),
});
const UpgradeSchema = z.object({
  targetLevel: z.number().int().min(2).max(6),
  costMultiplier: z.number().int().positive(),
  constructionMinutes: z.number().int().positive(),
});

export const RulesCatalogSchema = z.object({
  rulesId: z.literal(RULES_ID),
  internalUnitsPerResource: z.literal(600),
  levels: z.array(LevelSchema).length(6),
  buildingBaseCosts: z.record(
    z.enum(["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"]),
    z.object({ iron: z.number().int(), silver: z.number().int() }),
  ),
  upgrades: z.array(UpgradeSchema).length(5),
  units: z.record(z.enum(["spearman", "archer", "rider", "ram"]), UnitSchema),
  founding: z.object({
    constructionIron: z.number().int(),
    constructionSilver: z.number().int(),
    upkeepGrain: z.number().int(),
    homeGuardSpearmen: z.number().int(),
  }),
  combat: z.object({
    hungryNumerator: z.literal(3),
    hungryDenominator: z.literal(4),
    dicePercent: z.tuple([z.literal(90), z.literal(94), z.literal(98), z.literal(102), z.literal(106), z.literal(110)]),
  }),
  fortuneWeights: z.object({
    iron: z.literal(1),
    silver: z.literal(2),
    grainNumerator: z.literal(1),
    grainDenominator: z.literal(4),
  }),
});

export const rulesCatalog = RulesCatalogSchema.parse({
  rulesId: RULES_ID,
  internalUnitsPerResource: 600,
  levels: [
    [1, 30, 20, 10, 600, 20, 20, 20],
    [2, 45, 30, 15, 1200, 40, 40, 40],
    [3, 65, 45, 22, 2400, 80, 80, 70],
    [4, 90, 65, 32, 4800, 140, 140, 110],
    [5, 120, 90, 45, 9600, 240, 240, 160],
    [6, 160, 120, 60, 16000, 400, 400, 220],
  ].map(
    ([
      level,
      grainPerHour,
      ironPerHour,
      silverPerHour,
      storagePerResource,
      ownedTroopSlots,
      visitingTroopSlots,
      wallPower,
    ]) => ({
      level,
      grainPerHour,
      ironPerHour,
      silverPerHour,
      storagePerResource,
      ownedTroopSlots,
      visitingTroopSlots,
      wallPower,
    }),
  ),
  buildingBaseCosts: {
    hall: { iron: 180, silver: 90 },
    farm: { iron: 40, silver: 20 },
    mine: { iron: 50, silver: 25 },
    market: { iron: 40, silver: 30 },
    storehouse: { iron: 60, silver: 30 },
    barracks: { iron: 80, silver: 40 },
    wall: { iron: 80, silver: 30 },
  },
  upgrades: [
    [2, 1, 10],
    [3, 3, 120],
    [4, 7, 480],
    [5, 15, 1440],
    [6, 25, 4320],
  ].map(([targetLevel, costMultiplier, constructionMinutes]) => ({ targetLevel, costMultiplier, constructionMinutes })),
  units: {
    spearman: { iron: 10, silver: 4, trainingMinutes: 3, grainPerHour: 1, attack: 6, defense: 10, lootCapacity: 4 },
    archer: { iron: 10, silver: 6, trainingMinutes: 4, grainPerHour: 1, attack: 8, defense: 6, lootCapacity: 4 },
    rider: { iron: 30, silver: 16, trainingMinutes: 8, grainPerHour: 3, attack: 18, defense: 12, lootCapacity: 12 },
    ram: { iron: 60, silver: 30, trainingMinutes: 12, grainPerHour: 4, attack: 2, defense: 2, lootCapacity: 1 },
  },
  founding: { constructionIron: 200, constructionSilver: 100, upkeepGrain: 80, homeGuardSpearmen: 8 },
  combat: { hungryNumerator: 3, hungryDenominator: 4, dicePercent: [90, 94, 98, 102, 106, 110] },
  fortuneWeights: { iron: 1, silver: 2, grainNumerator: 1, grainDenominator: 4 },
});

export type BuildingKind = keyof typeof rulesCatalog.buildingBaseCosts;
export type UnitKind = keyof typeof rulesCatalog.units;

export function wholeResources(value: bigint | number): bigint {
  return BigInt(value) * INTERNAL_UNITS_PER_RESOURCE;
}

export function hourlyRatePerMinute(hourlyWholeResources: bigint | number): bigint {
  return wholeResources(hourlyWholeResources) / 60n;
}

export function upgradeCost(building: BuildingKind, targetLevel: number): { iron: bigint; silver: bigint } {
  const base = rulesCatalog.buildingBaseCosts[building];
  const upgrade = rulesCatalog.upgrades.find((entry) => entry.targetLevel === targetLevel);
  if (!upgrade) throw new Error("INVALID_TARGET_LEVEL");
  return {
    iron: wholeResources(base.iron * upgrade.costMultiplier),
    silver: wholeResources(base.silver * upgrade.costMultiplier),
  };
}

export function fortuneWeights(): Record<"iron" | "silver" | "grain", Rational> {
  return { iron: rational(1n), silver: rational(2n), grain: rational(1n, 4n) };
}
