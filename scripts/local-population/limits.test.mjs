import assert from "node:assert/strict";
import test from "node:test";
import { effectiveRequestCap, extendInterruptedRun } from "./limits.mjs";
import { reserveRequest } from "./state.mjs";

const fixture = () => ({
  mode: "population",
  runId: "test",
  status: "stopped",
  stopReason: "STOP_FILE",
  startedAt: 0,
  endsAt: 7200000,
  requests: 204,
  config: { requestCap: 1250 },
  actors: [
    { kingdomId: "owned", ownerDecisions: { one: { costs: { grain: "3" } } }, pending: { commandId: "original" } },
  ],
});
const input = {
  runId: "test",
  endsAt: 6 * 3600000,
  requestCap: 4000,
  authorization: "Founder explicitly extends to 08:00 Berlin",
};
test("authorized extension preserves prior config, used budget, owners and pending exact decisions", () => {
  const old = fixture();
  const extended = extendInterruptedRun(old, input, 1000);
  assert.equal(extended.requests, 204);
  assert.deepEqual(extended.config, old.config);
  assert.deepEqual(extended.actors, old.actors);
  assert.equal(extended.originalEndsAt, old.endsAt);
  assert.equal(old.endsAt, 7200000);
  assert.equal(effectiveRequestCap(extended), 4000);
  assert.equal(effectiveRequestCap(JSON.parse(JSON.stringify(extended))), 4000);
  reserveRequest(extended, 2000, () => {});
  assert.equal(extended.requests, 205);
  assert.throws(() => reserveRequest({ ...extended, requests: 4000 }, 2000, () => {}), /REQUEST_CAP/);
  assert.throws(() => reserveRequest(extended, extended.endsAt, () => {}), /DEADLINE/);
});
test("completed, expired, unapproved, decreasing, oversized or wrong-run extensions are rejected", () => {
  assert.throws(() => extendInterruptedRun({ ...fixture(), status: "finished" }, input, 1000));
  assert.throws(() => extendInterruptedRun(fixture(), input, 7200000));
  for (const change of [
    { runId: "other" },
    { authorization: "" },
    { requestCap: 1 },
    { requestCap: 5001 },
    { endsAt: 1000 },
    { endsAt: 9 * 3600000 },
  ])
    assert.throws(() => extendInterruptedRun(fixture(), { ...input, ...change }, 1000));
  const extended = extendInterruptedRun(fixture(), input, 1000);
  extended.endsAt++;
  assert.throws(() => effectiveRequestCap(extended), /DEADLINE_MISMATCH/);
});
