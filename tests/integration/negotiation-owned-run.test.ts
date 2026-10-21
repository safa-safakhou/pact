import { randomBytes, randomUUID } from "node:crypto";
import { createPool, dropTestSchema } from "@pact/db";
import { RunService } from "@pact/runs";
import { afterEach, expect, it } from "vitest";
import { type OwnedNegotiationWorld, prepareOwnedNegotiationWorld } from "../evaluation/negotiation-owned-run.js";
import { negotiationPlan } from "../evaluation/negotiation-plan.js";

const target = () => ({ pactUrl: process.env.TEST_DATABASE_URL!, nonce: process.env.FLEET_ARCHITECTURE_NONCE! });
const secrets = () => ({
  rulesKey: randomBytes(32).toString("base64"),
  tokenKey: randomBytes(32).toString("base64"),
  encryptionKey: randomBytes(32).toString("base64"),
});
const cell = (family = "C01") =>
  negotiationPlan("E1", {
    sources: { fleet: "a".repeat(40), pact: "b".repeat(40) },
    modelDigest: "c".repeat(64),
    policyDigest: "d".repeat(64),
    selectedProfile: { id: "reactive-cognition", version: "1" },
  }).find((c) => c.family === family)!;
const open: OwnedNegotiationWorld[] = [],
  schemas: string[] = [];
afterEach(async () => {
  for (const w of open.splice(0)) await w.disconnect();
  const p = createPool(target().pactUrl);
  try {
    for (const s of schemas.splice(0)) await dropTestSchema(p, s);
  } finally {
    await p.end();
  }
});
async function make(family = "C01") {
  const w = await prepareOwnedNegotiationWorld(target(), cell(family), {
    secrets: secrets(),
    retention: "preserve",
    onCreated: async (s) => {
      schemas.push(s);
    },
  });
  open.push(w);
  return w;
}
it("retained controlled clock excludes preparation/model wall gaps without advancing game time or clearing pauses", async () => {
  const w = await make();
  await w.pool.query(
    "UPDATE world_clocks SET last_heartbeat_at=clock_timestamp()-interval '5 minutes',next_tick_due_at=clock_timestamp()-interval '5 minutes' WHERE product_scope='pact'",
  );
  const before = (
    await w.pool.query("SELECT committed_game_time_ms::text time,tick_sequence::text sequence FROM world_clocks")
  ).rows;
  await expect(w.advanceTo(0)).resolves.toBeUndefined();
  await expect(w.refreshControlledSchedule()).resolves.toBeUndefined();
  expect(
    (await w.pool.query("SELECT committed_game_time_ms::text time,tick_sequence::text sequence FROM world_clocks"))
      .rows,
  ).toEqual(before);
  await w.pool.query(
    "UPDATE world_clocks SET status='paused',paused_at=clock_timestamp(),pause_origin='operator',suspension_reason='TEST_PAUSE',lease_holder=NULL,lease_token=NULL,lease_expires_at=NULL WHERE product_scope='pact'",
  );
  await expect(w.refreshControlledSchedule()).rejects.toThrow("CONTROLLED_CLOCK_NOT_ACTIVE");
  expect((await w.pool.query("SELECT status,suspension_reason FROM world_clocks")).rows[0]).toEqual({
    status: "paused",
    suspension_reason: "TEST_PAUSE",
  });
});
it.each(["C01", "C02"])(
  "disconnect retains %s identities, source rows and fenced run holders, and reconnects without new actors",
  async (family) => {
    const w = await make(family),
      checkpoint = w.checkpoint(),
      players = structuredClone(w.players);
    expect((w as unknown as { close?: unknown }).close).toBeUndefined();
    expect((await w.leaseFacts()).every((l) => l.leaseId === null && !l.live)).toBe(true);
    await expect(
      w
        .actor(players[0].kingdomId)
        .dispatch({ kind: "game.message.send", recipientKingdomId: players[1].kingdomId, body: "must remain fenced" }),
    ).rejects.toThrow("OWNED_WORLD_FENCED");
    const before = (await w.pool.query("SELECT to_jsonb(a) row FROM accounts a ORDER BY id")).rows;
    await w.disconnect();
    const restored = await prepareOwnedNegotiationWorld(target(), cell(family), {
      secrets: checkpoint.secrets,
      retention: "preserve",
      checkpoint,
    });
    open.push(restored);
    expect(restored.worldId).toBe(w.worldId);
    expect(restored.players).toEqual(players);
    expect((await restored.pool.query("SELECT to_jsonb(a) row FROM accounts a ORDER BY id")).rows).toEqual(before);
    expect((await restored.actor(players[0].kingdomId).readSelf())?.profile.kingdomId).toBe(players[0].kingdomId);
    expect(() => restored.actor(randomUUID())).toThrow("NEGOTIATION_ACTOR_SCOPE_MISMATCH");
  },
);
it("activates only initial owned run leases once and renews them without replacing IDs", async () => {
  const w = await make();
  await w.activateLeases();
  const before = await w.leaseFacts();
  expect(before.every((l) => l.live && l.leaseId)).toBe(true);
  await w.renewLeases();
  expect((await w.leaseFacts()).map((l) => l.leaseId)).toEqual(before.map((l) => l.leaseId));
  await expect(w.activateLeases()).rejects.toThrow("OWNED_LEASES_ALREADY_ACTIVATED");
  await w.pool.query("UPDATE write_leases SET released_at=clock_timestamp() WHERE subject_id=$1", [
    w.players[0].accountId,
  ]);
  await expect(w.renewLeases()).rejects.toThrow("FORBIDDEN");
  expect((await w.leaseFacts())[0]?.live).toBe(false);
});
it("wrong ownership and altered checkpoint cannot reopen a prepared world", async () => {
  const w = await make();
  const c = w.checkpoint();
  await w.disconnect();
  await expect(
    prepareOwnedNegotiationWorld({ ...target(), nonce: "0".repeat(64) }, cell(), {
      secrets: c.secrets,
      retention: "preserve",
      checkpoint: c,
    }),
  ).rejects.toThrow();
  const altered = structuredClone(c);
  const credential = altered.credentials[0];
  if (!credential) throw Error("MISSING_CHECKPOINT_CREDENTIAL");
  credential.holderId = randomUUID();
  await expect(
    prepareOwnedNegotiationWorld(target(), cell(), { secrets: c.secrets, retention: "preserve", checkpoint: altered }),
  ).rejects.toThrow("OWNED_CHECKPOINT_MISMATCH");
});
it("a failed retained setup preserves its schema instead of disposable finally cleanup", async () => {
  let schema = "";
  await expect(
    prepareOwnedNegotiationWorld(target(), cell(), {
      secrets: secrets(),
      retention: "preserve",
      onCreated: async (s) => {
        schema = s;
        schemas.push(s);
        throw Error("STOP_SETUP");
      },
    }),
  ).rejects.toThrow("STOP_SETUP");
  const p = createPool(target().pactUrl);
  try {
    expect((await p.query("SELECT 1 FROM information_schema.schemata WHERE schema_name=$1", [schema])).rowCount).toBe(
      1,
    );
  } finally {
    await p.end();
  }
});

it("concurrent initial activation has exactly one owner and never replaces the winning leases", async () => {
  const w = await make(),
    c = w.checkpoint();
  const second = await prepareOwnedNegotiationWorld(target(), cell(), {
    secrets: c.secrets,
    retention: "preserve",
    checkpoint: c,
  });
  open.push(second);
  const result = await Promise.allSettled([w.activateLeases(), second.activateLeases()]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
  const facts = await w.leaseFacts();
  expect(facts.every((l) => l.live)).toBe(true);
  await expect(second.activateLeases()).rejects.toThrow("OWNED_LEASES_ALREADY_ACTIVATED");
  expect((await w.leaseFacts()).map((l) => l.leaseId)).toEqual(facts.map((l) => l.leaseId));
});

it("requires all three canonical private keys before opening a database or schema", async () => {
  for (const bad of [{}, { rulesKey: "short", tokenKey: "short", encryptionKey: "short" }]) {
    await expect(
      prepareOwnedNegotiationWorld(target(), cell(), {
        retention: "preserve",
        secrets: bad as Parameters<typeof prepareOwnedNegotiationWorld>[2]["secrets"],
      }),
    ).rejects.toThrow("OWNED_WORLD_SECRETS_REQUIRED");
  }
});

it("an interrupted two-actor activation cannot admit its partially acquired first actor", async () => {
  const w = await make();
  const runs = new RunService(w.pool, { productScope: "pact", clock: { now: () => new Date() } });
  await runs.openMcpLease({ accountId: w.players[1].accountId, holderId: randomUUID() });
  await expect(w.activateLeases()).rejects.toThrow();
  await expect(
    w.actor(w.players[0].kingdomId).dispatch({
      kind: "game.contact.request",
      recipientKingdomId: w.players[1].kingdomId,
      note: "Must remain fenced after partial setup",
    }),
  ).rejects.toThrow("OWNED_WORLD_FENCED");
  await expect(w.activateLeases()).rejects.toThrow("OWNED_LEASES_ALREADY_ACTIVATED");
});
it("owned peer and cross-world reads never expose private stock, goal or another actor receipt", async () => {
  const w = await make("C02"),
    other = await make();
  const a = w.actor(w.players[0].kingdomId),
    b = w.actor(w.players[1].kingdomId);
  expect(w.openingOfferId).toBeTruthy();
  expect((await a.receipt(w.openingOfferId ?? ""))?.code).toBe("COMMITTED");
  expect(await b.receipt(w.openingOfferId ?? "")).toBeNull();
  expect(await other.actor(other.players[0].kingdomId).receipt(w.openingOfferId ?? "")).toBeNull();
  const peer = await a.readPeer(w.players[1].kingdomId);
  expect(peer?.audience).not.toBe("owner");
  expect(peer && Object.hasOwn(peer, "balances")).toBe(false);
  expect(peer && Object.hasOwn(peer, "ambition")).toBe(false);
  expect(await a.readPeer(other.players[0].kingdomId)).toBeNull();
});
