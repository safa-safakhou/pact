import { wholeUnitText } from "@pact/domain/resource-facts";
import { constructionAffordability, rulesCatalog, upgradeCost } from "@pact/domain/rules-catalog";
export type DevelopmentChoice = {
  building: string;
  from: number;
  to: number;
  minutes: number;
  iron: string;
  silver: string;
  affordable: boolean;
  before: number;
  after: number;
  benefit: string;
};
export function developmentChoices(view: {
  buildings: { kind: string; level: number }[];
  balances: Record<string, { ordinaryUnits: string; foundingAllowanceUnits: string }>;
}): DevelopmentChoice[] {
  const iron = view.balances.iron,
    silver = view.balances.silver;
  if (!iron || !silver) return [];
  const stock = {
    ordinaryIron: BigInt(iron.ordinaryUnits),
    ordinarySilver: BigInt(silver.ordinaryUnits),
    grantIron: BigInt(iron.foundingAllowanceUnits),
    grantSilver: BigInt(silver.foundingAllowanceUnits),
  };
  return (["farm", "mine", "market", "wall"] as const).flatMap((building) => {
    const from = view.buildings.find((b) => b.kind === building)?.level ?? 1;
    const to = from + 1,
      before = rulesCatalog.levels.find((l) => l.level === from),
      after = rulesCatalog.levels.find((l) => l.level === to),
      upgrade = rulesCatalog.upgrades.find((u) => u.targetLevel === to);
    if (!before || !after || !upgrade) return [];
    const key =
      building === "farm"
        ? "grainPerHour"
        : building === "mine"
          ? "ironPerHour"
          : building === "market"
            ? "silverPerHour"
            : "wallPower";
    const cost = upgradeCost(building, to);
    return [
      {
        building,
        from,
        to,
        minutes: upgrade.constructionMinutes,
        iron: wholeUnitText(cost.iron),
        silver: wholeUnitText(cost.silver),
        affordable: constructionAffordability(building, to, stock).affordable,
        before: before[key],
        after: after[key],
        benefit:
          building === "wall"
            ? "wall power"
            : building === "farm"
              ? "Grain/hour at 100% harvest"
              : building === "mine"
                ? "Iron/hour"
                : "Silver/hour",
      },
    ];
  });
}
