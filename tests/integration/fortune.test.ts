import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import { FortuneService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const scope = "pact";
let admin: Pool;
let pool: Pool;
let schema: string;
const ledger = new ResourceLedger(scope);
const fortune = new FortuneService(scope);

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "fortune");
  pool = createSchemaPool(connectionString, schema);
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function kingdom(hall = 1): Promise<{ accountId: string; kingdomId: string }> {
  const accountId = randomUUID();
  const kingdomId = randomUUID();
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
       VALUES ($1,'pact',$2,'fixture-only',clock_timestamp(),'terms-v1')`,
      [accountId, `${accountId}@example.test`],
    );
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1,'pact',$2,$3,'Fortune Fixture','portrait.wolf',clock_timestamp(),0,0,60000,$4)`,
      [kingdomId, accountId, `fortune_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
    await client.query(
      "INSERT INTO kingdom_buildings(product_scope, kingdom_id, kind, level) VALUES ('pact',$1,'hall',$2)",
      [kingdomId, hall],
    );
    await client.query(
      "INSERT INTO kingdom_score_baselines(product_scope, kingdom_id, game_time_ms) VALUES ('pact',$1,0)",
      [kingdomId],
    );
  });
  return { accountId, kingdomId };
}

async function credit(client: PoolClient, kingdomId: string, resource: "iron" | "silver" | "grain", amount: number) {
  await ledger.creditOrdinary(client, {
    kingdomId,
    resource,
    amount: wholeResources(amount),
    operationKey: randomUUID(),
    reason: "fixture",
    gameTimeMs: 60_000,
  });
}
async function wealth(kingdomId: string): Promise<bigint> {
  return withTransaction(pool, async (client) => (await fortune.wealth(client, kingdomId)).totalQuarterUnits);
}

describe("Fortune derived accounting", () => {
  it("excludes grants and Home Guard, and conserves ordinary value through building and training", async () => {
    const owner = await kingdom();
    await pool.query(
      `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id, type,
         home_guard, placement, created_game_time_ms, created_at)
       VALUES ($1,'pact',$2,$2,'spearman',true,'home',0,clock_timestamp())`,
      [randomUUID(), owner.kingdomId],
    );
    expect(await wealth(owner.kingdomId)).toBe(0n);
    await withTransaction(pool, async (client) => {
      await credit(client, owner.kingdomId, "iron", 100);
      await credit(client, owner.kingdomId, "silver", 50);
      await credit(client, owner.kingdomId, "grain", 20);
    });
    const initial = await wealth(owner.kingdomId);
    expect(initial).toBe(wholeResources(100) * 4n + wholeResources(50) * 8n + wholeResources(20));
    await withTransaction(pool, async (client) => {
      const buildIron = await ledger.payCost(client, {
        kingdomId: owner.kingdomId,
        resource: "iron",
        kind: "construction",
        amount: wholeResources(220),
        operationKey: randomUUID(),
        gameTimeMs: 60_000,
      });
      const buildSilver = await ledger.payCost(client, {
        kingdomId: owner.kingdomId,
        resource: "silver",
        kind: "construction",
        amount: wholeResources(110),
        operationKey: randomUUID(),
        gameTimeMs: 60_000,
      });
      expect((await fortune.wealth(client, owner.kingdomId)).totalQuarterUnits).toBe(initial);
      await ledger.completeCost(client, owner.kingdomId, buildIron.id, 120_000);
      await ledger.completeCost(client, owner.kingdomId, buildSilver.id, 120_000);
      expect((await fortune.wealth(client, owner.kingdomId)).totalQuarterUnits).toBe(initial);
      const trainIron = await ledger.payCost(client, {
        kingdomId: owner.kingdomId,
        resource: "iron",
        kind: "training",
        amount: wholeResources(10),
        operationKey: randomUUID(),
        gameTimeMs: 120_000,
      });
      const trainSilver = await ledger.payCost(client, {
        kingdomId: owner.kingdomId,
        resource: "silver",
        kind: "training",
        amount: wholeResources(4),
        operationKey: randomUUID(),
        gameTimeMs: 120_000,
      });
      expect((await fortune.wealth(client, owner.kingdomId)).totalQuarterUnits).toBe(initial);
      await ledger.consumeTrainingCost(client, {
        kingdomId: owner.kingdomId,
        costId: trainIron.id,
        ordinaryUnits: wholeResources(10),
        operationKey: "first",
        gameTimeMs: 180_000,
      });
      await ledger.consumeTrainingCost(client, {
        kingdomId: owner.kingdomId,
        costId: trainSilver.id,
        ordinaryUnits: wholeResources(4),
        operationKey: "first",
        gameTimeMs: 180_000,
      });
      await client.query(
        `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id, type,
           home_guard, placement, created_game_time_ms, created_at)
         VALUES ($1,'pact',$2,$2,'spearman',false,'home',180000,clock_timestamp())`,
        [randomUUID(), owner.kingdomId],
      );
      expect((await fortune.wealth(client, owner.kingdomId)).totalQuarterUnits).toBe(initial);
      const canceledCost = await ledger.payCost(client, {
        kingdomId: owner.kingdomId,
        resource: "iron",
        kind: "construction",
        amount: wholeResources(10),
        operationKey: randomUUID(),
        gameTimeMs: 180_000,
      });
      expect((await fortune.wealth(client, owner.kingdomId)).totalQuarterUnits).toBe(initial);
      await ledger.cancelCost(client, owner.kingdomId, canceledCost.id, 240_000);
      expect((await fortune.wealth(client, owner.kingdomId)).totalQuarterUnits).toBe(initial - wholeResources(5) * 4n);
    });
  });

  it("moves wealth once across transfers, bonds/defaults, loot, lending, seizure and casualties", async () => {
    const a = await kingdom();
    const b = await kingdom(3);
    const unitId = randomUUID();
    await withTransaction(pool, async (client) => {
      await credit(client, a.kingdomId, "iron", 100);
      await credit(client, b.kingdomId, "silver", 100);
      await client.query(
        `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id, type,
          home_guard, placement, placement_ref, created_game_time_ms, created_at)
         VALUES ($1,'pact',$2,$3,'spearman',false,'visiting',$4,0,clock_timestamp())`,
        [unitId, a.kingdomId, b.kingdomId, randomUUID()],
      );
    });
    const aStart = await wealth(a.kingdomId);
    const bStart = await wealth(b.kingdomId);
    await withTransaction(pool, async (client) => {
      await ledger.debit(client, {
        kingdomId: a.kingdomId,
        resource: "iron",
        amount: wholeResources(5),
        purpose: "transfer",
        operationKey: "send",
        gameTimeMs: 60_000,
      });
      await ledger.creditOrdinary(client, {
        kingdomId: b.kingdomId,
        resource: "iron",
        amount: wholeResources(5),
        operationKey: "receive",
        reason: "transfer",
        gameTimeMs: 60_000,
      });
      await ledger.lockBond(client, {
        kingdomId: b.kingdomId,
        resource: "silver",
        amount: wholeResources(10),
        operationKey: "bond",
        gameTimeMs: 60_000,
      });
    });
    expect(await wealth(a.kingdomId)).toBe(aStart - wholeResources(5) * 4n);
    expect(await wealth(b.kingdomId)).toBe(bStart + wholeResources(5) * 4n);
    await withTransaction(pool, async (client) => {
      await ledger.forfeitBond(client, {
        kingdomId: b.kingdomId,
        resource: "silver",
        amount: wholeResources(10),
        operationKey: "forfeit",
        gameTimeMs: 120_000,
      });
      await ledger.creditOrdinary(client, {
        kingdomId: a.kingdomId,
        resource: "silver",
        amount: wholeResources(10),
        operationKey: "compensate",
        reason: "bond_compensation",
        gameTimeMs: 120_000,
      });
      await ledger.debit(client, {
        kingdomId: b.kingdomId,
        resource: "silver",
        amount: wholeResources(2),
        purpose: "loot",
        operationKey: "loot-from-b",
        gameTimeMs: 120_000,
      });
      await ledger.creditOrdinary(client, {
        kingdomId: a.kingdomId,
        resource: "silver",
        amount: wholeResources(2),
        operationKey: "loot-to-a",
        reason: "loot",
        gameTimeMs: 120_000,
      });
    });
    expect(await wealth(a.kingdomId)).toBe(aStart - wholeResources(5) * 4n + wholeResources(12) * 8n);
    expect(await wealth(b.kingdomId)).toBe(bStart + wholeResources(5) * 4n - wholeResources(12) * 8n);
    await pool.query("UPDATE kingdom_troops SET owner_kingdom_id = $2 WHERE id = $1", [unitId, b.kingdomId]);
    const unitValue = wholeResources(10) * 4n + wholeResources(4) * 8n;
    expect(await wealth(a.kingdomId)).toBe(aStart - wholeResources(5) * 4n + wholeResources(12) * 8n - unitValue);
    expect(await wealth(b.kingdomId)).toBe(bStart + wholeResources(5) * 4n - wholeResources(12) * 8n + unitValue);
    await pool.query("DELETE FROM kingdom_troops WHERE id = $1", [unitId]);
    expect(await wealth(b.kingdomId)).toBe(bStart + wholeResources(5) * 4n - wholeResources(12) * 8n);
  });

  it("supports negative Fortune, Hall bands, ranks, and once-only hourly snapshots", async () => {
    const low = await kingdom();
    const high = await kingdom(5);
    await withTransaction(pool, async (client) => {
      await credit(client, low.kingdomId, "iron", 10);
      await credit(client, high.kingdomId, "iron", 20);
      await client.query(
        "UPDATE kingdom_score_baselines SET marked_value_numerator = $2, marked_value_denominator = 2400 WHERE kingdom_id = $1",
        [low.kingdomId, (wholeResources(15) * 4n).toString()],
      );
    });
    const ranked = await withTransaction(pool, (client) => fortune.provisional(client, 3_600_000));
    expect(ranked.find((row) => row.kingdomId === low.kingdomId)?.fortuneQuarterUnits).toBe(
      (-wholeResources(5) * 4n).toString(),
    );
    expect(ranked.find((row) => row.kingdomId === high.kingdomId)?.band).toBe("V-VI");
    const lowBand = await withTransaction(pool, (client) => fortune.provisional(client, 3_600_000, "I-II"));
    expect(lowBand.every((row) => row.band === "I-II")).toBe(true);
    expect(await withTransaction(pool, (client) => fortune.snapshotHour(client, 3_600_000, 1n))).toBeGreaterThan(0);
    expect(await withTransaction(pool, (client) => fortune.snapshotHour(client, 3_600_000, 1n))).toBe(0);
    const snapshots = await pool.query("SELECT * FROM fortune_hourly_snapshots WHERE kingdom_id = $1", [low.kingdomId]);
    expect(snapshots.rows).toHaveLength(1);
    expect(snapshots.rows[0]?.fortune_quarter_units).toBe((-wholeResources(5) * 4n).toString());
  });
});
