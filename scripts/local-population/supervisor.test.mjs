import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readConfig } from "./config.mjs";
import { clearDeadLock, environmentForState, processAlive, supervise } from "./supervisor.mjs";

test("background environment preserves every immutable limit rather than inheriting shell defaults", () => {
  const { dir, config } = readConfig({
    PACT_LOCAL_STATE: os.tmpdir(),
    PACT_LOCAL_ACCOUNTS: "50",
    PACT_LOCAL_REQUEST_CAP: "1250",
    PACT_LOCAL_MINUTES: "120",
  });
  const state = { mode: "population", config, endsAt: 123 };
  assert.deepEqual(readConfig(environmentForState(dir, state)).config, config);
  assert.throws(() => environmentForState(dir, { ...state, config: { model: "x" } }), /INCOMPLETE/);
});
test("a live PID keeps its lock; only a confirmed dead process can release its original lock", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pact-supervisor-"));
  const lock = path.join(dir, "runner.lock");
  try {
    fs.writeFileSync(lock, JSON.stringify({ pid: 123 }));
    assert.equal(
      clearDeadLock(dir, () => true),
      false,
    );
    assert.ok(fs.existsSync(lock));
    assert.equal(
      clearDeadLock(dir, () => false),
      true,
    );
    fs.writeFileSync(lock, JSON.stringify({ pid: "invalid" }));
    assert.throws(() => clearDeadLock(dir, () => false), /INVALID/);
    assert.ok(fs.existsSync(lock));
    assert.equal(processAlive(process.pid), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("finished background runs cannot start inference or receive a replacement budget", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pact-supervisor-terminal-"));
  try {
    const { config } = readConfig({ PACT_LOCAL_STATE: dir });
    const state = { mode: "population", runId: "terminal-test", status: "finished", requests: 100, config, endsAt: 1 };
    const file = path.join(dir, "private-state.json");
    fs.writeFileSync(file, JSON.stringify(state));
    assert.equal((await supervise(dir)).status, "terminal");
    assert.deepEqual(JSON.parse(fs.readFileSync(file)), state);
    assert.ok(!fs.existsSync(path.join(dir, "runner.lock")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
