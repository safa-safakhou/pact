import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PublicClient } from "../population/client.mjs";
import { comparisonModels, comparisonPersonas, initializeComparison, prepareAndRunComparison } from "./comparison.mjs";
import { runIsActive } from "./continuous.mjs";
import { LocalModel } from "./ollama.mjs";

test("finite comparison obeys persisted deadline and cap without limiting continuous authorization", () => {
  const finite = { mode: "full-game-comparison", endsAt: 200, requests: 9, config: { requestCap: 10 } };
  assert.equal(runIsActive(finite, 199), true);
  assert.equal(runIsActive(finite, 200), false);
  assert.equal(runIsActive({ ...finite, requests: 10 }, 100), false);
  assert.equal(runIsActive({ ...finite, endsAt: undefined }, 100), false);
  assert.equal(runIsActive({ mode: "unexpected" }, 100), false);
  assert.equal(runIsActive({ mode: "full-game-continuous", requests: 999999 }, 9999999999), true);
});

test("partial provisioning resumes the same 25 identities and ready state cannot reset its deadline", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pact-comparison-test-"));
  const preflight = LocalModel.prototype.preflight;
  const provision = PublicClient.prototype.provision;
  const owners = new Map();
  let fail = true;
  LocalModel.prototype.preflight = async function () {
    return { name: this.config.model, digest: this.config.model };
  };
  PublicClient.prototype.provision = async function () {
    const a = this.actor;
    if (a.index === 7 && fail) throw Error("SIMULATED_PROVISION_FAILURE");
    if (!owners.has(a.entryKey)) owners.set(a.entryKey, `owner-${a.index}`);
    a.kingdomId = owners.get(a.entryKey);
    this.save();
  };
  const env = { PACT_LOCAL_STATE: dir, PACT_COMPARISON_AUTHORIZATION: "five-models-five-new-accounts-two-hours" };
  try {
    await assert.rejects(initializeComparison(env), /SIMULATED_PROVISION_FAILURE/);
    const file = path.join(dir, "private-state.json");
    const first = JSON.parse(fs.readFileSync(file));
    assert.equal(first.endsAt, undefined);
    fail = false;
    await initializeComparison(env);
    const ready = JSON.parse(fs.readFileSync(file));
    assert.deepEqual(
      ready.actors.map((a) => a.entryKey),
      first.actors.map((a) => a.entryKey),
    );
    assert.equal(owners.size, 25);
    assert.equal(ready.endsAt - ready.startedAt, 7200000);
    assert.equal(ready.requests, 0);
    for (const model of comparisonModels) assert.equal(ready.actors.filter((a) => a.model === model).length, 5);
    await assert.rejects(initializeComparison(env), /COMPARISON_ALREADY_INITIALIZED/);
    assert.equal(JSON.parse(fs.readFileSync(file)).endsAt, ready.endsAt);
    assert.equal(fs.existsSync(path.join(dir, "runner.lock")), false);
  } finally {
    LocalModel.prototype.preflight = preflight;
    PublicClient.prototype.provision = provision;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("comparison needs founder authorization before provisioning and has matched roles across five models", async () => {
  await assert.rejects(initializeComparison({}), /COMPARISON_AUTHORIZATION_REQUIRED/);
  assert.equal(new Set(comparisonModels).size, 5);
  assert.equal(comparisonPersonas.length, 5);
});

test("finished comparison preparation cannot download or reset the old run", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pact-comparison-terminal-"));
  const file = path.join(dir, "private-state.json");
  const checkpoint = JSON.stringify({ mode: "full-game-comparison", status: "finished", endsAt: 1, requests: 27 });
  fs.writeFileSync(file, checkpoint);
  try {
    await prepareAndRunComparison({
      PACT_LOCAL_STATE: dir,
      PACT_COMPARISON_AUTHORIZATION: "five-models-five-new-accounts-two-hours",
    });
    assert.equal(fs.readFileSync(file, "utf8"), checkpoint);
    assert.equal(fs.existsSync(path.join(dir, "preparation.json")), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
