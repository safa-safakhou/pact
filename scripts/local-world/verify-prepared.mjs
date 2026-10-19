import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
if (!root) throw Error("Explicit state directory required");
const config = JSON.parse(readFileSync(resolve(root, "config.json"), "utf8"));
const state = JSON.parse(readFileSync(config.fleetEnv.FLEET_RUN_WINDOW_FILE, "utf8"));
assert.equal(state.status, "prepared");
assert.equal(state.startsAt, null);
assert.equal(state.endsAt, null);
process.chdir(config.fleetRepo);
Object.assign(process.env, config.fleetEnv);
const r = (await import(pathToFileURL(resolve(config.fleetRepo, "dist/server/runtime.js")).href)).runtime();
try {
  assert.equal(r.runWindow.isOpen(), false);
  assert.throws(() => r.runWindow.assertOpen());
  const counts = (
    await r.pool.query(
      "SELECT (SELECT count(*)::int FROM agents) actors,(SELECT count(*)::int FROM agents WHERE credential_state='ready' AND state='ready') ready,(SELECT count(*)::int FROM environment_bindings) bindings,(SELECT count(*)::int FROM turns) turns,(SELECT count(*)::int FROM compute_ledger) calls",
    )
  ).rows[0];
  assert.deepEqual(counts, { actors: 12, ready: 12, bindings: 12, turns: 0, calls: 0 });
  const cohorts = (await r.pool.query("SELECT state,anchor_at,model,budget FROM cohorts")).rows;
  assert.equal(cohorts.length, 4);
  for (const c of cohorts) {
    assert.equal(c.state, "draft");
    assert.equal(c.anchor_at, null);
    assert.equal(c.budget.mode, "continuous");
    assert.equal(c.budget.callLimit, null);
    assert.equal(c.budget.tokenLimit, null);
    assert.equal(c.model.model, "nemotron-3-nano:4b");
    assert.equal(c.model.thinking, true);
  }
  for (const row of (await r.pool.query("SELECT id,account_id,kingdom_id FROM agents")).rows) {
    const game = await r.broker.game(row.id);
    try {
      const profile = await game.profile();
      assert.equal(profile.accountId, row.account_id);
      assert.equal((await game.read("pact_world_read_v1", { forecastMinutes: 60 })).profile.kingdomId, row.kingdom_id);
      const tool = (await game.tools()).map((x) => x.name);
      assert.ok(tool.includes("pact_agent_events_v1"));
      assert.ok(tool.includes("pact_agent_outlook_v1"));
    } finally {
      await game.close();
    }
  }
  const { ProfileConsole } = await import(
    pathToFileURL(resolve(config.fleetRepo, "dist/server/platform/profile-console.js")).href
  );
  const pc = new ProfileConsole(r.store, r.tasks, r.environments, r.engines);
  for (const id of ["legacy-loop", "legacy-cognition", "reactive-basic", "reactive-cognition"])
    assert.equal(pc.preview({ id, version: "1" }).compatible, true);
  assert.equal(pc.preview({ id: "specialist-coordinator", version: "1" }).compatible, false);
  const { createPool } = await import(pathToFileURL(resolve(config.pactRepo, "packages/db/dist/index.js")).href);
  const gamePool = createPool(config.pactEnv.DATABASE_URL);
  try {
    assert.equal(
      (await gamePool.query("SELECT status FROM world_clocks WHERE product_scope='pact'")).rows[0].status,
      "paused",
    );
  } finally {
    await gamePool.end();
  }
  const ollama = config.fleetEnv.OLLAMA_BASE_URL;
  assert.equal((await (await fetch(ollama + "/api/version")).json()).version, config.ollamaVersion);
  const installed = (await (await fetch(ollama + "/api/tags")).json()).models;
  assert.equal(installed.find((model) => model.name === "nemotron-3-nano:4b")?.digest, config.modelDigest);
  const health = await fetch(config.pactEnv.PACT_ORIGIN + "/health");
  assert.equal(health.status, 200);
  const home = await fetch(config.pactEnv.PACT_ORIGIN);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<html/);
  const interfaces = await fetch(config.pactEnv.PACT_ORIGIN + "/v2/interfaces");
  assert.equal(interfaces.status, 200);
  const laya = await (await fetch(config.fleetEnv.FLEET_LAYA_URL + "/health")).json();
  assert.equal(laya.runtime, "0.4.6");
  assert.equal(laya.certificate, "c35e9af78a8f5e6e6f12f04819d2ec21b5887bdef3f13d969f70a0cf14b4645a");
  const receipt = {
    verifiedAt: new Date().toISOString(),
    disarmed: true,
    counts,
    profilesCompatible: 4,
    specialistRefused: true,
    ownedIdentityReadback: 12,
    webAndApi: true,
    eventsAndOutlookAdvertised: true,
    helperMetadataOnly: true,
    pausedClock: true,
    modelMetadataPinned: true,
    modelRequestsMade: 0,
  };
  writeFileSync(resolve(root, "evidence", "prepared-verification.json"), JSON.stringify(receipt, null, 2), {
    mode: 0o600,
  });
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await r.pool.end();
}
