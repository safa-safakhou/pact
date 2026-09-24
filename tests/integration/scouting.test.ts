import { randomUUID } from "node:crypto";
import { ExposureService } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import { ActionLimitService, ScoutService, TroopService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
const ledger = new ResourceLedger("pact");
const scouts = new ScoutService(
  "pact",
  ledger,
  new TroopService("pact", ledger),
  new ActionLimitService("pact"),
  new ExposureService("pact"),
);

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "scouting");
  pool = createSchemaPool(connectionString, schema);
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
       VALUES ($1,'pact',$2,'fixture-only',clock_timestamp(),'terms-v1')`,
      [accountId, `${accountId}@example.test`],
    );
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1,'pact',$2,$3,'Scout Fixture','portrait.wolf',clock_timestamp(),
         0,0,60000,$4)`,
      [kingdomId, accountId, `scout_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
    await client.query(
      `INSERT INTO kingdom_charges(product_scope, kingdom_id, kind, available, capacity,
         last_regenerated_game_time_ms) VALUES ('pact',$1,'scout',4,4,0)`,
      [kingdomId],
    );
    await client.query(
      "INSERT INTO kingdom_buildings(product_scope, kingdom_id, kind, level) VALUES ('pact',$1,'wall',2)",
      [kingdomId],
    );
    for (const [resource, amount] of [
      ["silver", 20],
      ["grain", 10],
    ] as const)
      await ledger.creditOrdinary(client, {
        kingdomId,
        resource,
        amount: wholeResources(amount),
        operationKey: `fixture:${kingdomId}:${resource}`,
        reason: "test_production",
        gameTimeMs: 60_000,
      });
  });
  return { accountId, kingdomId };
}

async function troop(
  kingdomId: string,
  homeGuard: boolean,
  type = "spearman",
  placement = "home",
  host = kingdomId,
): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id, type,
       home_guard, placement, placement_ref, created_game_time_ms, created_at)
     VALUES ($1,'pact',$2,$3,$4,$5,$6,$7,0,clock_timestamp())`,
    [id, kingdomId, host, type, homeGuard, placement, placement === "home" ? null : randomUUID()],
  );
  return id;
}

describe("timed scout operations", () => {
  it("rejects invalid admission without spending and charges one successful retry once", async () => {
    const source = await kingdom();
    const target = await kingdom();
    await troop(source.kingdomId, true);
    await troop(source.kingdomId, true);
    const operationId = randomUUID();
    const input = {
      accountId: source.accountId,
      operationId,
      operationKey: `scout:${operationId}`,
      targetKingdomId: target.kingdomId,
      actorKind: "human" as const,
      gameTimeMs: 61_000,
    };
    await expect(withTransaction(pool, (client) => scouts.start(client, input))).rejects.toThrow("UNITS_UNAVAILABLE");
    await expect(
      withTransaction(pool, (client) => scouts.start(client, { ...input, targetKingdomId: source.kingdomId })),
    ).rejects.toThrow("SELF_TARGET");
    const one = await troop(source.kingdomId, false);
    const two = await troop(source.kingdomId, false);
    await withTransaction(pool, (client) =>
      new TroopService("pact", ledger).captureBattleEligibility(client, {
        battleId: randomUUID(),
        hostKingdomId: source.kingdomId,
        raidId: randomUUID(),
        lockUntilGameTimeMs: 120_000,
      }),
    );
    await expect(withTransaction(pool, (client) => scouts.start(client, input))).rejects.toThrow("UNIT_LOCKED");
    await pool.query(
      "UPDATE battle_unit_eligibility SET locked_until_game_time_ms = 61_000 WHERE host_kingdom_id = $1",
      [source.kingdomId],
    );
    await withTransaction(pool, (client) =>
      ledger.debit(client, {
        kingdomId: source.kingdomId,
        resource: "silver",
        amount: wholeResources(20),
        purpose: "scout",
        operationKey: `fixture-drain:${operationId}`,
        gameTimeMs: 61_000,
      }),
    );
    await expect(withTransaction(pool, (client) => scouts.start(client, input))).rejects.toThrow("INSUFFICIENT_STOCK");
    await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId: source.kingdomId,
        resource: "silver",
        amount: wholeResources(20),
        operationKey: `fixture-refill:${operationId}`,
        reason: "test_production",
        gameTimeMs: 61_000,
      }),
    );
    const balanceBefore = await withTransaction(pool, (client) =>
      ledger.readBalance(client, source.kingdomId, "silver"),
    );
    const started = await withTransaction(pool, (client) => scouts.start(client, input));
    expect(started).toEqual({ operationId, dueGameTimeMs: 720_000 });
    expect(await withTransaction(pool, (client) => scouts.start(client, input))).toEqual(started);
    const balanceAfter = await withTransaction(pool, (client) =>
      ledger.readBalance(client, source.kingdomId, "silver"),
    );
    expect(balanceBefore.ordinary - balanceAfter.ordinary).toBe(wholeResources(10));
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM kingdom_charge_spends WHERE kingdom_id = $1 AND kind = 'scout'",
          [source.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(1);
    expect(
      (await pool.query("SELECT id FROM kingdom_troops WHERE placement = 'scouting' ORDER BY id")).rows
        .map((row) => row.id)
        .sort(),
    ).toEqual([one, two].sort());
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM outbox_events WHERE type = 'scout.target.noticed.v1' AND payload->>'targetKingdomId' = $1",
          [target.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(1);
  });

  it("samples only on completion, includes visitors but never their owners or offsite troops", async () => {
    const source = await kingdom();
    const target = await kingdom();
    const visitor = await kingdom();
    const stranger = await kingdom();
    await troop(source.kingdomId, false);
    await troop(source.kingdomId, false);
    await troop(target.kingdomId, true);
    await troop(visitor.kingdomId, false, "spearman", "visiting", target.kingdomId);
    await troop(target.kingdomId, false, "archer", "scouting");
    const operationId = randomUUID();
    await withTransaction(pool, (client) =>
      scouts.start(client, {
        accountId: source.accountId,
        operationId,
        operationKey: `scout:${operationId}`,
        targetKingdomId: target.kingdomId,
        actorKind: "human",
        gameTimeMs: 61_000,
      }),
    );
    await expect(
      withTransaction(pool, (client) => scouts.readReport(client, stranger.accountId, operationId)),
    ).rejects.toThrow("REPORT_NOT_FOUND");
    expect(await withTransaction(pool, (client) => scouts.finishDue(client, 660_000))).toBe(0);
    await pool.query("UPDATE kingdom_buildings SET level = 3 WHERE kingdom_id = $1 AND kind = 'wall'", [
      target.kingdomId,
    ]);
    expect(await withTransaction(pool, (client) => scouts.finishDue(client, 720_000))).toBe(2);
    const report = await withTransaction(pool, (client) => scouts.readReport(client, source.accountId, operationId));
    expect(report).toMatchObject({
      kind: "engine_report",
      wallLevel: 3,
      observedGameTimeMs: 720_000,
      homeTroops: { spearman: "1-10", archer: "0" },
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(visitor.kingdomId);
    expect(serialized).not.toContain(visitor.accountId);
    expect(serialized).not.toContain("contract");
    expect(await withTransaction(pool, (client) => scouts.finishDue(client, 720_000))).toBe(0);
    await withTransaction(pool, (client) =>
      scouts.shareReport(client, {
        accountId: source.accountId,
        operationId,
        recipientKingdomId: stranger.kingdomId,
        gameTimeMs: 730_000,
      }),
    );
    expect(await withTransaction(pool, (client) => scouts.readReport(client, stranger.accountId, operationId))).toEqual(
      report,
    );
  });

  it("reserves one agent troop commitment and closes it after observation", async () => {
    const source = await kingdom();
    const target = await kingdom();
    await troop(source.kingdomId, false);
    await troop(source.kingdomId, false);
    const operationId = randomUUID();
    const input = {
      accountId: source.accountId,
      operationId,
      operationKey: `scout:${operationId}`,
      targetKingdomId: target.kingdomId,
      actorKind: "agent" as const,
      gameTimeMs: 61_000,
    };
    await expect(withTransaction(pool, (client) => scouts.start(client, input))).rejects.toThrow();
    await pool.query(
      `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions, resource_limits, troop_limit)
       VALUES ('pact',$1,ARRAY['scout.start'],$2::jsonb,2)`,
      [source.accountId, JSON.stringify({ silver: String(wholeResources(10)), grain: String(wholeResources(5)) })],
    );
    await withTransaction(pool, (client) => scouts.start(client, input));
    expect(
      (
        await pool.query("SELECT status, troop_count FROM authority_commitments WHERE account_id = $1", [
          source.accountId,
        ])
      ).rows[0],
    ).toMatchObject({ status: "active", troop_count: 2 });
    await withTransaction(pool, (client) => scouts.finishDue(client, 720_000));
    expect(
      (await pool.query("SELECT status FROM authority_commitments WHERE account_id = $1", [source.accountId])).rows[0]
        ?.status,
    ).toBe("closed");
  });
});
