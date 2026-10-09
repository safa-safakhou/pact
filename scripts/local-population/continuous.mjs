import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PublicClient } from "../population/client.mjs";
import { readConfig } from "./config.mjs";
import {
  actionFamilies,
  dispatchFullCommand,
  FULL_OWNER_POLICY,
  fullPlanSchema,
  fullPrompt,
  parseFullPlan,
  prepareFullCommand,
  recoverFullCommand,
} from "./full-game.mjs";
import { LocalModel } from "./ollama.mjs";
import { coolAfterTurn, finishTurn, nextContinuousActor } from "./scheduler.mjs";
import { collectSocialWork, rememberSocialOutcome, socialActionGuard } from "./social-work.mjs";
import { atomicJson, RunStore } from "./state.mjs";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const errorCode = (e) =>
  e.serverCode ?? (/^[A-Z][A-Z0-9_]+$/.test(e.message) ? e.message : "TRANSPORT_OR_RESULT_ERROR");
export function continuousConfig(env) {
  const { dir, config: basic } = readConfig({ ...env, PACT_LOCAL_OUTPUT_TOKENS: "1000" });
  const config = { ...basic, context: 32768, outputTokens: 2400, timeoutMs: 90000, maxPromptCharacters: 80000 };
  delete config.durationMinutes;
  delete config.requestCap;
  delete config.ownerApprovalCap;
  delete config.ownerResourceLimit;
  delete config.ownerApprovals;
  return { dir, config };
}
export async function initializeContinuous(env, actors) {
  if (env.PACT_FULL_AUTHORIZATION !== "50-accounts-indefinitely-all-implemented-gameplay")
    throw Error("CONTINUOUS_AUTHORIZATION_REQUIRED");
  const { dir, config } = continuousConfig(env);
  if (
    actors.length !== config.accounts ||
    new Set(actors.map((a) => a.kingdomId)).size !== actors.length ||
    actors.some((a) => !a.kingdomId || !a.entryKey || a.pending)
  )
    throw Error("EXISTING_CLEAR_OWNERS_REQUIRED");
  const store = new RunStore(dir);
  try {
    if (store.read()) throw Error("NEW_CONTINUOUS_STATE_REQUIRED");
    const weights = await new LocalModel(config).preflight();
    const state = {
      mode: "full-game-continuous",
      runId: `full-game-${Date.now()}-${randomUUID().slice(0, 8)}`,
      config,
      weights,
      startedAt: Date.now(),
      requests: 0,
      status: "provisioning",
      authorization:
        "Founder explicitly authorized 50 existing accounts indefinitely, all implemented gameplay, 9 October 2026.",
      actors: actors.map((a, index) => ({
        index,
        kingdomId: a.kingdomId,
        accountId: a.accountId,
        nickname: a.nickname,
        entryKey: a.entryKey,
        persona: a.persona,
        ownerPolicy: FULL_OWNER_POLICY,
        turns: 0,
        successfulTurns: 0,
        failedTurns: 0,
        ownerDecisions: 0,
        memory: { intent: "Explore the full implemented game and choose a strategy." },
        nextDue: 0,
      })),
    };
    store.save(state);
    return { runId: state.runId, accounts: state.actors.length, mechanics: actionFamilies.size };
  } finally {
    store.close();
  }
}

export class ContinuousClient extends PublicClient {
  constructor(base, actor, save, active) {
    super(base, actor, save);
    this.active = active;
  }
  async resumeOwner() {
    if (!this.active()) throw Error("RUN_STOPPED");
    const result = await super.http("/v1/play/join", { entryKey: this.actor.entryKey, nickname: this.actor.nickname });
    if (result.kingdomId !== this.actor.kingdomId) throw Error("OWNER_IDENTITY_CHANGED");
    Object.assign(this.actor, result);
    this.actor.mandateReady = true; // Preserve actual owner mandate; exact exceptions use the separate human controller.
    this.actor.ownerReady = true;
    this.save();
  }
  async http(route, body, headers) {
    if (!this.active()) throw Error("RUN_STOPPED");
    try {
      return await super.http(route, body, headers);
    } catch (e) {
      if (!["UNAUTHENTICATED", "FORBIDDEN"].includes(e.serverCode) && !e.message.startsWith("HTTP_401_")) throw e;
      await this.resumeOwner();
      if (!this.active()) throw Error("RUN_STOPPED");
      return super.http(route, body, headers);
    }
  }
  async mcp() {
    try {
      return await super.mcp();
    } catch (error) {
      if (error.serverCode !== "INVALID_GRANT") throw error;
      // Recover a lost refresh response through the existing guest identity, never a replacement kingdom.
      await this.resumeOwner();
      delete this.actor.tokens;
      delete this.actor.tokenExpires;
      this.save();
      await this.provision();
      return super.mcp();
    }
  }
}

export function runIsActive(state, now) {
  return (
    state.mode === "full-game-continuous" ||
    (["full-game-comparison", "full-game-verification"].includes(state.mode) &&
      Number.isFinite(state.endsAt) &&
      now < state.endsAt &&
      state.requests < state.config.requestCap)
  );
}

export async function runContinuous(dir, { turnLimit = Infinity } = {}) {
  dir = readConfig({ PACT_LOCAL_STATE: dir }).dir;
  const store = new RunStore(dir);
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  let heartbeat;
  const state = store.read();
  const active = () => !interrupted && !store.stopped() && runIsActive(state, Date.now());
  const save = () => store.save(state);
  const emit = (type, data = {}) => {
    // Daily append-only segments retain receipts and decisions without unbounded in-memory history.
    const day = new Date().toISOString().slice(0, 10);
    fs.appendFileSync(
      path.join(dir, `events-${day}.jsonl`),
      `${JSON.stringify({ at: new Date().toISOString(), type, ...data }, (key, value) =>
        ["token", "access_token", "refresh_token", "entryKey", "cookie", "csrfToken", "password"].includes(key)
          ? "[REDACTED]"
          : value,
      )}\n`,
      { mode: 0o600 },
    );
  };
  const status = () =>
    atomicJson(path.join(dir, "status.json"), {
      runId: state.runId,
      mode: state.mode,
      status: state.status,
      config: state.config,
      startedAt: new Date(state.startedAt).toISOString(),
      deadline: state.endsAt ? new Date(state.endsAt).toISOString() : null,
      requestCap: state.config.requestCap ?? null,
      requests: state.requests,
      updatedAt: new Date().toISOString(),
      pid: process.pid,
      mechanics: actionFamilies.size,
      actors: state.actors.map(
        ({
          index,
          kingdomId,
          nickname,
          model,
          turns,
          successfulTurns,
          failedTurns,
          ownerDecisions,
          failures,
          nextDue,
          pending,
        }) => ({
          index,
          kingdomId,
          nickname,
          model,
          turns,
          successfulTurns,
          failedTurns,
          ownerDecisions,
          failures,
          nextDue,
          pendingCommandId: pending?.commandId,
        }),
      ),
    });
  try {
    if (
      !["full-game-continuous", "full-game-comparison", "full-game-verification"].includes(state?.mode) ||
      !state.authorization ||
      ["stopped", "finished"].includes(state.status)
    )
      throw Error("CONTINUOUS_STATE_INVALID");
    const models = new Map();
    const candidates = state.mode === "full-game-comparison" ? state.models : [state.weights];
    for (const weights of candidates) {
      const model = new LocalModel({ ...state.config, model: weights.name });
      if ((await model.preflight()).digest !== weights.digest) throw Error("MODEL_DIGEST_CHANGED");
      models.set(weights.name, model);
    }
    state.status = "running";
    save();
    status();
    heartbeat = setInterval(status, 15000);
    heartbeat.unref();
    emit("controller_started", { runId: state.runId, accounts: state.actors.length, mechanics: actionFamilies.size });
    const peers = state.actors.map(({ kingdomId, nickname }) => ({ kingdomId, nickname }));
    let turns = 0;
    while (active() && turns < turnLimit) {
      const actor = nextContinuousActor(state, Date.now());
      if (!actor) {
        await delay(500);
        continue;
      }
      const due = actor.nextDue,
        began = Date.now();
      const model = models.get(actor.model ?? state.config.model);
      if (!model) throw Error("ACTOR_MODEL_UNKNOWN");
      const client = new ContinuousClient(state.config.base, actor, save, active);
      let mcp;
      try {
        if (!actor.ownerReady) await client.resumeOwner();
        if (!actor.tokens) await client.provision();
        mcp = await client.mcp();
        await recoverFullCommand({ actor, client, mcp, save, emit, active });
        if (actor.pending) throw Error("UNCERTAIN_COMMAND");
        const tools = (await mcp.rpc("tools/list", {})).tools;
        const guide = await mcp.call("pact_agent_guide_v1", { topic: "start" });
        if (guide.worldStatus !== "active") throw Error("WORLD_NOT_ACTIVE");
        // Full authorized owner view includes troops, training, garrison, raids and reports, not the old compact brief.
        const world = await mcp.call("pact_world_read_v1", {});
        let social = collectSocialWork(actor, guide, await mcp.call("pact_play_view_v1", {}));
        const deliveredMessageIds = social.pendingMessages.slice(0, 3).map((message) => message.id);
        social.deliveredMessageIds = deliveredMessageIds;
        save(); // keep delivered incoming work durable before the model call
        const discoveryName = ["pact_court_read_v1", "pact_politics_read_v1", "pact_chronicle_read_v1"][
          actor.turns % 3
        ];
        const discovery = await mcp.call(discoveryName, {});
        const rules = await mcp.call("pact_agent_guide_v1", {
          topic: ["development", "diplomacy", "military", "authority"][actor.turns % 4],
        });
        const observations = {
          guide,
          rules,
          world,
          social,
          discovery: { name: discoveryName, result: discovery },
          reads: actor.reads ?? [],
        };
        const prompt = fullPrompt(actor, observations, tools, peers);
        if (!active()) throw Error("RUN_STOPPED");
        state.requests++;
        save();
        const result = await model.invoke(
          prompt,
          fullPlanSchema(tools),
          Math.min(state.endsAt ?? Infinity, Date.now() + state.config.timeoutMs),
        );
        emit("model_result", { actor: actor.index, model: actor.model ?? state.config.model, ...result });
        const plan = parseFullPlan(result.output, tools);
        const outcomes = [];
        for (const item of plan.actions) {
          if (!active()) break;
          try {
            const guard = socialActionGuard(actor, item.action, social);
            if (guard.code) {
              outcomes.push({ action: item.action, code: guard.code, recovery: guard.recovery });
              continue;
            }
            const pending = await prepareFullCommand(actor, item.action, client);
            if (pending.role === "synthetic-owner") {
              actor.ownerDecisions++;
              save();
              emit("owner_decision", { actor: actor.index, commandId: pending.commandId, action: pending.action });
            }
            const receipt = await dispatchFullCommand({ actor, pending, client, mcp, save, emit, active });
            rememberSocialOutcome(actor, item.action, receipt, guard);
            if (receipt.code === "COMMITTED" && /^game\.(contact|message|supply)\./.test(item.action.kind)) {
              try {
                social = collectSocialWork(actor, guide, await mcp.call("pact_play_view_v1", {}));
                social.deliveredMessageIds = deliveredMessageIds;
              } catch (error) {
                emit("social_refresh_failed", { actor: actor.index, code: errorCode(error) });
              }
            }
            outcomes.push({
              action: pending.action,
              code: receipt.code,
              recovery: receipt.recovery,
              commandId: receipt.commandId,
              records: receipt.recordVersions,
              result: receipt.ownerResult,
            });
            actor.recordIds = [
              ...(actor.recordIds ?? []),
              ...Object.entries(receipt.recordVersions ?? {}).map(([record, version]) => ({ record, version })),
            ].slice(-100);
          } catch (error) {
            outcomes.push({ action: item.action, code: errorCode(error) });
            emit("action_failed", { actor: actor.index, action: item.action, code: errorCode(error) });
            if (actor.pending) throw error;
          }
        }
        const reads = [];
        for (const read of plan.reads) {
          if (!active()) break;
          try {
            reads.push({ ...read, result: await mcp.call(read.name, read.args) });
          } catch (error) {
            reads.push({ ...read, error: errorCode(error) });
          }
        }
        actor.reads = reads;
        actor.memory = { intent: plan.intent, nextCheck: plan.nextCheck, outcomes, records: actor.recordIds };
        actor.successfulTurns++;
        actor.failures = 0;
        emit("turn_completed", {
          actor: actor.index,
          durationMs: Date.now() - began,
          outcomes: outcomes.map(({ result: _privateOwnerResult, ...outcome }) => outcome),
        });
      } catch (error) {
        actor.failedTurns++;
        actor.failures = (actor.failures ?? 0) + 1;
        emit("turn_failed", { actor: actor.index, code: errorCode(error), modelUsage: error.modelUsage });
      } finally {
        if (mcp) {
          try {
            await mcp.close();
          } catch (error) {
            emit("session_close_failed", { actor: actor.index, code: errorCode(error) });
          }
        }
        finishTurn(actor, due, Date.now(), state.config.intervalSeconds * 1000);
        coolAfterTurn(state, Date.now());
        // Failed actors retry later rather than permanently disappearing. Pending exact commands recover first.
        if (actor.failures > 1)
          actor.nextDue = Math.max(actor.nextDue, Date.now() + Math.min(3600000, actor.failures * 300000));
        turns++;
        save();
        status();
      }
    }
    state.status = store.stopped() ? "stopped" : !runIsActive(state, Date.now()) ? "finished" : "interrupted";
    save();
    status();
    emit("controller_exit", { status: state.status, requests: state.requests });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    store.close();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--initialize") {
    const source = JSON.parse(fs.readFileSync(process.env.PACT_FULL_SOURCE, "utf8"));
    if (source.mode !== "population" || source.status !== "finished") throw Error("FINISHED_SOURCE_REQUIRED");
    console.log(JSON.stringify(await initializeContinuous(process.env, source.actors)));
  } else if (process.argv[2] === "--state" && process.argv[3]) {
    await runContinuous(process.argv[3], { turnLimit: Number(process.env.PACT_FULL_VERIFY_TURNS ?? Infinity) });
  } else throw Error("CONTINUOUS_ARGUMENT_REQUIRED");
}
