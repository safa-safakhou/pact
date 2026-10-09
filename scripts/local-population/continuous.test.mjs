import assert from "node:assert/strict";
import test from "node:test";
import { PublicClient } from "../population/client.mjs";
import { ContinuousClient, continuousConfig } from "./continuous.mjs";

test("continuous profile removes lifetime caps while preserving finite model calls and ordinary bounded profile", () => {
  const { config } = continuousConfig({ PACT_LOCAL_STATE: "/tmp/pact-continuous-test", PACT_LOCAL_ACCOUNTS: "50" });
  assert.equal(config.accounts, 50);
  assert.equal(config.requestCap, undefined);
  assert.equal(config.durationMinutes, undefined);
  assert.equal(config.timeoutMs, 90000);
  assert.equal(config.context, 32768);
});
test("invalid refresh grant renews existing identity without losing uncertain command or counters", async () => {
  const original = PublicClient.prototype.mcp;
  let calls = 0;
  PublicClient.prototype.mcp = async () => {
    if (++calls === 1) throw Object.assign(Error("refresh lost"), { serverCode: "INVALID_GRANT" });
    return { connected: true };
  };
  try {
    const pending = { commandId: "exact-existing-id" };
    const actor = { kingdomId: "same-kingdom", tokens: { refresh_token: "fake" }, pending, turns: 23 };
    const client = new ContinuousClient(
      "https://example.test",
      actor,
      () => {},
      () => true,
    );
    client.resumeOwner = async () => {
      assert.equal(actor.kingdomId, "same-kingdom");
    };
    client.provision = async () => {
      assert.equal(actor.tokens, undefined);
      actor.tokens = { refresh_token: "renewed-fake" };
    };
    assert.equal((await client.mcp()).connected, true);
    assert.equal(actor.pending, pending);
    assert.equal(actor.turns, 23);
  } finally {
    PublicClient.prototype.mcp = original;
  }
});
test("guest identity mismatch fails before overwriting an existing kingdom", async () => {
  const original = PublicClient.prototype.http;
  PublicClient.prototype.http = async () => ({ kingdomId: "foreign-kingdom" });
  try {
    const actor = { kingdomId: "original-kingdom" };
    const client = new ContinuousClient(
      "https://example.test",
      actor,
      () => {},
      () => true,
    );
    await assert.rejects(client.resumeOwner(), /OWNER_IDENTITY_CHANGED/);
    assert.equal(actor.kingdomId, "original-kingdom");
  } finally {
    PublicClient.prototype.http = original;
  }
});
