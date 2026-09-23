import { z } from "zod";
import { multiplyRational, type Rational, rational } from "./rational.js";

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
    allowanceExpiryGameDays: z.literal(7),
  }),
  hallUnlocks: z.object({ archers: z.literal(2), riders: z.literal(3), lending: z.literal(3), rams: z.literal(4) }),
  combat: z.object({
    hungryNumerator: z.literal(3),
    hungryDenominator: z.literal(4),
    dicePercent: z.tuple([z.literal(90), z.literal(94), z.literal(98), z.literal(102), z.literal(106), z.literal(110)]),
    counterBonusPercent: z.literal(50),
    wallSuppressionPerRam: z.literal(30),
    hungryWallSuppressionNumerator: z.literal(45),
    hungryWallSuppressionDenominator: z.literal(2),
    winnerBaseCasualtyPercent: z.literal(5),
    winnerRatioCasualtyPercent: z.literal(15),
    loserBaseCasualtyPercent: z.literal(25),
    loserRatioCasualtyPercent: z.literal(20),
    loserMaximumCasualtyPercent: z.literal(80),
  }),
  fortuneWeights: z.object({
    iron: z.literal(1),
    silver: z.literal(2),
    grainNumerator: z.literal(1),
    grainDenominator: z.literal(4),
  }),
  harvestPercentByWeek: z.tuple([
    z.literal(100),
    z.literal(100),
    z.literal(90),
    z.literal(80),
    z.literal(80),
    z.literal(100),
  ]),
  construction: z.object({
    builderSlots: z.literal(2),
    waitingPerBuilder: z.literal(1),
    activeCancelRefundPercent: z.literal(50),
    maxLevel: z.literal(6),
  }),
  training: z.object({
    queueSlots: z.literal(1),
    maxBatchUnits: z.literal(40),
    remainingCancelRefundPercent: z.literal(80),
  }),
  upkeep: z.object({
    hungryPowerPercent: z.literal(75),
    recoveryFundedMinutes: z.literal(60),
    warningUnderfundedMinutes: z.literal(120),
    firstDesertionUnderfundedMinutes: z.literal(180),
    desertionIntervalMinutes: z.literal(60),
    desertionPercent: z.literal(5),
  }),
  supply: z.object({
    durationHours: z.tuple([z.literal(1), z.literal(6), z.literal(24), z.literal(72)]),
    noticeHours: z.tuple([z.literal(0), z.literal(1), z.literal(6)]),
    maxIncoming: z.literal(8),
    maxOutgoing: z.literal(8),
    defaultOfferExpiryMinutes: z.literal(15),
    minOfferExpiryMinutes: z.literal(5),
    maxOfferExpiryMinutes: z.literal(60),
    maxBondFlowHours: z.literal(6),
    totalBondCapacityPercent: z.literal(10),
    maxDailyTransfers: z.literal(24),
  }),
  scouting: z.object({
    silverCost: z.literal(10),
    grainCost: z.literal(5),
    ordinarySpearmen: z.literal(2),
    durationMinutes: z.literal(10),
    troopBandUpperBounds: z.tuple([
      z.literal(0),
      z.literal(10),
      z.literal(25),
      z.literal(50),
      z.literal(100),
      z.literal(200),
      z.literal(400),
    ]),
    resourceBandUpperBounds: z.tuple([z.literal(0), z.literal(100), z.literal(500), z.literal(1500), z.literal(5000)]),
  }),
  garrison: z.object({
    minimumLenderHallLevel: z.literal(3),
    durationHours: z.tuple([z.literal(1), z.literal(6), z.literal(24)]),
    maxLentDetachments: z.literal(4),
    maxHostedDetachments: z.literal(4),
  }),
  raid: z.object({
    maxAttackers: z.literal(3),
    minimumOrdinaryUnits: z.literal(8),
    baseGrainProvisions: z.literal(5),
    upkeepProvisionHours: z.literal(2),
    durationMinutes: z.literal(20),
    lockBeforeDeadlineMinutes: z.literal(5),
    lootPercent: z.literal(25),
    defaultLootPriority: z.tuple([z.literal("silver"), z.literal("iron"), z.literal("grain")]),
  }),
  actionLimits: z.object({
    raidCharges: z.literal(3),
    raidRegenerationHours: z.literal(8),
    scoutCharges: z.literal(4),
    scoutRegenerationHours: z.literal(6),
    openNegotiations: z.literal(12),
    outgoingMessagesPerDay: z.literal(96),
    messageCodePoints: z.literal(400),
    offerActionsPerDay: z.literal(48),
    coldContactsPerDay: z.literal(8),
    coldContactSilver: z.literal(2),
    activeNotices: z.literal(2),
    noticeLifetimeHours: z.literal(24),
    publicPostsPerDay: z.literal(6),
    stateReadsPerHour: z.literal(120),
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
  founding: {
    constructionIron: 200,
    constructionSilver: 100,
    upkeepGrain: 80,
    homeGuardSpearmen: 8,
    allowanceExpiryGameDays: 7,
  },
  hallUnlocks: { archers: 2, riders: 3, lending: 3, rams: 4 },
  combat: {
    hungryNumerator: 3,
    hungryDenominator: 4,
    dicePercent: [90, 94, 98, 102, 106, 110],
    counterBonusPercent: 50,
    wallSuppressionPerRam: 30,
    hungryWallSuppressionNumerator: 45,
    hungryWallSuppressionDenominator: 2,
    winnerBaseCasualtyPercent: 5,
    winnerRatioCasualtyPercent: 15,
    loserBaseCasualtyPercent: 25,
    loserRatioCasualtyPercent: 20,
    loserMaximumCasualtyPercent: 80,
  },
  fortuneWeights: { iron: 1, silver: 2, grainNumerator: 1, grainDenominator: 4 },
  harvestPercentByWeek: [100, 100, 90, 80, 80, 100],
  construction: { builderSlots: 2, waitingPerBuilder: 1, activeCancelRefundPercent: 50, maxLevel: 6 },
  training: { queueSlots: 1, maxBatchUnits: 40, remainingCancelRefundPercent: 80 },
  upkeep: {
    hungryPowerPercent: 75,
    recoveryFundedMinutes: 60,
    warningUnderfundedMinutes: 120,
    firstDesertionUnderfundedMinutes: 180,
    desertionIntervalMinutes: 60,
    desertionPercent: 5,
  },
  supply: {
    durationHours: [1, 6, 24, 72],
    noticeHours: [0, 1, 6],
    maxIncoming: 8,
    maxOutgoing: 8,
    defaultOfferExpiryMinutes: 15,
    minOfferExpiryMinutes: 5,
    maxOfferExpiryMinutes: 60,
    maxBondFlowHours: 6,
    totalBondCapacityPercent: 10,
    maxDailyTransfers: 24,
  },
  scouting: {
    silverCost: 10,
    grainCost: 5,
    ordinarySpearmen: 2,
    durationMinutes: 10,
    troopBandUpperBounds: [0, 10, 25, 50, 100, 200, 400],
    resourceBandUpperBounds: [0, 100, 500, 1500, 5000],
  },
  garrison: { minimumLenderHallLevel: 3, durationHours: [1, 6, 24], maxLentDetachments: 4, maxHostedDetachments: 4 },
  raid: {
    maxAttackers: 3,
    minimumOrdinaryUnits: 8,
    baseGrainProvisions: 5,
    upkeepProvisionHours: 2,
    durationMinutes: 20,
    lockBeforeDeadlineMinutes: 5,
    lootPercent: 25,
    defaultLootPriority: ["silver", "iron", "grain"],
  },
  actionLimits: {
    raidCharges: 3,
    raidRegenerationHours: 8,
    scoutCharges: 4,
    scoutRegenerationHours: 6,
    openNegotiations: 12,
    outgoingMessagesPerDay: 96,
    messageCodePoints: 400,
    offerActionsPerDay: 48,
    coldContactsPerDay: 8,
    coldContactSilver: 2,
    activeNotices: 2,
    noticeLifetimeHours: 24,
    publicPostsPerDay: 6,
    stateReadsPerHour: 120,
  },
});

export function loadRulesFixture(json: string): z.infer<typeof RulesCatalogSchema> {
  return RulesCatalogSchema.parse(JSON.parse(json));
}

export type BuildingKind = keyof typeof rulesCatalog.buildingBaseCosts;
export type UnitKind = keyof typeof rulesCatalog.units;

export function wholeResources(value: bigint | number): bigint {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0))
    throw new Error("UNSAFE_RESOURCE_AMOUNT");
  if (typeof value === "bigint" && value < 0n) throw new Error("NEGATIVE_RESOURCE_AMOUNT");
  return BigInt(value) * INTERNAL_UNITS_PER_RESOURCE;
}

export function hourlyRatePerMinute(hourlyWholeResources: bigint | number): bigint {
  return wholeResources(hourlyWholeResources) / 60n;
}

export function parseInternalUnits(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error("INVALID_INTERNAL_UNITS");
  return BigInt(value);
}

export function serializeInternalUnits(value: bigint): string {
  if (value < 0n) throw new Error("NEGATIVE_RESOURCE_AMOUNT");
  return value.toString();
}

export function roundDownPercent(value: bigint, percent: number): bigint {
  if (value < 0n || !Number.isSafeInteger(percent) || percent < 0 || percent > 100)
    throw new Error("INVALID_PERCENTAGE");
  return (value * BigInt(percent)) / 100n;
}

export function harvestProductionPerMinute(farmLevel: number, week: number): bigint {
  const level = rulesCatalog.levels.find((entry) => entry.level === farmLevel);
  const percent = rulesCatalog.harvestPercentByWeek[week - 1];
  if (!level || percent === undefined) throw new Error("INVALID_HARVEST_LEVEL_OR_WEEK");
  return roundDownPercent(hourlyRatePerMinute(level.grainPerHour), percent);
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

export function constructionAffordability(
  building: BuildingKind,
  targetLevel: number,
  stock: { ordinaryIron: bigint; ordinarySilver: bigint; grantIron: bigint; grantSilver: bigint },
): {
  affordable: boolean;
  grantIronSpent: bigint;
  grantSilverSpent: bigint;
  ordinaryIronSpent: bigint;
  ordinarySilverSpent: bigint;
} {
  const cost = upgradeCost(building, targetLevel);
  if (Object.values(stock).some((amount) => amount < 0n)) throw new Error("NEGATIVE_RESOURCE_AMOUNT");
  const grantIronSpent = stock.grantIron < cost.iron ? stock.grantIron : cost.iron;
  const grantSilverSpent = stock.grantSilver < cost.silver ? stock.grantSilver : cost.silver;
  const ordinaryIronSpent = cost.iron - grantIronSpent;
  const ordinarySilverSpent = cost.silver - grantSilverSpent;
  return {
    affordable: stock.ordinaryIron >= ordinaryIronSpent && stock.ordinarySilver >= ordinarySilverSpent,
    grantIronSpent,
    grantSilverSpent,
    ordinaryIronSpent,
    ordinarySilverSpent,
  };
}

export function counterAdjustedPower(input: {
  count: bigint;
  baseStat: bigint;
  opposingCountered: bigint;
  opposingNonRam: bigint;
  hungry: boolean;
}): Rational {
  const { count, baseStat, opposingCountered, opposingNonRam, hungry } = input;
  if (
    [count, baseStat, opposingCountered, opposingNonRam].some((value) => value < 0n) ||
    opposingCountered > opposingNonRam
  ) {
    throw new Error("INVALID_POWER_INPUT");
  }
  const base = rational(count * baseStat);
  const counter =
    opposingNonRam === 0n ? rational(1n) : rational(2n * opposingNonRam + opposingCountered, 2n * opposingNonRam);
  return multiplyRational(multiplyRational(base, counter), hungry ? rational(3n, 4n) : rational(1n));
}

export function fortuneWeights(): Record<"iron" | "silver" | "grain", Rational> {
  return { iron: rational(1n), silver: rational(2n), grain: rational(1n, 4n) };
}
