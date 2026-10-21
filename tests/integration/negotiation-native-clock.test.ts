import { randomBytes } from "node:crypto";
import { createPool, dropTestSchema } from "@pact/db";
import { WorldClockService } from "@pact/world";
import { afterEach, expect, it } from "vitest";
import { type OwnedNegotiationWorld, prepareOwnedNegotiationWorld } from "../evaluation/negotiation-owned-run.js";
import { negotiationPlan } from "../evaluation/negotiation-plan.js";

const target = () => ({ pactUrl: process.env.TEST_DATABASE_URL!, nonce: process.env.FLEET_ARCHITECTURE_NONCE! });
const worlds: OwnedNegotiationWorld[] = [],
  schemas: string[] = [];
const cell = () =>
  negotiationPlan("E4", {
    sources: { fleet: "a".repeat(40), pact: "b".repeat(40) },
    modelDigest: "c".repeat(64),
    policyDigest: "d".repeat(64),
    selectedProfile: { id: "reactive-cognition", version: "2" },
  })[0];
async function make(control = false) {
  const key = () => randomBytes(32).toString("base64");
  const planned = cell();
  if (!planned) throw Error("MISSING_NATIVE_CELL");
  const w = await prepareOwnedNegotiationWorld(target(), planned, {
    retention: "preserve",
    control,
    secrets: { rulesKey: key(), tokenKey: key(), encryptionKey: key() },
    onCreated: async (schema) => {
      schemas.push(schema);
    },
  });
  worlds.push(w);
  return w;
}
afterEach(async () => {
  for (const w of worlds.splice(0)) {
    if (typeof w.pauseClock === "function") await w.pauseClock();
    await w.disconnect();
  }
  const p = createPool(target().pactUrl);
  try {
    for (const schema of schemas.splice(0)) await dropTestSchema(p, schema);
  } finally {
    await p.end();
  }
});
it("native preparation is paused and starts its normal worker only once without changing GAME time", async () => {
  const w = await make();
  expect((await w.pool.query("SELECT status,suspension_reason FROM world_clocks")).rows[0]).toEqual({
    status: "paused",
    suspension_reason: "NEGOTIATION_PREPARED",
  });
  await w.startNativeClock();
  await expect(w.startNativeClock()).rejects.toThrow("NATIVE_CLOCK_ALREADY_STARTED");
  const tick = await w.tickNativeClock();
  expect(tick).toMatchObject({ committed: false, gameTimeMs: 0, sequence: "0" });
  await expect(w.refreshControlledSchedule()).rejects.toThrow("OWNED_CONTROLLED_CLOCK_REQUIRED");
  expect((await w.leaseFacts()).every((l) => l.leaseId === null)).toBe(true);
  await w.pauseClock("NATIVE_TEST_PAUSE");
  await expect(w.tickNativeClock()).rejects.toThrow("NATIVE_CLOCK_LEASE_LOST");
});
it("native start cannot clear another pause and a lost worker lease is never reacquired", async () => {
  const w = await make();
  await w.pool.query("UPDATE world_clocks SET suspension_reason='MANUAL_PAUSE' WHERE product_scope='pact'");
  await expect(w.startNativeClock()).rejects.toThrow("NATIVE_PREPARATION_PAUSE_REQUIRED");
  expect((await w.pool.query("SELECT status,suspension_reason FROM world_clocks")).rows[0]).toEqual({
    status: "paused",
    suspension_reason: "MANUAL_PAUSE",
  });
  const other = await make();
  await other.startNativeClock();
  const token = (await other.pool.query("SELECT lease_token FROM world_clocks")).rows[0].lease_token;
  await other.pool.query("UPDATE world_clocks SET lease_expires_at=clock_timestamp()-interval '1 second'");
  await expect(other.tickNativeClock()).rejects.toThrow("NATIVE_CLOCK_LEASE_LOST");
  await expect(other.tickNativeClock()).rejects.toThrow("NATIVE_CLOCK_LEASE_LOST");
  expect((await other.pool.query("SELECT lease_token FROM world_clocks")).rows[0].lease_token).toBe(token);
});
it("conditional operator resume checks the exact pause atomically", async () => {
  const w = await make(),
    clock = new WorldClockService(w.pool, "pact");
  expect(await clock.resumeIfPaused("DIFFERENT_REASON")).toBeNull();
  const results = await Promise.all([
    clock.resumeIfPaused("NEGOTIATION_PREPARED"),
    clock.resumeIfPaused("NEGOTIATION_PREPARED"),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(results.filter((r) => r === null)).toHaveLength(1);
  expect(
    (await w.pool.query("SELECT committed_game_time_ms::text time,tick_sequence::text sequence FROM world_clocks"))
      .rows[0],
  ).toEqual({ time: "0", sequence: "0" });
});
it("retained reconnect permits the original start once and never reacquires its worker after another reconnect", async () => {
  const w = await make(),
    checkpoint = w.checkpoint();
  worlds.splice(worlds.indexOf(w), 1);
  await w.disconnect();
  const reopened = await prepareOwnedNegotiationWorld(target(), checkpoint.cell, {
    retention: "preserve",
    secrets: checkpoint.secrets,
    checkpoint,
  });
  worlds.push(reopened);
  await reopened.startNativeClock();
  worlds.splice(worlds.indexOf(reopened), 1);
  await reopened.disconnect();
  const again = await prepareOwnedNegotiationWorld(target(), checkpoint.cell, {
    retention: "preserve",
    secrets: checkpoint.secrets,
    checkpoint,
  });
  worlds.push(again);
  expect(again.players).toEqual(checkpoint.players);
  await expect(again.startNativeClock()).rejects.toThrow("NATIVE_CLOCK_ALREADY_STARTED");
  await expect(again.tickNativeClock()).rejects.toThrow("NATIVE_CLOCK_NOT_STARTED");
});
it("normal native minute ticks continue while a fake provider response is withheld", async () => {
  const a = await make(),
    solo = await make(true);
  await a.startNativeClock();
  await solo.startNativeClock();
  let release!: () => void,
    settled = false;
  const fakeProvider = new Promise<void>((resolve) => {
    release = resolve;
  }).then(() => {
    settled = true;
  });
  let failure: unknown,
    pumping = Promise.resolve();
  const pump = () => {
    pumping = pumping
      .then(async () => {
        await a.tickNativeClock();
        await solo.tickNativeClock();
      })
      .catch((e) => {
        failure = e;
      });
  };
  const timer = setInterval(pump, 1000),
    started = Date.now();
  try {
    await expect
      .poll(
        async () => {
          if (failure) throw failure;
          return Number(
            (await a.pool.query("SELECT committed_game_time_ms FROM world_clocks")).rows[0].committed_game_time_ms,
          );
        },
        { timeout: 65000, interval: 500 },
      )
      .toBe(60000);
    await pumping;
    expect(Date.now() - started).toBeGreaterThanOrEqual(59000);
    expect(settled).toBe(false);
    expect(
      Number((await solo.pool.query("SELECT committed_game_time_ms FROM world_clocks")).rows[0].committed_game_time_ms),
    ).toBe(60000);
    expect((await a.pool.query("SELECT count(*)::int n FROM negotiation_fixture_ticks")).rows[0].n).toBe(1);
  } finally {
    clearInterval(timer);
    await pumping;
    release();
    await fakeProvider;
  }
}, 75000);
