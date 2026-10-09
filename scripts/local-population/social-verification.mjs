import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PublicClient } from "../population/client.mjs";
import { continuousConfig, runContinuous } from "./continuous.mjs";
import { FULL_OWNER_POLICY } from "./full-game.mjs";
import { LocalModel } from "./ollama.mjs";
import { atomicJson, RunStore } from "./state.mjs";

export async function initializeSocialVerification(env, { preflight, provision, now = Date.now } = {}) {
  if (env.PACT_SOCIAL_VERIFICATION_AUTHORIZATION !== "two-new-players-twenty-minutes-social-verification")
    throw Error("SOCIAL_VERIFICATION_AUTHORIZATION_REQUIRED");
  const { dir, config } = continuousConfig({ ...env, PACT_LOCAL_ACCOUNTS: "2", PACT_LOCAL_MODEL: "qwen3.5:9b" });
  const store = new RunStore(dir);
  try {
    let state = store.read();
    if (state) {
      if (state.mode !== "full-game-verification") throw Error("VERIFICATION_STATE_INVALID");
      if (state.status !== "provisioning") return { runId: state.runId, status: state.status };
    } else {
      const weights = await (preflight ? preflight(config) : new LocalModel(config).preflight());
      const roleInstructions = [
        "Negotiate with the other verification peer only. Once affordable, introduce yourself; after acceptance send a concrete Iron-for-Grain proposal, negotiate their counterterms and activate one modest reciprocal one-hour supply contract with no bonds. Use actual messages, real IDs and exact versions. Do not repeat unanswered messages or invent work.",
        "Respond to the other verification peer only: accept their incoming introduction through your synthetic owner. Reply with a concrete affordable counterproposal, discuss a changed rate and sign the agreed current offer version. Seek one modest reciprocal one-hour Iron/Grain contract with no bonds. Do not initiate another cold request or contact other players.",
      ];
      state = {
        mode: "full-game-verification",
        runId: `social-verification-${now()}-${randomUUID().slice(0, 8)}`,
        config: { ...config, requestCap: 60, intervalSeconds: 60 },
        weights,
        status: "provisioning",
        requests: 0,
        authorization:
          "Founder authorized fixes and a short real local-model social verification, 9 October 2026; two new synthetic owners, twenty minutes, sixty attempts maximum.",
        actors: roleInstructions.map((persona, index) => ({
          index,
          entryKey: randomUUID(),
          nickname: `Social check ${index + 1} ${randomUUID().slice(0, 6)}`,
          persona,
          ownerPolicy: FULL_OWNER_POLICY,
          mandateReady: true,
          turns: 0,
          successfulTurns: 0,
          failedTurns: 0,
          ownerDecisions: 0,
          failures: 0,
          nextDue: 0,
          memory: {},
        })),
      };
      store.save(state);
    }
    const save = () => store.save(state);
    for (const actor of state.actors) {
      if (!actor.tokens) {
        if (provision) await provision(actor, save);
        else await new PublicClient(state.config.base, actor, save).provision();
      }
      actor.ownerReady = true;
      save();
    }
    if (new Set(state.actors.map((a) => a.kingdomId)).size !== 2 || state.actors.some((a) => !a.kingdomId))
      throw Error("VERIFICATION_IDENTITIES_INVALID");
    state.startedAt = now();
    state.endsAt = state.startedAt + 20 * 60000;
    state.status = "ready";
    save();
    atomicJson(path.join(dir, "manifest.json"), {
      runId: state.runId,
      startedAt: new Date(state.startedAt).toISOString(),
      deadline: new Date(state.endsAt).toISOString(),
      requestCap: 60,
      model: state.config.model,
      weights: state.weights,
      accounts: state.actors.map(({ index, kingdomId, nickname }) => ({ index, kingdomId, nickname })),
      intervalSeconds: 60,
    });
    return { runId: state.runId, status: state.status };
  } finally {
    store.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== "--state") throw Error("VERIFICATION_STATE_ARGUMENT_REQUIRED");
  const env = { ...process.env, PACT_LOCAL_STATE: process.argv[3] };
  const result = await initializeSocialVerification(env);
  if (!["finished", "stopped"].includes(result.status)) await runContinuous(env.PACT_LOCAL_STATE);
}
