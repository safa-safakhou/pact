import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PublicClient } from "../population/client.mjs";
import { PERSONAS } from "../population/policy.mjs";
import { readConfig } from "./config.mjs";
import { effectiveRequestCap } from "./limits.mjs";
import { LocalModel } from "./ollama.mjs";
import { approveOwnerAction, OWNER_POLICY, ownerMayHandle, resolveOwnerDecision } from "./owner.mjs";
import { conversationContacts, pacedGuide, recordOutcome } from "./pacing.mjs";
import { cohortGuide, parsePlan, promptFor, schemaFor, validateAction } from "./plan.mjs";
import { capacity, finishTurn, nextActor } from "./scheduler.mjs";
import { atomicJson, RunStore, reserveRequest, sameConfig } from "./state.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const codeOf = (error) =>
  error.serverCode ??
  (/^[A-Z][A-Z0-9_]+$/.test(String(error.code)) ? error.code : undefined) ??
  (/^[A-Z][A-Z0-9_]+$/.test(error.message)
    ? error.message
    : error.name === "TimeoutError"
      ? "TIMEOUT"
      : "TRANSPORT_OR_RESULT_ERROR");

class BoundedPublicClient extends PublicClient {
  constructor(base, actor, save, active) {
    super(base, actor, save);
    this.active = active;
  }
  async http(route, body, headers) {
    if (!this.active()) throw Error("RUN_STOPPED");
    return super.http(route, body, headers);
  }
}

export async function executeAction({ actor, action, role = "agent", client, mcp, save, emit, active, originalId }) {
  if (!active()) throw Error("RUN_STOPPED");
  const commandId = originalId ?? randomUUID();
  actor.pending = { commandId, action, role };
  save();
  emit("action_requested", { actor: actor.index, commandId, action, role });
  let receipt;
  try {
    receipt =
      role === "simulated-human"
        ? await client.humanCommand(action, commandId)
        : await mcp.call("pact_game_action_v1", { commandId, action });
  } catch (error) {
    if (error.serverCode) {
      delete actor.pending;
      save();
      emit("action_denied", { actor: actor.index, commandId, code: error.serverCode, detail: error.serverDetail });
      return { commandId, code: error.serverCode, receiptExists: false };
    }
    try {
      receipt = await mcp.call("pact_receipt_read_v1", { commandId });
    } catch {}
  }
  if (!receipt || receipt.commandId !== commandId) {
    actor.blocked = "UNCERTAIN_COMMAND";
    save();
    throw Error("UNCERTAIN_COMMAND");
  }
  delete actor.pending;
  save();
  emit("receipt", { actor: actor.index, role, action, receipt });
  return receipt;
}

export async function reconcilePending({ actor, client, mcp, save, emit, active }) {
  if (!actor.pending) return false;
  const pending = actor.pending;
  const receipt = await mcp.call("pact_receipt_read_v1", { commandId: pending.commandId });
  if (receipt.commandId === pending.commandId) {
    delete actor.pending;
    delete actor.blocked;
    save();
    emit("receipt_recovered", { actor: actor.index, role: pending.role, action: pending.action, receipt });
    return false;
  }
  if (receipt.code !== "RECEIPT_NOT_FOUND") throw Error("UNCERTAIN_COMMAND");
  if (pending.role === "simulated-human-approval") {
    const leaseOpen = actor.ownerDecisions?.[pending.commandId]?.route === "approval";
    if (leaseOpen) await mcp.call("run.open");
    await resolveOwnerDecision({ actor, client, mcp, save, emit, active });
    return leaseOpen;
  }
  if (pending.role === "agent") await mcp.call("run.open");
  await executeAction({
    actor,
    client,
    mcp,
    save,
    emit,
    active,
    action: pending.action,
    role: pending.role,
    originalId: pending.commandId,
  });
  delete actor.blocked;
  save();
  return pending.role === "agent";
}

export async function runPopulation(env = process.env) {
  const { dir, config } = readConfig(env);
  const store = new RunStore(dir);
  let interrupted = false;
  const stop = () => {
    interrupted = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const events = path.join(dir, "events.jsonl");
  const emit = (type, data = {}) =>
    fs.appendFileSync(events, `${JSON.stringify({ at: new Date().toISOString(), type, ...data })}\n`, { mode: 0o600 });
  let state;
  try {
    state = store.read();
    if (state && (state.mode !== "population" || !sameConfig(state.config, config)))
      throw Error("RESUME_CONFIG_MISMATCH");
    if (state && ["finished", "stopped"].includes(state.status)) throw Error("RUN_ALREADY_FINISHED");
    const model = new LocalModel(config);
    const weights = await model.preflight();
    if (state && state.weights.digest !== weights.digest) throw Error("RESUME_MODEL_CHANGED");
    state ??= {
      mode: "population",
      runId: `local-${Date.now()}-${randomUUID().slice(0, 8)}`,
      config,
      weights,
      startedAt: Date.now(),
      endsAt: Date.now() + config.durationMinutes * 60000,
      requests: 0,
      status: "provisioning",
      actors: Array.from({ length: config.accounts }, (_, index) => ({
        index,
        nickname: `Local Qwen ${Date.now().toString(36)} ${String(index + 1).padStart(2, "0")}`,
        persona: PERSONAS[index % PERSONAS.length][1],
        entryKey: randomUUID(),
        ownerPolicy: OWNER_POLICY,
        memory: {},
        nextDue: 0,
        turns: 0,
      })),
    };
    const save = () => store.save(state);
    const requestCap = effectiveRequestCap(state);
    const priorTurns = fs.existsSync(events)
      ? fs.readFileSync(events, "utf8").split("\n").filter(Boolean).map(JSON.parse)
      : [];
    for (const actor of state.actors) {
      actor.successfulTurns ??= priorTurns.filter((e) => e.type === "turn_completed" && e.actor === actor.index).length;
      actor.failedTurns ??= priorTurns.filter((e) => e.type === "turn_failed" && e.actor === actor.index).length;
    }
    save();
    const active = () => !interrupted && !store.stopped() && Date.now() < state.endsAt;
    const status = () => {
      atomicJson(path.join(dir, "status.json"), {
        runId: state.runId,
        status: state.status,
        config,
        effectiveRequestCap: requestCap,
        originalEndsAt: state.originalEndsAt ? new Date(state.originalEndsAt).toISOString() : undefined,
        extensions: state.extensions,
        weights,
        startedAt: new Date(state.startedAt).toISOString(),
        endsAt: new Date(state.endsAt).toISOString(),
        requests: state.requests,
        updatedAt: new Date().toISOString(),
        actors: state.actors.map(
          ({ index, nickname, kingdomId, turns, successfulTurns, failedTurns, nextDue, blocked, failures }) => ({
            index,
            nickname,
            kingdomId,
            turns,
            scheduledTurns: turns,
            successfulTurns,
            failedTurns,
            nextDue,
            blocked,
            failures,
          }),
        ),
      });
    };
    emit("run_started", { runId: state.runId, config, weights, resumed: state.status !== "provisioning" });
    for (const actor of state.actors) {
      if (!active()) break;
      await new BoundedPublicClient(config.base, actor, save, active).provision();
      if (!actor.nextDue) actor.nextDue = Date.now() + actor.index * 1000;
      emit("actor_ready", { actor: actor.index, kingdomId: actor.kingdomId });
      save();
      status();
    }
    const cohort = new Set(state.actors.map((a) => a.kingdomId).filter(Boolean));
    const peers = state.actors
      .filter((a) => a.kingdomId)
      .map(({ index, nickname, kingdomId }) => ({ index, nickname, kingdomId }));
    state.turnTimings ??= [];
    state.modelTimings ??= [];
    const samples = state.turnTimings;
    const modelSamples = state.modelTimings;
    state.status = "running";
    save();
    while (active() && state.requests < requestCap) {
      // Pending actors are allowed back only for receipt reconciliation.
      const actor = nextActor(
        state.actors.map((a) => (a.pending ? { ...a, blocked: undefined } : a)),
        Date.now(),
      );
      if (!actor) {
        await sleep(500);
        continue;
      }
      const a = state.actors[actor.index];
      const due = a.nextDue;
      const began = Date.now();
      const client = new BoundedPublicClient(config.base, a, save, active);
      let mcp;
      let modelUsed = false;
      let completed = false;
      try {
        mcp = await client.mcp();
        const leaseOpen = await reconcilePending({ actor: a, client, mcp, save, emit, active });
        let guide = pacedGuide(a, cohortGuide(await mcp.call("pact_agent_guide_v1"), cohort));
        if (guide.worldStatus !== "active") throw Error("WORLD_NOT_ACTIVE");
        // Explicit synthetic-owner policy only; the model cannot invoke this human route.
        for (const request of guide.contactRequests.filter((r) => r.direction === "incoming")) {
          if (!active()) break;
          await executeAction({
            actor: a,
            client,
            mcp,
            save,
            emit,
            active,
            role: "simulated-human",
            action: { kind: "game.contact.answer", requestId: request.id, accept: true },
          });
        }
        if (guide.contactRequests.some((r) => r.direction === "incoming"))
          guide = pacedGuide(a, cohortGuide(await mcp.call("pact_agent_guide_v1"), cohort));
        const conversations = [];
        for (const contact of conversationContacts(guide, a.turns)) {
          if (!active()) break;
          conversations.push({
            counterpartyKingdomId: contact.kingdomId,
            ...(await mcp.call("pact_conversation_read_v1", { counterpartyKingdomId: contact.kingdomId, limit: 3 })),
          });
        }
        const otherPeers = peers.filter((p) => p.kingdomId !== a.kingdomId);
        const offset = (a.index + a.turns) % Math.max(1, otherPeers.length);
        const visiblePeers = otherPeers.slice(offset).concat(otherPeers.slice(0, offset)).slice(0, 4);
        const prompt = promptFor(a, guide, visiblePeers, conversations);
        reserveRequest(state, Date.now(), save);
        modelUsed = true;
        const result = await model.invoke(prompt, schemaFor(guide, visiblePeers), state.endsAt);
        emit("model_result", { actor: a.index, prompt, ...result });
        modelSamples.push(result.wallMs);
        // No writes from a result arriving after cancellation or its fixed deadline.
        if (!active()) throw Error("RUN_STOPPED");
        const actions = parsePlan(result.output);
        if (actions.length && !leaseOpen) await mcp.call("run.open");
        const outcomes = [];
        for (const action of actions) {
          if (!active()) break;
          guide = pacedGuide(a, cohortGuide(await mcp.call("pact_agent_guide_v1"), cohort));
          try {
            validateAction(action, guide, cohort);
            let receipt = await executeAction({ actor: a, action, client, mcp, save, emit, active });
            if (ownerMayHandle(receipt.code, config)) {
              guide = pacedGuide(a, cohortGuide(await mcp.call("pact_agent_guide_v1"), cohort));
              receipt = await approveOwnerAction({
                actor: a,
                action,
                commandId: receipt.commandId,
                client,
                mcp,
                save,
                emit,
                active,
                guide,
                cohort,
                config,
              });
            }
            recordOutcome(a, action, receipt.code, guide.asOfGameTimeMs);
            save();
            outcomes.push({
              action,
              code: receipt.code,
              commandId: receipt.commandId,
              records: receipt.recordVersions ?? {},
            });
          } catch (error) {
            emit("plan_action_rejected", { actor: a.index, action, code: codeOf(error) });
            outcomes.push({ action, code: codeOf(error) });
            if (a.pending) throw error;
          }
        }
        a.memory = {
          intent: result.output.intent.slice(0, 1000),
          nextCheck: result.output.nextCheck.slice(0, 1000),
          outcomes,
        };
        a.failures = 0;
        a.successfulTurns = (a.successfulTurns ?? 0) + 1;
        emit("turn_completed", { actor: a.index, outcomes, modelMs: result.wallMs });
        completed = true;
      } catch (error) {
        const code = codeOf(error);
        emit("turn_failed", { actor: a.index, code, modelUsage: error.modelUsage });
        a.failedTurns = (a.failedTurns ?? 0) + 1;
        if (!["RUN_ALREADY_ACTIVE", "TICK_PENDING", "WORLD_NOT_ACTIVE", "RUN_STOPPED"].includes(code)) {
          a.failures = (a.failures ?? 0) + 1;
          if (a.failures >= 3) a.blocked = a.blocked ?? "THREE_TURN_FAILURES";
        }
      } finally {
        try {
          await mcp?.close();
        } catch {
          emit("session_close_failed", { actor: a.index });
        }
        if (completed) samples.push(Date.now() - began);
        finishTurn(a, due, Date.now(), config.intervalSeconds * 1000);
        emit("turn_timing", {
          actor: a.index,
          wallMs: Date.now() - began,
          modelUsed,
          completed,
          latenessMs: began - due,
        });
        save();
        status();
        atomicJson(path.join(dir, "capacity.json"), {
          runId: state.runId,
          turnCapacity: capacity(samples),
          modelCapacity: capacity(modelSamples),
          observedAccounts: peers.length,
          input: "Live owner state; one serial worker. Projections are not a load certification.",
        });
      }
      if (state.actors.every((a) => a.blocked && !a.pending)) break;
    }
    state.status = interrupted ? "interrupted" : store.stopped() ? "stopped" : "finished";
    state.stopReason = interrupted
      ? "SIGNAL"
      : store.stopped()
        ? "STOP_FILE"
        : state.requests >= requestCap
          ? "REQUEST_CAP"
          : Date.now() >= state.endsAt
            ? "DEADLINE"
            : "ALL_ACTORS_BLOCKED";
    save();
    status();
    emit("run_finished", { status: state.status, stopReason: state.stopReason, requests: state.requests });
    console.log(
      JSON.stringify({
        runId: state.runId,
        status: state.status,
        stopReason: state.stopReason,
        requests: state.requests,
        accounts: peers.length,
      }),
    );
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    store.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPopulation().catch((error) => {
    console.error(codeOf(error));
    process.exitCode = 1;
  });
}
