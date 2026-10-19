import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { rulesCatalog } from "@pact/domain";
export const design = JSON.parse(readFileSync(new URL("./design.json", import.meta.url), "utf8")) as {
  rulesId: string;
  seeds: { development: number[]; heldOut: number[] };
  scenarios: {
    id: string;
    eligibility: string;
    requiresMessage?: boolean;
    fixture?: {
      lenderHall: number;
      hostBarracks: number;
      lenderBarracks: number;
      enemyBarracks: number;
      helpSpearmen: number;
      attackerSpearmen: number;
      attackerArchers: number;
      hostOrdinaryGrain: number;
      ordinaryIron: number;
      ordinarySilver: number;
      hostSilverBond: number;
      durationHours: 1;
      offerAtMinute: number;
      acceptAtMinute: number;
      earlyRecallAtMinute: number | null;
      endMinute: number;
      entropyByte: number;
      permissions: string[];
      executor: string;
      randomness: string;
    };
  }[];
  oneFactor: string[];
  interactions: string[][];
};
export function independentPlan() {
  if (design.rulesId !== rulesCatalog.rulesId) throw Error("RULES_CHANGED_REVIEW_DESIGN");
  if (design.seeds.development.some((n) => design.seeds.heldOut.includes(n))) throw Error("HELD_OUT_OVERLAP");
  return Object.entries(design.seeds).flatMap(([split, seeds]) =>
    seeds.flatMap((seed) =>
      design.scenarios.flatMap((scenario) => {
        const hash = createHash("sha256").update(`${scenario.id}:${seed}`).digest("hex");
        return ["baseline", ...design.oneFactor, ...design.interactions.map((v) => v.join("+"))].map((arm, i) => ({
          replicaId: `${scenario.id}:${seed}:${arm}`,
          worldIsolationRequired: true,
          split,
          seed,
          scenario: scenario.id,
          arm,
          orderKey: hash.slice(0, 16),
          order: (i + parseInt(hash.slice(0, 4), 16)) % (1 + design.oneFactor.length + design.interactions.length),
          goalEligibility: scenario.eligibility,
        }));
      }),
    ),
  );
}
