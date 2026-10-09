import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { localEndpoint, readConfig } from "./config.mjs";
import { fixture } from "./fixture.mjs";
import { LocalModel } from "./ollama.mjs";
import { cohortGuide, PLAN_SCHEMA, parsePlan, promptFor, schemaFor, validateAction } from "./plan.mjs";
import { executeAction, reconcilePending } from "./runner.mjs";
import { capacity, finishTurn, nextActor } from "./scheduler.mjs";
import { RunStore, reserveRequest } from "./state.mjs";

test("only credential-free loopback inference endpoints and external state are accepted", () => {
  assert.equal(localEndpoint("http://127.0.0.1:11434"), "http://127.0.0.1:11434");
  for (const value of [
    "https://api.openai.com",
    "http://192.168.0.1",
    "http://localhost@evil.test",
    "http://localhost/?redirect=x",
    "http://u:p@localhost",
  ])
    assert.throws(() => localEndpoint(value));
  assert.throws(() => readConfig({}));
  assert.throws(
    () => readConfig({ PACT_LOCAL_STATE: "\\\\wsl.localhost\\Ubuntu\\state" }, "win32"),
    /WINDOWS_STATE_LOCAL_DISK_REQUIRED/,
  );
  assert.throws(
    () => readConfig({ PACT_LOCAL_STATE: "//wsl.localhost/Ubuntu/state" }, "win32"),
    /WINDOWS_STATE_LOCAL_DISK_REQUIRED/,
  );
  assert.throws(() => readConfig({ PACT_LOCAL_STATE: path.resolve("scripts/local-population") }));
  assert.throws(() => readConfig({ PACT_LOCAL_STATE: os.tmpdir(), PACT_LOCAL_INTERVAL_SECONDS: "1" }));
});

test("durable lock prevents a duplicate worker and charged requests survive reopening", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pact-local-test-"));
  try {
    const store = new RunStore(dir);
    assert.throws(() => new RunStore(dir));
    const state = { requests: 0, endsAt: 100, config: { requestCap: 1 } };
    reserveRequest(state, 99, () => store.save(state));
    assert.throws(() => reserveRequest(state, 99, () => {}), /REQUEST_CAP/);
    store.close();
    const reopened = new RunStore(dir);
    assert.equal(reopened.read().requests, 1);
    assert.throws(() => reserveRequest({ ...state, requests: 0 }, 100, () => {}), /DEADLINE/);
    reopened.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("model transport counts outputs, rejects cloud entries, truncation and late dispatch", async () => {
  const calls = [];
  const config = {
    endpoint: "http://localhost:11434",
    model: "qwen3.5:4b",
    timeoutMs: 1000,
    context: 8192,
    outputTokens: 600,
  };
  const model = new LocalModel(config, async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/api/tags"))
      return Response.json({ models: [{ name: config.model, size: 123, digest: "digest" }] });
    return Response.json({
      done: true,
      done_reason: "stop",
      message: { content: JSON.stringify({ actions: [] }) },
      prompt_eval_count: 20,
      eval_count: 10,
    });
  });
  await model.preflight();
  const result = await model.invoke("safe synthetic facts", PLAN_SCHEMA, Date.now() + 1000);
  assert.equal(result.inputTokens, 20);
  const request = JSON.parse(calls[1].options.body);
  assert.equal(request.think, false);
  assert.equal(request.options.num_predict, 600);
  assert.equal(calls[1].options.redirect, "error");
  await assert.rejects(model.invoke("prompt", PLAN_SCHEMA, Date.now() - 1), /DEADLINE/);
  const cloud = new LocalModel(config, async () =>
    Response.json({ models: [{ name: config.model, size: 1, digest: "x", remote_host: "cloud" }] }),
  );
  await assert.rejects(cloud.preflight(), /LOCAL_WEIGHTS_REQUIRED/);
  const truncated = new LocalModel(config, async () =>
    Response.json({ done: true, done_reason: "length", message: { content: "{}" } }),
  );
  await assert.rejects(truncated.invoke("p", PLAN_SCHEMA, Date.now() + 1000), /MODEL_OUTPUT_TRUNCATED/);
});

test("plans cannot impersonate humans, target outsiders, sign invented offers or expand liabilities", () => {
  const { guide, peers } = fixture();
  const cohort = new Set(peers.map((p) => p.kingdomId));
  const valid = { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 };
  assert.doesNotThrow(() => validateAction(valid, guide, cohort));
  for (const action of [
    { kind: "game.contact.answer", requestId: "x", accept: true },
    { ...valid, owner: "human" },
    { ...valid, targetLevel: 7 },
    { kind: "game.message.send", recipientKingdomId: "outsider", body: "hello" },
    { kind: "game.supply.sign", offerId: "invented", version: 1 },
    {
      kind: "game.supply.offer",
      counterpartyKingdomId: peers[1].kingdomId,
      terms: {
        aToB: { resource: "grain", wholePerHour: 3 },
        bToA: { resource: "iron", wholePerHour: 3 },
        aBond: null,
        bBond: null,
        durationHours: 24,
        noticeHours: 0,
      },
    },
  ])
    assert.throws(() => validateAction(action, guide, cohort));
  assert.throws(() =>
    parsePlan({
      understanding: "",
      intent: "",
      nextCheck: "",
      actions: Array(4).fill({ actionJson: "{}", reason: "" }),
    }),
  );
});

test("unrelated contact and offer metadata stays out of cohort prompts", () => {
  const f = fixture();
  f.guide.contacts.push({ kingdomId: "outsider", privateNote: "not ours" });
  f.guide.openSupplyOffers.push({ counterpartyKingdomId: "outsider", id: "secret" });
  const guide = cohortGuide(f.guide, new Set(f.peers.map((p) => p.kingdomId)));
  assert.equal(guide.contacts.length, 1);
  assert.equal(guide.openSupplyOffers.length, 0);
  assert.ok(!promptFor(f.actor, guide, f.peers).includes("privateNote"));
});

test("fresh owner facts reject a second build after its building or slot becomes occupied", () => {
  const { guide, peers } = fixture();
  const cohort = new Set(peers.map((p) => p.kingdomId));
  const action = { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 };
  guide.constructionStockChecks[0].busy = true;
  assert.throws(() => validateAction(action, guide, cohort), /BUILD_NO_LONGER_AVAILABLE/);
  guide.constructionStockChecks[0].busy = false;
  guide.builders[0] = { slot: 1, instructionId: "occupied", state: "active" };
  assert.throws(() => validateAction(action, guide, cohort), /BUILD_NO_LONGER_AVAILABLE/);
  assert.doesNotThrow(() => validateAction({ ...action, slot: 2 }, guide, cohort));
});

test("dynamic schema cannot generate unobserved signatures, repeated introductions or busy builds", () => {
  const f = fixture();
  const schema = schemaFor(f.guide, f.peers);
  const variants = schema.properties.actions.items.properties.action.oneOf;
  assert.ok(!variants.some((v) => v.properties.kind.const === "game.supply.sign"));
  assert.ok(!variants.some((v) => v.properties.kind.const === "game.contact.request"));
  f.guide.constructionStockChecks.forEach((b) => {
    b.busy = true;
  });
  f.guide.contacts = [];
  f.guide.resources.silver.facts.ordinaryWhole = "0";
  assert.deepEqual(schemaFor(f.guide, f.peers).properties.actions.const, []);
  const action = { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 };
  assert.deepEqual(
    parsePlan({ understanding: "", intent: "", nextCheck: "", actions: [{ action, reason: "build" }] }),
    [action],
  );
});

test("lost command response is reconciled without minting another command ID", async () => {
  const actor = { index: 0 };
  const calls = [];
  const mcp = {
    call: async (name, args) => {
      calls.push({ name, args });
      if (name === "pact_game_action_v1") throw Error("socket lost");
      return { commandId: args.commandId, code: "COMMITTED" };
    },
  };
  const result = await executeAction({
    actor,
    action: { kind: "game.building.queue" },
    mcp,
    save() {},
    emit() {},
    active: () => true,
  });
  assert.equal(result.code, "COMMITTED");
  assert.equal(calls[0].args.commandId, calls[1].args.commandId);
  assert.equal(actor.pending, undefined);
});

test("uncertain commands halt writes and recovery reuses the exact pending action", async () => {
  const actor = { index: 0 };
  const args = {
    actor,
    action: { kind: "game.building.queue" },
    mcp: {
      call: async () => {
        throw Error("network");
      },
    },
    save() {},
    emit() {},
    active: () => true,
  };
  await assert.rejects(executeAction(args), /UNCERTAIN_COMMAND/);
  const pending = structuredClone(actor.pending);
  const calls = [];
  const mcp = {
    call: async (name, value) => {
      calls.push({ name, value });
      if (name === "pact_receipt_read_v1") return { code: "RECEIPT_NOT_FOUND" };
      if (name === "run.open") return {};
      return { commandId: value.commandId, code: "COMMITTED" };
    },
  };
  await reconcilePending({ actor, mcp, save() {}, emit() {}, active: () => true });
  assert.deepEqual(calls[2].value, { commandId: pending.commandId, action: pending.action });
  assert.equal(actor.blocked, undefined);
  await assert.rejects(executeAction({ ...args, active: () => false }), /RUN_STOPPED/);
});

test("definitive denials do not become uncertain writes or successful receipts", async () => {
  const actor = { index: 0 };
  const error = Object.assign(Error("denied"), { serverCode: "INSUFFICIENT_STOCK" });
  const result = await executeAction({
    actor,
    action: {},
    mcp: {
      call: async () => {
        throw error;
      },
    },
    save() {},
    emit() {},
    active: () => true,
  });
  assert.equal(result.receiptExists, false);
  assert.equal(actor.pending, undefined);
});

test("scheduler is fair and skips missed periods while capacity includes headroom", () => {
  const actors = [
    { index: 1, nextDue: 0 },
    { index: 0, nextDue: 0 },
    { index: 2, nextDue: -1, blocked: true },
  ];
  assert.equal(nextActor(actors, 0).index, 0);
  finishTurn(actors[1], 0, 1000000, 300000);
  assert.equal(actors[1].nextDue, 1300000);
  assert.equal(nextActor(actors, 1).index, 1);
  assert.equal(capacity([10000, 10000]).projections[0].p95Accounts, 21);
  assert.equal(capacity([]), null);
});
