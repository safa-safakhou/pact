import { validateAction } from "./plan.mjs";

export const OWNER_POLICY = "local-synthetic-v1";
const AUTHORITY_DENIALS = new Set(["APPROVAL_REQUIRED", "FORBIDDEN", "INSUFFICIENT_ALLOWANCE"]);
export function ownerMayHandle(code, config) {
  return config.ownerApprovals === "bounded" && AUTHORITY_DENIALS.has(code);
}

// An operator policy for synthetic owners, never a grant of server authority.
export function reserveOwnerDecision({ actor, action, commandId, guide, cohort, config, save }) {
  if (
    config.ownerApprovals !== "bounded" ||
    actor.ownerPolicy !== OWNER_POLICY ||
    actor.kingdomId !== guide.self.kingdomId ||
    !actor.entryKey ||
    !actor.cookie ||
    !actor.csrfToken
  )
    throw Error("OWNER_POLICY_FORBIDDEN");
  validateAction(action, guide, cohort);
  const costs = { iron: 0n, silver: 0n, grain: 0n };
  let route = "command";
  if (action.kind === "game.building.queue") {
    route = "approval";
    const build = guide.constructionStockChecks.find(
      (b) => b.building === action.building && b.targetLevel === action.targetLevel,
    );
    for (const resource of ["iron", "silver"]) {
      const value = String(build.costWhole?.[resource]);
      if (!/^\d+$/.test(value)) throw Error("OWNER_COST_UNKNOWN");
      costs[resource] = BigInt(value);
    }
  } else if (action.kind === "game.contact.request") {
    route = "approval";
    if (
      guide.contacts.some((c) => c.kingdomId === action.recipientKingdomId) ||
      guide.contactRequests.some((r) => r.kingdomId === action.recipientKingdomId) ||
      BigInt(guide.resources.silver.facts.ordinaryWhole) < 2n
    )
      throw Error("OWNER_CONTACT_UNAVAILABLE");
    costs.silver = 2n;
  } else if (action.kind === "game.supply.sign") {
    const offer = guide.openSupplyOffers.find((o) => o.id === action.offerId && o.version === action.version);
    if (offer.signedBy.includes(actor.kingdomId)) throw Error("OWNER_ALREADY_SIGNED");
    validateAction(
      { kind: "game.supply.offer", counterpartyKingdomId: offer.counterpartyKingdomId, terms: offer.terms },
      guide,
      cohort,
    );
    // Charge the complete outgoing hour, never expected incoming profit.
    const flow = actor.kingdomId === offer.kingdomA ? offer.terms.aToB : offer.terms.bToA;
    if (![offer.kingdomA, offer.kingdomB].includes(actor.kingdomId)) throw Error("OWNER_OFFER_PARTY_UNKNOWN");
    costs[flow.resource] = BigInt(flow.wholePerHour);
  } else if (!["game.supply.offer", "game.supply.counter"].includes(action.kind)) {
    throw Error("OWNER_ACTION_NOT_ALLOWED");
  }
  actor.ownerDecisions ??= {};
  const existing = actor.ownerDecisions[commandId];
  if (existing) {
    if (JSON.stringify(existing.action) !== JSON.stringify(action)) throw Error("OWNER_DECISION_CONFLICT");
    return existing;
  }
  const decisions = Object.values(actor.ownerDecisions);
  if (decisions.length >= config.ownerApprovalCap) throw Error("OWNER_DECISION_CAP");
  for (const resource of Object.keys(costs)) {
    const used = decisions.reduce((n, d) => n + BigInt(d.costs[resource]), 0n);
    if (used + costs[resource] > BigInt(config.ownerResourceLimit)) throw Error("OWNER_RESOURCE_CAP");
  }
  const decision = {
    commandId,
    action: structuredClone(action),
    route,
    policy: OWNER_POLICY,
    costs: Object.fromEntries(Object.entries(costs).map(([r, n]) => [r, n.toString()])),
  };
  actor.ownerDecisions[commandId] = decision;
  save(); // Failed or uncertain decisions consume the cap; no automatic budget refund.
  return decision;
}

export async function resolveOwnerDecision({ actor, client, mcp, save, emit, active }) {
  const pending = actor.pending;
  const decision = actor.ownerDecisions?.[pending?.commandId];
  if (
    !decision ||
    pending.role !== "simulated-human-approval" ||
    decision.policy !== OWNER_POLICY ||
    JSON.stringify(decision.action) !== JSON.stringify(pending.action)
  )
    throw Error("OWNER_DECISION_UNKNOWN");
  if (!active()) throw Error("RUN_STOPPED");
  let receipt;
  if (decision.route === "approval") {
    // Re-proposing the same exact command verifies the immutable server request even after a lost response.
    const proposal = await mcp.call("pact_approval_propose_v1", {
      commandId: decision.commandId,
      action: decision.action,
    });
    if (!/^[a-f0-9-]{36}$/.test(proposal.approvalId)) throw Error("OWNER_APPROVAL_INVALID");
    if (pending.approvalId && pending.approvalId !== proposal.approvalId) throw Error("OWNER_APPROVAL_CHANGED");
    pending.approvalId = proposal.approvalId;
    save();
    const route = `/v1/approvals/${proposal.approvalId}`;
    const view = await client.http(route);
    if (view.commandId !== decision.commandId || view.approvalId !== pending.approvalId)
      throw Error("OWNER_APPROVAL_CHANGED");
    if (view.status === "approved") receipt = view.receipt;
    else {
      const expiresAt = Date.parse(view.expiresAt);
      if (view.status !== "pending" || !Number.isFinite(expiresAt) || expiresAt <= Date.now())
        throw Error("OWNER_APPROVAL_EXPIRED");
      if (!active()) throw Error("RUN_STOPPED");
      receipt = (await client.http(`${route}/approve`, {})).receipt;
    }
  } else {
    if (!active()) throw Error("RUN_STOPPED");
    // Supply is not supported by approval.propose v1; use the exact ordinary owner command.
    receipt = await client.humanCommand(decision.action, decision.commandId);
  }
  if (!receipt || receipt.commandId !== decision.commandId) throw Error("UNCERTAIN_COMMAND");
  delete actor.pending;
  delete actor.blocked;
  save();
  emit("receipt", { actor: actor.index, role: "simulated-human-approval", action: decision.action, receipt });
  emit("owner_decision_resolved", {
    actor: actor.index,
    commandId: decision.commandId,
    route: decision.route,
    code: receipt.code,
  });
  return receipt;
}

export async function approveOwnerAction(args) {
  if (!args.active()) throw Error("RUN_STOPPED");
  const decision = reserveOwnerDecision(args);
  args.actor.pending = { commandId: decision.commandId, action: decision.action, role: "simulated-human-approval" };
  args.save();
  args.emit("owner_decision_reserved", { actor: args.actor.index, ...decision });
  try {
    return await resolveOwnerDecision(args);
  } catch (error) {
    // Retain exact pending state until receipt reconciliation; never fall through to another write.
    args.actor.blocked = "UNCERTAIN_OWNER_DECISION";
    args.save();
    throw error;
  }
}
