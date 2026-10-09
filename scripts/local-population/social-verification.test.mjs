import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runIsActive } from "./continuous.mjs";
import { initializeSocialVerification } from "./social-verification.mjs";

test("short verification fixes its budget after provisioning and never resets a terminal checkpoint", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pact-social-verification-"));
  try {
    const env = {
      PACT_LOCAL_STATE: dir,
      PACT_SOCIAL_VERIFICATION_AUTHORIZATION: "two-new-players-twenty-minutes-social-verification",
    };
    let provisions = 0;
    const deps = {
      now: () => 1000000,
      preflight: async () => ({ digest: "fixture" }),
      provision: async (a) => {
        a.kingdomId = `kingdom-${a.index}`;
        a.tokens = { access_token: "fake" };
        provisions++;
      },
    };
    await assert.rejects(
      initializeSocialVerification({ ...env, PACT_SOCIAL_VERIFICATION_AUTHORIZATION: "" }, deps),
      /AUTHORIZATION_REQUIRED/,
    );
    await initializeSocialVerification(env, deps);
    const file = path.join(dir, "private-state.json");
    const state = JSON.parse(fs.readFileSync(file));
    assert.equal(state.endsAt, 2200000);
    assert.equal(state.config.requestCap, 60);
    assert.equal(state.config.intervalSeconds, 60);
    assert.equal(runIsActive(state, 2199999), true);
    assert.equal(runIsActive(state, 2200000), false);
    const keys = state.actors.map((a) => a.entryKey);
    state.status = "finished";
    state.requests = 41;
    fs.writeFileSync(file, JSON.stringify(state));
    await initializeSocialVerification(env, { ...deps, now: () => 999999999 });
    const final = JSON.parse(fs.readFileSync(file));
    assert.equal(provisions, 2);
    assert.deepEqual(
      final.actors.map((a) => a.entryKey),
      keys,
    );
    assert.equal(final.endsAt, 2200000);
    assert.equal(final.requests, 41);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
