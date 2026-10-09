import fs from "node:fs";
import path from "node:path";
import { readConfig } from "./config.mjs";
import { LocalModel } from "./ollama.mjs";
import { parsePlan, promptFor, schemaFor, validateAction } from "./plan.mjs";
import { atomicJson, RunStore, reserveRequest } from "./state.mjs";

// Inference-only verification against recorded synthetic owners. No game client is imported.
const { dir, config } = readConfig();
if (!process.env.PACT_LOCAL_REPLAY_EVENTS) throw Error("REPLAY_EVENTS_REQUIRED");
const count = Number(process.env.PACT_LOCAL_REPLAY_SAMPLES ?? 48);
if (!Number.isInteger(count) || count < 1 || count > 100) throw Error("INVALID_REPLAY_COUNT");
const recorded = fs
  .readFileSync(process.env.PACT_LOCAL_REPLAY_EVENTS, "utf8")
  .split("\n")
  .filter(Boolean)
  .map(JSON.parse)
  .filter((e) => e.type === "model_result");
const store = new RunStore(dir);
try {
  if (store.read()) throw Error("REPLAY_REQUIRES_NEW_STATE");
  const model = new LocalModel(config);
  const state = {
    mode: "replay",
    config,
    weights: await model.preflight(),
    requests: 0,
    endsAt: Date.now() + config.durationMinutes * 60000,
    samples: [],
    status: "running",
  };
  const save = () => store.save(state);
  save();
  const ranked = [...recorded].sort((a, b) => b.prompt.length - a.prompt.length);
  const selected = [
    ...ranked.slice(0, Math.floor(count / 3)),
    ...Array.from(
      { length: count - Math.floor(count / 3) },
      (_, i) => recorded[Math.floor(((i + 0.5) * recorded.length) / (count - Math.floor(count / 3)))],
    ),
  ];
  for (const event of selected) {
    if (store.stopped() || Date.now() >= state.endsAt || state.requests >= config.requestCap) break;
    const begin = event.prompt.indexOf("\n{");
    const input = JSON.parse(event.prompt.slice(begin + 1));
    const guide = input.guide;
    guide.resources = Object.fromEntries(
      Object.entries(guide.resources).map(([k, facts]) => [k, { facts, ordinaryWholeFloor: facts.ordinaryWhole }]),
    );
    const actor = {
      index: event.actor,
      persona: input.persona,
      memory: {
        intent: input.previous?.intent?.slice(0, 120),
        nextCheck: input.previous?.nextCheck?.slice(0, 120),
        outcomes: input.previous?.outcomes?.slice(-3),
      },
    };
    const peers = input.peers;
    const cohort = new Set([
      guide.self.kingdomId,
      ...peers.map((p) => p.kingdomId),
      ...guide.contacts.map((c) => c.kingdomId),
    ]);
    const prompt = promptFor(actor, guide, peers, input.conversations);
    reserveRequest(state, Date.now(), save);
    try {
      const result = await model.invoke(prompt, schemaFor(guide, peers), state.endsAt);
      const actions = parsePlan(result.output);
      const rejected = [];
      for (const action of actions)
        try {
          validateAction(action, guide, cohort);
        } catch (e) {
          rejected.push(e.message);
        }
      state.samples.push({
        sourceAt: event.at,
        actor: event.actor,
        sourcePromptCharacters: event.prompt.length,
        promptCharacters: prompt.length,
        ...result,
        valid: !rejected.length,
        rejected,
      });
    } catch (e) {
      state.samples.push({
        sourceAt: event.at,
        actor: event.actor,
        valid: false,
        error: e.message,
        modelUsage: e.modelUsage,
      });
    }
    save();
    console.log(
      JSON.stringify({
        sample: state.samples.length,
        valid: state.samples.at(-1).valid,
        error: state.samples.at(-1).error,
        rejected: state.samples.at(-1).rejected,
      }),
    );
  }
  state.status = "finished";
  save();
  const summary = {
    observedAt: new Date().toISOString(),
    mode: state.mode,
    requests: state.requests,
    validPlans: state.samples.filter((s) => s.valid).length,
    truncations: state.samples.filter((s) => s.error === "MODEL_OUTPUT_TRUNCATED").length,
    errors: state.samples
      .filter((s) => !s.valid)
      .map(({ actor, sourceAt, error, rejected }) => ({ actor, sourceAt, error, rejected })),
    config,
    weights: state.weights,
    samples: state.samples,
    note: "Recorded synthetic-owner replay with current prompt/schema; no accounts, HTTP game actions, approvals or settlements. Includes largest prompts and samples throughout the run.",
  };
  atomicJson(path.join(dir, "replay.json"), summary);
  console.log(JSON.stringify({ ...summary, samples: undefined }));
} finally {
  store.close();
}
