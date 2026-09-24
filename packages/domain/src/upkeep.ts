import { compareUuidBytes } from "./rational.js";
import { hourlyRatePerMinute, rulesCatalog } from "./rules-catalog.js";

export type UpkeepTroopKind = keyof typeof rulesCatalog.units;
export interface UpkeepTroop {
  id: string;
  ownerKingdomId: string;
  hostKingdomId: string;
  placement: "home" | "visiting" | "scouting" | "attacking";
  type: UpkeepTroopKind;
}

const typeOrder: UpkeepTroopKind[] = ["spearman", "archer", "rider", "ram"];

export function foodPayer(troop: UpkeepTroop): string {
  return troop.placement === "visiting" ? troop.hostKingdomId : troop.ownerKingdomId;
}

export function upkeepPerMinute(troops: readonly UpkeepTroop[]): bigint {
  return troops.reduce((sum, troop) => sum + hourlyRatePerMinute(rulesCatalog.units[troop.type].grainPerHour), 0n);
}

/** Selects from a single food-payer/original-owner group, independent of UI stacks. */
export function desertingTroopIds(troops: readonly UpkeepTroop[]): string[] {
  if (troops.length === 0) return [];
  const losses = Math.min(troops.length, Math.ceil((troops.length * rulesCatalog.upkeep.desertionPercent) / 100));
  const byType = new Map(typeOrder.map((type) => [type, troops.filter((troop) => troop.type === type)]));
  const quotas = new Map(
    typeOrder.map((type) => [type, Math.floor((losses * (byType.get(type)?.length ?? 0)) / troops.length)]),
  );
  let remaining = losses - [...quotas.values()].reduce((sum, value) => sum + value, 0);
  const ranked = [...typeOrder].sort((left, right) => {
    const leftRemainder = (losses * (byType.get(left)?.length ?? 0)) % troops.length;
    const rightRemainder = (losses * (byType.get(right)?.length ?? 0)) % troops.length;
    return rightRemainder - leftRemainder || typeOrder.indexOf(left) - typeOrder.indexOf(right);
  });
  for (const type of ranked) {
    if (remaining === 0) break;
    quotas.set(type, (quotas.get(type) ?? 0) + 1);
    remaining -= 1;
  }
  return typeOrder.flatMap((type) =>
    (byType.get(type) ?? [])
      .sort((left, right) => compareUuidBytes(left.id, right.id))
      .slice(0, quotas.get(type))
      .map((troop) => troop.id),
  );
}
