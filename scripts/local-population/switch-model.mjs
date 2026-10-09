import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "./config.mjs";
import { LocalModel } from "./ollama.mjs";
import { RunStore } from "./state.mjs";
import { clearDeadLock } from "./supervisor.mjs";

export async function switchContinuousModel(env, { preflight, now = Date.now } = {}) {
  if (env.PACT_MODEL_SWITCH_AUTHORIZATION !== "existing-fifty-to-qwen3.5-9b")
    throw Error("MODEL_SWITCH_AUTHORIZATION_REQUIRED");
  const { dir } = readConfig(env);
  if (!clearDeadLock(dir)) throw Error("CONTROLLER_ALREADY_RUNNING");
  const store = new RunStore(dir);
  try {
    const state = store.read();
    if (
      state?.mode !== "full-game-continuous" ||
      !state.authorization ||
      ["finished", "stopped"].includes(state.status) ||
      store.stopped() ||
      state.config.accounts !== 50 ||
      state.actors.length !== 50 ||
      new Set(state.actors.map((actor) => actor.kingdomId)).size !== 50 ||
      state.actors.some((actor) => !actor.kingdomId || actor.pending)
    )
      throw Error("MODEL_SWITCH_STATE_NOT_READY");
    const model = "qwen3.5:9b";
    const weights = await (preflight
      ? preflight({ ...state.config, model })
      : new LocalModel({ ...state.config, model }).preflight());
    if (weights.name !== model || !weights.digest) throw Error("MODEL_SWITCH_WEIGHTS_INVALID");
    if (state.config.model === model) {
      if (state.weights.digest !== weights.digest) throw Error("MODEL_DIGEST_CHANGED");
      return { runId: state.runId, model, unchanged: true };
    }
    const change = {
      at: new Date(now()).toISOString(),
      from: state.config.model,
      to: model,
      previousDigest: state.weights.digest,
      digest: weights.digest,
      requests: state.requests,
      authorization:
        "Founder requested switching the existing fifty accounts to the better tested model, 9 October 2026.",
    };
    state.config.model = model;
    state.weights = weights;
    for (const actor of state.actors) actor.model = model;
    state.modelChanges = [...(state.modelChanges ?? []), change];
    store.save(state); // Preserve identities, counters, pacing, memory and all authority settings.
    fs.appendFileSync(
      path.join(dir, `events-${change.at.slice(0, 10)}.jsonl`),
      `${JSON.stringify({ type: "model_switch", ...change })}\n`,
      { mode: 0o600 },
    );
    return { runId: state.runId, ...change, accounts: state.actors.length };
  } finally {
    store.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== "--state") throw Error("MODEL_SWITCH_STATE_ARGUMENT_REQUIRED");
  console.log(JSON.stringify(await switchContinuousModel({ ...process.env, PACT_LOCAL_STATE: process.argv[3] })));
}
