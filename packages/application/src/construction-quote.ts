import {
  type BuildingKind,
  type BuildingLevels,
  checkUpgrade,
  constructionAffordability,
  parseInternalUnits,
  RULES_ID,
  upgradeCost,
} from "@pact/domain";
import type { OwnerKingdomView } from "@pact/kingdom";

/** Server projection of current authoritative inputs, not a reservation or guarantee. */
export function constructionAdmissionQuote(
  view: OwnerKingdomView,
  building: BuildingKind,
  targetLevel: number,
  slot: 1 | 2,
) {
  const cost = upgradeCost(building, targetLevel),
    levels = Object.fromEntries(view.buildings.map((b) => [b.kind, b.level])) as unknown as BuildingLevels;
  const prerequisite = checkUpgrade(levels, building, targetLevel);
  const stock = constructionAffordability(building, targetLevel, {
    ordinaryIron: parseInternalUnits(view.balances.iron.ordinaryUnits),
    ordinarySilver: parseInternalUnits(view.balances.silver.ordinaryUnits),
    grantIron: parseInternalUnits(view.balances.iron.foundingAllowanceUnits),
    grantSilver: parseInternalUnits(view.balances.silver.foundingAllowanceUnits),
  });
  const authority = view.authority,
    admission: string[] = [],
    start: string[] = [];
  if (view.worldStatus !== "active") admission.push("WORLD_PAUSED");
  if (prerequisite === "invalid_level" || prerequisite === "not_next_level") admission.push("INVALID_LEVEL");
  if (view.builders.some((b) => b.kind === building && b.instructionId)) admission.push("BUILDING_BUSY");
  const builder = view.builders.find((b) => b.slot === slot);
  if (builder?.state === "waiting") admission.push("SLOT_BUSY");
  if (builder?.state === "active") start.push("BUILDER_ACTIVE");
  if (prerequisite !== "ready" && !["invalid_level", "not_next_level"].includes(prerequisite))
    start.push("PREREQUISITE");
  if (!stock.affordable) start.push("INSUFFICIENT_STOCK");
  if (authority && !authority.allowedActions.includes("building.queue")) admission.push("FORBIDDEN");
  const resources = Object.fromEntries(
    (["iron", "silver"] as const).map((asset) => {
      const a = authority?.resources[asset],
        required = cost[asset],
        ordinary = asset === "iron" ? stock.ordinaryIronSpent : stock.ordinarySilverSpent;
      if (authority && required > BigInt(a?.headroomUnits ?? "0")) admission.push(`INSUFFICIENT_ALLOWANCE:${asset}`);
      const floor = BigInt(a?.reserveFloorUnits ?? "0"),
        ordinaryAvailable = BigInt(view.balances[asset].ordinaryUnits);
      if (floor > 0n && ordinaryAvailable - ordinary < floor) start.push(`RESERVE_FLOOR:${asset}`);
      let headroom =
        BigInt(a?.ceilingUnits ?? "0") -
        BigInt(a?.legacySpentUnits ?? "0") -
        BigInt(a?.rollingSpentUnits ?? "0") -
        BigInt(a?.reservedUnits ?? "0");
      let reliefAt: number | null = authority && headroom >= required ? view.asOfGameTimeMs : null;
      for (const release of a?.releaseSchedule ?? []) {
        headroom += BigInt(release.units);
        if (reliefAt === null && headroom >= required) reliefAt = release.gameTimeMs;
      }
      return [
        asset,
        {
          requiredReservationUnits: required.toString(),
          ordinaryStockUnits: view.balances[asset].ordinaryUnits,
          foundingAllowanceUnits: view.balances[asset].foundingAllowanceUnits,
          lockedUnits: view.balances[asset].lockedUnits,
          stockVersion: view.balances[asset].version,
          ordinaryDebitAtStartUnits: ordinary.toString(),
          allowanceDebitAtStartUnits: (asset === "iron" ? stock.grantIronSpent : stock.grantSilverSpent).toString(),
          authority: a ?? null,
          conditionalAuthorityReliefGameTimeMs: reliefAt,
          reliefAssumption:
            "No new spends/reservations; reservations do not expire on a timer. Paused game time has no wall-clock ETA.",
          exceedsFullCeiling: authority ? required > BigInt(a?.ceilingUnits ?? "0") : null,
        },
      ];
    }),
  );
  return {
    schemaVersion: "pact.construction-quote.v1",
    rulesId: RULES_ID,
    building,
    targetLevel,
    slot,
    asOfGameTimeMs: view.asOfGameTimeMs,
    committedTickSequence: view.committedTickSequence,
    lastCommittedEventId: view.lastCommittedEventId,
    mandateVersion: authority?.mandateVersion ?? null,
    worldStatus: view.worldStatus,
    resources,
    prerequisite,
    admission: { known: !!authority, allowed: authority ? admission.length === 0 : null, blockers: admission },
    immediateStart: { possible: admission.length === 0 && start.length === 0 && !!authority, blockers: start },
    routes: {
      agent: "Current delegated action and sufficient full reservation required; quote never grants permission.",
      human: "Use an exact human approval for the chosen action if authority is insufficient; never automatic.",
    },
    meaning:
      "Queue admission reserves authority, not stock. Waiting can be legitimate; stocks/prerequisites/builders/floors are rechecked at start. Other spending may change this snapshot. Only actual settled lifecycle proves completion.",
  };
}
