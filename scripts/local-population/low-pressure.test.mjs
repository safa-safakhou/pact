import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyLowPressure } from "./low-pressure.mjs";
import { LocalModel } from "./ollama.mjs";
import { coolAfterTurn, nextContinuousActor } from "./scheduler.mjs";

test("authorized low-pressure change staggers owners and preserves pending writes, counters and authority", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pact-cooling-"));
  const env = { PACT_LOCAL_STATE: dir, PACT_LOW_PRESSURE_AUTHORIZATION: "cool-existing-fifty-hourly" };
  const original = {
    mode: "full-game-continuous",
    runId: "same",
    status: "interrupted",
    authorization: "keep",
    requests: 5000,
    config: { accounts: 50, model: "qwen3.5:9b", intervalSeconds: 300 },
    actors: Array.from({ length: 50 }, (_, index) => ({
      index,
      kingdomId: `kingdom-${index}`,
      turns: 100,
      nextDue: 0,
      ownerPolicy: "keep",
      memory: { intent: "keep" },
      pending: index === 0 ? { commandId: "same-id", action: { kind: "exact" } } : undefined,
    })),
  };
  const file = path.join(dir, "private-state.json");
  const write = (state) => fs.writeFileSync(file, JSON.stringify(state));
  try {
    write(original);
    assert.throws(() => applyLowPressure({ PACT_LOCAL_STATE: dir }), /AUTHORIZATION_REQUIRED/);
    for (const patch of [{ status: "finished" }, { mode: "full-game-comparison" }]) {
      write({ ...original, ...patch });
      assert.throws(() => applyLowPressure(env), /STATE_INVALID/);
    }
    write(original);
    fs.writeFileSync(path.join(dir, "STOP"), "");
    assert.throws(() => applyLowPressure(env), /STATE_INVALID/);
    fs.unlinkSync(path.join(dir, "STOP"));
    fs.writeFileSync(path.join(dir, "runner.lock"), JSON.stringify({ pid: process.pid }));
    assert.throws(() => applyLowPressure(env), /ALREADY_RUNNING/);
    fs.unlinkSync(path.join(dir, "runner.lock"));
    applyLowPressure(env, { now: () => 1000 });
    const state = JSON.parse(fs.readFileSync(file));
    assert.equal(state.requests, 5000);
    assert.equal(state.runId, "same");
    assert.equal(state.nextTurnAt, 301000);
    assert.equal(state.actors[49].nextDue, 301000 + 49 * 72000);
    for (let i = 0; i < 50; i++) {
      const { nextDue: _due, ...actual } = state.actors[i];
      const { nextDue: _oldDue, ...expected } = JSON.parse(JSON.stringify(original.actors[i]));
      assert.deepEqual(actual, expected);
    }
    assert.equal(nextContinuousActor(state, 300999), undefined);
    assert.equal(nextContinuousActor(state, 301000).index, 0);
    coolAfterTurn(state, 400000);
    state.actors[1].nextDue = 0; // Overdue work cannot bypass the cooling gap.
    assert.equal(nextContinuousActor(state, 459999), undefined);
    assert.equal(nextContinuousActor(state, 460000).index, 1);
    assert.equal(applyLowPressure(env, { now: () => 900000 }).unchanged, true);
    assert.equal(JSON.parse(fs.readFileSync(file)).nextTurnAt, 301000);
    const ordinary = { config: {}, actors: [{ index: 0, nextDue: 0 }] };
    coolAfterTurn(ordinary, 400000);
    assert.equal(ordinary.nextTurnAt, undefined);
    assert.equal(nextContinuousActor(ordinary, 0).index, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("explicit zero keep-alive reaches Ollama instead of the ordinary ten-minute default", async () => {
  let body;
  const model = new LocalModel(
    {
      endpoint: "http://127.0.0.1:11434",
      model: "fixture",
      keepAlive: 0,
      timeoutMs: 1000,
      context: 32768,
      outputTokens: 2400,
    },
    async (_url, options) => {
      body = JSON.parse(options.body);
      return Response.json({
        done: true,
        message: { content: '{"actions":[]}' },
        prompt_eval_count: 20,
        eval_count: 5,
      });
    },
  );
  await model.invoke("synthetic", {}, Date.now() + 1000);
  assert.equal(body.keep_alive, 0);
  assert.equal(body.options.num_ctx, 32768);
});
