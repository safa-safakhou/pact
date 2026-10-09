const DAY = 86_400_000;
const policies = {
  contact: { limit: 8, window: DAY },
  supply: { limit: 48, window: DAY },
  message: { limit: 96, window: DAY },
};
function group(action) {
  if (action.kind === "game.contact.request") return "contact";
  if (action.kind.startsWith("game.supply.")) return "supply";
  if (action.kind === "game.message.send") return "message";
}
function offerKey(action) {
  return `offer:${action.offerId}:${action.version ?? action.expectedVersion}`;
}
export function pacedGuide(actor, guide) {
  return {
    ...guide,
    localPacing: {
      meaning:
        "Conservative client history/backoff; server checks remain authoritative. Earlier runs may have used more quota.",
      cooldowns: actor.pacing?.cooldowns ?? {},
      usage: Object.fromEntries(
        Object.entries(policies).map(([key, p]) => [
          key,
          {
            observedUsed: (actor.pacing?.usage?.[key] ?? []).filter((t) => t > guide.asOfGameTimeMs - p.window).length,
            limit: p.limit,
          },
        ]),
      ),
      recentMessages: actor.pacing?.messages ?? [],
    },
  };
}
export function actionAvailable(action, guide) {
  const now = guide.asOfGameTimeMs;
  const p = guide.localPacing;
  if (!p) return true;
  const g = group(action);
  if (g && (p.cooldowns[g] > now || p.usage[g]?.observedUsed >= p.usage[g]?.limit)) return false;
  if (action.kind === "game.message.send") {
    if (p.cooldowns[`message:${action.recipientKingdomId}`] > now) return false;
    if (
      action.body &&
      p.recentMessages.some(
        (m) => m.peer === action.recipientKingdomId && m.at > now - 1_800_000 && m.body === action.body.trim(),
      )
    )
      return false;
  }
  if (action.offerId && p.cooldowns[offerKey(action)] > now) return false;
  return true;
}
export function recordOutcome(actor, action, code, gameTimeMs) {
  if (!Number.isSafeInteger(gameTimeMs)) return;
  const g = group(action);
  if (!g) return;
  actor.pacing ??= { cooldowns: {}, usage: {}, messages: [] };
  const p = actor.pacing;
  for (const [key, until] of Object.entries(p.cooldowns)) if (until <= gameTimeMs) delete p.cooldowns[key];
  for (const [key, policy] of Object.entries(policies))
    p.usage[key] = (p.usage[key] ?? []).filter((t) => t > gameTimeMs - policy.window);
  if (code === "COMMITTED") {
    p.usage[g].push(gameTimeMs);
    if (action.kind === "game.message.send") {
      p.messages = p.messages.filter((m) => m.at > gameTimeMs - 1_800_000);
      p.messages.push({ peer: action.recipientKingdomId, body: action.body.trim(), at: gameTimeMs });
      p.messages = p.messages.slice(-96);
    }
  } else if (code === "RATE_LIMITED") p.cooldowns[g] = gameTimeMs + DAY;
  else if (code === "MESSAGE_QUEUE_FULL") p.cooldowns[`message:${action.recipientKingdomId}`] = gameTimeMs + 1_800_000;
  else if (action.offerId && ["INVALID_COMMAND", "EXPIRED", "STALE_VERSION", "OFFER_CLOSED"].includes(code))
    p.cooldowns[offerKey(action)] = gameTimeMs + 1_800_000;
}
export function conversationContacts(guide, turn, maximum = 2) {
  const contacts = guide.contacts ?? [];
  if (!contacts.length) return [];
  const offset = turn % contacts.length;
  // Round-robin guarantees every thread is read; no duplicate read when only one contact exists.
  return contacts.slice(offset).concat(contacts.slice(0, offset)).slice(0, maximum);
}
