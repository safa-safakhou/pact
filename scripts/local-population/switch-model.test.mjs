import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { switchContinuousModel } from "./switch-model.mjs";

test("authorized paused switch preserves all fifty identities, counters, memory and game authority", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pact-model-switch-"));
  const env = { PACT_LOCAL_STATE: dir, PACT_MODEL_SWITCH_AUTHORIZATION: "existing-fifty-to-qwen3.5-9b" };
  const original = {
    runId: "same-run",
    mode: "full-game-continuous",
    status: "interrupted",
    authorization: "founder",
    config: { accounts: 50, model: "qwen3.5:4b", intervalSeconds: 300, context: 32768 },
    weights: { name: "qwen3.5:4b", digest: "old" },
    requests: 4100,
    actors: Array.from({ length: 50 }, (_, index) => ({
      index,
      kingdomId: `kingdom-${index}`,
      turns: 90,
      nextDue: 1000,
      memory: { intent: "keep" },
      socialAgenda: [{ id: "pending-message", responded: false }],
      ownerPolicy: "keep",
    })),
  };
  const file = path.join(dir, "private-state.json");
  const write = (s) => fs.writeFileSync(file, JSON.stringify(s));
  const options = { preflight: async () => ({ name: "qwen3.5:9b", digest: "new" }), now: () => 1000 };
  try {
    write(original);
    await assert.rejects(switchContinuousModel({ PACT_LOCAL_STATE: dir }, options), /AUTHORIZATION_REQUIRED/);
    for (const patch of [
      { status: "finished" },
      { mode: "full-game-verification" },
      { actors: original.actors.map((a, i) => (i ? a : { ...a, pending: { commandId: "exact" } })) },
    ]) {
      write({ ...original, ...patch });
      await assert.rejects(switchContinuousModel(env, options), /STATE_NOT_READY/);
    }
    write(original);
    fs.writeFileSync(path.join(dir, "runner.lock"), JSON.stringify({ pid: process.pid }));
    await assert.rejects(switchContinuousModel(env, options), /ALREADY_RUNNING/);
    fs.unlinkSync(path.join(dir, "runner.lock"));
    await assert.rejects(
      switchContinuousModel(env, {
        preflight: async () => {
          throw Error("UNAVAILABLE");
        },
      }),
      /UNAVAILABLE/,
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), original);
    await switchContinuousModel(env, options);
    const after = JSON.parse(fs.readFileSync(file));
    assert.equal(after.config.model, "qwen3.5:9b");
    assert.deepEqual(
      after.actors.map(({ model: _model, ...actor }) => actor),
      original.actors,
    );
    assert.deepEqual(
      {
        ...after,
        config: original.config,
        weights: original.weights,
        actors: original.actors,
        modelChanges: undefined,
      },
      { ...original, modelChanges: undefined },
    );
    assert.equal(after.modelChanges[0].requests, 4100);
    assert.equal((await switchContinuousModel(env, options)).unchanged, true);
    assert.equal(JSON.parse(fs.readFileSync(file)).modelChanges.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
