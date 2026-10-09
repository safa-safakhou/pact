import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { checkUpgrade } from "../../packages/domain/dist/rules-catalog.js";
import { PublicClient } from "../population/client.mjs";
import { readConfig } from "./config.mjs";
import { OWNER_POLICY } from "./owner.mjs";
import { atomicJson, RunStore } from "./state.mjs";

// Operator-only cleanup: ordinary owner cancellation of unpaid, prerequisite-blocked synthetic queues.
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
if (!process.argv.includes("--source")) throw Error("SOURCE_REQUIRED");
const { dir, config } = readConfig();
const source = JSON.parse(fs.readFileSync(arg("--source"), "utf8"));
if (source.mode !== "population" || source.status !== "finished" || source.config.base !== config.base)
  throw Error("FINISHED_SYNTHETIC_SOURCE_REQUIRED");
const store = new RunStore(dir);
const state = store.read() ?? {
  mode: "waiting-repair",
  sourceRunId: source.runId,
  startedAt: Date.now(),
  endsAt: Date.now() + 120000,
  status: "running",
  requests: 0,
  actors: structuredClone(source.actors),
  decisions: [],
};
const save = () => store.save(state);
async function cancel(client, decision) {
  for (let retry = 0; retry < 8; retry++) {
    if (Date.now() >= state.endsAt || store.stopped()) throw Error("REPAIR_LIMIT");
    let receipt;
    try {
      receipt = await client.humanCommand(
        { kind: "game.building.cancel", instructionId: decision.instructionId },
        decision.commandId,
      );
    } catch (error) {
      if (error.serverCode !== "TICK_PENDING") throw error;
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    if (receipt.code !== "COMMITTED") throw Error(`REPAIR_${receipt.code}`);
    if (receipt.charged?.length) throw Error("UNEXPECTED_REPAIR_CHARGE");
    decision.applied = true;
    decision.receipt = receipt;
    save();
    return;
  }
  throw Error("REPAIR_TICK_WAIT");
}
try {
  if (state.mode !== "waiting-repair" || state.sourceRunId !== source.runId || state.status !== "running")
    throw Error("REPAIR_STATE_MISMATCH");
  save();
  if (process.argv.includes("--apply"))
    for (const decision of state.decisions.filter((d) => !d.applied)) {
      const actor = state.actors.find((a) => a.index === decision.actor && a.kingdomId === decision.kingdomId);
      if (!actor || actor.ownerPolicy !== OWNER_POLICY) throw Error("SYNTHETIC_OWNER_REQUIRED");
      await cancel(new PublicClient(config.base, actor, save), decision);
    }
  for (const actor of state.actors) {
    if (Date.now() >= state.endsAt || store.stopped()) throw Error("REPAIR_LIMIT");
    if (actor.ownerPolicy !== OWNER_POLICY) throw Error("SYNTHETIC_OWNER_REQUIRED");
    const client = new PublicClient(config.base, actor, save);
    const view = await client.http(`/v1/world/kingdoms/${actor.kingdomId}`);
    if (view.audience !== "owner" || view.profile.kingdomId !== actor.kingdomId) throw Error("OWNER_VIEW_REQUIRED");
    const levels = Object.fromEntries(view.buildings.map((b) => [b.kind, b.level]));
    for (const builder of view.builders.filter((b) => b.instructionId && b.state === "waiting")) {
      const reason = checkUpgrade(levels, builder.kind, builder.targetLevel);
      if (!["hall_prerequisite", "hall_limit"].includes(reason)) continue;
      if (state.decisions.length >= 16) throw Error("REPAIR_CAP");
      // Fresh owner view prevents using stale diagnostic rows; no active construction is canceled.
      const fresh = await client.http(`/v1/world/kingdoms/${actor.kingdomId}`);
      const current = fresh.builders.find((b) => b.instructionId === builder.instructionId);
      const currentLevels = Object.fromEntries(fresh.buildings.map((b) => [b.kind, b.level]));
      if (current?.state !== "waiting" || checkUpgrade(currentLevels, current.kind, current.targetLevel) !== reason)
        throw Error("REPAIR_STATE_CHANGED");
      const commandId = randomUUID();
      const decision = {
        actor: actor.index,
        kingdomId: actor.kingdomId,
        instructionId: builder.instructionId,
        reason,
        commandId,
        applied: false,
      };
      state.decisions.push(decision);
      save();
      if (process.argv.includes("--apply")) {
        await cancel(client, decision);
      }
    }
  }
  state.status = "finished";
  save();
  const proof = {
    observedAt: new Date().toISOString(),
    sourceRunId: source.runId,
    modelRequests: 0,
    applied: state.decisions.filter((d) => d.applied).length,
    decisions: state.decisions,
    note: "Normal owner commands cancel only unpaid prerequisite-blocked waiting work. Stock-limited legal waiting work remains. No original state, model budget, balances, mandates or historical receipts were rewritten.",
  };
  atomicJson(path.join(dir, "repair.json"), proof);
  console.log(JSON.stringify(proof));
} finally {
  store.close();
}
