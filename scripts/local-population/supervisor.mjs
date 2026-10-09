import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "./config.mjs";
import { effectiveRequestCap } from "./limits.mjs";
import { runPopulation } from "./runner.mjs";
import { atomicJson } from "./state.mjs";

const configEnvironment = {
  base: "BASE",
  endpoint: "OLLAMA",
  model: "MODEL",
  accounts: "ACCOUNTS",
  durationMinutes: "MINUTES",
  intervalSeconds: "INTERVAL_SECONDS",
  requestCap: "REQUEST_CAP",
  context: "CONTEXT",
  outputTokens: "OUTPUT_TOKENS",
  timeoutMs: "TIMEOUT_MS",
  ownerApprovals: "OWNER_APPROVALS",
  ownerApprovalCap: "OWNER_APPROVAL_CAP",
  ownerResourceLimit: "OWNER_RESOURCE_LIMIT",
};
export function environmentForState(dir, state) {
  if (state.mode !== "population" || !Number.isFinite(state.endsAt) || !state.config)
    throw Error("SUPERVISOR_STATE_INVALID");
  const env = { PACT_LOCAL_STATE: dir };
  for (const [key, suffix] of Object.entries(configEnvironment)) {
    if (state.config[key] === undefined) throw Error("SUPERVISOR_CONFIG_INCOMPLETE");
    env[`PACT_LOCAL_${suffix}`] = String(state.config[key]);
  }
  return env;
}
export function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw Error("SUPERVISOR_LOCK_INVALID");
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}
export function clearDeadLock(dir, alive = processAlive) {
  const lock = path.join(dir, "runner.lock");
  if (!fs.existsSync(lock)) return true;
  const raw = fs.readFileSync(lock, "utf8");
  const { pid } = JSON.parse(raw);
  if (!Number.isSafeInteger(pid) || pid <= 0) throw Error("SUPERVISOR_LOCK_INVALID");
  if (alive(pid)) return false;
  if (fs.readFileSync(lock, "utf8") !== raw) throw Error("SUPERVISOR_LOCK_CHANGED");
  fs.unlinkSync(lock);
  return true;
}

export async function supervise(dir) {
  // Validate the directory before any file access or network work.
  dir = readConfig({ PACT_LOCAL_STATE: dir }).dir;
  const state = JSON.parse(fs.readFileSync(path.join(dir, "private-state.json"), "utf8"));
  const env = environmentForState(dir, state);
  if (["finished", "stopped"].includes(state.status)) return { status: "terminal", runId: state.runId };
  if (!clearDeadLock(dir)) return { status: "already-running", runId: state.runId };
  const heartbeat = (status, error) => {
    let view;
    try {
      view = JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8"));
    } catch {}
    atomicJson(path.join(dir, "supervisor.json"), {
      runId: state.runId,
      pid: process.pid,
      status,
      error,
      heartbeatAt: new Date().toISOString(),
      endsAt: new Date(state.endsAt).toISOString(),
      requestCap: effectiveRequestCap(state),
      workerStatus: view?.status,
      requests: view?.requests,
      accounts: view?.actors?.length ?? state.actors.length,
      blockedAccounts: view?.actors?.filter((a) => a.blocked).length ?? 0,
    });
  };
  heartbeat("running");
  const timer = setInterval(() => heartbeat("running"), 15000);
  timer.unref();
  try {
    await runPopulation(env);
    heartbeat("finished");
    return { status: "finished", runId: state.runId };
  } catch (error) {
    const code = /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : "SUPERVISOR_WORKER_FAILED";
    heartbeat("failed", code);
    throw Error(code);
  } finally {
    clearInterval(timer);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== "--state" || !process.argv[3] || process.argv.length !== 4)
    throw Error("SUPERVISOR_STATE_ARGUMENT_REQUIRED");
  supervise(process.argv[3])
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
