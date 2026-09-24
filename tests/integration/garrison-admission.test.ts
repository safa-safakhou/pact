import { randomUUID } from "node:crypto";
import { ExactHumanPermitService, ExposureService } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import { GarrisonService, TroopService, UpkeepService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
const ledger = new ResourceLedger("pact");
const exposure = new ExposureService("pact");
const troops = new TroopService("pact", ledger);
const garrison = new GarrisonService("pact", ledger, troops, exposure);

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "garrison_admission");
  pool = createSchemaPool(connectionString, schema);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function kingdom(hall: number): Promise<{ accountId: string; kingdomId: string }> {
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
       VALUES ($1, 'pact', $2, $3, 'Garrison Fixture', 'portrait.wolf', clock_timestamp(),
         0, 0, 60000, $4)`,
      [kingdomId, accountId, `garrison_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
    for (const [kind, level] of [
      ["hall", hall],
      ["barracks", 1],
    ] as const) {
      await client.query(
        "INSERT INTO kingdom_buildings(product_scope, kingdom_id, kind, level) VALUES ('pact',$1,$2,$3)",
        [kingdomId, kind, level],
      );
    }
  });
  return { accountId, kingdomId };
}

describe("garrison contract admission", () => {
  it("requires Hall III and activates signed ordinary troops with one host upkeep reservation", async () => {
    const lender = await kingdom(2);
    const host = await kingdom(1);
    const terms = {
      units: [{ type: "spearman" as const, count: 2 }],
      durationHours: 1 as const,
      lenderBond: null,
      hostBond: null,
    };
    const offerId = randomUUID();
    const offerInput = {
      accountId: lender.accountId,
      hostKingdomId: host.kingdomId,
      offerId,
      terms,
      gameTimeMs: 61_000,
      expiresGameTimeMs: 300_000,
    };
    await expect(withTransaction(pool, (client) => garrison.createOffer(client, offerInput))).rejects.toThrow(
      "HALL_LOCKED",
    );
    await pool.query("UPDATE kingdom_buildings SET level = 3 WHERE kingdom_id = $1 AND kind = 'hall'", [
      lender.kingdomId,
    ]);
    for (let index = 0; index < 2; index += 1) {
      await pool.query(
        `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id, type,
           home_guard, placement, created_game_time_ms, created_at)
         VALUES ($1,'pact',$2,$2,'spearman',false,'home',0,clock_timestamp())`,
        [randomUUID(), lender.kingdomId],
      );
    }
    await pool.query(
      `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions, resource_limits, troop_limit)
       VALUES ('pact',$1,ARRAY['garrison.sign'],'{}'::jsonb,2)`,
      [lender.accountId],
    );
    await pool.query(
      `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions, resource_limits)
       VALUES ('pact',$1,ARRAY['garrison.sign'],$2::jsonb)`,
      [host.accountId, JSON.stringify({ grain: String(wholeResources(3)) })],
    );
    expect(await withTransaction(pool, (client) => garrison.createOffer(client, offerInput))).toBe(offerId);
    expect(await withTransaction(pool, (client) => garrison.createOffer(client, offerInput))).toBe(offerId);
    expect(
      await withTransaction(pool, (client) =>
        garrison.signOffer(client, {
          accountId: lender.accountId,
          offerId,
          version: 1,
          actorKind: "agent",
          gameTimeMs: 62_000,
        }),
      ),
    ).toEqual({ contractId: null });
    const accepted = await withTransaction(pool, (client) =>
      garrison.signOffer(client, {
        accountId: host.accountId,
        offerId,
        version: 1,
        actorKind: "agent",
        gameTimeMs: 63_000,
      }),
    );
    expect(accepted.contractId).toBeTruthy();
    const contract = await pool.query("SELECT * FROM garrison_contracts WHERE id = $1", [accepted.contractId]);
    expect(contract.rows[0]).toMatchObject({
      lender_kingdom_id: lender.kingdomId,
      host_kingdom_id: host.kingdomId,
      start_game_time_ms: "63000",
      end_game_time_ms: "3720000",
      status: "active",
    });
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM kingdom_troops WHERE placement = 'visiting' AND placement_ref = $1",
          [accepted.contractId],
        )
      ).rows[0]?.count,
    ).toBe(2);
    expect(
      (
        await pool.query("SELECT sum(troop_count)::int AS count FROM authority_commitments WHERE account_id = $1", [
          lender.accountId,
        ])
      ).rows[0]?.count,
    ).toBe(2);
    expect(
      (
        await pool.query("SELECT reserved_units FROM authority_ledger WHERE account_id = $1 AND asset = 'grain'", [
          host.accountId,
        ])
      ).rows[0]?.reserved_units,
    ).toBe("1300"); // Two Spearmen × 10 units/minute × 65 ticks.
    const firstBattle = await withTransaction(pool, (client) =>
      troops.captureBattleEligibility(client, {
        battleId: randomUUID(),
        hostKingdomId: host.kingdomId,
        raidId: randomUUID(),
        lockUntilGameTimeMs: 180_000,
      }),
    );
    expect(firstBattle.defenderIds).toHaveLength(2);
    await withTransaction(pool, (client) =>
      garrison.requestExit(client, {
        accountId: lender.accountId,
        contractId: accepted.contractId as string,
        gameTimeMs: 64_000,
      }),
    );
    expect(
      (await pool.query("SELECT status, lender_default FROM garrison_contracts WHERE id = $1", [accepted.contractId]))
        .rows[0],
    ).toEqual({
      status: "exit_pending",
      lender_default: true,
    });
    const laterBattle = await withTransaction(pool, (client) =>
      troops.captureBattleEligibility(client, {
        battleId: randomUUID(),
        hostKingdomId: host.kingdomId,
        raidId: randomUUID(),
        lockUntilGameTimeMs: 240_000,
      }),
    );
    expect(laterBattle.defenderIds).toHaveLength(0);
    expect(await withTransaction(pool, (client) => garrison.settleMinute(client, 179_000))).toBe(0);
    expect(await withTransaction(pool, (client) => garrison.settleMinute(client, 180_000))).toBe(1);
    expect(
      (await pool.query("SELECT status FROM garrison_contracts WHERE id = $1", [accepted.contractId])).rows[0]?.status,
    ).toBe("closed");
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM kingdom_troops WHERE owner_kingdom_id = $1 AND placement = 'home'",
          [lender.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(2);
    expect(
      (
        await pool.query("SELECT reserved_units FROM authority_ledger WHERE account_id = $1 AND asset = 'grain'", [
          host.accountId,
        ])
      ).rows[0]?.reserved_units,
    ).toBe("0");
  });

  it("requires exact human approval and an unlocked detachment for seizure", async () => {
    const lender = await kingdom(3);
    const host = await kingdom(1);
    const troopId = randomUUID();
    await pool.query(
      `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id, type,
         home_guard, placement, created_game_time_ms, created_at)
       VALUES ($1,'pact',$2,$2,'spearman',false,'home',0,clock_timestamp())`,
      [troopId, lender.kingdomId],
    );
    const offerId = randomUUID();
    await withTransaction(pool, (client) =>
      garrison.createOffer(client, {
        accountId: lender.accountId,
        hostKingdomId: host.kingdomId,
        offerId,
        terms: { units: [{ type: "spearman", count: 1 }], durationHours: 1, lenderBond: null, hostBond: null },
        gameTimeMs: 61_000,
        expiresGameTimeMs: 300_000,
      }),
    );
    await withTransaction(pool, (client) =>
      garrison.signOffer(client, {
        accountId: lender.accountId,
        offerId,
        version: 1,
        actorKind: "human",
        gameTimeMs: 62_000,
      }),
    );
    const { contractId } = await withTransaction(pool, (client) =>
      garrison.signOffer(client, {
        accountId: host.accountId,
        offerId,
        version: 1,
        actorKind: "human",
        gameTimeMs: 63_000,
      }),
    );
    if (!contractId) throw new Error("missing contract");
    await withTransaction(pool, (client) =>
      troops.captureBattleEligibility(client, {
        battleId: randomUUID(),
        hostKingdomId: host.kingdomId,
        raidId: randomUUID(),
        lockUntilGameTimeMs: 180_000,
      }),
    );
    await expect(
      withTransaction(pool, (client) =>
        garrison.seize(client, {
          accountId: host.accountId,
          contractId,
          permitId: randomUUID(),
          gameTimeMs: 100_000,
        }),
      ),
    ).rejects.toThrow("INVALID_EXACT_PERMIT");
    const sessionId = randomUUID();
    await pool.query(
      `INSERT INTO sessions(id, product_scope, account_id, audience, token_hash, expires_at, idle_expires_at)
       VALUES ($1,'pact',$2,'human',$3,clock_timestamp() + interval '1 hour',clock_timestamp() + interval '1 hour')`,
      [sessionId, host.accountId, randomUUID()],
    );
    const permits = new ExactHumanPermitService("pact");
    const permitId = await withTransaction(pool, (client) =>
      permits.issue(client, {
        accountId: host.accountId,
        humanSessionId: sessionId,
        action: "garrison.seize",
        operationKey: `garrison:${contractId}:seize`,
        assets: {},
        troopCount: 1,
      }),
    );
    expect(
      (
        await pool.query(
          "SELECT account_id, action, operation_key, assets, troop_count, used_at FROM authority_human_permits WHERE id = $1",
          [permitId],
        )
      ).rows[0],
    ).toMatchObject({
      account_id: host.accountId,
      action: "garrison.seize",
      operation_key: `garrison:${contractId}:seize`,
      assets: {},
      troop_count: 1,
      used_at: null,
    });
    await expect(
      withTransaction(pool, (client) =>
        garrison.seize(client, {
          accountId: host.accountId,
          contractId,
          permitId,
          gameTimeMs: 100_000,
        }),
      ),
    ).rejects.toThrow("UNIT_LOCKED");
    expect(
      await withTransaction(pool, (client) =>
        garrison.seize(client, {
          accountId: host.accountId,
          contractId,
          permitId,
          gameTimeMs: 180_000,
        }),
      ),
    ).toEqual([troopId]);
    expect(
      (
        await pool.query("SELECT id, owner_kingdom_id, host_kingdom_id, placement FROM kingdom_troops WHERE id = $1", [
          troopId,
        ])
      ).rows[0],
    ).toMatchObject({
      id: troopId,
      owner_kingdom_id: host.kingdomId,
      host_kingdom_id: host.kingdomId,
      placement: "home",
    });
    expect(
      (await pool.query("SELECT status, host_default FROM garrison_contracts WHERE id = $1", [contractId])).rows[0],
    ).toEqual({ status: "closed", host_default: true });
    await expect(
      withTransaction(pool, (client) =>
        garrison.seize(client, {
          accountId: host.accountId,
          contractId,
          permitId,
          gameTimeMs: 180_000,
        }),
      ),
    ).rejects.toThrow("CONTRACT_CLOSED");
  });

  it("defaults an underfunded host on its first tick and transfers only its posted bond", async () => {
    const lender = await kingdom(3);
    const host = await kingdom(1);
    await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId: host.kingdomId,
        resource: "grain",
        amount: wholeResources(2),
        operationKey: `fixture-bond:${host.kingdomId}`,
        reason: "test_production",
        gameTimeMs: 60_000,
      }),
    );
    await pool.query(
      `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id, type,
         home_guard, placement, created_game_time_ms, created_at)
       VALUES ($1,'pact',$2,$2,'spearman',false,'home',0,clock_timestamp())`,
      [randomUUID(), lender.kingdomId],
    );
    const offerId = randomUUID();
    await withTransaction(pool, (client) =>
      garrison.createOffer(client, {
        accountId: lender.accountId,
        hostKingdomId: host.kingdomId,
        offerId,
        terms: {
          units: [{ type: "spearman", count: 1 }],
          durationHours: 1,
          lenderBond: null,
          hostBond: { resource: "grain", wholeAmount: 1 },
        },
        gameTimeMs: 61_000,
        expiresGameTimeMs: 300_000,
      }),
    );
    await withTransaction(pool, (client) =>
      garrison.signOffer(client, {
        accountId: lender.accountId,
        offerId,
        version: 1,
        actorKind: "human",
        gameTimeMs: 62_000,
      }),
    );
    const { contractId } = await withTransaction(pool, (client) =>
      garrison.signOffer(client, {
        accountId: host.accountId,
        offerId,
        version: 1,
        actorKind: "human",
        gameTimeMs: 63_000,
      }),
    );
    if (!contractId) throw new Error("missing contract");
    const lenderBefore = await withTransaction(pool, (client) => ledger.readBalance(client, lender.kingdomId, "grain"));
    await withTransaction(pool, (client) =>
      ledger.debit(client, {
        kingdomId: host.kingdomId,
        resource: "grain",
        amount: wholeResources(1000),
        purpose: "visiting_upkeep",
        operationKey: `fixture-drain:${contractId}`,
        gameTimeMs: 119_000,
      }),
    );
    await withTransaction(pool, async (client) => {
      await new UpkeepService("pact", ledger).settleMinute(client, {
        productScope: "pact",
        sequence: 2n,
        gameTimeMs: 120_000,
        dueAt: new Date(),
      });
      expect(await garrison.settleMinute(client, 120_000)).toBe(1);
    });
    expect(
      (
        await pool.query("SELECT status, host_default, close_reason FROM garrison_contracts WHERE id = $1", [
          contractId,
        ])
      ).rows[0],
    ).toEqual({ status: "closed", host_default: true, close_reason: "host_underfunded" });
    const lenderAfter = await withTransaction(pool, (client) => ledger.readBalance(client, lender.kingdomId, "grain"));
    expect(lenderAfter.ordinary - lenderBefore.ordinary).toBe(wholeResources(1));
    expect(
      (await pool.query("SELECT placement FROM kingdom_troops WHERE owner_kingdom_id = $1", [lender.kingdomId])).rows[0]
        ?.placement,
    ).toBe("home");
  });
});
