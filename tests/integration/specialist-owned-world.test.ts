import { randomBytes, randomUUID } from "node:crypto";
import { createPool, dropTestSchema } from "@pact/db";
import { afterEach, expect, it } from "vitest";
import { type OwnedSpecialistWorld, prepareOwnedSpecialistWorld } from "../evaluation/specialist-owned-world.js";

const descriptor = {
  id: "KQ1:resources-diplomacy:guarded:existing-goal",
  configurationDigest: "f".repeat(64),
  scenario: "existing-goal" as const,
  sources: { fleet: "a".repeat(40), pact: "b".repeat(40) },
  modelDigest: "c".repeat(64),
  policyDigest: "d".repeat(64),
};
function target() {
  if (!process.env.TEST_DATABASE_URL || !process.env.FLEET_ARCHITECTURE_NONCE) throw Error("OWNED_TEST_REQUIRED");
  return { pactUrl: process.env.TEST_DATABASE_URL, nonce: process.env.FLEET_ARCHITECTURE_NONCE };
}
const secrets = () =>
  Object.fromEntries(["rulesKey", "tokenKey", "encryptionKey"].map((k) => [k, randomBytes(32).toString("base64")])) as {
    rulesKey: string;
    tokenKey: string;
    encryptionKey: string;
  };
const open: OwnedSpecialistWorld[] = [],
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
async function make(scenario: "existing-goal" | "changed-consent-reserve" = "existing-goal") {
  const definition = { ...descriptor, id: descriptor.id.replace("existing-goal", scenario), scenario };
  const w = await prepareOwnedSpecialistWorld(target(), definition, {
    secrets: secrets(),
    retention: "preserve",
    onCreated: async (s) => {
      schemas.push(s);
    },
  });
  open.push(w);
  return w;
}
it("retains dedicated KQ1 identities, exact owner goal and scripted peer prefix across reconnect", async () => {
  const w = await make(),
    c = w.checkpoint();
  expect((w as unknown as { close?: unknown }).close).toBeUndefined();
  expect(w.actorId).not.toBe(w.peerId);
  expect((await w.actor.readSelf())?.ambition).toContain(w.offer.id);
  expect(
    (await w.pool.query("SELECT kind,scripted_prefix FROM negotiation_fixture_commands ORDER BY wall_time")).rows.every(
      (r) => r.scripted_prefix,
    ),
  ).toBe(true);
  expect((await w.pool.query("SELECT count(*)::int n FROM supply_contracts")).rows[0].n).toBe(0);
  await w.disconnect();
  const restored = await prepareOwnedSpecialistWorld(target(), descriptor, {
    secrets: c.world.secrets,
    retention: "preserve",
    checkpoint: c,
  });
  open.push(restored);
  expect(restored.actorId).toBe(w.actorId);
  expect(restored.offer).toEqual(w.offer);
  await expect(
    prepareOwnedSpecialistWorld({ ...target(), nonce: "0".repeat(64) }, descriptor, {
      secrets: c.world.secrets,
      retention: "preserve",
      checkpoint: c,
    }),
  ).rejects.toThrow();
});
it("uses native guarded signatures, preserves original receipt, then observes full delivery separately", async () => {
  const w = await make();
  await w.activateLeases();
  const command = {
    schemaVersion: "pact.command.v2" as const,
    commandId: randomUUID(),
    actor: {
      principalId: w.accountId,
      productScope: "pact" as const,
      audience: "agent" as const,
      subject: { type: "account" as const, id: w.accountId },
    },
    action: { kind: "game.supply.sign" as const, offerId: w.offer.id, version: 1 },
    submittedAt: new Date().toISOString(),
  };
  const quote = await w.actor.effects(command),
    guard = {
      schemaVersion: "fleet.action-effects-guard.v1" as const,
      expectedRevision: quote.revision,
      expectedEffects: quote,
    };
  expect((await w.actor.submitGuarded(command, guard)).code).toBe("COMMITTED");
  expect((await w.actor.submitGuarded(command, guard)).code).toBe("COMMITTED");
  expect((await w.pool.query("SELECT count(*)::int n FROM supply_contracts")).rows[0].n).toBe(1);
  expect((await w.evidence()).actualFullDelivery).toBe(false);
  await w.advanceTo(80);
  expect((await w.evidence()).actualFullDelivery).toBe(true);
  expect((await w.actor.receipt(command.commandId))?.commandId).toBe(command.commandId);
  const leases = await w.leaseFacts();
  await w.renewLeases();
  expect((await w.leaseFacts()).map((l) => l.leaseId)).toEqual(leases.map((l) => l.leaseId));
});
it("applies only the preregistered counterexample once and rejects a stale signature without delivery", async () => {
  const w = await make("changed-consent-reserve");
  await w.activateLeases();
  await w.applyCounterexample();
  await expect(w.applyCounterexample()).rejects.toThrow("KQ1_COUNTEREXAMPLE_ALREADY_APPLIED");
  await expect(w.actor.dispatch({ kind: "game.supply.sign", offerId: w.offer.id, version: 1 })).rejects.toThrow(
    "INVALID_COMMAND",
  );
  expect((await w.evidence()).actualFullDelivery).toBe(false);
  expect((await w.pool.query("SELECT count(*)::int n FROM supply_contracts")).rows[0].n).toBe(0);
});
it("refuses wrong cell/checkpoint before recreating any owned state", async () => {
  const w = await make(),
    c = w.checkpoint();
  await expect(
    prepareOwnedSpecialistWorld(
      target(),
      { ...descriptor, configurationDigest: "0".repeat(64) },
      { secrets: c.world.secrets, retention: "preserve", checkpoint: c },
    ),
  ).rejects.toThrow("KQ1_CHECKPOINT_MISMATCH");
  await expect(
    prepareOwnedSpecialistWorld(target(), descriptor, {
      secrets: { ...c.world.secrets, rulesKey: "short" },
      retention: "preserve",
    }),
  ).rejects.toThrow("OWNED_WORLD_SECRETS_REQUIRED");
});
