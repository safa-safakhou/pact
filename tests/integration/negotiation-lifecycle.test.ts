import { afterEach, expect, it } from "vitest";
import { compareSolo, readNegotiationEvidence } from "../evaluation/negotiation-outcome.js";
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
afterEach(async () => {
  for (const w of worlds.splice(0)) await w.close();
});
async function make(family: string, variant = "default", control = false) {
  const cell = negotiationPlan("E3", selected).find((c) => c.family === family && c.variant === variant);
  if (!cell) throw Error("CELL_MISSING");
  const w = await createNegotiationWorld(target(), cell, { control });
  worlds.push(w);
  return w;
}
const terms = {
  aToB: { resource: "iron" as const, wholePerHour: 2 },
  bToA: { resource: "silver" as const, wholePerHour: 1 },
  aBond: null,
  bBond: null,
  durationHours: 1 as const,
  noticeHours: 0 as const,
};
async function contact(w: NegotiationWorld) {
  const a = w.actor(w.players[0].kingdomId),
    b = w.actor(w.players[1].kingdomId);
  const request = await a.dispatch({
    kind: "game.contact.request",
    recipientKingdomId: w.players[1].kingdomId,
    note: "I have excess Iron and seek Silver. Are you interested?",
  });
  const key = Object.keys(request.recordVersions).find((k) => k.startsWith("contact-request:"));
  if (!key) throw Error("NO_CONTACT_RECEIPT");
  await b.dispatch({ kind: "game.contact.answer", requestId: key.slice("contact-request:".length), accept: true });
  return { a, b };
}
it("settles 60 installments each way with exact mutual benefit versus independent solo worlds", async () => {
  const w = await make("C01"),
    control = await make("C01", "default", true);
  const { a, b } = await contact(w);
  await a.dispatch({
    kind: "game.message.send",
    recipientKingdomId: w.players[1].kingdomId,
    body: "I can send 2 Iron/hour for 1 Silver/hour for one hour, with no bonds.",
  });
  await b.dispatch({
    kind: "game.message.send",
    recipientKingdomId: w.players[0].kingdomId,
    body: "That fits my Iron need and Silver limit. Please submit those terms.",
  });
  const offer = await a.dispatch({
    kind: "game.supply.offer",
    counterpartyKingdomId: w.players[1].kingdomId,
    terms,
    expiryMinutes: 60,
  });
  await a.dispatch({ kind: "game.supply.sign", offerId: offer.commandId, version: 1 });
  expect((await readNegotiationEvidence(w)).contracts).toEqual([]);
  const signed = await b.dispatch({ kind: "game.supply.sign", offerId: offer.commandId, version: 1 });
  expect(await b.receipt(signed.commandId)).toEqual(signed);
  expect(
    await b.dispatch({ kind: "game.supply.sign", offerId: offer.commandId, version: 1 }, signed.commandId),
  ).toEqual(signed);
  await w.advanceTo(62);
  await control.advanceTo(62);
  const result = await readNegotiationEvidence(w),
    solo = await readNegotiationEvidence(control);
  expect(result.contracts).toHaveLength(1);
  const contract = result.contracts[0];
  if (!contract) throw Error("NO_CONTRACT");
  expect(contract.status).toBe("expired");
  expect(
    contract.flows
      .map((f) => ({
        resource: f.resource,
        due: f.dueUnits,
        delivered: f.deliveredUnits,
        installments: f.installments,
        failed: f.failedInstallments,
      }))
      .sort((x, y) => x.resource.localeCompare(y.resource)),
  ).toEqual([
    { resource: "iron", due: "1200", delivered: "1200", installments: 60, failed: 0 },
    { resource: "silver", due: "600", delivered: "600", installments: 60, failed: 0 },
  ]);
  const compared = compareSolo(result, solo);
  expect(compared.map((c) => c.ordinaryDeltaByResource)).toEqual([
    { iron: "0", silver: "600", grain: "0" },
    { iron: "1200", silver: "0", grain: "0" },
  ]);
  expect(compared.every((c) => c.supported && c.beneficial)).toBe(true);
  expect(compareSolo(result, { ...solo, worldId: result.worldId }).every((c) => !c.supported)).toBe(true);
  expect(compareSolo(result, { ...solo, horizonGameTimeMs: "0" }).every((c) => !c.supported)).toBe(true);
  expect(
    compareSolo(result, { ...solo, coverage: { ...solo.coverage, complete: false } }).every((c) => !c.supported),
  ).toBe(true);
  const unknown = structuredClone(result),
    unknownSolo = structuredClone(solo);
  for (const e of [unknown, unknownSolo]) for (const actor of e.actors) actor.goalDigest = "f".repeat(64);
  expect(compareSolo(unknown, unknownSolo).every((c) => !c.beneficial)).toBe(true);
  expect(await w.actor(w.players[0].kingdomId).receipt(signed.commandId)).toBeNull();
  expect(await control.actor(control.players[1].kingdomId).receipt(signed.commandId)).toBeNull();
  await expect(
    a.readSection({
      section: "agreements",
      cursor: {
        ownerKingdomId: control.players[0].kingdomId,
        section: "agreements",
        committedTickSequence: "0",
        lastCommittedEventId: "0",
        afterKey: "x",
      },
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });

  expect(result.receipts.filter((r) => r.commandId === signed.commandId)).toHaveLength(1);
  expect(result.lifecycle.some((e) => e.stage === "dialogue" && !e.scriptedPrefix)).toBe(true);
}, 120_000);
it("invalidates old signatures on counter and refuses revoked authority or expired offers", async () => {
  const w = await make("C02");
  const a = w.actor(w.players[0].kingdomId),
    b = w.actor(w.players[1].kingdomId);
  const id = w.openingOfferId;
  if (!id) throw Error("NO_OFFER");
  await b.dispatch({ kind: "game.supply.counter", offerId: id, expectedVersion: 1, terms, expiryMinutes: 60 });
  await expect(a.dispatch({ kind: "game.supply.sign", offerId: id, version: 1 })).rejects.toMatchObject({
    code: "STALE_VERSION",
  });
  await a.dispatch({ kind: "game.supply.sign", offerId: id, version: 2 });
  await w.ownerSetSupplyPermission(1, false);
  await expect(b.dispatch({ kind: "game.supply.sign", offerId: id, version: 2 })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect((await readNegotiationEvidence(w)).contracts).toHaveLength(0);
  const expired = await make("C04", "expired");
  await expect(
    expired
      .actor(expired.players[0].kingdomId)
      .dispatch({ kind: "game.supply.sign", offerId: expired.openingOfferId ?? "", version: 1 }),
  ).rejects.toMatchObject({ code: "EXPIRED" });
  expect((await readNegotiationEvidence(expired)).contracts).toHaveLength(0);
}, 60_000);
it("records unfavorable legal exchange and distinguishes actual default from fulfilled history", async () => {
  const bad = await make("C03"),
    soloBad = await make("C03", "default", true);
  const id = bad.openingOfferId;
  if (!id) throw Error("NO_OFFER");
  for (const p of bad.players)
    await bad.actor(p.kingdomId).dispatch({ kind: "game.supply.sign", offerId: id, version: 1 });
  await bad.advanceTo(62);
  await soloBad.advanceTo(62);
  const losses = compareSolo(await readNegotiationEvidence(bad), await readNegotiationEvidence(soloBad));
  expect(losses[1]?.ordinaryDeltaByResource.silver).toBe("-6000");
  expect(losses[1]?.beneficial).toBe(false);
  const fulfilled = await make("C05", "fulfilled"),
    failed = await make("C05", "default");
  expect((await readNegotiationEvidence(fulfilled)).contracts[0]?.status).toBe("expired");
  const history = await readNegotiationEvidence(failed);
  expect(history.contracts[0]?.status).toBe("defaulted");
  expect(history.contracts[0]?.flows.some((f) => f.failedInstallments > 0)).toBe(true);
  expect(await failed.actor(failed.players[0].kingdomId).history()).toHaveLength(10);
  expect((await failed.pool.query("SELECT count(*)::int n FROM command_receipts")).rows[0].n).toBeGreaterThan(0);
}, 180_000);
