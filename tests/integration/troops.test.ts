import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import { TroopService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
let ledger: ResourceLedger;
let troops: TroopService;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "troops");
  pool = createSchemaPool(connectionString, schema);
  ledger = new ResourceLedger("pact");
  troops = new TroopService("pact", ledger);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function foundingFixture(options: { hall?: number; barracks?: number; homeGuard?: number } = {}) {
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
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms,
         activation_event_id)
       VALUES ($1, 'pact', $2, $3, 'Training Fixture', 'portrait.wolf', clock_timestamp(),
         0, 0, 60000, $4)`,
      [kingdomId, accountId, `troop_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
    for (const kind of ["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"]) {
      const level = kind === "hall" ? (options.hall ?? 1) : kind === "barracks" ? (options.barracks ?? 1) : 1;
      await client.query(
        "INSERT INTO kingdom_buildings(product_scope, kingdom_id, kind, level) VALUES ('pact', $1, $2, $3)",
        [kingdomId, kind, level],
      );
    }
    for (let index = 0; index < (options.homeGuard ?? 0); index += 1) {
      await client.query(
        `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
           type, home_guard, placement, created_game_time_ms, created_at)
         VALUES ($1, 'pact', $2, $2, 'spearman', true, 'home', 0, clock_timestamp())`,
        [randomUUID(), kingdomId],
      );
    }
  });
  return { accountId, kingdomId };
}

async function credit(kingdomId: string, iron: number, silver: number): Promise<void> {
  await withTransaction(pool, async (client) => {
    for (const [resource, amount] of [
      ["iron", iron],
      ["silver", silver],
    ] as const) {
      await ledger.creditOrdinary(client, {
        kingdomId,
        resource,
        amount: wholeResources(amount),
        operationKey: `training-fixture:${randomUUID()}`,
        reason: "test_production",
        gameTimeMs: 0,
      });
    }
  });
}

async function tick(gameTimeMs: number): Promise<void> {
  await withTransaction(pool, (client) =>
    troops.settleMinute(client, {
      productScope: "pact",
      sequence: BigInt(gameTimeMs / 60_000),
      gameTimeMs,
      dueAt: new Date(),
    }),
  );
}

describe("training, unit identity, and placement", () => {
  it("consumes only completed unit costs and refunds 80% of the remaining reserved batch", async () => {
    const owner = await foundingFixture({ homeGuard: 8 });
    await credit(owner.kingdomId, 40, 16);
    const batchId = randomUUID();
    const queued = await withTransaction(pool, (client) =>
      troops.queueTraining(client, {
        ...owner,
        batchId,
        type: "spearman",
        count: 4,
        gameTimeMs: 0,
      }),
    );
    expect(queued.nextUnitDueGameTimeMs).toBe(240_000);
    expect(
      await withTransaction(pool, (client) =>
        troops.queueTraining(client, {
          ...owner,
          batchId,
          type: "spearman",
          count: 4,
          gameTimeMs: 0,
        }),
      ),
    ).toEqual(queued);
    await tick(240_000);
    await tick(420_000);
    await tick(420_000);
    const trained = await pool.query<{ id: string }>(
      "SELECT id FROM kingdom_troops WHERE owner_kingdom_id = $1 AND home_guard = false ORDER BY id",
      [owner.kingdomId],
    );
    expect(trained.rows).toHaveLength(2);
    expect(trained.rows.every((row) => row.id[14] === "7")).toBe(true);
    const canceled = await withTransaction(pool, (client) =>
      troops.cancelTraining(client, {
        ...owner,
        batchId,
        gameTimeMs: 420_000,
      }),
    );
    expect(canceled).toMatchObject({ completed: 2, requested: 4, status: "canceled" });
    expect(
      await withTransaction(pool, (client) =>
        troops.cancelTraining(client, {
          ...owner,
          batchId,
          gameTimeMs: 420_000,
        }),
      ),
    ).toEqual(canceled);
    const refunds = await pool.query(
      "SELECT resource, ordinary_delta, allowance_delta FROM resource_movements WHERE kingdom_id = $1 AND reason = 'cancellation_refund' ORDER BY resource",
      [owner.kingdomId],
    );
    expect(refunds.rows).toEqual([
      { resource: "iron", ordinary_delta: ((wholeResources(20) * 80n) / 100n).toString(), allowance_delta: "0" },
      { resource: "silver", ordinary_delta: ((wholeResources(8) * 80n) / 100n).toString(), allowance_delta: "0" },
    ]);
    await tick(10_020_000);
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM kingdom_troops WHERE owner_kingdom_id = $1 AND home_guard = false",
          [owner.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(2);
  });

  it("prevents concurrent queues from exceeding owned capacity and enforces Hall unlocks", async () => {
    const owner = await foundingFixture({ homeGuard: 8 });
    await credit(owner.kingdomId, 300, 150);
    await expect(
      withTransaction(pool, (client) =>
        troops.queueTraining(client, {
          ...owner,
          batchId: randomUUID(),
          type: "archer",
          count: 1,
          gameTimeMs: 0,
        }),
      ),
    ).rejects.toMatchObject({ code: "HALL_LOCKED" });
    await expect(
      withTransaction(pool, (client) =>
        troops.queueTraining(client, {
          ...owner,
          batchId: randomUUID(),
          type: "spearman",
          count: 13,
          gameTimeMs: 0,
        }),
      ),
    ).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });
    const results = await Promise.allSettled([
      withTransaction(pool, (client) =>
        troops.queueTraining(client, {
          ...owner,
          batchId: randomUUID(),
          type: "spearman",
          count: 12,
          gameTimeMs: 0,
        }),
      ),
      withTransaction(pool, (client) =>
        troops.queueTraining(client, {
          ...owner,
          batchId: randomUUID(),
          type: "spearman",
          count: 12,
          gameTimeMs: 0,
        }),
      ),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM training_batches WHERE kingdom_id = $1 AND status = 'active'",
          [owner.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(1);
    await expect(
      withTransaction(pool, (client) =>
        troops.queueTraining(client, {
          ...owner,
          batchId: randomUUID(),
          type: "spearman",
          count: 41,
          gameTimeMs: 0,
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_TROOP" });
  });

  it("keeps Home Guard defensive and preserves trained IDs through exclusive commitments and battle locks", async () => {
    const owner = await foundingFixture({ homeGuard: 2, hall: 3 });
    await credit(owner.kingdomId, 20, 8);
    const batchId = randomUUID();
    await withTransaction(pool, (client) =>
      troops.queueTraining(client, {
        ...owner,
        batchId,
        type: "spearman",
        count: 2,
        gameTimeMs: 0,
      }),
    );
    await tick(420_000);
    const homeGuards = await pool.query<{ id: string }>(
      "SELECT id FROM kingdom_troops WHERE owner_kingdom_id = $1 AND home_guard = true ORDER BY id",
      [owner.kingdomId],
    );
    const raidId = randomUUID();
    const assigned = await withTransaction(pool, (client) =>
      troops.assign(client, {
        accountId: owner.accountId,
        ownerKingdomId: owner.kingdomId,
        hostKingdomId: owner.kingdomId,
        placement: "attacking",
        referenceId: raidId,
        type: "spearman",
        count: 1,
        gameTimeMs: 420_000,
      }),
    );
    expect(assigned).toHaveLength(1);
    expect(assigned[0]?.homeGuard).toBe(false);
    const trainedIds = (
      await pool.query<{ id: string }>(
        "SELECT id FROM kingdom_troops WHERE owner_kingdom_id = $1 AND home_guard = false ORDER BY id",
        [owner.kingdomId],
      )
    ).rows.map((row) => row.id);
    expect(assigned[0]?.id).toBe(trainedIds[0]);
    expect(homeGuards.rows.map((row) => row.id)).not.toContain(assigned[0]?.id);
    await expect(
      withTransaction(pool, (client) =>
        troops.assign(client, {
          accountId: owner.accountId,
          ownerKingdomId: owner.kingdomId,
          hostKingdomId: owner.kingdomId,
          placement: "scouting",
          referenceId: randomUUID(),
          type: "spearman",
          count: 1,
          explicitIds: [assigned[0]?.id ?? ""],
          gameTimeMs: 420_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "UNITS_UNAVAILABLE" });
    const battleId = randomUUID();
    const snapshot = await withTransaction(pool, (client) =>
      troops.captureBattleEligibility(client, {
        battleId,
        hostKingdomId: owner.kingdomId,
        raidId,
        lockUntilGameTimeMs: 1_000_000,
      }),
    );
    expect(snapshot.attackerIds).toEqual([assigned[0]?.id]);
    expect(snapshot.defenderIds).toEqual(expect.arrayContaining(homeGuards.rows.map((row) => row.id)));
    expect(
      await withTransaction(pool, (client) =>
        troops.captureBattleEligibility(client, {
          battleId,
          hostKingdomId: owner.kingdomId,
          raidId,
          lockUntilGameTimeMs: 1_000_000,
        }),
      ),
    ).toEqual(snapshot);
    await expect(
      withTransaction(pool, (client) =>
        troops.returnPlacement(client, {
          ownerKingdomId: owner.kingdomId,
          placement: "attacking",
          referenceId: raidId,
          gameTimeMs: 900_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "UNIT_LOCKED" });
    expect(
      await withTransaction(pool, (client) =>
        troops.returnPlacement(client, {
          ownerKingdomId: owner.kingdomId,
          placement: "attacking",
          referenceId: raidId,
          gameTimeMs: 1_000_000,
        }),
      ),
    ).toEqual([assigned[0]?.id]);
    const guardId = homeGuards.rows[0]?.id ?? "";
    const before = await pool.query(
      "SELECT ordinary_units, allowance_units FROM resource_balances WHERE kingdom_id = $1 AND resource = 'iron'",
      [owner.kingdomId],
    );
    expect(
      await withTransaction(pool, (client) =>
        troops.disband(client, {
          ...owner,
          troopId: guardId,
          gameTimeMs: 1_000_000,
        }),
      ),
    ).toBe(true);
    expect(
      await withTransaction(pool, (client) =>
        troops.disband(client, {
          ...owner,
          troopId: guardId,
          gameTimeMs: 1_000_000,
        }),
      ),
    ).toBe(false);
    expect(
      (
        await pool.query(
          "SELECT ordinary_units, allowance_units FROM resource_balances WHERE kingdom_id = $1 AND resource = 'iron'",
          [owner.kingdomId],
        )
      ).rows,
    ).toEqual(before.rows);

    const remainingGuard = homeGuards.rows[1]?.id ?? "";
    const host = await foundingFixture();
    for (const placement of ["scouting", "attacking", "visiting"] as const) {
      await expect(
        withTransaction(pool, (client) =>
          troops.assign(client, {
            accountId: owner.accountId,
            ownerKingdomId: owner.kingdomId,
            hostKingdomId: placement === "visiting" ? host.kingdomId : owner.kingdomId,
            placement,
            referenceId: randomUUID(),
            type: "spearman",
            count: 1,
            explicitIds: [remainingGuard],
            gameTimeMs: 1_000_000,
          }),
        ),
      ).rejects.toMatchObject({ code: "UNITS_UNAVAILABLE" });
    }
    const secondTrained =
      (
        await pool.query<{ id: string }>(
          "SELECT id FROM kingdom_troops WHERE owner_kingdom_id = $1 AND home_guard = false AND placement = 'home' ORDER BY id DESC LIMIT 1",
          [owner.kingdomId],
        )
      ).rows[0]?.id ?? "";
    const competing = await Promise.allSettled(
      ["scouting", "attacking"].map((placement) =>
        withTransaction(pool, (client) =>
          troops.assign(client, {
            accountId: owner.accountId,
            ownerKingdomId: owner.kingdomId,
            hostKingdomId: owner.kingdomId,
            placement: placement as "scouting" | "attacking",
            referenceId: randomUUID(),
            type: "spearman",
            count: 1,
            explicitIds: [secondTrained],
            gameTimeMs: 1_000_000,
          }),
        ),
      ),
    );
    expect(competing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await pool.query("SELECT id FROM kingdom_troops WHERE id = $1", [secondTrained])).rowCount).toBe(1);
  });

  it("rolls back a unit completion and its consumed provenance when insertion fails", async () => {
    const owner = await foundingFixture();
    await credit(owner.kingdomId, 10, 4);
    const batchId = randomUUID();
    await withTransaction(pool, (client) =>
      troops.queueTraining(client, {
        ...owner,
        batchId,
        type: "spearman",
        count: 1,
        gameTimeMs: 0,
      }),
    );
    await pool.query(`CREATE FUNCTION fail_trained_troop() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.home_guard = false THEN RAISE EXCEPTION 'fixture troop failure'; END IF;
      RETURN NEW; END $$`);
    await pool.query(
      "CREATE TRIGGER fail_trained_troop BEFORE INSERT ON kingdom_troops FOR EACH ROW EXECUTE FUNCTION fail_trained_troop()",
    );
    try {
      await expect(tick(240_000)).rejects.toThrow("fixture troop failure");
    } finally {
      await pool.query("DROP TRIGGER fail_trained_troop ON kingdom_troops");
      await pool.query("DROP FUNCTION fail_trained_troop()");
    }
    expect(
      (await pool.query("SELECT completed_count FROM training_batches WHERE id = $1", [batchId])).rows[0]
        ?.completed_count,
    ).toBe(0);
    expect(
      (
        await pool.query("SELECT count(*)::integer AS count FROM kingdom_troops WHERE owner_kingdom_id = $1", [
          owner.kingdomId,
        ])
      ).rows[0]?.count,
    ).toBe(0);
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM resource_training_consumptions WHERE operation_key = $1",
          [`training-unit:${batchId}:1`],
        )
      ).rows[0]?.count,
    ).toBe(0);
    await tick(240_000);
    expect(
      (await pool.query("SELECT completed_count FROM training_batches WHERE id = $1", [batchId])).rows[0]
        ?.completed_count,
    ).toBe(1);
  });

  it("serializes visitor capacity across owners without copying troop identities", async () => {
    const host = await foundingFixture();
    const first = await foundingFixture({ hall: 3 });
    const second = await foundingFixture({ hall: 3 });
    for (const owner of [first, second]) {
      for (let index = 0; index < 12; index += 1) {
        await pool.query(
          `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
             type, home_guard, placement, created_game_time_ms, created_at)
           VALUES ($1, 'pact', $2, $2, 'spearman', false, 'home', 0, clock_timestamp())`,
          [randomUUID(), owner.kingdomId],
        );
      }
    }
    const results = await Promise.allSettled(
      [first, second].map((owner) =>
        withTransaction(pool, (client) =>
          troops.assign(client, {
            accountId: owner.accountId,
            ownerKingdomId: owner.kingdomId,
            hostKingdomId: host.kingdomId,
            placement: "visiting",
            referenceId: randomUUID(),
            type: "spearman",
            count: 12,
            gameTimeMs: 0,
          }),
        ),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM kingdom_troops WHERE host_kingdom_id = $1 AND placement = 'visiting'",
          [host.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(12);
    expect(
      (
        await pool.query(
          "SELECT count(DISTINCT id)::integer AS count FROM kingdom_troops WHERE host_kingdom_id = $1 AND placement = 'visiting'",
          [host.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(12);
  });
});
