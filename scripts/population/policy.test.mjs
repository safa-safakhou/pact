import assert from "node:assert/strict";
import test from "node:test";
import { botPlan, validatePlanAction } from "./policy.mjs";

const peers = Array.from({ length: 100 }, (_, index) => ({ index, kingdomId: `k${index}` }));
const guide = {
  state: "active",
  worldStatus: "active",
  self: { kingdomId: "k10" },
  builders: [{ slot: 1, instructionId: null }],
  buildings: [{ kind: "hall", level: 1 }],
  constructionStockChecks: [{ building: "farm", targetLevel: 2, stockAffordable: true, busy: false }],
  contacts: [],
  contactRequests: [],
  openSupplyOffers: [],
  activeSupplyContracts: [],
  resources: {
    silver: { ordinaryMarked: "0", ordinaryWholeFloor: "0" },
    grain: { ordinaryMarked: "0", ordinaryWholeFloor: "0" },
    iron: { ordinaryMarked: "0", ordinaryWholeFloor: "0" },
  },
};
test("new bots can build but cannot spend founding silver on contacts", () => {
  assert.deepEqual(
    botPlan(guide, { index: 10, nickname: "bot" }, peers, {}, 0).map((x) => x.kind),
    ["game.building.queue"],
  );
});
test("busy buildings are not queued into a different slot", () => {
  const g = structuredClone(guide);
  g.constructionStockChecks[0].busy = true;
  assert.equal(botPlan(g, { index: 10 }, peers, {}, 0).length, 0);
});
test("contact waits for ordinary silver and never duplicates incoming request", () => {
  const g = structuredClone(guide);
  g.resources.silver.ordinaryMarked = "1200";
  g.contactRequests = [{ kingdomId: "k0" }, { kingdomId: "k11" }];
  assert.ok(!botPlan(g, { index: 10 }, peers, {}, 1).some((a) => a.kind === "game.contact.request"));
});
test("cohort boundary and human-only actions are enforced before dispatch", () => {
  assert.throws(() => validatePlanAction({ kind: "game.contact.answer" }, guide, new Set(["k10"])));
  assert.throws(() =>
    validatePlanAction({ kind: "game.message.send", recipientKingdomId: "outsider" }, guide, new Set(["k10"])),
  );
});
test("unseen/stale signatures and excessive experimental liabilities are rejected", () => {
  assert.throws(() =>
    validatePlanAction({ kind: "game.supply.sign", offerId: "invented", version: 1 }, guide, new Set()),
  );
  assert.throws(() =>
    validatePlanAction(
      { kind: "game.supply.offer", counterpartyKingdomId: "k11", terms: { durationHours: 24 } },
      guide,
      new Set(["k11"]),
    ),
  );
});
test("bot rejects a one-sided or unaffordable offer", () => {
  const g = structuredClone(guide);
  g.contacts = [{ kingdomId: "k0" }];
  g.openSupplyOffers = [
    {
      id: "offer",
      counterpartyKingdomId: "k0",
      signedBy: [],
      terms: { durationHours: 1, noticeHours: 0, aBond: null, bBond: null },
      youSend: { resource: "grain", wholePerHour: 6 },
      youReceive: null,
    },
  ];
  assert.ok(!botPlan(g, { index: 10 }, peers, {}, 3).some((a) => a.kind === "game.supply.sign"));
});

test("script counteroffers preserve A/B resources and use the observed version", () => {
  const g = structuredClone(guide);
  g.contacts = [{ kingdomId: "k0" }];
  g.openSupplyOffers = [
    {
      id: "offer",
      version: 4,
      counterpartyKingdomId: "k0",
      signedBy: [],
      terms: {
        aToB: { resource: "grain", wholePerHour: 9 },
        bToA: { resource: "silver", wholePerHour: 2 },
        durationHours: 1,
        noticeHours: 0,
        aBond: null,
        bBond: null,
      },
      youSend: { resource: "grain", wholePerHour: 9 },
      youReceive: { resource: "silver", wholePerHour: 2 },
    },
  ];
  const action = botPlan(g, { index: 10, nickname: "bot" }, peers, {}, 3).find((a) => a.kind === "game.supply.counter");
  assert.equal(action.expectedVersion, 4);
  assert.deepEqual(action.terms.aToB, { resource: "grain", wholePerHour: 3 });
  assert.deepEqual(action.terms.bToA, { resource: "silver", wholePerHour: 3 });
  assert.doesNotThrow(() => validatePlanAction(action, g, new Set(["k0"])));
});
