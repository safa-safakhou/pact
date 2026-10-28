import { afterAll, beforeAll, expect, it } from "vitest";
import { actionEffectsFixture } from "../fixtures/action-effects.js";

let f: Awaited<ReturnType<typeof actionEffectsFixture>>;
beforeAll(async () => {
  f = await actionEffectsFixture();
});
afterAll(async () => {
  await f?.close();
});
const terms = {
  aToB: { resource: "iron" as const, wholePerHour: 1 },
  bToA: { resource: "silver" as const, wholePerHour: 1 },
  aBond: null,
  bBond: null,
  durationHours: 1 as const,
  noticeHours: 0 as const,
};
it("reports closed owned offers as expired without exposing foreign offer existence", async () => {
  const a = await f.owner(),
    b = await f.owner(),
    outsider = await f.owner();
  await f.pool.query(
    "INSERT INTO social_contacts(product_scope,kingdom_a,kingdom_b,accepted_game_time_ms) VALUES('pact',$1,$2,0)",
    [...[a.kingdomId, b.kingdomId].sort()],
  );
  const offer = f.command(a.principal, { kind: "game.supply.offer", counterpartyKingdomId: b.kingdomId, terms });
  await f.dispatcher.dispatchGuarded(a.principal, await f.guarded(a.principal, offer));
  await f.pool.query("UPDATE supply_offers SET status='expired',expires_game_time_ms=0 WHERE id=$1", [offer.commandId]);
  const before = (await f.pool.query("SELECT count(*)::int n FROM command_receipts")).rows[0].n;
  for (const actor of [a, b, outsider]) {
    for (const action of [
      { kind: "game.supply.sign" as const, offerId: offer.commandId, version: 1 },
      { kind: "game.supply.counter" as const, offerId: offer.commandId, expectedVersion: 1, terms },
    ]) {
      await expect(f.effects.quote(actor.principal, f.command(actor.principal, action))).rejects.toThrow(
        actor === outsider ? "FORBIDDEN" : "EXPIRED",
      );
    }
  }
  await expect(
    f.effects.quote(
      a.principal,
      f.command(a.principal, { kind: "game.supply.sign", offerId: outsider.kingdomId, version: 1 }),
    ),
  ).rejects.toThrow("FORBIDDEN");
  expect((await f.pool.query("SELECT count(*)::int n FROM command_receipts")).rows[0].n).toBe(before);
});
it("covers eight actual action handlers with read-only quotes and exact one-time guarded receipts", async () => {
  const a = await f.owner(),
    b = await f.owner();
  const run = async (p: typeof a, action: Parameters<typeof f.command>[1]) => {
    const cmd = f.command(p.principal, action),
      before = (await f.pool.query("SELECT count(*)::int n FROM command_receipts")).rows[0].n;
    const g = await f.guarded(p.principal, cmd);
    expect(g.guard.expectedEffects).toMatchObject({
      actionKey: action.kind,
      coverage: { complete: true, omitted: [] },
      supported: true,
    });
    expect((await f.pool.query("SELECT count(*)::int n FROM command_receipts")).rows[0].n).toBe(before);
    const receipt = await f.dispatcher.dispatchGuarded(p.principal, g);
    expect(receipt.code).toBe("COMMITTED");
    expect(await f.dispatcher.dispatchGuarded(p.principal, g)).toEqual(receipt);
    return { cmd, g, receipt };
  };
  await run(a, { kind: "game.contact.request", recipientKingdomId: b.kingdomId, note: "Synthetic contact" });
  const request = (await f.pool.query("SELECT id FROM cold_contact_requests WHERE sender_kingdom_id=$1", [a.kingdomId]))
    .rows[0];
  await run(b, { kind: "game.contact.answer", requestId: request.id, accept: true });
  await run(a, { kind: "game.message.send", recipientKingdomId: b.kingdomId, body: "Synthetic fixture message" });
  const building = await run(a, { kind: "game.building.queue", slot: 1, building: "farm", targetLevel: 2 });
  expect(building.receipt.charged).toEqual(
    expect.arrayContaining(
      building.g.guard.expectedEffects.claims
        .filter((c) => c.kind === "resource" && c.schemaId === "pact.stock.v1")
        .map((c) => ({ asset: c.key.split(":")[0], units: c.kind === "resource" ? c.units : "0" }))
        .filter((c) => c.units !== "0"),
    ),
  );
  await run(a, { kind: "game.training.queue", type: "spearman", count: 1 });
  const offer = await run(a, { kind: "game.supply.offer", counterpartyKingdomId: b.kingdomId, terms });
  await run(b, { kind: "game.supply.counter", offerId: offer.cmd.commandId, expectedVersion: 1, terms });
  const first = await run(a, { kind: "game.supply.sign", offerId: offer.cmd.commandId, version: 2 });
  expect(first.receipt.charged).toEqual([]);
  const second = await run(b, { kind: "game.supply.sign", offerId: offer.cmd.commandId, version: 2 });
  expect(second.g.guard.expectedEffects.claims).toContainEqual(
    expect.objectContaining({ kind: "promise", value: expect.stringContaining('"deliveryUnproven":true') }),
  );
  expect((await f.pool.query("SELECT * FROM supply_contracts WHERE offer_id=$1", [offer.cmd.commandId])).rowCount).toBe(
    1,
  );
});
it("rejects changed stock, payload, authority, capacity, tick and fabricated effects before mutation", async () => {
  for (const mutation of ["stock", "authority", "capacity", "tick", "effects", "payload", "lease"]) {
    const a = await f.owner(),
      cmd = f.command(a.principal, { kind: "game.training.queue", type: "spearman", count: 1 }),
      g = await f.guarded(a.principal, cmd);
    if (mutation === "stock")
      await f.pool.query(
        "UPDATE resource_balances SET ordinary_units=ordinary_units-1,version=version+1 WHERE kingdom_id=$1 AND resource='iron'",
        [a.kingdomId],
      );
    if (mutation === "authority")
      await f.pool.query("UPDATE kingdom_mandates SET version=version+1,allowed_actions='{}' WHERE account_id=$1", [
        a.accountId,
      ]);
    if (mutation === "capacity")
      await f.pool.query("UPDATE kingdom_buildings SET level=2 WHERE kingdom_id=$1 AND kind='barracks'", [a.kingdomId]);
    if (mutation === "tick")
      await f.pool.query(
        "UPDATE world_clocks SET tick_sequence=tick_sequence+1,committed_game_time_ms=committed_game_time_ms+60000 WHERE product_scope='pact'",
      );
    if (mutation === "effects") g.guard.expectedEffects.claims = [];
    if (mutation === "payload" && g.command.action.kind === "game.training.queue") g.command.action.count = 2;
    if (mutation === "lease")
      await f.pool.query("UPDATE write_leases SET released_at=now() WHERE subject_id=$1", [a.accountId]);
    await expect(f.dispatcher.dispatchGuarded(a.principal, g)).rejects.toThrow();
    expect((await f.pool.query("SELECT * FROM command_receipts WHERE command_id=$1", [cmd.commandId])).rowCount).toBe(
      0,
    );
    expect((await f.pool.query("SELECT * FROM training_batches WHERE account_id=$1", [a.accountId])).rowCount).toBe(0);
  }
});
it("keeps queueing without immediate stock charges and rejects foreign or unsupported requests", async () => {
  const a = await f.owner(),
    b = await f.owner();
  await f.pool.query("UPDATE resource_balances SET ordinary_units=0,allowance_units=0 WHERE kingdom_id=$1", [
    a.kingdomId,
  ]);
  const cmd = f.command(a.principal, { kind: "game.building.queue", slot: 1, building: "hall", targetLevel: 2 }),
    g = await f.guarded(a.principal, cmd);
  expect(g.guard.expectedEffects.claims.filter((c) => c.kind === "resource" && c.schemaId === "pact.stock.v1")).toEqual(
    [],
  );
  expect((await f.dispatcher.dispatchGuarded(a.principal, g)).charged).toEqual([]);
  await expect(
    f.effects.quote(
      b.principal,
      f.command(a.principal, { kind: "game.contact.answer", requestId: cmd.commandId, accept: true }),
    ),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    f.effects.quote(a.principal, f.command(a.principal, { kind: "game.scout.start", targetKingdomId: b.kingdomId })),
  ).rejects.toThrow("INVALID_COMMAND");
});
it("retains an exact receipt after pause and conflicts on changed original guard", async () => {
  const a = await f.owner(),
    cmd = f.command(a.principal, { kind: "game.building.queue", slot: 1, building: "farm", targetLevel: 2 }),
    g = await f.guarded(a.principal, cmd),
    r = await f.dispatcher.dispatchGuarded(a.principal, g);
  await f.world.pause();
  expect(await f.dispatcher.dispatchGuarded(a.principal, g)).toEqual(r);
  expect(
    (await f.dispatcher.dispatchGuarded(a.principal, { ...g, guard: { ...g.guard, expectedRevision: "changed" } }))
      .code,
  ).toBe("IDEMPOTENCY_CONFLICT");
});
it("rejects changed offer consent or deadlines and retains exactly one concurrent command", async () => {
  // This test follows the paused receipt check; reopen this isolated synthetic clock only.
  await f.pool.query(
    "UPDATE world_clocks SET status='active',paused_at=NULL,suspension_reason=NULL,next_tick_due_at=clock_timestamp()+interval '10 minutes' WHERE product_scope='pact'",
  );
  const a = await f.owner(),
    b = await f.owner();
  await f.pool.query(
    "INSERT INTO social_contacts(product_scope,kingdom_a,kingdom_b,accepted_game_time_ms) VALUES('pact',$1,$2,0)",
    [...[a.kingdomId, b.kingdomId].sort()],
  );
  const offer = f.command(a.principal, { kind: "game.supply.offer", counterpartyKingdomId: b.kingdomId, terms });
  await f.dispatcher.dispatchGuarded(a.principal, await f.guarded(a.principal, offer));
  const sign = f.command(a.principal, { kind: "game.supply.sign", offerId: offer.commandId, version: 1 }),
    first = await f.guarded(a.principal, sign);
  const peerSign = f.command(b.principal, { kind: "game.supply.sign", offerId: offer.commandId, version: 1 });
  await f.dispatcher.dispatchGuarded(b.principal, await f.guarded(b.principal, peerSign));
  await expect(f.dispatcher.dispatchGuarded(a.principal, first)).rejects.toThrow("STALE_VERSION");
  const second = await f.guarded(a.principal, sign);
  await f.pool.query("UPDATE supply_offers SET expires_game_time_ms=0 WHERE id=$1", [offer.commandId]);
  await expect(f.dispatcher.dispatchGuarded(a.principal, second)).rejects.toThrow("EXPIRED");
  const c = await f.owner(),
    cmd = f.command(c.principal, { kind: "game.training.queue", type: "spearman", count: 1 }),
    g1 = await f.guarded(c.principal, cmd),
    g2 = await f.guarded(c.principal, f.command(c.principal, cmd.action));
  const results = await Promise.allSettled([
    f.dispatcher.dispatchGuarded(c.principal, g1),
    f.dispatcher.dispatchGuarded(c.principal, g2),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await f.pool.query("SELECT * FROM training_batches WHERE account_id=$1", [c.accountId])).rowCount).toBe(1);
  const d = await f.owner(),
    expired = await f.guarded(
      d.principal,
      f.command(d.principal, { kind: "game.training.queue", type: "spearman", count: 1 }),
    );
  f.advance(30001);
  await expect(f.dispatcher.dispatchGuarded(d.principal, expired)).rejects.toThrow("EXPIRED");
});
