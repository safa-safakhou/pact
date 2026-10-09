import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "./fixture.mjs";
import { approveOwnerAction, OWNER_POLICY, ownerMayHandle, reserveOwnerDecision } from "./owner.mjs";
import { reconcilePending } from "./runner.mjs";

function setup() {
  const f = fixture();
  const actor = {
    index: 0,
    kingdomId: f.guide.self.kingdomId,
    ownerPolicy: OWNER_POLICY,
    entryKey: "synthetic-entry",
    cookie: "fake-owner-cookie",
    csrfToken: "fake-csrf",
  };
  return {
    actor,
    guide: f.guide,
    cohort: new Set(f.peers.map((p) => p.kingdomId)),
    action: { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 },
    commandId: "00000000-0000-4000-8000-000000000010",
    config: { ownerApprovals: "bounded", ownerApprovalCap: 2, ownerResourceLimit: 100 },
    save() {},
    emit() {},
    active: () => true,
  };
}
const approvalId = "00000000-0000-4000-8000-000000000020";
test("owner decisions require synthetic identity, exact allowed actions and persistent ceilings", () => {
  const a = setup();
  const d = reserveOwnerDecision(a);
  assert.equal(d.costs.iron, "50");
  assert.equal(reserveOwnerDecision(a), d);
  assert.throws(() => reserveOwnerDecision({ ...a, action: { ...a.action, slot: 2 } }), /CONFLICT/);
  const restored = JSON.parse(JSON.stringify(a.actor));
  reserveOwnerDecision({ ...a, actor: restored, commandId: "second" });
  assert.throws(() => reserveOwnerDecision({ ...a, actor: restored, commandId: "third" }), /CAP/);
  assert.throws(
    () => reserveOwnerDecision({ ...setup(), config: { ...a.config, ownerResourceLimit: 49 } }),
    /RESOURCE_CAP/,
  );
  assert.throws(() => reserveOwnerDecision({ ...setup(), actor: { ...a.actor, ownerPolicy: undefined } }), /FORBIDDEN/);
  assert.throws(() => reserveOwnerDecision({ ...setup(), action: { kind: "game.transfer" } }));
  assert.equal(ownerMayHandle("INSUFFICIENT_STOCK", a.config), false);
  assert.equal(ownerMayHandle("TICK_PENDING", a.config), false);
  assert.equal(ownerMayHandle("FORBIDDEN", { ...a.config, ownerApprovals: "off" }), false);
});

test("exact requests are reviewed and approved through the separate owner client", async () => {
  const a = setup();
  const calls = [];
  a.mcp = {
    call: async (name, args) => {
      calls.push({ name, args });
      return { approvalId };
    },
  };
  a.client = {
    http: async (route, body) => {
      calls.push({ route, body });
      if (!body)
        return {
          approvalId,
          commandId: a.commandId,
          status: "pending",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        };
      return { receipt: { commandId: a.commandId, code: "COMMITTED" } };
    },
  };
  assert.equal((await approveOwnerAction(a)).code, "COMMITTED");
  assert.deepEqual(calls[0].args, { commandId: a.commandId, action: a.action });
  assert.equal(calls[2].route, `/v1/approvals/${approvalId}/approve`);
  assert.equal(a.actor.pending, undefined);
  assert.equal(Object.keys(a.actor.ownerDecisions).length, 1);
  assert.ok(!JSON.stringify(calls.filter((c) => c.name)).includes("cookie"));
});

test("unknown command reviews, expiry and stop never authorize a POST", async () => {
  for (const change of [{ commandId: "other" }, { expiresAt: "2000-01-01" }, { expiresAt: "invalid" }]) {
    const a = setup();
    let posts = 0;
    a.mcp = { call: async () => ({ approvalId }) };
    a.client = {
      http: async (_route, body) => {
        if (body) posts++;
        return {
          approvalId,
          commandId: a.commandId,
          status: "pending",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          ...change,
        };
      },
    };
    await assert.rejects(approveOwnerAction(a));
    assert.equal(posts, 0);
    assert.ok(a.actor.pending);
  }
  await assert.rejects(approveOwnerAction({ ...setup(), active: () => false }), /RUN_STOPPED/);
});

test("lost owner response reconciles the original receipt without another decision or approval", async () => {
  const a = setup();
  a.mcp = { call: async () => ({ approvalId }) };
  a.client = {
    http: async (_route, body) => {
      if (body) throw Error("lost response");
      return {
        approvalId,
        commandId: a.commandId,
        status: "pending",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      };
    },
  };
  await assert.rejects(approveOwnerAction(a));
  a.mcp = {
    call: async (name, args) => {
      assert.equal(name, "pact_receipt_read_v1");
      assert.equal(args.commandId, a.commandId);
      return { commandId: a.commandId, code: "COMMITTED" };
    },
  };
  await reconcilePending(a);
  assert.equal(a.actor.pending, undefined);
  assert.equal(Object.keys(a.actor.ownerDecisions).length, 1);
});

test("supply owner decisions preserve exact bounded terms through the ordinary owner command route", async () => {
  const a = setup();
  const other = [...a.cohort].find((id) => id !== a.actor.kingdomId);
  const terms = {
    aToB: { resource: "grain", wholePerHour: 3 },
    bToA: { resource: "iron", wholePerHour: 3 },
    aBond: null,
    bBond: null,
    durationHours: 1,
    noticeHours: 0,
  };
  a.guide.openSupplyOffers = [
    {
      id: "offer",
      version: 1,
      kingdomA: a.actor.kingdomId,
      kingdomB: other,
      counterpartyKingdomId: other,
      terms,
      signedBy: [],
    },
  ];
  a.action = { kind: "game.supply.sign", offerId: "offer", version: 1 };
  a.client = {
    humanCommand: async (action, commandId) => {
      assert.deepEqual(action, a.action);
      assert.equal(commandId, a.commandId);
      return { commandId, code: "COMMITTED" };
    },
  };
  assert.equal((await approveOwnerAction(a)).code, "COMMITTED");
  assert.equal(a.actor.ownerDecisions[a.commandId].costs.grain, "3");
  const b = setup();
  b.guide = a.guide;
  b.action = a.action;
  b.guide.openSupplyOffers[0].terms.durationHours = 24;
  assert.throws(() => reserveOwnerDecision(b), /TERMS_LIMIT/);
});

test("uncommitted owner decisions reopen one recovery lease and preserve the original budget and command", async () => {
  const a = setup();
  const decision = reserveOwnerDecision(a);
  a.actor.pending = { commandId: a.commandId, action: a.action, role: "simulated-human-approval" };
  const calls = [];
  a.mcp = {
    call: async (name, args) => {
      calls.push({ name, args });
      if (name === "pact_receipt_read_v1") return { code: "RECEIPT_NOT_FOUND" };
      return { approvalId };
    },
  };
  a.client = {
    http: async (_route, body) =>
      body
        ? { receipt: { commandId: a.commandId, code: "COMMITTED" } }
        : {
            approvalId,
            commandId: a.commandId,
            status: "pending",
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
  };
  assert.equal(await reconcilePending(a), true);
  assert.deepEqual(
    calls.map((c) => c.name),
    ["pact_receipt_read_v1", "run.open", "pact_approval_propose_v1"],
  );
  assert.deepEqual(calls[2].args, { commandId: a.commandId, action: a.action });
  assert.equal(a.actor.ownerDecisions[a.commandId], decision);
  assert.equal(Object.keys(a.actor.ownerDecisions).length, 1);
});
