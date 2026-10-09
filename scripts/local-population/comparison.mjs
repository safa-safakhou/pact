import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PublicClient } from "../population/client.mjs";
import { continuousConfig, runContinuous } from "./continuous.mjs";
import { FULL_OWNER_POLICY } from "./full-game.mjs";
import { LocalModel } from "./ollama.mjs";
import { atomicJson, RunStore } from "./state.mjs";
import { clearDeadLock } from "./supervisor.mjs";

export async function prepareAndRunComparison(env = process.env) {
  if (env.PACT_COMPARISON_AUTHORIZATION !== "five-models-five-new-accounts-two-hours")
    throw Error("COMPARISON_AUTHORIZATION_REQUIRED");
  const { dir, config } = continuousConfig({ ...env, PACT_LOCAL_ACCOUNTS: "25" });
  const checkpoint = path.join(dir, "private-state.json");
  if (fs.existsSync(checkpoint)) {
    const previous = JSON.parse(fs.readFileSync(checkpoint, "utf8"));
    if (previous.mode !== "full-game-comparison") throw Error("COMPARISON_STATE_INVALID");
    if (["finished", "stopped"].includes(previous.status)) return;
  }
  const progress = (data) =>
    atomicJson(path.join(dir, "preparation.json"), {
      updatedAt: new Date().toISOString(),
      ...data,
    });
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const model of comparisonModels) {
    if (fs.existsSync(path.join(dir, "STOP"))) throw Error("RUN_STOPPED");
    try {
      await new LocalModel({ ...config, model }).preflight();
      continue;
    } catch (error) {
      if (error.message !== "LOCAL_WEIGHTS_REQUIRED") throw error;
    }
    progress({ status: "downloading", model });
    const response = await fetch(`${config.endpoint}/api/pull`, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
      signal: AbortSignal.timeout(60 * 60000),
    });
    if (!response.ok) throw Error("MODEL_DOWNLOAD_FAILED");
    let buffer = "",
      lastWrite = 0,
      success = false;
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      if (fs.existsSync(path.join(dir, "STOP"))) throw Error("RUN_STOPPED");
      buffer += decoder.decode(chunk, { stream: true });
      while (buffer.includes("\n")) {
        const newline = buffer.indexOf("\n");
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.error) throw Error("MODEL_DOWNLOAD_FAILED");
        success ||= event.status === "success";
        if (Date.now() - lastWrite > 15000 || success) {
          progress({
            status: "downloading",
            model,
            phase: event.status,
            totalBytes: event.total,
            completedBytes: event.completed,
            digest: event.digest,
          });
          lastWrite = Date.now();
        }
      }
    }
    if (!success) throw Error("MODEL_DOWNLOAD_INCOMPLETE");
    await new LocalModel({ ...config, model }).preflight();
  }
  const file = path.join(dir, "private-state.json");
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  if (!existing || existing.status === "provisioning") {
    progress({ status: "provisioning", models: comparisonModels });
    await initializeComparison(env);
  }
  progress({ status: "ready", models: comparisonModels });
  await superviseComparison(dir);
  const final = JSON.parse(fs.readFileSync(file, "utf8"));
  progress({ status: final.status, models: comparisonModels });
}

export const comparisonModels = ["gemma4:12b", "qwen3.5:9b", "granite4.2:8b", "ornith-1.5:9b", "lfm2.5:8b"];
export const comparisonPersonas = [
  "Develop production efficiently. Resolve blocked prerequisites rather than repeatedly waiting or retrying denials.",
  "Negotiate and complete mutually useful supply contracts. Read conversations, change terms when useful, verify activation.",
  "Build a Court community using actual membership and publications, and coordinate a concrete useful common project.",
  "Develop affordable troops and scout real targets. Consider military or garrison choices with actual costs and authority.",
  "Practice diplomacy: establish contacts, respond to messages and requests, negotiate agreements and recover from failed actions.",
];

export async function initializeComparison(env = process.env) {
  if (env.PACT_COMPARISON_AUTHORIZATION !== "five-models-five-new-accounts-two-hours")
    throw Error("COMPARISON_AUTHORIZATION_REQUIRED");
  const { dir, config } = continuousConfig({ ...env, PACT_LOCAL_ACCOUNTS: "25" });
  const store = new RunStore(dir);
  try {
    let state = store.read();
    if (!state) {
      const weights = [];
      for (const model of comparisonModels) weights.push(await new LocalModel({ ...config, model }).preflight());
      const tag = Date.now().toString(36);
      state = {
        mode: "full-game-comparison",
        runId: `model-comparison-${tag}-${randomUUID().slice(0, 8)}`,
        config: { ...config, requestCap: 1000 },
        models: weights,
        authorization:
          "Founder authorized downloads and five new accounts per shortlisted model for two hours, 9 October 2026.",
        status: "provisioning",
        requests: 0,
        provisionedAt: Date.now(),
        actors: comparisonModels.flatMap((model, group) =>
          comparisonPersonas.map((persona, role) => ({
            index: group * 5 + role,
            model,
            role,
            nickname: `Trial ${group + 1}-${role + 1} ${tag}`,
            entryKey: randomUUID(),
            persona,
            mandateReady: true,
            ownerPolicy: FULL_OWNER_POLICY,
            turns: 0,
            successfulTurns: 0,
            failedTurns: 0,
            ownerDecisions: 0,
            failures: 0,
            nextDue: 0,
            memory: { intent: "Use actual state to pursue your role; explore and recover from mistakes." },
          })),
        ),
      };
      store.save(state); // Stable entry keys precede all provisioning; retry never creates replacement owners.
    }
    if (state.mode !== "full-game-comparison" || state.status !== "provisioning")
      throw Error("COMPARISON_ALREADY_INITIALIZED");
    for (const actor of state.actors) {
      if (store.stopped()) throw Error("RUN_STOPPED");
      await new PublicClient(state.config.base, actor, () => store.save(state)).provision();
      actor.ownerReady = true;
      store.save(state);
    }
    if (new Set(state.actors.map((a) => a.kingdomId)).size !== 25) throw Error("COMPARISON_IDENTITIES_INVALID");
    state.startedAt = Date.now();
    state.endsAt = state.startedAt + 120 * 60000;
    state.status = "ready";
    store.save(state);
    atomicJson(path.join(dir, "manifest.json"), {
      runId: state.runId,
      startedAt: new Date(state.startedAt).toISOString(),
      deadline: new Date(state.endsAt).toISOString(),
      requestCap: state.config.requestCap,
      models: state.models,
      accounts: state.actors.map(({ index, model, role, kingdomId, nickname }) => ({
        index,
        model,
        role,
        kingdomId,
        nickname,
      })),
      settings: { context: config.context, outputTokens: config.outputTokens, think: false, intervalSeconds: 300 },
    });
    return { runId: state.runId, accounts: 25, deadline: new Date(state.endsAt).toISOString() };
  } finally {
    store.close();
  }
}

export async function superviseComparison(dir) {
  while (!fs.existsSync(path.join(dir, "STOP"))) {
    const state = JSON.parse(fs.readFileSync(path.join(dir, "private-state.json"), "utf8"));
    if (state.mode !== "full-game-comparison") throw Error("COMPARISON_STATE_INVALID");
    if (["finished", "stopped"].includes(state.status)) return;
    if (!clearDeadLock(dir)) throw Error("CONTROLLER_ALREADY_RUNNING");
    try {
      await runContinuous(dir);
    } catch (error) {
      atomicJson(path.join(dir, "supervisor.json"), {
        at: new Date().toISOString(),
        status: "retrying",
        error: /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : "CONTROLLER_FAILURE",
      });
      if (Date.now() >= state.endsAt) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--prepare-and-run") await prepareAndRunComparison();
  else if (process.argv[2] === "--initialize") console.log(JSON.stringify(await initializeComparison()));
  else if (process.argv[2] === "--state" && process.argv[3]) await superviseComparison(process.argv[3]);
  else throw Error("COMPARISON_ARGUMENT_REQUIRED");
}
