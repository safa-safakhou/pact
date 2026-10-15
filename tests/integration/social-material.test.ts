import { randomUUID } from "node:crypto";
import { ExposureService } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import {
  ActionLimitService,
  ConversationHistoryReader,
  SocialService,
  SupplyExposureAdapter,
  SupplyService,
  SupplySettlementService,
  type SupplyTerms,
  WorldViewService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:55437/pact_test";
let admin: Pool, pool: Pool, schema: string, ledger: ResourceLedger, limits: ActionLimitService, social: SocialService;
beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "social_material");
  pool = createSchemaPool(connectionString, schema);
  await new WorldClockService(pool, "pact").bootstrap();
  // New disposable world: define its initial GAME-time epoch before any offers or effects.
  await pool.query("UPDATE world_clocks SET committed_game_time_ms=0,tick_sequence=0 WHERE product_scope='pact'");
  ledger = new ResourceLedger("pact");
  limits = new ActionLimitService("pact");
  social = new SocialService("pact", ledger, limits, { now: () => new Date("2026-09-23T00:00:00Z") });
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});
async function kingdom(): Promise<{ accountId: string; kingdomId: string }> {
  const accountId = randomUUID();
  const kingdomId = randomUUID();
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
       VALUES ($1, 'pact', $2, 'fixture-only', clock_timestamp(), 'terms-v1')`,
      [accountId, `${accountId}@example.test`],
    );
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1, 'pact', $2, $3, 'Supply Fixture', 'portrait.wolf', clock_timestamp(),
         0, 0, 60000, $4)`,
      [kingdomId, accountId, `supply_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
  });
  return { accountId, kingdomId };
}

it("fulfils an optional overflow-saving trade with greater retained stock than matched solo founders; declining bad terms is valid", async () => {
  const a = await kingdom(),
    b = await kingdom(),
    soloA = await kingdom(),
    soloB = await kingdom();
  const exposure = new ExposureService("pact"),
    adapter = new SupplyExposureAdapter(exposure),
    live = new SupplyService("pact", ledger, limits, social, adapter),
    settlement = new SupplySettlementService("pact", ledger, { read: async () => 0n }, adapter);
  for (const owner of [a, b])
    await pool.query(
      "INSERT INTO kingdom_mandates(product_scope,account_id,allowed_actions,resource_limits) VALUES('pact',$1,ARRAY['supply.sign'],$2)",
      [
        owner.accountId,
        {
          iron: wholeResources(10000).toString(),
          silver: wholeResources(10000).toString(),
          grain: wholeResources(10000).toString(),
        },
      ],
    );
  for (const owner of [a, soloA])
    await withTransaction(pool, async (c) => {
      const balance = await ledger.readBalance(c, owner.kingdomId, "iron");
      await ledger.creditOrdinary(c, {
        kingdomId: owner.kingdomId,
        resource: "iron",
        amount: balance.storageCap,
        operationKey: "overflow-fixture",
        reason: "fixture",
        gameTimeMs: 0,
      });
    });
  for (const owner of [b, soloB])
    await withTransaction(pool, async (c) => {
      const balance = await ledger.readBalance(c, owner.kingdomId, "silver");
      await ledger.creditOrdinary(c, {
        kingdomId: owner.kingdomId,
        resource: "silver",
        amount: balance.storageCap,
        operationKey: "overflow-fixture",
        reason: "fixture",
        gameTimeMs: 0,
      });
    });
  const offerId = randomUUID(),
    trade: SupplyTerms = {
      aToB: { resource: "iron", wholePerHour: 2 },
      bToA: { resource: "silver", wholePerHour: 1 },
      aBond: null,
      bBond: null,
      durationHours: 1,
      noticeHours: 0,
    };
  await withTransaction(pool, (c) =>
    live.createOffer(c, {
      accountId: a.accountId,
      counterpartyKingdomId: b.kingdomId,
      offerId,
      terms: trade,
      expiryMinutes: 60,
      gameTimeMs: 0,
      operationKey: "material-offer",
    }),
  );
  expect(
    (await new ConversationHistoryReader(pool, "pact").agreements(b.accountId, a.kingdomId)).offers[0],
  ).toMatchObject({ id: offerId, terms: trade, status: "open" });
  const views = new WorldViewService(pool, "pact");
  expect(
    (await views.readSection(b.accountId, { section: "social_attention", recordId: offerId })).records,
  ).toMatchObject([{ type: "SupplyOffer", terms: trade, reason: "signature_decision", signedBy: [] }]);
  const first = await withTransaction(pool, (c) =>
    live.signOffer(c, {
      accountId: a.accountId,
      offerId,
      version: 1,
      actorKind: "agent",
      gameTimeMs: 0,
      operationKey: "material-a",
    }),
  );
  expect(first.contractId).toBeFalsy();
  const signed = await withTransaction(pool, (c) =>
    live.signOffer(c, {
      accountId: b.accountId,
      offerId,
      version: 1,
      actorKind: "agent",
      gameTimeMs: 0,
      operationKey: "material-b",
    }),
  );
  expect(signed.contractId).toBeTruthy();
  if (!signed.contractId) throw Error("Expected actual activated contract");
  for (let minute = 1; minute <= 61; minute++)
    await withTransaction(pool, async (c) => {
      const gameTimeMs = minute * 60000;
      await settlement.settleBoundaries(c, gameTimeMs);
      await ledger.settleProductionMinute(
        c,
        { productScope: "pact", gameTimeMs, sequence: BigInt(minute), dueAt: new Date(gameTimeMs) },
        1,
      );
      await settlement.capture(c, gameTimeMs);
      await settlement.settleDeliveries(c, gameTimeMs);
      await settlement.settleDefaults(c, gameTimeMs);
      await c.query("UPDATE world_clocks SET committed_game_time_ms=$1,tick_sequence=$2 WHERE product_scope='pact'", [
        gameTimeMs,
        minute,
      ]);
    });
  const balance = (owner: typeof a, resource: "iron" | "silver") =>
    withTransaction(pool, (c) => ledger.readBalance(c, owner.kingdomId, resource));
  expect((await balance(a, "iron")).ordinary).toBe((await balance(soloA, "iron")).ordinary);
  expect((await balance(b, "silver")).ordinary).toBe((await balance(soloB, "silver")).ordinary);
  expect((await balance(a, "silver")).ordinary - (await balance(soloA, "silver")).ordinary).toBe(wholeResources(1));
  expect((await balance(b, "iron")).ordinary - (await balance(soloB, "iron")).ordinary).toBe(wholeResources(2));
  expect(
    (await pool.query("SELECT status FROM supply_contracts WHERE id=$1", [signed.contractId])).rows[0].status,
  ).toBe("expired");
  const terminal = await views.readSection(b.accountId, { section: "agreements", recordId: signed.contractId });
  expect(terminal.records).toMatchObject([
    {
      type: "SupplyContract",
      status: "expired",
      terms: trade,
      deliveries: expect.arrayContaining([
        expect.objectContaining({
          direction: "received",
          resource: "iron",
          deliveredMarked: wholeResources(2).toString(),
        }),
      ]),
    },
  ]);
  expect(
    (await views.readSection(b.accountId, { section: "social_attention", recordId: signed.contractId })).records,
  ).toEqual([]);
  const deliveries = (
    await pool.query(
      "SELECT resource,count(*)::int n,sum(due_units)::text due,sum(delivered_units)::text delivered,sum(overflow_units)::text overflow FROM supply_installments WHERE contract_id=$1 GROUP BY resource ORDER BY resource",
      [signed.contractId],
    )
  ).rows;
  expect(deliveries).toEqual([
    {
      resource: "iron",
      n: 60,
      due: wholeResources(2).toString(),
      delivered: wholeResources(2).toString(),
      overflow: "0",
    },
    {
      resource: "silver",
      n: 60,
      due: wholeResources(1).toString(),
      delivered: wholeResources(1).toString(),
      overflow: "0",
    },
  ]);
  const badId = randomUUID();
  await withTransaction(pool, (c) =>
    live.createOffer(c, {
      accountId: a.accountId,
      counterpartyKingdomId: b.kingdomId,
      offerId: badId,
      terms: { ...trade, aToB: { resource: "iron", wholePerHour: 1 }, bToA: { resource: "silver", wholePerHour: 10 } },
      gameTimeMs: 61 * 60000,
      operationKey: "bad-terms",
    }),
  );
  await withTransaction(pool, (c) => live.withdrawOffer(c, b.accountId, badId, 61 * 60000, 1));
  expect((await pool.query("SELECT status FROM supply_offers WHERE id=$1", [badId])).rows[0].status).toBe("withdrawn");
  expect((await pool.query("SELECT count(*)::int n FROM supply_contracts WHERE offer_id=$1", [badId])).rows[0].n).toBe(
    0,
  );
}, 30000);
