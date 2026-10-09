import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "./fixture.mjs";
import { analyzeNegotiations } from "./negotiations.mjs";
import { LocalModel } from "./ollama.mjs";
import { actionAvailable, conversationContacts, pacedGuide, recordOutcome } from "./pacing.mjs";
import { legalBuild, parsePlan, schemaFor, validateAction } from "./plan.mjs";

test("prerequisites exclude affordable Hall II and level III until dependencies are ready", () => {
  const { guide } = fixture();
  assert.equal(legalBuild({ building: "hall", targetLevel: 2 }, guide), false);
  assert.equal(legalBuild({ building: "farm", targetLevel: 3 }, guide), false);
  guide.buildings.find((b) => b.kind === "farm").level = 2;
  guide.buildings.find((b) => b.kind === "barracks").level = 2;
  assert.equal(legalBuild({ building: "hall", targetLevel: 2 }, guide), true);
  guide.buildings.find((b) => b.kind === "hall").level = 2;
  assert.equal(legalBuild({ building: "farm", targetLevel: 3 }, guide), true);
});
test("persisted quota and recipient backoff survive reload and expire only on game time", () => {
  const f = fixture(),
    actor = {};
  const offer = { kind: "game.supply.offer" };
  recordOutcome(actor, offer, "RATE_LIMITED", f.guide.asOfGameTimeMs);
  const reloaded = JSON.parse(JSON.stringify(actor));
  assert.equal(actionAvailable(offer, pacedGuide(reloaded, f.guide)), false);
  const variants = schemaFor(pacedGuide(reloaded, f.guide), f.peers).properties.actions.items.properties.action.oneOf;
  assert.ok(!variants.some((v) => v.properties.kind.const.startsWith("game.supply.")));
  assert.equal(
    actionAvailable(offer, pacedGuide(reloaded, { ...f.guide, asOfGameTimeMs: f.guide.asOfGameTimeMs + 86400000 })),
    true,
  );
  const msg = { kind: "game.message.send", recipientKingdomId: f.peers[1].kingdomId, body: "same" };
  recordOutcome(actor, msg, "MESSAGE_QUEUE_FULL", f.guide.asOfGameTimeMs);
  assert.equal(actionAvailable(msg, pacedGuide(actor, f.guide)), false);
  assert.equal(actionAvailable({ ...msg, recipientKingdomId: "other" }, pacedGuide(actor, f.guide)), true);
  assert.equal(
    actionAvailable(msg, pacedGuide(actor, { ...f.guide, asOfGameTimeMs: f.guide.asOfGameTimeMs + 1800000 })),
    true,
  );
});
test("daily committed budgets and repeated messages are bounded without charging denials", () => {
  const f = fixture(),
    actor = {};
  for (let i = 0; i < 8; i++)
    recordOutcome(actor, { kind: "game.contact.request" }, "COMMITTED", f.guide.asOfGameTimeMs + i);
  assert.equal(
    actionAvailable(
      { kind: "game.contact.request" },
      pacedGuide(actor, { ...f.guide, asOfGameTimeMs: f.guide.asOfGameTimeMs + 8 }),
    ),
    false,
  );
  const msg = { kind: "game.message.send", recipientKingdomId: f.peers[1].kingdomId, body: "same" };
  recordOutcome(actor, msg, "COMMITTED", f.guide.asOfGameTimeMs);
  assert.equal(actionAvailable(msg, pacedGuide(actor, f.guide)), false);
  assert.equal(actionAvailable({ ...msg, body: "reply to new terms" }, pacedGuide(actor, f.guide)), true);
  recordOutcome(actor, { kind: "game.supply.offer" }, "TICK_PENDING", f.guide.asOfGameTimeMs);
  assert.equal(actor.pacing.usage.supply.length, 0);
});
test("conversation polling visits every contact without duplicated single-contact reads", () => {
  assert.equal(conversationContacts(fixture().guide, 0).length, 1);
  const guide = { contacts: Array.from({ length: 7 }, (_, i) => ({ kingdomId: `peer-${i}` })) };
  const seen = new Set();
  for (let i = 0; i < 7; i++) for (const c of conversationContacts(guide, i)) seen.add(c.kingdomId);
  assert.equal(seen.size, 7);
});
test("fresh offer checks reject own signatures, expired versions and local contract saturation", () => {
  const { guide, peers } = fixture();
  const offer = {
    id: "offer",
    version: 1,
    signedBy: [guide.self.kingdomId],
    expiresGameTimeMs: guide.asOfGameTimeMs + 60000,
    counterpartyKingdomId: peers[1].kingdomId,
    terms: {
      aToB: { resource: "grain", wholePerHour: 3 },
      bToA: { resource: "iron", wholePerHour: 3 },
      aBond: null,
      bBond: null,
      durationHours: 1,
      noticeHours: 0,
    },
  };
  guide.openSupplyOffers = [offer];
  const action = { kind: "game.supply.sign", offerId: "offer", version: 1 };
  assert.throws(() => validateAction(action, guide, new Set(peers.map((p) => p.kingdomId))), /OFFER_ALREADY_SIGNED/);
  offer.signedBy = [];
  offer.expiresGameTimeMs = guide.asOfGameTimeMs;
  assert.throws(() => validateAction(action, guide, new Set(peers.map((p) => p.kingdomId))), /OFFER_EXPIRED/);
  offer.expiresGameTimeMs += 60000;
  guide.activeSupplyContracts = Array.from({ length: 8 }, () => ({}));
  assert.throws(() => validateAction(action, guide, new Set(peers.map((p) => p.kingdomId))), /CONTRACT_CAPACITY/);
});
test("counter grammar requires a changed term, allows bilateral changes and rejects semantic no-ops", () => {
  const { guide, peers } = fixture();
  const terms = {
    aToB: { resource: "grain", wholePerHour: 3 },
    bToA: { resource: "iron", wholePerHour: 3 },
    aBond: null,
    bBond: null,
    durationHours: 1,
    noticeHours: 0,
  };
  guide.openSupplyOffers = [
    {
      id: "offer",
      version: 1,
      signedBy: [],
      expiresGameTimeMs: guide.asOfGameTimeMs + 60000,
      counterpartyKingdomId: peers[1].kingdomId,
      terms,
    },
  ];
  const variants = schemaFor(guide, peers).properties.actions.items.properties.action.oneOf;
  const counters = variants.find((v) => v.properties.kind.const === "game.supply.counter").properties.terms.anyOf;
  assert.equal(counters.length, 4);
  assert.ok(!counters[0].properties.aToB.properties.wholePerHour.enum.includes(3));
  const action = { kind: "game.supply.counter", offerId: "offer", expectedVersion: 1, terms };
  assert.throws(() => validateAction(action, guide, new Set(peers.map((p) => p.kingdomId))), /COUNTER_UNCHANGED/);
  assert.doesNotThrow(() =>
    validateAction(
      { ...action, terms: { ...terms, aToB: { resource: "grain", wholePerHour: 4 } } },
      guide,
      new Set(peers.map((p) => p.kingdomId)),
    ),
  );
});
test("truncated responses retain safe usage without admitting partial actions; verbose plans fail closed", async () => {
  const model = new LocalModel(
    { endpoint: "http://localhost:11434", timeoutMs: 1000, model: "qwen3.5:4b", outputTokens: 1000 },
    async () =>
      Response.json({
        done: true,
        done_reason: "length",
        prompt_eval_count: 55,
        eval_count: 1000,
        message: { content: '{"actions":[' },
      }),
  );
  await assert.rejects(
    model.invoke("fixture", {}, Date.now() + 1000),
    (e) =>
      e.message === "MODEL_OUTPUT_TRUNCATED" && e.modelUsage.outputTokens === 1000 && e.modelUsage.inputTokens === 55,
  );
  assert.throws(
    () => parsePlan({ understanding: "x".repeat(121), intent: "", nextCheck: "", actions: [] }),
    /INVALID_PLAN_TEXT/,
  );
});
test("negotiation measurement deduplicates receipt recovery and excludes unsigned expiry", () => {
  const receipt = (id, kind, at, action, records) => ({
    type: "receipt",
    actor: 0,
    at,
    action: { kind, ...action },
    receipt: { commandId: id, code: "COMMITTED", recordVersions: records },
  });
  const events = [
    receipt("a", "game.supply.offer", "2026-10-09T00:00:00Z", { terms: {} }, { "supply-offer:a": 1 }),
    receipt("b", "game.supply.offer", "2026-10-09T00:01:00Z", { terms: {} }, { "supply-offer:b": 1 }),
  ];
  events.push({ ...events[0], type: "receipt_recovered" });
  const result = analyzeNegotiations(events, {
    offers: [
      { id: "a", status: "active" },
      { id: "b", status: "expired" },
    ],
    contracts: [
      { offer_id: "a", created_at: "2026-10-09T00:05:00Z", start_game_time_ms: 0, end_game_time_ms: 3600000 },
    ],
  });
  assert.equal(result.offerCommands, 2);
  assert.equal(result.activatedOffers, 1);
  assert.equal(result.agreementLatency.medianMs, 300000);
  assert.equal(result.offerOutcomes.expired, 1);
});
