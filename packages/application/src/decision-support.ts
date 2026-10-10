import type { GameAction } from "@pact/contracts";
import {
  type BuildingKind,
  type BuildingLevels,
  checkUpgrade,
  constructionAffordability,
  hourlyRatePerMinute,
  parseInternalUnits,
  RULES_ID,
  rulesCatalog,
  trainingQuote,
  type UnitKind,
  upgradeCost,
} from "@pact/domain";
import {
  type OwnerKingdomView,
  type SocialOverview,
  type SocialOverviewReader,
  supplyExposure,
  type WorldViewService,
} from "@pact/kingdom";

export interface DecisionCandidate {
  id: string;
  kind: "wait" | "read" | "action";
  label: string;
  action?: GameAction & { expectedVersion?: number };
  read?: { name: string; args: Record<string, unknown> };
  checks: Record<string, unknown>;
  effects: Record<string, unknown>;
}
const amounts = (value: Record<string, bigint>) =>
  Object.fromEntries(Object.entries(value).map(([key, n]) => [key, n.toString()]));
/** Optional conveniences from the caller's authorized facts. No writes, hidden opponent state or ranking. */
export function calculateDecisionSupport(view: OwnerKingdomView, social?: SocialOverview | null, proposalOffset = 0) {
  if (!Number.isSafeInteger(proposalOffset) || proposalOffset < 0 || proposalOffset > 10000)
    throw new Error("INVALID_PROPOSAL_OFFSET");
  if (view.audience !== "owner") throw new Error("OWNER_VIEW_REQUIRED");
  if (social && social.kingdomId !== view.profile.kingdomId) throw new Error("OBSERVATION_OWNER_MISMATCH");
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        clock: view.asOfGameTimeMs,
        tick: view.committedTickSequence,
        balances: view.balances,
        buildings: view.buildings,
        builders: view.builders,
        troops: view.troops,
        training: view.training,
        charges: view.charges,
        upkeep: view.upkeep,
        contracts: view.contracts,
        offers: social?.supplyOffers,
      }),
    )
    .digest("hex")
    .slice(0, 32);
  const stamp = `${view.profile.kingdomId}:${fingerprint}`;
  const militaryKnownInputs = {
    troops: view.troops,
    unitDefinitions: rulesCatalog.units,
    wallPower: rulesCatalog.levels[(view.buildings.find((b) => b.kind === "wall")?.level ?? 1) - 1]?.wallPower,
    hungry: view.upkeep.hungry,
    modifiers: rulesCatalog.combat,
    meaning:
      "Authorized observed inputs, not a battle forecast. Home Guard cannot attack; placement/eligibility/locks are checked by the command handler. Opponent private counts and future dice are unknown.",
  };
  const candidates: DecisionCandidate[] = [
    { id: `${stamp}:wait`, kind: "wait", label: "Wait without a command", checks: {}, effects: { commitment: false } },
    {
      id: `${stamp}:read`,
      kind: "read",
      label: "Refresh authorized world facts",
      read: { name: "pact_world_read_v1", args: {} },
      checks: {},
      effects: { commitment: false },
    },
  ];
  const levels = Object.fromEntries(view.buildings.map((b) => [b.kind, b.level])) as unknown as BuildingLevels;
  for (const kind of Object.keys(rulesCatalog.buildingBaseCosts).sort() as BuildingKind[]) {
    const level = levels[kind];
    if (!Number.isInteger(level)) throw new Error("BUILDING_STATE_INCOMPLETE");
    if (level >= rulesCatalog.construction.maxLevel) continue;
    const target = level + 1,
      cost = upgradeCost(kind, target);
    const levelRule = rulesCatalog.levels[target - 1];
    const knownCompletionEffect =
      kind === "farm"
        ? {
            baseGrainPerHourWhole: levelRule?.grainPerHour,
            assumption: "Baseline before harvest modifiers; the future harvest may differ.",
          }
        : kind === "mine"
          ? { ironPerHourWhole: levelRule?.ironPerHour }
          : kind === "market"
            ? { silverPerHourWhole: levelRule?.silverPerHour }
            : kind === "storehouse"
              ? { storagePerResourceWhole: levelRule?.storagePerResource }
              : kind === "barracks"
                ? { ownedTroopSlots: levelRule?.ownedTroopSlots, visitingTroopSlots: levelRule?.visitingTroopSlots }
                : kind === "wall"
                  ? { wallPower: levelRule?.wallPower }
                  : { hallLevel: target, unlockThresholds: rulesCatalog.hallUnlocks };
    const affordability = constructionAffordability(kind, target, {
      ordinaryIron: parseInternalUnits(view.balances.iron.ordinaryUnits),
      ordinarySilver: parseInternalUnits(view.balances.silver.ordinaryUnits),
      grantIron: parseInternalUnits(view.balances.iron.foundingAllowanceUnits),
      grantSilver: parseInternalUnits(view.balances.silver.foundingAllowanceUnits),
    });
    for (const slot of [1, 2] as const)
      candidates.push({
        id: `${stamp}:build:${kind}:${target}:${slot}`,
        kind: "action",
        label: `Queue ${kind} level ${target} in builder ${slot}`,
        action: { kind: "game.building.queue", building: kind, targetLevel: target, slot },
        checks: {
          prerequisite: checkUpgrade(levels, kind, target),
          affordable: affordability.affordable,
          builderObservedState: view.builders.find((b) => b.slot === slot)?.state ?? null,
          buildingAlreadyQueued: view.builders.some((b) => b.kind === kind && b.instructionId),
          authority: "Revalidated by shared command handler; not granted by this quote.",
        },
        effects: {
          knownCompletionEffect,
          costMarkedUnits: amounts(cost),
          ordinarySpentMarkedUnits: {
            iron: affordability.ordinaryIronSpent.toString(),
            silver: affordability.ordinarySilverSpent.toString(),
          },
          allowanceSpentMarkedUnits: {
            iron: affordability.grantIronSpent.toString(),
            silver: affordability.grantSilverSpent.toString(),
          },
          constructionMinutes: rulesCatalog.upgrades.find((u) => u.targetLevel === target)?.constructionMinutes,
          completion: "Only after funding, prerequisites and available builder; queueing is not completion.",
        },
      });
  }
  const owned = view.troops
    .filter((t) => t.ownerKingdomId === view.profile.kingdomId)
    .reduce((sum, t) => sum + t.count, 0);
  for (const type of Object.keys(rulesCatalog.units).sort() as UnitKind[]) {
    const quote = trainingQuote(type, 1);
    candidates.push({
      id: `${stamp}:train:${type}:1`,
      kind: "action",
      label: `Train one ${type}`,
      action: { kind: "game.training.queue", type, count: 1 },
      checks: {
        requiredHall: quote.requiredHall,
        hallUnlocked: levels.hall >= quote.requiredHall,
        queueFree: view.training.length === 0,
        capacityAvailable: owned + 1 <= (rulesCatalog.levels[levels.barracks - 1]?.ownedTroopSlots ?? 0),
        affordable:
          parseInternalUnits(view.balances.iron.ordinaryUnits) >= quote.iron &&
          parseInternalUnits(view.balances.silver.ordinaryUnits) >= quote.silver,
        authority: "Not checked by a read; shared handler validates mandate/reserves.",
      },
      effects: {
        costMarkedUnits: amounts({ iron: quote.iron, silver: quote.silver }),
        usesFoundingAllowance: false,
        trainingMinutes: quote.batchMinutes,
        additionalGrainPerMinuteMarkedUnits: quote.additionalGrainPerMinute.toString(),
      },
    });
  }
  const observedProposals = (social?.supplyOffers ?? []).filter(
    (o) => o.status === "open" && BigInt(o.expiresGameTimeMs) > BigInt(view.asOfGameTimeMs),
  );
  const proposals = observedProposals.slice(proposalOffset, proposalOffset + 12).map((o) => {
    const isA = o.kingdomA === view.profile.kingdomId,
      outgoing = isA ? o.terms.aToB : o.terms.bToA,
      bond = isA ? o.terms.aBond : o.terms.bBond;
    candidates.push({
      id: `${stamp}:decline:${o.id}:${o.version}`,
      kind: "action",
      label: `Decline/withdraw proposal ${o.id} version ${o.version}`,
      action: { kind: "game.supply.withdraw", offerId: o.id, expectedVersion: o.version },
      checks: { observedVersion: o.version, refreshBeforeCommand: true, authority: "Not granted by this quote." },
      effects: { proposalClosed: true, contractActivated: false },
    });
    candidates.push({
      id: `${stamp}:read-offer:${o.id}:${o.version}`,
      kind: "read",
      label: "Read retained terms/signatures before deciding",
      read: { name: "pact_conversation_history_v2", args: { kingdomId: o.kingdomId } },
      checks: {},
      effects: { commitment: false },
    });
    return {
      offerId: o.id,
      version: o.version,
      expiresGameTimeMs: o.expiresGameTimeMs,
      youSend: outgoing,
      youReceive: isA ? o.terms.bToA : o.terms.aToB,
      bond,
      maximumAuthorityExposureMarkedUnits: amounts(supplyExposure(outgoing, bond, o.terms.durationHours)),
      outgoingPerMinuteMarkedUnits: outgoing ? hourlyRatePerMinute(outgoing.wholePerHour).toString() : "0",
      incomingDelivery: "Conditional on peer stock and contract activation; never guaranteed.",
      signedBy: o.signedBy,
    };
  });
  return {
    schemaVersion: "pact.decision-support.v2",
    rulesId: RULES_ID,
    kingdomId: view.profile.kingdomId,
    asOfGameTimeMs: view.asOfGameTimeMs,
    committedTickSequence: view.committedTickSequence,
    worldStatus: view.worldStatus,
    markedUnitsPerWhole: "600",
    meaning:
      "Optional, unranked conveniences. Not an action whitelist, permission, economic guarantee or strategic objective. Direct schema-valid authorized commands remain available.",
    freshness:
      "World facts share one repeatable-read snapshot. Social proposal versions may be newer; refresh dependent records before committing. The server revalidates state, versions, affordability and authority.",
    forecast: view.forecast,
    upkeep: view.upkeep,
    charges: view.charges,
    militaryKnownInputs,
    proposals,
    proposalOffset,
    proposalsNextOffset: observedProposals.length > proposalOffset + 12 ? proposalOffset + 12 : null,
    proposalCoverage: {
      observed: observedProposals.length,
      pageSize: 12,
      additionalRecordsMayExist: (social?.supplyOffers.length ?? 0) >= 50,
      meaning:
        "This menu pages the latest observed proposals. Use participant pair/history reads for deeper records; absence here does not prove no proposal exists.",
    },
    candidates: candidates.sort((a, b) => a.id.localeCompare(b.id)),
    unknowns: [
      "Opponent private stocks, objectives, units and reasoning.",
      "Future peer choices and provider model quality.",
      "Future deliveries, combat outcomes and authority admission.",
    ],
  };
}

export class DecisionSupportReader {
  constructor(
    private readonly world: Pick<WorldViewService, "readSelf">,
    private readonly social?: Pick<SocialOverviewReader, "read">,
  ) {}
  async read(accountId: string, candidateId?: string, proposalOffset = 0) {
    const view = await this.world.readSelf(accountId);
    if (!view) return null;
    const social = this.social ? await this.social.read(accountId, { acknowledgeDeliveredMessages: false }) : null;
    const support = calculateDecisionSupport(view, social, proposalOffset);
    if (candidateId !== undefined) {
      const candidate = support.candidates.find((c) => c.id === candidateId);
      return candidate
        ? {
            schemaVersion: support.schemaVersion,
            asOfGameTimeMs: support.asOfGameTimeMs,
            committedTickSequence: support.committedTickSequence,
            candidate,
            meaning:
              "A current blueprint, never a command receipt or authority grant. Submit any chosen action through the shared handler.",
          }
        : {
            code: "CANDIDATE_STALE",
            refresh: "Read decision support again; facts changed or the ID is not in this owner's current menu.",
          };
    }
    return support;
  }
}

import { createHash } from "node:crypto";
