import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { hourlyRatePerMinute, wholeResources } from "@pact/domain";
import { allocateSupplyProportionally, SupplySettlementService, type SupplyTerms } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
const ledger = new ResourceLedger("pact");
const floors = new Map<string, bigint>();
const settlement = new SupplySettlementService("pact", ledger, {
  read: async (_client, accountId, resource) => floors.get(`${accountId}:${resource}`) ?? 0n,
});

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "supply_settlement");
  pool = createSchemaPool(connectionString, schema);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function kingdom(): Promise<{ accountId: string; id: string }> {
  const accountId = randomUUID();
  const id = randomUUID();
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
       VALUES ($1, 'pact', $2, 'fixture-only', clock_timestamp(), 'terms-v1')`,
      [accountId, `${accountId}@example.test`],
    );
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1, 'pact', $2, $3, 'Settlement Fixture', 'portrait.wolf', clock_timestamp(),
         0, 0, 60000, $4)`,
      [id, accountId, `settle_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, id, 0);
  });
  return { accountId, id };
}

async function credit(id: string, resource: "iron" | "silver" | "grain", amount: bigint): Promise<void> {
  await withTransaction(pool, (client) =>
    ledger.creditOrdinary(client, {
      kingdomId: id,
      resource,
      amount,
      operationKey: randomUUID(),
      reason: "fixture",
      gameTimeMs: 0,
    }),
  );
}

async function contract(a: string, b: string, terms: SupplyTerms, start = 60_000): Promise<string> {
  const offerId = randomUUID();
  const id = randomUUID();
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO supply_offers(id, product_scope, kingdom_a, kingdom_b, version, terms, status,
         expires_game_time_ms, created_game_time_ms, updated_game_time_ms)
       VALUES ($1, 'pact', $2, $3, 1, $4::jsonb, 'active', 60000, 0, 0)`,
      [offerId, a, b, JSON.stringify(terms)],
    );
    for (const [owner, bond] of [
      [a, terms.aBond],
      [b, terms.bBond],
    ] as const) {
      if (bond)
        await ledger.lockBond(client, {
          kingdomId: owner,
          resource: bond.resource,
          amount: wholeResources(bond.wholeAmount),
          operationKey: `test-bond:${id}:${owner}`,
          gameTimeMs: 0,
        });
    }
    await client.query(
      `INSERT INTO supply_contracts(id, product_scope, offer_id, offer_version, kingdom_a, kingdom_b,
         terms, start_game_time_ms, end_game_time_ms, status)
       VALUES ($1, 'pact', $2, 1, $3, $4, $5::jsonb, $6, $7, 'active')`,
      [id, offerId, a, b, JSON.stringify(terms), start, start + terms.durationHours * 3_600_000],
    );
  });
  return id;
}

async function tick(gameTimeMs: number): Promise<void> {
  await withTransaction(pool, async (client) => {
    await settlement.settleBoundaries(client, gameTimeMs);
    await settlement.capture(client, gameTimeMs);
    await settlement.settleDeliveries(client, gameTimeMs);
    await settlement.settleDefaults(client, gameTimeMs);
  });
}

const oneWay = (overrides: Partial<SupplyTerms> = {}): SupplyTerms => ({
  aToB: { resource: "silver", wholePerHour: 8 },
  bToA: null,
  aBond: null,
  bBond: null,
  durationHours: 6,
  noticeHours: 1,
  ...overrides,
});

describe("independent supply settlement", () => {
  it("allocates exact internal-unit remainders by contract ID", () => {
    expect([
      ...allocateSupplyProportionally(
        [
          { id: "b", due: 80n },
          { id: "a", due: 80n },
        ],
        81n,
      ),
    ]).toEqual([
      ["a", 41n],
      ["b", 40n],
    ]);
  });

  it("delivers exactly 360 installments in six hours, then expires without a 361st", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await credit(a.id, "silver", wholeResources(50));
    const id = await contract(a.id, b.id, oneWay({ aBond: { resource: "silver", wholeAmount: 1 } }));
    for (let minute = 1; minute <= 360; minute++) await tick(minute * 60_000);
    await tick(361 * 60_000);
    const rows = await pool.query<{ count: string; total: string }>(
      `SELECT count(*)::text, sum(delivered_units)::text AS total FROM supply_installments WHERE contract_id = $1`,
      [id],
    );
    expect(rows.rows[0]).toMatchObject({ count: "360", total: String(hourlyRatePerMinute(8) * 360n) });
    expect(
      (await pool.query("SELECT status, close_reason FROM supply_contracts WHERE id = $1", [id])).rows[0],
    ).toMatchObject({ status: "expired", close_reason: "natural_expiry" });
    expect(
      (
        await pool.query("SELECT locked_units FROM resource_balances WHERE kingdom_id = $1 AND resource = 'silver'", [
          a.id,
        ])
      ).rows[0]?.locked_units,
    ).toBe("0");
  });

  it("does not recycle incoming credit; preserves funded delivery and transfers only defaulter bond", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await credit(a.id, "silver", wholeResources(2));
    await credit(b.id, "silver", wholeResources(1));
    const id = await contract(
      a.id,
      b.id,
      oneWay({
        bToA: { resource: "silver", wholePerHour: 8 },
        aBond: { resource: "silver", wholeAmount: 1 },
        bBond: { resource: "silver", wholeAmount: 1 },
      }),
    );
    await tick(60_000);
    const deliveries = await pool.query<{ payer_kingdom_id: string; delivered_units: string }>(
      "SELECT payer_kingdom_id, delivered_units FROM supply_installments WHERE contract_id = $1",
      [id],
    );
    expect(deliveries.rows.find((row) => row.payer_kingdom_id === a.id)?.delivered_units).toBe("80");
    expect(deliveries.rows.find((row) => row.payer_kingdom_id === b.id)?.delivered_units).toBe("0");
    expect((await pool.query("SELECT status FROM supply_contracts WHERE id = $1", [id])).rows[0]?.status).toBe(
      "defaulted",
    );
    const aBalance = await withTransaction(pool, (client) => ledger.readBalance(client, a.id, "silver"));
    expect(aBalance.ordinary).toBe(wholeResources(2) - 80n + wholeResources(1));
  });

  it("applies changed floors and grant expiry to Grain exports, then exchanges both defaulted bonds", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await credit(a.id, "grain", wholeResources(2));
    await credit(b.id, "grain", wholeResources(2));
    const id = await contract(
      a.id,
      b.id,
      oneWay({
        aToB: { resource: "grain", wholePerHour: 8 },
        bToA: { resource: "grain", wholePerHour: 8 },
        aBond: { resource: "grain", wholeAmount: 1 },
        bBond: { resource: "grain", wholeAmount: 1 },
      }),
    );
    floors.set(`${a.accountId}:grain`, wholeResources(1));
    floors.set(`${b.accountId}:grain`, wholeResources(1));
    await tick(60_000);
    expect((await pool.query("SELECT status FROM supply_contracts WHERE id = $1", [id])).rows[0]?.status).toBe(
      "active",
    );
    await withTransaction(pool, async (client: PoolClient) => {
      await client.query(
        "UPDATE ledger_kingdoms SET grant_expires_game_time_ms = 120000 WHERE kingdom_id IN ($1, $2)",
        [a.id, b.id],
      );
      await ledger.expireFoundingAllowances(client, {
        productScope: "pact",
        sequence: 2n,
        gameTimeMs: 120_000,
        dueAt: new Date(),
      });
    });
    await tick(120_000);
    const rows = await pool.query<{ delivered_units: string; failure_reason: string }>(
      "SELECT delivered_units, failure_reason FROM supply_installments WHERE contract_id = $1 AND game_time_ms = 120000",
      [id],
    );
    expect(rows.rows).toHaveLength(2);
    expect(
      rows.rows.every((row) => BigInt(row.delivered_units) < 80n && row.failure_reason === "reserve_constraint"),
    ).toBe(true);
    expect((await pool.query("SELECT status FROM supply_contracts WHERE id = $1", [id])).rows[0]?.status).toBe(
      "defaulted",
    );
    const bondMovements = await pool.query<{ reason: string }>(
      "SELECT reason FROM resource_movements WHERE operation_key LIKE $1 ORDER BY reason",
      [`supply:${id}:%bond:forfeit`],
    );
    expect(bondMovements.rows.map((row) => row.reason)).toEqual(["bond_forfeit", "bond_forfeit"]);
  });

  it("splits a shortage across contracts by ID and keeps a funded counterflow", async () => {
    const a = await kingdom();
    const b = await kingdom();
    const c = await kingdom();
    await credit(a.id, "silver", 81n);
    await credit(b.id, "iron", 80n);
    const first = await contract(
      a.id,
      b.id,
      oneWay({
        bToA: { resource: "iron", wholePerHour: 8 },
      }),
    );
    const second = await contract(a.id, c.id, oneWay());
    await tick(60_000);
    const rows = await pool.query<{ contract_id: string; payer_kingdom_id: string; delivered_units: string }>(
      "SELECT contract_id, payer_kingdom_id, delivered_units FROM supply_installments WHERE contract_id IN ($1, $2)",
      [first, second],
    );
    const outgoing = rows.rows.filter((row) => row.payer_kingdom_id === a.id);
    expect(outgoing.reduce((sum, row) => sum + BigInt(row.delivered_units), 0n)).toBe(81n);
    const earlier = [first, second].sort()[0];
    expect(outgoing.find((row) => row.contract_id === earlier)?.delivered_units).toBe("41");
    expect(rows.rows.find((row) => row.payer_kingdom_id === b.id)?.delivered_units).toBe("80");
    expect(
      (
        await pool.query("SELECT count(*)::text FROM supply_contracts WHERE id IN ($1, $2) AND status = 'defaulted'", [
          first,
          second,
        ])
      ).rows[0]?.count,
    ).toBe("2");
  });

  it("honors notice and mutual release at the next boundary, returning bonds with overflow", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await credit(a.id, "silver", wholeResources(2));
    const id = await contract(a.id, b.id, oneWay({ aBond: { resource: "silver", wholeAmount: 1 }, noticeHours: 0 }));
    await withTransaction(pool, async (client) => {
      expect(await settlement.giveNotice(client, a.accountId, id, 60_000)).toBe(120_000);
    });
    await tick(60_000);
    await withTransaction(pool, async (client) => {
      await client.query(
        "UPDATE resource_balances SET ordinary_units = storage_cap_units WHERE kingdom_id = $1 AND resource = 'silver'",
        [a.id],
      );
    });
    await tick(120_000);
    expect(
      (await pool.query("SELECT status, close_reason FROM supply_contracts WHERE id = $1", [id])).rows[0],
    ).toMatchObject({ status: "released", close_reason: "notice_expiry" });
    const returned = await pool.query<{ overflow_units: string }>(
      "SELECT overflow_units FROM resource_movements WHERE operation_key = $1",
      [`supply:${id}:${a.id}:bond:return`],
    );
    expect(returned.rows[0]?.overflow_units).toBe(String(wholeResources(1)));
    expect(
      (await pool.query("SELECT count(*)::text FROM supply_installments WHERE contract_id = $1", [id])).rows[0]?.count,
    ).toBe("1");

    const c = await kingdom();
    const d = await kingdom();
    await credit(c.id, "silver", wholeResources(2));
    const releaseId = await contract(c.id, d.id, oneWay({ aBond: { resource: "silver", wholeAmount: 1 } }));
    await withTransaction(pool, async (client) => {
      await settlement.signRelease(client, c.accountId, releaseId, 60_000);
      await settlement.signRelease(client, d.accountId, releaseId, 60_000);
    });
    await tick(120_000);
    expect(
      (await pool.query("SELECT status, close_reason FROM supply_contracts WHERE id = $1", [releaseId])).rows[0],
    ).toMatchObject({ status: "released", close_reason: "mutual_release" });
    expect(
      (await pool.query("SELECT count(*)::text FROM supply_installments WHERE contract_id = $1", [releaseId])).rows[0]
        ?.count,
    ).toBe("0");
  });

  it("forfeits both bonds on simultaneous explicit refusal", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await credit(a.id, "silver", wholeResources(2));
    await credit(b.id, "silver", wholeResources(2));
    const id = await contract(
      a.id,
      b.id,
      oneWay({
        bToA: { resource: "silver", wholePerHour: 8 },
        aBond: { resource: "silver", wholeAmount: 1 },
        bBond: { resource: "silver", wholeAmount: 1 },
      }),
    );
    await withTransaction(pool, async (client) => {
      await settlement.refuse(client, a.accountId, id, 60_000);
      await settlement.refuse(client, b.accountId, id, 60_000);
    });
    await tick(120_000);
    expect(
      (await pool.query("SELECT status, close_reason FROM supply_contracts WHERE id = $1", [id])).rows[0],
    ).toMatchObject({ status: "defaulted", close_reason: "owner_termination" });
    expect(
      (
        await pool.query("SELECT count(*)::text FROM resource_movements WHERE operation_key LIKE $1", [
          `supply:${id}:%bond:forfeit`,
        ])
      ).rows[0]?.count,
    ).toBe("2");
  });

  it("continues installments through a one-hour notice and stops on its exact boundary", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await credit(a.id, "silver", wholeResources(12));
    const id = await contract(a.id, b.id, oneWay({ durationHours: 6, noticeHours: 1 }));
    await withTransaction(pool, async (client) => {
      expect(await settlement.giveNotice(client, a.accountId, id, 60_000)).toBe(3_720_000);
    });
    for (let minute = 1; minute <= 62; minute++) await tick(minute * 60_000);
    expect(
      (await pool.query("SELECT count(*)::text FROM supply_installments WHERE contract_id = $1", [id])).rows[0]?.count,
    ).toBe("61");
    expect(
      (await pool.query("SELECT status, close_reason FROM supply_contracts WHERE id = $1", [id])).rows[0],
    ).toMatchObject({ status: "released", close_reason: "notice_expiry" });
  });
});
