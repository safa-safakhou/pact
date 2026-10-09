import { createHash } from "node:crypto";

export function collectSocialWork(actor, guide, view) {
  const social = view.interactions ?? {};
  actor.socialAgenda ??= [];
  for (const message of social.messages ?? []) {
    if (message.senderKingdomId === actor.kingdomId || actor.socialAgenda.some((m) => m.id === message.id)) continue;
    actor.socialAgenda.push({
      id: message.id,
      peerId: message.kingdomId,
      body: message.body,
      sentGameTimeMs: message.sentGameTimeMs,
      responded: false,
    });
  }
  // Preserve pending work; remove old answered history first, never silently erase pending messages.
  actor.socialAgenda = [
    ...actor.socialAgenda.filter((m) => m.responded).slice(-20),
    ...actor.socialAgenda.filter((m) => !m.responded),
  ];
  const requests = social.requests ?? guide.contactRequests ?? [];
  const incoming = requests.filter((r) => r.direction === "incoming");
  const outgoing = requests.filter((r) => r.direction === "outgoing");
  return {
    incomingRequests: incoming.map((r) => ({
      id: r.id,
      peerId: r.kingdomId,
      handle: r.handle,
      note: r.note,
      acceptAction: { kind: "game.contact.answer", requestId: r.id, accept: true },
      declineAction: { kind: "game.contact.answer", requestId: r.id, accept: false },
    })),
    outgoingRequests: outgoing.map((r) => ({
      id: r.id,
      peerId: r.kingdomId,
      handle: r.handle,
      waitingFor: "counterparty owner; you cannot accept this",
    })),
    contacts: social.contacts ?? guide.contacts ?? [],
    pendingMessages: actor.socialAgenda.filter((m) => !m.responded),
    recentMessages: (social.messages ?? []).slice(0, 8),
    offers: social.supplyOffers ?? guide.openSupplyOffers ?? [],
    requestHistory: social.requestHistory ?? [],
  };
}

export function socialActionGuard(actor, action, work) {
  if (action.kind === "game.contact.answer" && !work.incomingRequests.some((r) => r.id === action.requestId))
    return {
      code: "CONTACT_REQUEST_NOT_INCOMING",
      recovery:
        "Only answer a current incoming request using its exact requestId. An outgoing request belongs to the other owner; wait or choose another action.",
    };
  if (action.kind === "game.contact.request") {
    if (work.contacts.some((p) => p.kingdomId === action.recipientKingdomId))
      return {
        code: "ALREADY_CONTACT",
        recovery: "This peer is already a contact. Send an actual message instead of another introduction.",
      };
    const incoming = work.incomingRequests.find((r) => r.peerId === action.recipientKingdomId);
    if (incoming)
      return {
        code: "REQUEST_EXISTS",
        recovery:
          "The peer already introduced themselves. Choose acceptAction or declineAction from incomingRequests; do not send an opposite request.",
      };
    if (work.outgoingRequests.some((r) => r.peerId === action.recipientKingdomId))
      return {
        code: "REQUEST_EXISTS",
        recovery: "Your introduction is pending with the other owner. Do not resend it or approve it yourself.",
      };
  }
  if (action.kind === "game.message.send") {
    if (!work.contacts.some((p) => p.kingdomId === action.recipientKingdomId))
      return {
        code: "CONTACT_REQUIRED",
        recovery:
          "Messaging requires an accepted contact. Resolve incoming introductions or send one affordable introduction first.",
      };
    const pending = work.pendingMessages.filter((m) => m.peerId === action.recipientKingdomId);
    const last = actor.lastSocialReplies?.[action.recipientKingdomId];
    if (!pending.length && last?.body === action.body)
      return {
        code: "DUPLICATE_MESSAGE",
        recovery:
          "That exact message was already committed and no new incoming message is awaiting reply. Wait, read fresh facts, or make a materially different proposal.",
      };
  }
  const state = createHash("sha256")
    .update(
      JSON.stringify({
        contacts: work.contacts.map((p) => p.kingdomId),
        incoming: work.incomingRequests.map((r) => r.id),
        outgoing: work.outgoingRequests.map((r) => r.id),
        offers: work.offers.map((o) => [o.id, o.version]),
      }),
    )
    .digest("hex");
  const failed = actor.socialDenials?.find((d) => d.actionKey === JSON.stringify(action) && d.state === state);
  if (failed && ["INVALID_COMMAND", "FORBIDDEN", "REQUEST_NOT_FOUND", "CONTACT_REQUIRED"].includes(failed.code))
    return {
      code: "REPEATED_DENIED_ACTION",
      recovery:
        "This exact social action already failed without a relevant social-state change. Read the actual target/version and choose a corrected action; a fresh command ID does not fix it.",
    };
  return { state };
}

export function rememberSocialOutcome(actor, action, result, guard) {
  if (result.code === "COMMITTED" && action.kind === "game.message.send") {
    actor.lastSocialReplies ??= {};
    actor.lastSocialReplies[action.recipientKingdomId] = { body: action.body, commandId: result.commandId };
    for (const message of actor.socialAgenda ?? [])
      if (message.peerId === action.recipientKingdomId) message.responded = true;
  }
  if (guard.state && result.code !== "COMMITTED" && /^game\.(contact|message|supply)\./.test(action.kind)) {
    actor.socialDenials ??= [];
    actor.socialDenials.push({ actionKey: JSON.stringify(action), state: guard.state, code: result.code });
    actor.socialDenials = actor.socialDenials.slice(-30);
  }
}

export function prioritySocialWork(work) {
  return {
    incomingRequests: work.incomingRequests.slice(0, 3),
    pendingMessages: work.pendingMessages.slice(0, 3).map((m) => ({ ...m, body: m.body.slice(0, 1200) })),
    outgoingRequests: work.outgoingRequests.slice(0, 3),
    contacts: work.contacts.slice(0, 6).map(({ kingdomId, handle }) => ({ kingdomId, handle })),
    offers: work.offers.slice(0, 3),
    remaining: {
      incomingRequests: Math.max(0, work.incomingRequests.length - 3),
      pendingMessages: Math.max(0, work.pendingMessages.length - 3),
    },
  };
}
