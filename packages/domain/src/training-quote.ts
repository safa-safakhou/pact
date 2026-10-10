import { rulesCatalog, type UnitKind, wholeResources } from "./rules-catalog.js";

export function trainingRequiredHall(kind: UnitKind): number {
  if (kind === "archer") return rulesCatalog.hallUnlocks.archers;
  if (kind === "rider") return rulesCatalog.hallUnlocks.riders;
  if (kind === "ram") return rulesCatalog.hallUnlocks.rams;
  return 1;
}
/** The same unit definition used by settlement; ordinary stock only, never founding grants. */
export function trainingQuote(kind: UnitKind, count: number) {
  if (!Number.isSafeInteger(count) || count < 1 || count > rulesCatalog.training.maxBatchUnits)
    throw new Error("INVALID_TRAINING_COUNT");
  const unit = rulesCatalog.units[kind];
  if (!unit) throw new Error("INVALID_TROOP");
  return {
    iron: wholeResources(unit.iron) * BigInt(count),
    silver: wholeResources(unit.silver) * BigInt(count),
    additionalGrainPerMinute: (wholeResources(unit.grainPerHour) * BigInt(count)) / 60n,
    unitMinutes: unit.trainingMinutes,
    batchMinutes: unit.trainingMinutes * count,
    requiredHall: trainingRequiredHall(kind),
  };
}
