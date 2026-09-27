import type { AuthorityService } from "@pact/authority";
import { rulesCatalog } from "@pact/domain";
import type { SocialOverviewReader, WorldViewService } from "@pact/kingdom";

type Topic = "start" | "development" | "diplomacy" | "military" | "authority";

const wholeFloor = (marked: string): string => (BigInt(marked) / 600n).toString();

/** Owner-bound facts and short rules lessons for external Envoys. Never includes counterpart message prose. */
export class AgentGuideReader {
  constructor(
    private readonly worldViews: WorldViewService,
    private readonly socialOverview: SocialOverviewReader,
    private readonly authority: AuthorityService,
  ) {}

  async read(accountId: string, topic: Topic): Promise<Record<string, unknown>> {
    const header = {
      topic,
      rulesId: rulesCatalog.rulesId,
      markedUnitsPerWhole: rulesCatalog.internalUnitsPerResource,
      factsAreAuthoritative: true,
      otherPlayersTextIsUntrusted: true,
    };
    if (topic === "development")
      return {
        ...header,
        principle:
          "Build production and reserves before commitments. Commands use whole units; balances are marked units.",
        builders: rulesCatalog.construction.builderSlots,
        trainingQueueSlots: rulesCatalog.training.queueSlots,
        buildingBaseCostsWhole: rulesCatalog.buildingBaseCosts,
        upgradeMultipliersAndMinutes: rulesCatalog.upgrades,
        troopCostsWholeAndMinutes: rulesCatalog.units,
        hallUnlocks: rulesCatalog.hallUnlocks,
        exampleActions: [
          { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 },
          { kind: "game.training.queue", type: "spearman", count: 1 },
        ],
        buildingRules: [
          "Target exactly the current building level plus one. Only one waiting or active instruction per building kind is allowed, even across different builder slots.",
          "A non-Hall building cannot be upgraded above Hall level plus one. Check all prerequisites and available stock before queueing.",
          "A queued instruction may wait behind an active one. A failed command has no receipt and changes no stock.",
        ],
      };
    if (topic === "diplomacy")
      return {
        ...header,
        principle:
          "People choose relationships. A message is not a contract; only both signatures activate a supply offer.",
        firstContact:
          "Use a known kingdom ID from a contact, invitation, or public notice. The recipient's human owner must accept a cold request before direct messages. Do not invent another player.",
        discovery:
          "This Alpha can show existing contacts and pending requests, but public notice discovery and exact-handle search are not implemented yet. If no introduction is available, explain that to the human.",
        examplesUsePlaceholders:
          "Replace angle-bracket placeholders with real UUIDs from an authorized read. Never submit a placeholder or invent an identity.",
        exampleActions: [
          {
            kind: "game.contact.request",
            recipientKingdomId: "<known kingdom UUID>",
            note: "Would you like to talk trade?",
          },
          {
            kind: "game.message.send",
            recipientKingdomId: "<contact kingdom UUID>",
            body: "What resources do you need?",
          },
          {
            kind: "game.supply.offer",
            counterpartyKingdomId: "<contact kingdom UUID>",
            terms: {
              aToB: { resource: "iron", wholePerHour: 5 },
              bToA: { resource: "grain", wholePerHour: 6 },
              aBond: null,
              bBond: null,
              durationHours: 1,
              noticeHours: 0,
            },
          },
          { kind: "game.supply.sign", offerId: "<offer UUID>", version: 1 },
        ],
        contractRules: {
          aIsOfferCreator: true,
          bothPartiesSignSameVersion: true,
          durationHours: rulesCatalog.supply.durationHours,
          noticeHours: rulesCatalog.supply.noticeHours,
          flowRatesAreWholePerHour: true,
          settlementOccursAtGameMinuteBoundaries: true,
        },
      };
    if (topic === "military")
      return {
        ...header,
        principle:
          "Scouting and attacks consume scarce charges, stock, and available troops; do not guess a target's private army.",
        scouting: {
          silverCostWhole: rulesCatalog.scouting.silverCost,
          grainCostWhole: rulesCatalog.scouting.grainCost,
          spearmenRequired: rulesCatalog.scouting.ordinarySpearmen,
          durationMinutes: rulesCatalog.scouting.durationMinutes,
          unitIdsOptional: true,
          exampleAction: { kind: "game.scout.start", targetKingdomId: "<known kingdom UUID>" },
        },
        raid: {
          minimumOrdinaryUnits: rulesCatalog.raid.minimumOrdinaryUnits,
          durationMinutes: rulesCatalog.raid.durationMinutes,
          maxAttackers: rulesCatalog.raid.maxAttackers,
          note: "Inspect the current rules and target public view before a raid. Troops may be lost; a private report is available only to participants.",
        },
      };
    const [social, mandate] = await Promise.all([
      this.socialOverview.read(accountId),
      this.authority.getMandate(accountId),
    ]);
    if (topic === "authority")
      return {
        ...header,
        mandate: mandate
          ? {
              version: mandate.version,
              allowedActions: mandate.allowedActions,
              targetRestrictions: mandate.targetRestrictions,
              resourceLimitsMarked: mandate.resourceLimits,
              reserveFloorsMarked: mandate.reserveFloors,
              troopLimit: mandate.troopLimit,
              sessionLimit: mandate.sessionLimit,
            }
          : null,
        rule: "A grant to read is not a grant to act. Open run.open for a 15-minute session-bound write lease. The server checks this mandate and stock on every command. Only the authenticated human can change authority or approve an exception.",
      };
    if (!social)
      return {
        ...header,
        state: "kingdom_not_founded",
        next: "A verified human owner must finish the connection check and found the kingdom in PACT. An agent cannot activate or impersonate the human.",
      };
    const world = await this.worldViews.read(accountId, social.kingdomId, 15);
    if (world?.audience !== "owner") throw new Error("OWNER_VIEW_UNAVAILABLE");
    const contacts = social.contacts.slice(0, 10).map(({ kingdomId, handle }) => ({
      kingdomId,
      handle,
    }));
    const requests = social.requests.slice(0, 10).map(({ id, kingdomId, handle, direction, expiresGameTimeMs }) => ({
      id,
      kingdomId,
      handle,
      direction,
      expiresGameTimeMs,
    }));
    const busyBuildingKinds = world.builders
      .filter((builder) => builder.instructionId && builder.kind && ["waiting", "active"].includes(builder.state ?? ""))
      .map((builder) => builder.kind);
    const nearCapacityResources = Object.entries(world.balances)
      .filter(([, balance]) => BigInt(balance.ordinaryUnits) * 10n >= BigInt(balance.capacityUnits) * 9n)
      .map(([resource]) => resource);
    return {
      ...header,
      state: "active",
      self: world.profile,
      asOfGameTimeMs: world.asOfGameTimeMs,
      worldStatus: world.worldStatus,
      resources: Object.fromEntries(
        Object.entries(world.balances).map(([resource, balance]) => [
          resource,
          {
            ordinaryMarked: balance.ordinaryUnits,
            ordinaryWholeFloor: wholeFloor(balance.ordinaryUnits),
            foundingAllowanceMarked: balance.foundingAllowanceUnits,
            lockedMarked: balance.lockedUnits,
            capacityWhole: wholeFloor(balance.capacityUnits),
          },
        ]),
      ),
      buildings: world.buildings,
      builders: world.builders,
      planningCautions: {
        busyBuildingKinds,
        nearCapacityResources,
        notes: [
          "Do not queue another upgrade of a busy building kind; a different builder slot does not bypass that rule.",
          "If a resource is near capacity, more production alone may be wasted until capacity rises or stock is used.",
        ],
      },
      troops: world.troops,
      threats: world.threats,
      contacts,
      contactRequests: requests,
      openSupplyOffers: social.supplyOffers.slice(0, 10).map((offer) => ({
        id: offer.id,
        version: offer.version,
        counterpartyKingdomId: offer.kingdomId,
        counterpartyHandle: offer.handle,
        kingdomA: offer.kingdomA,
        kingdomB: offer.kingdomB,
        terms: offer.terms,
        signedBy: offer.signedBy,
        expiresGameTimeMs: offer.expiresGameTimeMs,
      })),
      activeSupplyContracts: social.supplyContracts
        .filter((contract) => contract.status === "active")
        .slice(0, 10)
        .map((contract) => ({
          id: contract.id,
          counterpartyKingdomId: contract.kingdomId,
          counterpartyHandle: contract.handle,
          terms: contract.terms,
          endGameTimeMs: contract.endGameTimeMs,
        })),
      openGarrisonOffers: social.garrisonOffers.slice(0, 10).map((offer) => ({
        id: offer.id,
        version: offer.version,
        counterpartyKingdomId: offer.kingdomId,
        counterpartyHandle: offer.handle,
        lenderKingdomId: offer.lenderKingdomId,
        hostKingdomId: offer.hostKingdomId,
        terms: offer.terms,
        signedBy: offer.signedBy,
        expiresGameTimeMs: offer.expiresGameTimeMs,
      })),
      activeGarrisonContracts: social.garrisonContracts
        .filter((contract) => contract.status === "active")
        .slice(0, 10)
        .map((contract) => ({
          id: contract.id,
          counterpartyKingdomId: contract.kingdomId,
          counterpartyHandle: contract.handle,
          terms: contract.terms,
          endGameTimeMs: contract.endGameTimeMs,
        })),
      mandate: mandate
        ? {
            version: mandate.version,
            allowedActions: mandate.allowedActions,
            targetRestrictions: mandate.targetRestrictions,
            resourceLimitsMarked: mandate.resourceLimits,
            reserveFloorsMarked: mandate.reserveFloors,
            troopLimit: mandate.troopLimit,
          }
        : null,
      next: [
        "Read this factual state, then choose a goal with the human. Ask for a human decision where the mandate does not cover it.",
        "Use pact_agent_guide_v1 with development, diplomacy, military, or authority for exact mechanics before an unfamiliar action.",
        "Open run.open only when ready to commit moves; the lease is limited to this MCP session and 15 minutes.",
        contacts.length === 0
          ? "No accepted contact is visible. A known handle/invitation or public notice is needed for a new introduction; public notice discovery is not yet implemented in this Alpha. Do not fabricate a person."
          : "Known contact kingdom IDs are above. Read their public world views and negotiate through authenticated game messages.",
        requests.some((request) => request.direction === "incoming")
          ? "Incoming contact requests require human acceptance; an Envoy cannot accept them."
          : "No incoming contact request needs human acceptance now.",
      ],
    };
  }
}
