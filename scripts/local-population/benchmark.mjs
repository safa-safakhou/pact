import fs from "node:fs";
import path from "node:path";
import { readConfig } from "./config.mjs";
import { fixture } from "./fixture.mjs";
import { LocalModel } from "./ollama.mjs";
import { PLAN_SCHEMA, parsePlan, promptFor, schemaFor, validateAction } from "./plan.mjs";
import { capacity } from "./scheduler.mjs";
import { atomicJson, RunStore, reserveRequest, sameConfig } from "./state.mjs";

const { dir, config } = readConfig();
const count = Number(process.env.PACT_LOCAL_BENCHMARK_SAMPLES ?? 24);
if (!Number.isInteger(count) || count < 1 || count > 100) throw Error("INVALID_BENCHMARK_SAMPLES");
const store = new RunStore(dir);
try {
  const recordedPrompts = process.env.PACT_LOCAL_BENCHMARK_EVENTS
    ? fs
        .readFileSync(process.env.PACT_LOCAL_BENCHMARK_EVENTS, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((event) => event.type === "model_result")
        .map((event) => event.prompt)
    : [];
  if (process.env.PACT_LOCAL_BENCHMARK_EVENTS && !recordedPrompts.length) throw Error("NO_RECORDED_PROMPTS");
  const model = new LocalModel(config);
  const weights = await model.preflight();
  let state = store.read();
  if (
    state &&
    (!sameConfig(state.config, config) || state.weights.digest !== weights.digest || state.mode !== "benchmark")
  )
    throw Error("RESUME_CONFIG_MISMATCH");
  state ??= {
    mode: "benchmark",
    config,
    weights,
    requests: 0,
    endsAt: Date.now() + config.durationMinutes * 60000,
    samples: [],
  };
  const save = () => store.save(state);
  save();
  // No game requests, account creation or credentials in the isolated benchmark.
  while (
    state.samples.length < count &&
    Date.now() < state.endsAt &&
    state.requests < config.requestCap &&
    !store.stopped()
  ) {
    const sample = fixture(state.samples.length);
    const prompt = recordedPrompts.length
      ? `${recordedPrompts[state.samples.length % recordedPrompts.length]}\nIndependent benchmark replay ${state.samples.length}; never execute actions.`
      : promptFor(sample.actor, sample.guide, sample.peers, sample.conversations);
    reserveRequest(state, Date.now(), save);
    const began = Date.now();
    let result;
    try {
      result = await model.invoke(
        prompt,
        recordedPrompts.length ? PLAN_SCHEMA : schemaFor(sample.guide, sample.peers),
        state.endsAt,
      );
      const actions = parsePlan(result.output);
      const invalid = [];
      for (const action of recordedPrompts.length ? [] : actions)
        try {
          validateAction(action, sample.guide, new Set(sample.peers.map((p) => p.kingdomId)));
        } catch (error) {
          invalid.push(error.message);
        }
      state.samples.push({
        index: sample.actor.index,
        promptCharacters: prompt.length,
        ...result,
        valid: invalid.length === 0,
        invalid,
      });
    } catch (error) {
      state.samples.push({
        ...result,
        index: sample.actor.index,
        wallMs: Date.now() - began,
        valid: false,
        error: error.name,
      });
    }
    save();
    console.log(JSON.stringify({ sample: state.samples.length, ...state.samples.at(-1), output: undefined }));
  }
  const summary = {
    weights,
    config,
    samples: state.samples.length,
    validPlans: state.samples.filter((s) => s.valid).length,
    requests: state.requests,
    cold: state.samples[0],
    warmCapacity: capacity(
      state.samples
        .slice(1)
        .filter((s) => s.valid)
        .map((s) => s.wallMs),
    ),
    fullCapacity: capacity(state.samples.filter((s) => s.valid).map((s) => s.wallMs)),
    promptSource: recordedPrompts.length
      ? "Recorded synthetic live cohort prompts; shape validation only on replay"
      : "Synthetic fixture; shape and cohort action validation",
    note: "Serial inference throughput only; game/OAuth/network overhead and sustained multiplayer capacity are not measured here.",
  };
  atomicJson(path.join(dir, "benchmark.json"), summary);
  fs.copyFileSync(path.join(dir, "private-state.json"), path.join(dir, "benchmark-samples.json"));
  console.log(JSON.stringify({ summary: { ...summary, cold: { ...summary.cold, output: undefined } } }));
} finally {
  store.close();
}
