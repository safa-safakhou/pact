import { createPool } from "@pact/db";
import { afterEach, expect, it } from "vitest";
import { negotiationPlan } from "../evaluation/negotiation-plan.js";
import { createNegotiationWorld, type NegotiationWorld } from "../evaluation/negotiation-world.js";

const selected = {
  sources: { fleet: "a".repeat(40), pact: "b".repeat(40) },
  modelDigest: "c".repeat(64),
  policyDigest: "d".repeat(64),
  selectedProfile: { id: "reactive-cognition", version: "2" },
};
const target = () => ({
  pactUrl: process.env.TEST_DATABASE_URL ?? "",
  nonce: process.env.FLEET_ARCHITECTURE_NONCE ?? "",
});
const worlds: NegotiationWorld[] = [];
function firstCell() {
  const cell = negotiationPlan("E1", selected)[0];
  if (!cell) throw Error("MISSING_CELL");
  return cell;
}
afterEach(async () => {
  for (const w of worlds.splice(0)) await w.close();
});
it("rejects foreign ownership before creating a test world", async () => {
  const admin = createPool(target().pactUrl);
  try {
    const count = async () =>
      Number(
        (
          await admin.query(
            "SELECT count(*) FROM information_schema.schemata WHERE schema_name LIKE 'test_negotiation_%'",
          )
        ).rows[0].count,
      );
    const before = await count();
    await expect(createNegotiationWorld({ ...target(), nonce: "0".repeat(64) }, firstCell())).rejects.toThrow(
      "NEGOTIATION_OWNED_FIXTURE_REQUIRED",
    );
    expect(await count()).toBe(before);
  } finally {
    await admin.end();
  }
});
it("uses two normal founders and isolates actor observations commands and control state", async () => {
  const cell = firstCell();
  const w = await createNegotiationWorld(target(), cell);
  worlds.push(w);
  const other = await createNegotiationWorld(target(), cell, { control: true });
  worlds.push(other);
  expect(w.worldId).not.toBe(other.worldId);
  expect(Number((await w.pool.query("SELECT count(*) FROM kingdoms WHERE status='ranked'")).rows[0].count)).toBe(2);
  expect(Number((await w.pool.query("SELECT count(*) FROM kingdom_buildings")).rows[0].count)).toBe(14);
  expect(Number((await w.pool.query("SELECT count(*) FROM kingdom_troops")).rows[0].count)).toBe(16);
  const a = w.players[0],
    b = w.players[1];
  const allowances = (
    await w.pool.query(
      "SELECT resource,allowance_units::text amount FROM resource_balances WHERE kingdom_id=$1 ORDER BY resource",
      [a.kingdomId],
    )
  ).rows;
  expect(allowances).toEqual([
    { resource: "grain", amount: "48000" },
    { resource: "iron", amount: "120000" },
    { resource: "silver", amount: "60000" },
  ]);
  expect(() => w.actor(other.players[0].kingdomId)).toThrow("NEGOTIATION_ACTOR_SCOPE_MISMATCH");
  const peer = await w.actor(a.kingdomId).readPeer(b.kingdomId);
  expect(peer?.audience).not.toBe("owner");
  expect(peer && Object.hasOwn(peer, "balances")).toBe(false);
  expect(await w.actor(a.kingdomId).readPeer(other.players[0].kingdomId)).toBeNull();
  await expect(
    w.actor(a.kingdomId).dispatch({ kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await other.actor(other.players[0].kingdomId).readSelf())?.balances.iron.ordinaryUnits).toBe("360000");
}, 30_000);

it("rejects altered planned cells before schema creation", async () => {
  const cell = firstCell();
  await expect(
    createNegotiationWorld(target(), { ...cell, limits: { ...cell.limits, callsPerWorld: 999 } }).then((w) => {
      worlds.push(w);
      return "unexpectedly accepted";
    }),
  ).rejects.toThrow("NEGOTIATION_DESIGN_MISMATCH");
});
it("keeps the symmetric no-op case free of scripted social activity", async () => {
  const cell = negotiationPlan("E3", selected).find((c) => c.family === "C06");
  if (!cell) throw Error("MISSING_CELL");
  const w = await createNegotiationWorld(target(), cell);
  worlds.push(w);
  expect(w.openingOfferId).toBeNull();
  expect((await w.pool.query("SELECT count(*)::int n FROM negotiation_fixture_commands")).rows[0].n).toBe(0);
  expect((await w.actor(w.players[0].kingdomId).readSelf())?.balances.iron.ordinaryUnits).toBe("0");
}, 30_000);
