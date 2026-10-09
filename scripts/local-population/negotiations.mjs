import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stats = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return {
    samples: sorted.length,
    minimumMs: sorted[0],
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maximumMs: sorted.at(-1),
    meanMs: sorted.reduce((n, v) => n + v, 0) / sorted.length,
  };
};
export function termsKey(terms) {
  if (!terms) return "";
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((k) => [k, canonical(value[k])]),
          )
        : value;
  return JSON.stringify(canonical(terms));
}
export function analyzeNegotiations(events, server = {}) {
  const unique = new Map();
  for (const e of events)
    if (["receipt", "receipt_recovered"].includes(e.type) && e.receipt.code === "COMMITTED")
      unique.set(e.receipt.commandId, e);
  const committed = [...unique.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const contracts = new Map((server.contracts ?? []).map((c) => [c.offer_id, c]));
  const offers = new Map((server.offers ?? []).map((o) => [o.id, o]));
  const records = [];
  for (const event of committed.filter((e) => e.action.kind === "game.supply.offer")) {
    const id = Object.keys(event.receipt.recordVersions ?? {})
      .find((k) => k.startsWith("supply-offer:"))
      ?.slice("supply-offer:".length);
    if (!id) continue;
    const counterEvents = committed.filter((e) => e.action.kind === "game.supply.counter" && e.action.offerId === id);
    const signatures = committed.filter((e) => e.action.kind === "game.supply.sign" && e.action.offerId === id);
    const c = contracts.get(id),
      o = offers.get(id);
    let terms = event.action.terms,
      changedCounters = 0;
    for (const counter of counterEvents) {
      if (termsKey(counter.action.terms) !== termsKey(terms)) changedCounters++;
      terms = counter.action.terms;
    }
    const createdAt = event.receipt.committedAt ?? event.at;
    const activatedAt = c?.created_at;
    const signatureKeys = new Set(signatures.map((e) => `${e.actor}:${e.action.version}`));
    const pair = new Set([o?.kingdom_a ?? c?.kingdom_a, o?.kingdom_b ?? c?.kingdom_b].filter(Boolean));
    const lastAt = activatedAt ?? events.at(-1)?.at;
    const messages = committed.filter(
      (e) =>
        e.action.kind === "game.message.send" &&
        pair.has(e.action.recipientKingdomId) &&
        Date.parse(e.at) >= Date.parse(createdAt) &&
        Date.parse(e.at) <= Date.parse(lastAt) &&
        pair.has(events.find((x) => x.type === "actor_ready" && x.actor === e.actor)?.kingdomId),
    );
    records.push({
      offerId: id,
      proposerActor: event.actor,
      kingdomA: o?.kingdom_a ?? c?.kingdom_a,
      kingdomB: o?.kingdom_b ?? c?.kingdom_b,
      createdAt,
      status: o?.status ?? "unknown",
      finalVersion: o?.version,
      counterCommands: counterEvents.length,
      changedCounters,
      signatureCommands: signatures.length,
      uniqueActorVersionSignatures: signatureKeys.size,
      repeatedSignCommands: signatures.length - signatureKeys.size,
      activatedAt,
      agreementMs: activatedAt ? Date.parse(activatedAt) - Date.parse(createdAt) : null,
      firstSignatureAt: signatures[0]?.at,
      finalContractVersion: c?.offer_version,
      contractStatus: c?.status,
      conversationMessagesDuringOffer: messages.length,
      originalTerms: event.action.terms,
      finalTerms: c?.terms ?? o?.terms,
      contractDurationMs: c ? c.end_game_time_ms - c.start_game_time_ms : null,
    });
  }
  const activated = records.filter((r) => r.activatedAt);
  const countered = records.filter((r) => r.counterCommands);
  const statuses = records.reduce((a, r) => {
    const k = r.activatedAt ? "activated" : r.status;
    a[k] = (a[k] ?? 0) + 1;
    return a;
  }, {});
  return {
    offerCommands: committed.filter((e) => e.action.kind === "game.supply.offer").length,
    offersWithRecordId: records.length,
    activatedOffers: activated.length,
    offerOutcomes: statuses,
    counterCommands: countered.reduce((n, r) => n + r.counterCommands, 0),
    counteredOffers: countered.length,
    changedCounterCommands: countered.reduce((n, r) => n + r.changedCounters, 0),
    changedCounteredOffers: countered.filter((r) => r.changedCounters).length,
    activatedChangedCounteredOffers: countered.filter((r) => r.changedCounters && r.activatedAt).length,
    activatedCounteredOffers: countered.filter((r) => r.activatedAt).length,
    signatureCommands: records.reduce((n, r) => n + r.signatureCommands, 0),
    repeatedActorVersionSignCommands: records.reduce((n, r) => n + r.repeatedSignCommands, 0),
    agreementLatency: stats(activated.map((r) => r.agreementMs)),
    counteredAgreementLatency: stats(activated.filter((r) => r.counterCommands).map((r) => r.agreementMs)),
    changedCounteredAgreementLatency: stats(activated.filter((r) => r.changedCounters).map((r) => r.agreementMs)),
    uncounteredAgreementLatency: stats(activated.filter((r) => !r.counterCommands).map((r) => r.agreementMs)),
    firstSignatureLatency: stats(
      records.filter((r) => r.firstSignatureAt).map((r) => Date.parse(r.firstSignatureAt) - Date.parse(r.createdAt)),
    ),
    contractDuration: stats(activated.map((r) => r.contractDurationMs)),
    perOffer: records,
    note: "Agreement latency is wall time from committed formal offer to contract creation. Unactivated offers are excluded, not counted as instant agreements. Messages in the pair/time window are not proof every message was bargaining. Repeat signing receipts are not new contracts.",
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
  if (!process.argv.includes("--events")) throw Error("EVENTS_REQUIRED");
  const events = fs.readFileSync(arg("--events"), "utf8").split("\n").filter(Boolean).map(JSON.parse);
  const server = process.argv.includes("--server") ? JSON.parse(fs.readFileSync(arg("--server"), "utf8")) : {};
  const result = analyzeNegotiations(events, server);
  if (process.argv.includes("--output")) fs.writeFileSync(arg("--output"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ...result, perOffer: undefined }, null, 2));
}
