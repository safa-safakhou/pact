import { rulesCatalog, upgradeCost, wholeUnitText } from "@pact/domain";
import type { OwnerKingdomView } from "@pact/kingdom";
/** Rules-derived capability limits, not a chosen goal, reservation or permission grant. */
export function goalFeasibility(view: OwnerKingdomView) {
  const authority = view.authority;
  return {
    schemaVersion: "pact.goal-feasibility.v1",
    rulesId: rulesCatalog.rulesId,
    asOfGameTimeMs: view.asOfGameTimeMs,
    mandateVersion: authority?.mandateVersion ?? null,
    currentHall: view.buildings.find((b) => b.kind === "hall")?.level ?? null,
    hallUpgrades: rulesCatalog.upgrades.map(({ targetLevel }) => {
      const cost = upgradeCost("hall", targetLevel);
      return {
        targetLevel,
        costWhole: { iron: wholeUnitText(cost.iron), silver: wholeUnitText(cost.silver) },
        exceedsFullCeiling: authority
          ? (["iron", "silver"] as const).filter((r) => cost[r] > BigInt(authority.resources[r]?.ceilingUnits ?? "0"))
          : null,
      };
    }),
    comparisonBands:
      "Hall I–II / III–IV / V–VI are comparison filters, not promotion payouts or protected combat leagues.",
    unsupported: ["territory expansion", "autonomous Court creation/joining/publication or political signatures"],
    ownerDecision:
      "If a desired action exceeds delegated authority: constrain the goal, request an exact human approval, or ask the human to review bounded ceilings. Never self-authorize. No alternative has been selected here.",
    pathChecks:
      "Costs are per Hall upgrade, not total path cost. First reach every preceding Hall and prerequisite level, storage, stock/provenance, builders, floors and actual rolling headroom; use current construction quotes. Waiting does not raise the full ceiling. Trading changes stock, not permission.",
  };
}

/** Minimum proposed ceiling for an explicitly chosen 24-game-hour action set; no database write. */
export function proposedAuthorityMinimum(input: {
  rollingSpentUnits: bigint;
  legacySpentUnits: bigint;
  existingReservedUnits: bigint;
  newReservationsUnits: bigint[];
}) {
  const all = [
    input.rollingSpentUnits,
    input.legacySpentUnits,
    input.existingReservedUnits,
    ...input.newReservationsUnits,
  ];
  if (all.some((n) => n < 0n)) throw Error("NEGATIVE_AUTHORITY_INPUT");
  return (
    input.rollingSpentUnits +
    input.legacySpentUnits +
    input.existingReservedUnits +
    input.newReservationsUnits.reduce((a, b) => a + b, 0n)
  );
}
