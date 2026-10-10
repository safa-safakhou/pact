import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveReadPlan } from "./full-game.mjs";

test("requested reads are delivered before a new decision; accompanying stale actions never execute", async () => {
  const plan = {
    intent: "inspect",
    nextCheck: "next eligible turn",
    reads: [{ name: "pact_world_read_v1", args: {} }],
    actions: [{ action: { kind: "game.supply.sign", offerId: "fixture", version: 1 } }],
  };
  const result = await resolveReadPlan(plan, async () => ({ version: 2 }));
  assert.deepEqual(result.plan.actions, []);
  assert.equal(result.results[0].result.version, 2);
  assert.equal(plan.actions.length, 1); // original intent not silently rewritten in evidence
  const fresh = {
    ...plan,
    reads: [],
    actions: [{ action: { kind: "game.supply.sign", offerId: "fixture", version: 2 } }],
  };
  assert.deepEqual((await resolveReadPlan(fresh, () => assert.fail())).plan.actions, fresh.actions);
});
test("failed reads and owner stop cannot fall through to accompanying commands", async () => {
  const plan = { reads: [{ name: "read", args: {} }], actions: [{ action: { kind: "game.message.send" } }] };
  assert.deepEqual(
    (
      await resolveReadPlan(plan, async () => {
        throw { code: "FORBIDDEN" };
      })
    ).plan.actions,
    [],
  );
  const stopped = await resolveReadPlan(
    plan,
    () => assert.fail(),
    () => false,
  );
  assert.deepEqual(stopped.plan.actions, []);
  assert.equal(stopped.results.length, 0);
});
