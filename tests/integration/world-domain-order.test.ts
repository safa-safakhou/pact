import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { SupplySettlementService, type SupplyTerms, UpkeepService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { type TickHandlers, WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "world_domain_order");
  pool = createSchemaPool(connectionString, schema);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

describe("real-domain tick ordering", () => {
  it("uses same-minute production for delivery and rolls both back before retry", async () => {
    const scope = "pact";
    const ledger = new ResourceLedger(scope);
    const upkeep = new UpkeepService(scope, ledger);
    const settlement = new SupplySettlementService(scope, ledger, { read: async () => 0n });
    const kingdomIds = [randomUUID(), randomUUID()];
    for (const kingdomId of kingdomIds) {
      const accountId = randomUUID();
      await withTransaction(pool, async (client) => {
        await client.query(
          `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
           VALUES ($1, $2, $3, 'fixture-only', clock_timestamp(), 'terms-v1')`,
          [accountId, scope, `${accountId}@example.test`],
        );
        await client.query(
          `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
             activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms,
             activation_event_id)
           VALUES ($1, $2, $3, $4, 'Tick Fixture', 'portrait.wolf', clock_timestamp(), 0, 0, 60000, $5)`,
          [kingdomId, scope, accountId, `tick_${randomUUID().slice(0, 8)}`, randomUUID()],
        );
        await ledger.initializeKingdom(client, kingdomId, 0);
      });
    }
    const [sender, recipient] = kingdomIds as [string, string];
    const offerId = randomUUID();
    const contractId = randomUUID();
    const terms: SupplyTerms = {
      aToB: { resource: "silver", wholePerHour: 8 },
      bToA: null,
      aBond: null,
      bBond: null,
      durationHours: 1,
      noticeHours: 0,
    };
    await pool.query(
      `INSERT INTO supply_offers(id, product_scope, kingdom_a, kingdom_b, version, terms, status,
         expires_game_time_ms, created_game_time_ms, updated_game_time_ms)
       VALUES ($1, $2, $3, $4, 1, $5::jsonb, 'active', 60000, 0, 0)`,
      [offerId, scope, sender, recipient, JSON.stringify(terms)],
    );
    await pool.query(
      `INSERT INTO supply_contracts(id, product_scope, offer_id, offer_version, kingdom_a, kingdom_b,
         terms, start_game_time_ms, end_game_time_ms, status)
       VALUES ($1, $2, $3, 1, $4, $5, $6::jsonb, 60000, 3660000, 'active')`,
      [contractId, scope, offerId, sender, recipient, JSON.stringify(terms)],
    );

    const handlers: TickHandlers = {
      boundaries_and_completions: async (client, context) => {
        await settlement.settleBoundaries(client, context.gameTimeMs);
      },
      production: (client, context) => ledger.settleProductionMinute(client, context, 1),
      upkeep: async (client, context) => {
        await upkeep.settleMinute(client, context);
        throw new Error("FAULT_AFTER_PRODUCTION");
      },
      capture_obligations: (client, context) => settlement.capture(client, context.gameTimeMs),
      settle_deliveries: (client, context) => settlement.settleDeliveries(client, context.gameTimeMs),
      defaults_and_bonds: async (client, context) => {
        await settlement.settleDefaults(client, context.gameTimeMs);
      },
    };
    const failing = new WorldClockService(pool, scope, handlers);
    await failing.bootstrap();
    const token = await failing.acquireLease("domain-order-worker");
    expect(token).toBeTruthy();
    await pool.query(
      `UPDATE world_clocks SET committed_game_time_ms = 0,
         next_tick_due_at = clock_timestamp() - interval '1 second',
         last_heartbeat_at = clock_timestamp(), lease_expires_at = clock_timestamp() + interval '30 seconds'
       WHERE product_scope = $1`,
      [scope],
    );
    await expect(failing.advance("domain-order-worker", token ?? "")).rejects.toThrow("FAULT_AFTER_PRODUCTION");
    expect((await withTransaction(pool, (client) => ledger.readBalance(client, sender, "silver"))).ordinary).toBe(0n);
    expect((await pool.query("SELECT 1 FROM supply_installments WHERE contract_id = $1", [contractId])).rowCount).toBe(
      0,
    );
    expect((await pool.query("SELECT 1 FROM world_ticks WHERE product_scope = $1", [scope])).rowCount).toBe(0);

    handlers.upkeep = (client, context) => upkeep.settleMinute(client, context);
    const recovered = new WorldClockService(pool, scope, handlers);
    expect((await recovered.advance("domain-order-worker", token ?? "")).kind).toBe("committed");
    expect((await recovered.advance("domain-order-worker", token ?? "")).kind).toBe("not_due");
    const installment = await pool.query<{ delivered_units: string; due_units: string }>(
      "SELECT delivered_units, due_units FROM supply_installments WHERE contract_id = $1",
      [contractId],
    );
    expect(installment.rows).toEqual([{ delivered_units: "80", due_units: "80" }]);
    expect((await withTransaction(pool, (client) => ledger.readBalance(client, sender, "silver"))).ordinary).toBe(20n);
    expect((await withTransaction(pool, (client) => ledger.readBalance(client, recipient, "silver"))).ordinary).toBe(
      180n,
    );
    expect((await pool.query("SELECT 1 FROM world_ticks WHERE product_scope = $1", [scope])).rowCount).toBe(1);
  });
});
