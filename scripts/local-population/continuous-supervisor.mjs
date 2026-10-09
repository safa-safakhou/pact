import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "./config.mjs";
import { runContinuous } from "./continuous.mjs";
import { atomicJson } from "./state.mjs";
import { clearDeadLock } from "./supervisor.mjs";

export async function superviseContinuous(dir) {
  dir = readConfig({ PACT_LOCAL_STATE: dir }).dir;
  let quitting = false;
  const quit = () => {
    quitting = true;
  };
  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
  const stopped = () => quitting || fs.existsSync(path.join(dir, "STOP"));
  let retries = 0;
  try {
    while (!stopped()) {
      const state = JSON.parse(fs.readFileSync(path.join(dir, "private-state.json"), "utf8"));
      if (state.mode !== "full-game-continuous" || !state.authorization) throw Error("CONTINUOUS_STATE_INVALID");
      if (state.status === "stopped") return;
      if (!clearDeadLock(dir)) throw Error("CONTROLLER_ALREADY_RUNNING");
      const heartbeat = (status, error) =>
        atomicJson(path.join(dir, "supervisor.json"), {
          runId: state.runId,
          pid: process.pid,
          status,
          error,
          retries,
          heartbeatAt: new Date().toISOString(),
          continuous: true,
          accounts: state.actors.length,
        });
      heartbeat("running");
      const timer = setInterval(() => heartbeat("running"), 15000);
      timer.unref();
      try {
        await runContinuous(dir);
        heartbeat(stopped() ? "stopped" : "interrupted");
      } catch (e) {
        retries++;
        heartbeat("retrying", /^[A-Z][A-Z0-9_]+$/.test(e.message) ? e.message : "CONTROLLER_FAILURE");
      } finally {
        clearInterval(timer);
      }
      // Retry the same state/counters; never recreate accounts or reset authorizations.
      const until = Date.now() + Math.min(300000, retries * 60000 + 60000);
      while (!stopped() && Date.now() < until) await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    process.off("SIGINT", quit);
    process.off("SIGTERM", quit);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== "--state" || !process.argv[3] || process.argv.length !== 4)
    throw Error("CONTINUOUS_STATE_ARGUMENT_REQUIRED");
  await superviseContinuous(process.argv[3]);
}
