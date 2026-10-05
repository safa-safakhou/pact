import { type BuildingKind, rulesCatalog, upgradeCost } from "@pact/domain";
import { timedJobDeadline } from "@pact/world";

export { type BuildingLevels, checkUpgrade, type UpgradeCheck } from "@pact/domain";

export function upgradeQuote(kind: BuildingKind, targetLevel: number, startGameTimeMs: number) {
  const upgrade = rulesCatalog.upgrades.find((candidate) => candidate.targetLevel === targetLevel);
  if (!upgrade) throw new Error("INVALID_TARGET_LEVEL");
  return {
    ...upgradeCost(kind, targetLevel),
    constructionMinutes: upgrade.constructionMinutes,
    dueGameTimeMs: timedJobDeadline(startGameTimeMs, upgrade.constructionMinutes),
  };
}
