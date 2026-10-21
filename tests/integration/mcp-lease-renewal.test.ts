import { randomUUID } from "node:crypto";
import { RunService } from "@pact/runs";
import { afterEach, expect, it } from "vitest";
import { negotiationPlan } from "../evaluation/negotiation-plan.js";
import { createNegotiationWorld, type NegotiationWorld } from "../evaluation/negotiation-world.js";

let world: NegotiationWorld | undefined;
afterEach(async () => {
  await world?.close();
  world = undefined;
});
async function setup() {
  const cell = negotiationPlan("E1", {
    sources: { fleet: "a".repeat(40), pact: "b".repeat(40) },
    modelDigest: "c".repeat(64),
    policyDigest: "d".repeat(64),
    selectedProfile: { id: "reactive-cognition", version: "1" },
  })[0]!;
  world = await createNegotiationWorld(
    { pactUrl: process.env.TEST_DATABASE_URL!, nonce: process.env.FLEET_ARCHITECTURE_NONCE! },
    cell,
  );
  const base = Date.now();
  let now = base;
  const service = new RunService(world.pool, { productScope: "pact", clock: { now: () => new Date(now) } });
  const row = (await world.pool.query("SELECT * FROM write_leases WHERE subject_id=$1", [world.players[0].accountId]))
    .rows[0];
  return {
    world,
    service,
    row,
    base,
    setNow: (value: number) => {
      now = value;
    },
    input: { accountId: world.players[0].accountId, holderId: row.holder_id, expectedLeaseId: row.lease_id },
  };
}
it("renews the same live lease for fifteen minutes from current UTC without inference or a new holder", async () => {
  const f = await setup();
  f.setNow(f.base + 300000);
  const result = await f.service.renewMcpLease(f.input);
  expect(result.leaseId).toBe(f.row.lease_id);
  expect(result.expiresAt.toISOString()).toBe(new Date(f.base + 1200000).toISOString());
  const saved = (await f.world.pool.query("SELECT * FROM write_leases WHERE subject_id=$1", [f.input.accountId]))
    .rows[0];
  expect(saved.lease_id).toBe(f.row.lease_id);
  expect(saved.acquired_at).toEqual(f.row.acquired_at);
  expect((await f.world.pool.query("SELECT count(*) n FROM envoy_runs")).rows[0].n).toBe("0");
});
it.each(["expired", "released", "wrong-holder", "wrong-lease", "wrong-account"])(
  "does not reacquire or change a %s lease",
  async (kind) => {
    const f = await setup();
    if (kind === "expired") f.setNow(new Date(f.row.expires_at).getTime());
    if (kind === "released") await f.service.releaseMcpLease(f.input);
    const input = { ...f.input };
    if (kind === "wrong-holder") input.holderId = randomUUID();
    if (kind === "wrong-lease") input.expectedLeaseId = randomUUID();
    if (kind === "wrong-account") input.accountId = randomUUID();
    const before = (await f.world.pool.query("SELECT to_jsonb(l) row FROM write_leases l ORDER BY subject_id")).rows;
    await expect(f.service.renewMcpLease(input)).rejects.toThrow("FORBIDDEN");
    expect((await f.world.pool.query("SELECT to_jsonb(l) row FROM write_leases l ORDER BY subject_id")).rows).toEqual(
      before,
    );
  },
);
it("a renewal waiting behind a concurrent release cannot revive the lease", async () => {
  const f = await setup(),
    c = await f.world.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("UPDATE write_leases SET released_at=clock_timestamp() WHERE subject_id=$1", [f.input.accountId]);
    const attempt = f.service.renewMcpLease(f.input);
    const verdict = expect(attempt).rejects.toThrow("FORBIDDEN");
    await c.query("COMMIT");
    await verdict;
    expect(
      (await f.world.pool.query("SELECT released_at FROM write_leases WHERE subject_id=$1", [f.input.accountId]))
        .rows[0].released_at,
    ).not.toBeNull();
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
});

it("expiry while waiting for the row lock cannot be renewed using an earlier timestamp", async () => {
  const f = await setup(),
    c = await f.world.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT 1 FROM write_leases WHERE subject_id=$1 FOR UPDATE", [f.input.accountId]);
    const verdict = expect(f.service.renewMcpLease(f.input)).rejects.toThrow("FORBIDDEN");
    f.setNow(new Date(f.row.expires_at).getTime());
    await c.query("COMMIT");
    await verdict;
    expect(
      (await f.world.pool.query("SELECT expires_at FROM write_leases WHERE subject_id=$1", [f.input.accountId])).rows[0]
        .expires_at,
    ).toEqual(f.row.expires_at);
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
});
