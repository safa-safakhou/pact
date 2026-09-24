import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import { UpkeepService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
let ledger: ResourceLedger;
let upkeep: UpkeepService;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "upkeep");
  pool = createSchemaPool(connectionString, schema);
  ledger = new ResourceLedger("pact");
  upkeep = new UpkeepService("pact", ledger);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function kingdom(drain = true): Promise<string> {
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
       VALUES ($1, 'pact', $2, $3, 'Upkeep Fixture', 'portrait.wolf', clock_timestamp(),
         0, 0, 60000, $4)`,
      [kingdomId, accountId, `upkeep_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
    if (drain) {
      await ledger.debit(client, {
        kingdomId,
        resource: "grain",
        amount: wholeResources(80),
        purpose: "upkeep",
        operationKey: `fixture-drain:${kingdomId}`,
        gameTimeMs: 0,
      });
    }
  });
  return kingdomId;
}

async function addTroop(owner: string, host: string, suffix: number, visiting = false): Promise<string> {
  const id = `00000000-0000-7000-8000-${suffix.toString(16).padStart(12, "0")}`;
  await pool.query(
    `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id, type,
       home_guard, placement, placement_ref, created_game_time_ms, created_at)
     VALUES ($1, 'pact', $2, $3, 'spearman', $4, $5, $6, 0, clock_timestamp())`,
    [id, owner, host, !visiting, visiting ? "visiting" : "home", visiting ? randomUUID() : null],
  );
  return id;
}

async function tick(minute: number): Promise<void> {
  await withTransaction(pool, (client) =>
    upkeep.settleMinute(client, {
      productScope: "pact",
      sequence: BigInt(minute),
      gameTimeMs: minute * 60_000,
      dueAt: new Date(),
    }),
  );
}

async function credit(kingdomId: string, units: bigint, minute: number): Promise<void> {
  await withTransaction(pool, (client) =>
    ledger.creditOrdinary(client, {
      kingdomId,
      resource: "grain",
      amount: units,
      operationKey: `fixture-credit:${kingdomId}:${minute}`,
      reason: "test_production",
      gameTimeMs: minute * 60_000,
    }),
  );
}

describe("atomic upkeep settlement", () => {
  it("does not spend a host's owner-only founding allowance on visiting troops", async () => {
    const host = await kingdom(false);
    const lender = await kingdom();
    await addTroop(lender, host, 250, true);
    await tick(1);
    const balance = await withTransaction(pool, (client) => ledger.readBalance(client, host, "grain"));
    expect(balance.ordinary).toBe(0n);
    expect(balance.allowance).toBe(wholeResources(80));
    expect((await withTransaction(pool, (client) => upkeep.state(client, host)))?.hungry).toBe(true);
    expect(
      (
        await pool.query("SELECT count(*)::int AS count FROM garrison_upkeep_defaults WHERE host_kingdom_id = $1", [
          host,
        ])
      ).rows[0]?.count,
    ).toBe(1);
  });

  it("spends ordinary Grain before the restricted founding allowance", async () => {
    const payer = await kingdom(false);
    await addTroop(payer, payer, 200);
    await credit(payer, 10n, 0);
    await tick(1);
    const balance = await withTransaction(pool, (client) => ledger.readBalance(client, payer, "grain"));
    expect(balance.ordinary).toBe(0n);
    expect(balance.allowance).toBe(wholeResources(80));
    expect((await withTransaction(pool, (client) => upkeep.state(client, payer)))?.hungry).toBe(false);
  });

  it("warns at 120, removes owner groups at 180/240 despite battle locks, and replays once", async () => {
    const host = await kingdom();
    const lender = await kingdom();
    const homeIds: string[] = [];
    for (let n = 1; n <= 8; n += 1) homeIds.push(await addTroop(host, host, n));
    const visitor = await addTroop(lender, host, 9, true);
    const battleId = randomUUID();
    await pool.query(
      `INSERT INTO battle_eligibility_snapshots(product_scope, battle_id, host_kingdom_id, raid_id, locked_until_game_time_ms)
       VALUES ('pact', $1, $2, $3, 20000000)`,
      [battleId, host, randomUUID()],
    );
    await pool.query(
      `INSERT INTO battle_unit_eligibility(product_scope, battle_id, troop_id, side, host_kingdom_id, locked_until_game_time_ms)
       VALUES ('pact', $1, $2, 'defender', $3, 20000000)`,
      [battleId, visitor, host],
    );
    for (let minute = 1; minute <= 119; minute += 1) await tick(minute);
    expect((await withTransaction(pool, (client) => upkeep.state(client, host)))?.underfundedMinutes).toBe(119);
    expect(
      (await pool.query("SELECT count(*)::integer AS count FROM kingdom_troops WHERE host_kingdom_id = $1", [host]))
        .rows[0]?.count,
    ).toBe(9);
    await tick(120);
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM outbox_events WHERE type = 'upkeep.warning.v1' AND payload->>'payerKingdomId' = $1",
          [host],
        )
      ).rows[0]?.count,
    ).toBe(1);
    for (let minute = 121; minute <= 180; minute += 1) await tick(minute);
    const survivors = await pool.query<{ id: string }>(
      "SELECT id FROM kingdom_troops WHERE host_kingdom_id = $1 ORDER BY id",
      [host],
    );
    expect(survivors.rows.map((row) => row.id)).not.toContain(homeIds[0]);
    expect(survivors.rows.map((row) => row.id)).not.toContain(visitor);
    expect(survivors.rowCount).toBe(7);
    expect(
      (
        await pool.query("SELECT count(*)::integer AS count FROM battle_unit_eligibility WHERE troop_id = $1", [
          visitor,
        ])
      ).rows[0]?.count,
    ).toBe(0);
    await tick(180);
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM outbox_events WHERE type = 'upkeep.desertion.v1' AND payload->>'payerKingdomId' = $1",
          [host],
        )
      ).rows[0]?.count,
    ).toBe(2);
    for (let minute = 181; minute <= 240; minute += 1) await tick(minute);
    expect(
      (await pool.query("SELECT count(*)::integer AS count FROM kingdom_troops WHERE host_kingdom_id = $1", [host]))
        .rows[0]?.count,
    ).toBe(6);
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM outbox_events WHERE type = 'garrison.host_underfunded.v1' AND payload->>'hostKingdomId' = $1",
          [host],
        )
      ).rows[0]?.count,
    ).toBe(1);
  });

  it("requires 60 consecutive fully funded minutes to clear hunger", async () => {
    const payer = await kingdom();
    await addTroop(payer, payer, 100);
    await tick(1);
    expect((await withTransaction(pool, (client) => upkeep.state(client, payer)))?.hungry).toBe(true);
    await credit(payer, 300n, 1); // 30 funded Spearman minutes.
    for (let minute = 2; minute <= 31; minute += 1) await tick(minute);
    expect((await withTransaction(pool, (client) => upkeep.state(client, payer)))?.fundedRecoveryMinutes).toBe(30);
    await tick(32);
    expect((await withTransaction(pool, (client) => upkeep.state(client, payer)))?.fundedRecoveryMinutes).toBe(0);
    await credit(payer, 600n, 32);
    for (let minute = 33; minute <= 91; minute += 1) await tick(minute);
    expect((await withTransaction(pool, (client) => upkeep.state(client, payer)))?.hungry).toBe(true);
    await tick(92);
    expect((await withTransaction(pool, (client) => upkeep.state(client, payer)))?.hungry).toBe(false);
    expect((await withTransaction(pool, (client) => upkeep.state(client, payer)))?.underfundedMinutes).toBe(0);
  });
});
