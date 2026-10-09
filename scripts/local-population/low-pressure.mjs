import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "./config.mjs";
import { RunStore } from "./state.mjs";
import { clearDeadLock } from "./supervisor.mjs";

export function applyLowPressure(env, { now = Date.now } = {}) {
  if (env.PACT_LOW_PRESSURE_AUTHORIZATION !== "cool-existing-fifty-hourly")
    throw Error("LOW_PRESSURE_AUTHORIZATION_REQUIRED");
  const { dir } = readConfig(env);
  if (!clearDeadLock(dir)) throw Error("CONTROLLER_ALREADY_RUNNING");
  const store = new RunStore(dir);
  try {
    const state = store.read();
    if (
      state?.mode !== "full-game-continuous" ||
      !state.authorization ||
      store.stopped() ||
      ["finished", "stopped"].includes(state.status) ||
      state.actors.length !== 50 ||
      new Set(state.actors.map((a) => a.kingdomId)).size !== 50
    )
      throw Error("LOW_PRESSURE_STATE_INVALID");
    if (
      state.config.intervalSeconds === 3600 &&
      state.config.minimumTurnGapSeconds === 60 &&
      state.config.keepAlive === 0
    )
      return { runId: state.runId, unchanged: true };
    const at = now();
    const change = {
      at: new Date(at).toISOString(),
      previousIntervalSeconds: state.config.intervalSeconds,
      intervalSeconds: 3600,
      minimumTurnGapSeconds: 60,
      keepAlive: 0,
      requests: state.requests,
      authorization: "Founder requested reducing pressure on the computer now, 9 October 2026.",
    };
    Object.assign(state.config, { intervalSeconds: 3600, minimumTurnGapSeconds: 60, keepAlive: 0 });
    state.nextTurnAt = at + 300000; // Initial quiet cooldown; exact pending writes remain intact for recovery.
    state.actors.forEach((actor, index) => {
      actor.nextDue = state.nextTurnAt + index * 72000;
    });
    state.pacingChanges = [...(state.pacingChanges ?? []), change];
    store.save(state);
    fs.appendFileSync(
      path.join(dir, `events-${change.at.slice(0, 10)}.jsonl`),
      `${JSON.stringify({ type: "pacing_change", ...change })}\n`,
      { mode: 0o600 },
    );
    return { runId: state.runId, ...change, nextTurnAt: new Date(state.nextTurnAt).toISOString(), accounts: 50 };
  } finally {
    store.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== "--state") throw Error("LOW_PRESSURE_STATE_ARGUMENT_REQUIRED");
  console.log(JSON.stringify(applyLowPressure({ ...process.env, PACT_LOCAL_STATE: process.argv[3] })));
}
