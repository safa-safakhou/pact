import assert from "node:assert/strict";
import test from "node:test";
import {
  actionFamilies,
  dispatchFullCommand,
  FULL_OWNER_POLICY,
  fullPlanSchema,
  fullPrompt,
  isGameRead,
  parseFullPlan,
  prepareFullCommand,
  recoverFullCommand,
  validateFullAction,
} from "./full-game.mjs";

const id = "00000000-0000-4000-8000-000000000001";
const actorFor = () => ({ index: 0, kingdomId: id, entryKey: "synthetic-key", ownerPolicy: FULL_OWNER_POLICY });

test("large accumulated read results are paged with labels while the entire action catalog stays visible", () => {
  const observations = {
    reads: Array.from({ length: 20 }, (_, i) => ({ result: { body: "x".repeat(100000), id: String(i) } })),
  };
  const prompt = fullPrompt({ memory: {} }, observations, [], []);
  assert.ok(prompt.length <= 78000);
  const input = JSON.parse(prompt.slice(prompt.indexOf("\n") + 1));
  assert.equal(input.availableActions.length, actionFamilies.size);
  assert.ok(input.truncatedCollections.length > 0);
  assert.match(input.observations.reads[0].result.body, /remainder omitted/);
});
test("full catalog includes every implemented family and unrestricted engine contract terms", () => {
  for (const kind of [
    "court.create",
    "court.join",
    "article.publish",
    "allegiance.propose",
    "seal.publish",
    "chronicle.publish",
    "invitation.issue",
    "game.training.queue",
    "game.scout.start",
    "game.raid.declare",
    "game.garrison.offer",
    "game.supply.release",
    "game.transfer",
  ])
    assert.ok(actionFamilies.has(kind), kind);
  validateFullAction({
    kind: "game.supply.offer",
    counterpartyKingdomId: id,
    terms: {
      aToB: { resource: "grain", wholePerHour: 100 },
      bToA: null,
      aBond: { resource: "silver", wholeAmount: 20 },
      bBond: null,
      durationHours: 72,
      noticeHours: 6,
    },
  });
  assert.throws(() => validateFullAction({ kind: "authority.raise" }), /NOT_A_GAME_COMMAND/);
  assert.throws(() => validateFullAction({ kind: "court.join", courtId: "invented" }));
});
test("model read calls cannot turn into write tools, URLs or arbitrary owner HTTP", () => {
  const tools = [{ name: "pact_court_read_v1", inputSchema: { type: "object" } }, { name: "pact_game_action_v1" }];
  assert.equal(isGameRead(tools[0]), true);
  assert.equal(isGameRead(tools[1]), false);
  const plan = {
    intent: "Read",
    nextCheck: "Check roster",
    actions: [],
    reads: [{ name: "pact_court_read_v1", args: {} }],
  };
  parseFullPlan(plan, tools);
  assert.throws(
    () => parseFullPlan({ ...plan, reads: [{ name: "pact_game_action_v1", args: {} }] }, tools),
    /INVALID_GAME_READ/,
  );
  assert.equal(fullPlanSchema(tools).properties.reads.items.oneOf.length, 1);
});
test("publication owner binds fresh exact selection and requires explicit synthetic policy", async () => {
  const action = {
    kind: "seal.publish",
    selection: { recordType: "message", recordId: id },
    previewDigest: "0".repeat(64),
  };
  const client = {
    http: async (route, selection) => {
      assert.equal(route, "/v1/seals/preview");
      assert.deepEqual(selection, action.selection);
      return { previewDigest: "a".repeat(64) };
    },
  };
  const result = await prepareFullCommand(actorFor(), action, client);
  assert.equal(result.action.previewDigest, "a".repeat(64));
  assert.equal(result.version, "pact.seal-command.v1");
  assert.equal(result.role, "synthetic-owner");
  assert.equal(action.previewDigest, "0".repeat(64));
  await assert.rejects(
    prepareFullCommand({ ...actorFor(), ownerPolicy: "ordinary-human" }, action, client),
    /AUTHORIZATION_REQUIRED/,
  );
});
test("authority denial routes exact command through owner while stock denial never does", async () => {
  for (const code of ["FORBIDDEN", "INSUFFICIENT_STOCK"]) {
    const actor = actorFor(),
      commandId = id,
      action = { kind: "game.training.queue", type: "spearman", count: 2 };
    let ownerCalls = 0;
    const context = {
      actor,
      pending: { commandId, action, version: "pact.command.v1", role: "agent" },
      client: {
        humanCommand: async (received, receivedId) => {
          assert.deepEqual(received, action);
          assert.equal(receivedId, commandId);
          assert.equal(actor.pending.role, "synthetic-owner");
          ownerCalls++;
          return { commandId, code: "COMMITTED" };
        },
      },
      mcp: {
        call: async (name) => {
          if (name === "run.open") return {};
          throw Object.assign(Error(code), { serverCode: code });
        },
      },
      save() {},
      emit() {},
      active: () => true,
    };
    const receipt = await dispatchFullCommand(context);
    assert.equal(ownerCalls, code === "FORBIDDEN" ? 1 : 0);
    assert.equal(receipt.code, code === "FORBIDDEN" ? "COMMITTED" : code);
    assert.equal(actor.pending, undefined);
  }
});
test("multiple actions in one connection reuse its lease instead of reopening an active run", async () => {
  const actor = actorFor();
  let opens = 0,
    writes = 0;
  const mcp = {
    call: async (name, args) => {
      if (name === "run.open") {
        opens++;
        assert.equal(opens, 1);
        return {};
      }
      writes++;
      return { commandId: args.commandId, code: "COMMITTED" };
    },
  };
  for (let i = 0; i < 2; i++)
    await dispatchFullCommand({
      actor,
      pending: {
        commandId: `${id.slice(0, -1)}${i}`,
        action: { kind: "game.training.queue", type: "spearman", count: 1 },
        role: "agent",
        version: "pact.command.v1",
      },
      mcp,
      client: {},
      save() {},
      emit() {},
      active: () => true,
    });
  assert.equal(writes, 2);
  assert.equal(opens, 1);
});
test("uncertain human commit keeps exact payload and recovers receipt without duplicate execution", async () => {
  const actor = actorFor();
  const pending = {
    commandId: id,
    version: "pact.court-command.v1",
    role: "synthetic-owner",
    action: { kind: "court.join", courtId: id },
  };
  const context = {
    actor,
    pending,
    client: {
      http: async () => {
        throw Error("connection lost");
      },
    },
    mcp: { call: async () => ({ commandId: id, code: "COMMITTED" }) },
    save() {},
    emit() {},
    active: () => true,
  };
  await assert.rejects(dispatchFullCommand(context), /UNCERTAIN_COMMAND/);
  assert.deepEqual(actor.pending, pending);
  await recoverFullCommand(context);
  assert.equal(actor.pending, undefined);
});
test("receipt-not-found retries same command; STOP prevents every route", async () => {
  const actor = actorFor();
  actor.pending = {
    commandId: id,
    version: "pact.court-command.v1",
    role: "synthetic-owner",
    action: { kind: "court.join", courtId: id },
  };
  const pending = actor.pending;
  let calls = 0;
  const context = {
    actor,
    client: {
      http: async (route, body) => {
        assert.equal(route, "/v1/social/commands");
        assert.equal(body.commandId, id);
        assert.deepEqual(body.action, pending.action);
        calls++;
        return { receipt: { commandId: id, code: "COMMITTED" }, result: { courtId: id } };
      },
    },
    mcp: { call: async () => ({ commandId: id, code: "RECEIPT_NOT_FOUND" }) },
    save() {},
    emit() {},
    active: () => true,
  };
  await recoverFullCommand(context);
  assert.equal(calls, 1);
  await assert.rejects(dispatchFullCommand({ ...context, pending, active: () => false }), /RUN_STOPPED/);
  assert.equal(calls, 1);
});
