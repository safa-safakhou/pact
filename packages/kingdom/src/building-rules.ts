import { type BuildingKind, rulesCatalog, upgradeCost } from "@pact/domain";
import { timedJobDeadline } from "@pact/world";

export type BuildingLevels = Readonly<Record<BuildingKind, number>>;
export type UpgradeCheck = "ready" | "invalid_level" | "not_next_level" | "hall_limit" | "hall_prerequisite";

export function checkUpgrade(levels: BuildingLevels, kind: BuildingKind, targetLevel: number): UpgradeCheck {
  if (!Number.isInteger(targetLevel) || targetLevel < 2 || targetLevel > rulesCatalog.construction.maxLevel) {
    return "invalid_level";
  }
  if (targetLevel !== levels[kind] + 1) return "not_next_level";
  if (kind === "hall") {
    if (levels.farm < targetLevel || levels.barracks < targetLevel || levels.storehouse < targetLevel - 1) {
      return "hall_prerequisite";
    }
  } else if (targetLevel > levels.hall + 1) {
    return "hall_limit";
  }
  return "ready";
}

export function upgradeQuote(kind: BuildingKind, targetLevel: number, startGameTimeMs: number) {
  const upgrade = rulesCatalog.upgrades.find((candidate) => candidate.targetLevel === targetLevel);
  if (!upgrade) throw new Error("INVALID_TARGET_LEVEL");
  return {
    ...upgradeCost(kind, targetLevel),
    constructionMinutes: upgrade.constructionMinutes,
    dueGameTimeMs: timedJobDeadline(startGameTimeMs, upgrade.constructionMinutes),
  };
}
