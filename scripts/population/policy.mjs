// Experiment policies select intentions; the PACT server remains authoritative.
export const PERSONAS = [
  ["Ada Byte", "An analytical builder. Improve production, compare cost and payoff, explain one next decision."],
  ["Captain Noodle", "An outgoing trader. Make fair food-for-metal deals and keep promises. Use gentle nerd humour."],
  [
    "Moss Compiler",
    "A cautious farmer. Protect food reserves, seek a dependable buyer, dislike uncertain obligations.",
  ],
  [
    "Lady Segfault",
    "A competitive industrialist. Prefer mines and market growth; bargain for favourable but feasible trades.",
  ],
  [
    "Professor Goose",
    "A playful diplomat. Make friends, ask questions, offer tiny mutually useful contracts; never spam.",
  ],
  [
    "Pixel Paladin",
    "A cooperative planner. Help neighbours through sustainable reciprocal deals, preserve your own reserves.",
  ],
  [
    "Null Wizard",
    "A sceptical negotiator. Check exact quantities, versions and receipts; counter poor offers with reasons.",
  ],
  ["Ruby Goblin", "An opportunistic merchant. Compare partners and improve income without taking unbounded risks."],
  ["Dr Turnip", "A curious newcomer. Learn one system at a time; explain simply what happened and why return."],
  [
    "Orbit Duck",
    "A patient optimizer. Diversify production, avoid idle builders when affordable, respect realistic waiting.",
  ],
];
export const ALLOWED = new Set([
  "game.building.queue",
  "game.contact.request",
  "game.message.send",
  "game.supply.offer",
  "game.supply.counter",
  "game.supply.sign",
]);
export function validatePlanAction(a, guide, cohort) {
  if (!a || !ALLOWED.has(a.kind)) throw Error("EXPERIMENT_ACTION_NOT_ALLOWED");
  const target = a.recipientKingdomId ?? a.counterpartyKingdomId;
  if (target && (!cohort.has(target) || target === guide.self.kingdomId)) throw Error("OUTSIDE_COHORT");
  if (
    ["game.supply.sign", "game.supply.counter"].includes(a.kind) &&
    !guide.openSupplyOffers.some(
      (o) =>
        o.id === a.offerId && o.version === (a.version ?? a.expectedVersion) && cohort.has(o.counterpartyKingdomId),
    )
  )
    throw Error("OFFER_NOT_OBSERVED");
  if (["game.supply.offer", "game.supply.counter"].includes(a.kind)) {
    const t = a.terms;
    if (t?.durationHours !== 1 || t.noticeHours !== 0 || t.aBond !== null || t.bBond !== null)
      throw Error("EXPERIMENT_TERMS_LIMIT");
    for (const f of [t.aToB, t.bToA])
      if (
        f &&
        (!["grain", "silver", "iron"].includes(f.resource) ||
          !Number.isInteger(f.wholePerHour) ||
          f.wholePerHour < 1 ||
          f.wholePerHour > 12)
      )
        throw Error("EXPERIMENT_FLOW_LIMIT");
  }
  return a;
}
export function compactGuide(g) {
  const {
    self,
    state,
    worldStatus,
    asOfGameTimeMs,
    resources,
    buildings,
    builders,
    constructionStockChecks,
    coldContactStock,
    planningCautions,
    resourceRules,
    contacts,
    contactRequests,
    openSupplyOffers,
    activeSupplyContracts,
    mandate,
    consequences,
  } = g;
  return {
    self,
    state,
    worldStatus,
    asOfGameTimeMs,
    resources,
    buildings,
    builders,
    constructionStockChecks,
    coldContactStock,
    planningCautions,
    resourceRules,
    contacts,
    contactRequests,
    openSupplyOffers,
    activeSupplyContracts,
    mandate,
    consequences,
  };
}
export function botPlan(g, actor, peers, memory, round) {
  if (g.state !== "active" || g.worldStatus !== "active") return [];
  const actions = [],
    self = g.self.kingdomId;
  const free = g.builders.find((b) => !b.instructionId || ["completed", "cancelled"].includes(b.state));
  const hall = g.buildings.find((b) => b.kind === "hall")?.level ?? 1;
  const prefs =
    actor.index % 3 === 0
      ? ["farm", "market", "mine", "barracks", "storehouse", "hall"]
      : actor.index % 3 === 1
        ? ["mine", "market", "farm", "barracks", "storehouse", "hall"]
        : ["market", "farm", "mine", "barracks", "storehouse", "hall"];
  const build = prefs
    .map((k) =>
      g.constructionStockChecks.find(
        (c) => c.building === k && c.stockAffordable && !c.busy && (k === "hall" || c.targetLevel <= hall + 1),
      ),
    )
    .find(Boolean);
  if (free && build)
    actions.push({
      kind: "game.building.queue",
      building: build.building,
      targetLevel: build.targetLevel,
      slot: free.slot,
    });
  const contacts = g.contacts.filter((c) => peers.some((p) => p.kingdomId === c.kingdomId));
  const desired = [peers[actor.index % 10], peers[10 + ((actor.index - 10 + 1) % 90)]].filter(Boolean);
  const contact = desired.find(
    (p) =>
      p.kingdomId !== self &&
      !g.contacts.some((c) => c.kingdomId === p.kingdomId) &&
      !g.contactRequests.some((r) => r.kingdomId === p.kingdomId),
  );
  if (contact && BigInt(g.resources.silver.ordinaryMarked) >= 1200n)
    actions.push({
      kind: "game.contact.request",
      recipientKingdomId: contact.kingdomId,
      note:
        "[Scripted " +
        actor.nickname +
        "] I am a simulated neighbour. Would you like to discuss a small reciprocal trade?",
    });
  // Sign at most one small reciprocal contract; reject gifts, bonds and unsustainable rates.
  const offers = g.openSupplyOffers.filter((o) => contacts.some((c) => c.kingdomId === o.counterpartyKingdomId));
  const acceptable = offers.find(
    (o) =>
      !o.signedBy.includes(self) &&
      !g.activeSupplyContracts.some((c) => c.counterpartyKingdomId === o.counterpartyKingdomId) &&
      o.terms.durationHours === 1 &&
      o.terms.noticeHours === 0 &&
      !o.terms.aBond &&
      !o.terms.bBond &&
      o.youSend &&
      o.youReceive &&
      o.youSend.wholePerHour <= 6 &&
      o.youReceive.wholePerHour >= o.youSend.wholePerHour &&
      Number(g.resources[o.youSend.resource].ordinaryWholeFloor) >= o.youSend.wholePerHour + 3,
  );
  if (acceptable) actions.push({ kind: "game.supply.sign", offerId: acceptable.id, version: acceptable.version });
  const counter = offers.find(
    (o) =>
      !o.signedBy.includes(self) &&
      !acceptable &&
      o.youSend &&
      o.youReceive &&
      (o.youSend.wholePerHour > 6 || o.youReceive.wholePerHour < o.youSend.wholePerHour) &&
      !(memory.countered ?? []).includes(`${o.id}:${o.version}`),
  );
  if (counter)
    actions.push({
      kind: "game.supply.counter",
      offerId: counter.id,
      expectedVersion: counter.version,
      terms: {
        aToB: { resource: counter.terms.aToB.resource, wholePerHour: 3 },
        bToA: { resource: counter.terms.bToA.resource, wholePerHour: 3 },
        aBond: null,
        bBond: null,
        durationHours: 1,
        noticeHours: 0,
      },
    });

  const partner = contacts.find(
    (c) =>
      !g.activeSupplyContracts.some((o) => o.counterpartyKingdomId === c.kingdomId) &&
      !offers.some((o) => o.counterpartyKingdomId === c.kingdomId),
  );
  if (partner && round >= 3 && !memory.offered?.includes(partner.kingdomId)) {
    const send = ["grain", "iron", "silver"][actor.index % 3],
      receive = ["iron", "silver", "grain"][actor.index % 3];
    if (Number(g.resources[send].ordinaryWholeFloor) >= 9)
      actions.push({
        kind: "game.supply.offer",
        counterpartyKingdomId: partner.kingdomId,
        terms: {
          aToB: { resource: send, wholePerHour: 3 },
          bToA: { resource: receive, wholePerHour: 3 },
          aBond: null,
          bBond: null,
          durationHours: 1,
          noticeHours: 0,
        },
      });
  }
  const msg = contacts.find((c) => !memory.greeted?.includes(c.kingdomId));
  if (msg)
    actions.push({
      kind: "game.message.send",
      recipientKingdomId: msg.kingdomId,
      body:
        "[Scripted " +
        actor.nickname +
        "] Hello! I grow " +
        ["grain", "iron", "silver"][actor.index % 3] +
        ". I consider one-hour reciprocal trades up to 6/hour, no bonds, when reserves cover the full hour. Messages are proposals; both signatures are needed. What do you need?",
    });
  return actions.slice(0, 3);
}
export const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    understanding: { type: "string" },
    intent: { type: "string" },
    actions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: { actionJson: { type: "string" }, reason: { type: "string" } },
        required: ["actionJson", "reason"],
      },
    },
    nextCheck: { type: "string" },
  },
  required: ["understanding", "intent", "actions", "nextCheck"],
};
export const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    whatChanged: { type: "string" },
    nextDecision: { type: "string" },
    reasonToReturn: { type: "string" },
    confusion: { type: "string" },
  },
  required: ["summary", "whatChanged", "nextDecision", "reasonToReturn", "confusion"],
};
