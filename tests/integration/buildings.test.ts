import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { type BuildingKind, wholeResources } from "@pact/domain";
import { BuildingEngine, type ConstructionAuthorityPort, KingdomService, upgradeQuote } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { OnboardingService } from "@pact/onboarding";
import { WorldClockService } from "@pact/world";
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
let ledger: ResourceLedger;
let engine: BuildingEngine;
let kingdomId: string;
let accountId: string;
let allowStart = true;
const calls: string[] = [];

const authority: ConstructionAuthorityPort = {
  async reserve(_client, input) {
    calls.push(`reserve:${input.instructionId}`);
    return `fixture:${input.instructionId}`;
  },
  async recheckAndStart(_client, input) {
    calls.push(`start:${input.instructionId}:${input.ordinaryIron}:${input.ordinarySilver}`);
    return allowStart;
  },
  async releaseWaiting(_client, _ref, instructionId) {
    calls.push(`release:${instructionId}`);
  },
  async recordActiveCancellation(_client, _ref, instructionId) {
    calls.push(`active-cancel:${instructionId}`);
  },
};

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "buildings");
  pool = createSchemaPool(connectionString, schema);
  ledger = new ResourceLedger("pact");
  const now = new Date();
  const onboarding = new OnboardingService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    now: () => now,
  });
  const world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  await pool.query(
    "UPDATE world_clocks SET next_tick_due_at = clock_timestamp() + interval '5 minutes' WHERE product_scope = 'pact'",
  );
  const kingdom = new KingdomService(pool, { productScope: "pact", onboarding, world, ledger });
  accountId = randomUUID();
  await pool.query(
    `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
     VALUES ($1, 'pact', $2, 'fixture-only', $3, 'terms-v1')`,
    [accountId, `${accountId}@example.test`, now],
  );
  const draft = await onboarding.ensureDraft(accountId);
  await onboarding.updateDraft(accountId, {
    displayName: "Build Test",
    proposedHandle: `build_${randomUUID().slice(0, 8)}`,
    portrait: "portrait.wolf",
    expectedVersion: draft.version,
  });
  await onboarding.recordConnectionCheck(accountId);
  kingdomId = (await kingdom.activate(accountId)).kingdomId;
  engine = new BuildingEngine("pact", ledger, authority);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function queue(kind: string, slot: number, targetLevel = 2, instructionId = randomUUID()) {
  return withTransaction(pool, (client) =>
    engine.queue(client, {
      accountId,
      kingdomId,
      instructionId,
      slot,
      kind,
      targetLevel,
      actor: "agent",
      mandateVersion: 1,
      gameTimeMs: 0,
    }),
  );
}

async function settle(gameTimeMs: number): Promise<void> {
  await withTransaction(pool, (client) =>
    engine.settleMinute(client, {
      productScope: "pact",
      sequence: BigInt(gameTimeMs / 60_000),
      gameTimeMs,
      dueAt: new Date(),
    }),
  );
}

async function credit(resource: "iron" | "silver", amount: number, key: string): Promise<void> {
  await withTransaction(pool, async (client: PoolClient) => {
    await ledger.creditOrdinary(client, {
      kingdomId,
      resource,
      amount: wholeResources(amount),
      operationKey: key,
      reason: "test_production",
      gameTimeMs: 60_000,
    });
  });
}

describe("building queues", () => {
  it("uses two active slots, one waiting per slot, and starts funded work in slot order", async () => {
    const farmId = randomUUID();
    const barracksId = randomUUID();
    const hallId = randomUUID();
    const storehouseId = randomUUID();
    const farm = await queue("farm", 1, 2, farmId);
    const barracks = await queue("barracks", 2, 2, barracksId);
    expect(farm.state).toBe("active");
    expect(barracks.state).toBe("active");
    expect(farm.dueGameTimeMs).toBe(660_000);
    expect((await queue("hall", 1, 2, hallId)).state).toBe("waiting");
    expect((await queue("storehouse", 2, 2, storehouseId)).state).toBe("waiting");
    await expect(queue("hall", 2)).rejects.toMatchObject({ code: "BUILDING_BUSY" });
    await expect(queue("mine", 1)).rejects.toMatchObject({ code: "SLOT_BUSY" });
    await expect(queue("farm", 2)).rejects.toMatchObject({ code: "BUILDING_BUSY" });
    expect(await queue("farm", 1, 2, farmId)).toEqual(farm);
    await expect(queue("farm", 2, 2, farmId)).rejects.toMatchObject({ code: "INSTRUCTION_CONFLICT" });

    allowStart = false;
    await settle(660_000);
    const levels = await pool.query(
      "SELECT kind, level FROM kingdom_buildings WHERE kingdom_id = $1 AND kind IN ('farm','barracks','hall') ORDER BY kind",
      [kingdomId],
    );
    expect(levels.rows).toEqual([
      { kind: "barracks", level: 2 },
      { kind: "farm", level: 2 },
      { kind: "hall", level: 1 },
    ]);
    // Hall II needs 180 Iron; the remaining restricted grant is only 80.
    expect((await pool.query("SELECT state FROM building_instructions WHERE id = $1", [hallId])).rows[0]?.state).toBe(
      "waiting",
    );
    await credit("iron", 160, `fund-hall-${randomUUID()}`);
    await credit("silver", 80, `fund-hall-${randomUUID()}`);
    const beforeRechecks = calls.length;
    await settle(720_000);
    expect(calls.slice(beforeRechecks).filter((call) => call.startsWith("start:"))).toEqual([
      expect.stringContaining(`start:${hallId}:`),
      expect.stringContaining(`start:${storehouseId}:`),
    ]);
    expect((await pool.query("SELECT state FROM building_instructions WHERE id = $1", [hallId])).rows[0]?.state).toBe(
      "waiting",
    );
    allowStart = true;
    await settle(780_000);
    const started = await pool.query<{ state: string; started_game_time_ms: string; due_game_time_ms: string }>(
      "SELECT state, started_game_time_ms, due_game_time_ms FROM building_instructions WHERE id = $1",
      [hallId],
    );
    expect(started.rows[0]).toEqual({ state: "active", started_game_time_ms: "780000", due_game_time_ms: "1440000" });
    expect(
      (await pool.query("SELECT state FROM building_instructions WHERE id = $1", [storehouseId])).rows[0]?.state,
    ).toBe("active");
    expect(calls.filter((call) => call.startsWith(`reserve:${hallId}`))).toHaveLength(1);
    await settle(1_440_000);
    await settle(1_440_000);
    expect(
      (await pool.query("SELECT level FROM kingdom_buildings WHERE kingdom_id = $1 AND kind = 'hall'", [kingdomId]))
        .rows[0]?.level,
    ).toBe(2);
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM outbox_events WHERE type = 'building.completed.v1' AND payload->>'instructionId' = $1",
          [hallId],
        )
      ).rows[0]?.count,
    ).toBe(1);
  });

  it("cancels waiting work free and active work at original-category half refund without replay", async () => {
    await credit("iron", 50, `fund-mine-${randomUUID()}`);
    await credit("silver", 25, `fund-mine-${randomUUID()}`);
    const activeId = randomUUID();
    const waitingId = randomUUID();
    const active = await queue("mine", 1, 2, activeId);
    expect(active.state).toBe("active");
    const waiting = await queue("market", 1, 2, waitingId);
    expect(waiting.state).toBe("waiting");
    const before = await pool.query<{ ordinary_units: string; allowance_units: string }>(
      "SELECT ordinary_units, allowance_units FROM resource_balances WHERE kingdom_id = $1 AND resource = 'iron'",
      [kingdomId],
    );
    const canceledWaiting = await withTransaction(pool, (client) =>
      engine.cancel(client, {
        accountId,
        kingdomId,
        instructionId: waitingId,
        gameTimeMs: 1_500_000,
      }),
    );
    expect(canceledWaiting.state).toBe("canceled");
    expect(calls.filter((call) => call === `release:${waitingId}`)).toHaveLength(1);
    expect(
      (
        await pool.query(
          "SELECT ordinary_units, allowance_units FROM resource_balances WHERE kingdom_id = $1 AND resource = 'iron'",
          [kingdomId],
        )
      ).rows,
    ).toEqual(before.rows);
    const canceledActive = await withTransaction(pool, (client) =>
      engine.cancel(client, {
        accountId,
        kingdomId,
        instructionId: activeId,
        gameTimeMs: 1_500_000,
      }),
    );
    expect(canceledActive.state).toBe("canceled");
    expect(calls.filter((call) => call === `active-cancel:${activeId}`)).toHaveLength(1);
    expect(
      await withTransaction(pool, (client) =>
        engine.cancel(client, {
          accountId,
          kingdomId,
          instructionId: activeId,
          gameTimeMs: 1_500_000,
        }),
      ),
    ).toEqual(canceledActive);
    const refunds = await pool.query(
      "SELECT resource, ordinary_delta, allowance_delta FROM resource_movements WHERE kingdom_id = $1 AND reason = 'cancellation_refund' AND game_time_ms = 1500000 ORDER BY resource",
      [kingdomId],
    );
    expect(refunds.rows).toEqual([
      { resource: "iron", ordinary_delta: wholeResources(25).toString(), allowance_delta: "0" },
      { resource: "silver", ordinary_delta: (wholeResources(25) / 2n).toString(), allowance_delta: "0" },
    ]);
    expect(
      (await pool.query("SELECT level FROM kingdom_buildings WHERE kingdom_id = $1 AND kind = 'mine'", [kingdomId]))
        .rows[0]?.level,
    ).toBe(1);
  });

  it("rejects another account and preserves building/ledger state on a failed completion", async () => {
    await expect(
      withTransaction(pool, (client) =>
        engine.queue(client, {
          accountId: randomUUID(),
          kingdomId,
          instructionId: randomUUID(),
          slot: 1,
          kind: "wall",
          targetLevel: 2,
          actor: "human",
          permitId: "fixture",
          gameTimeMs: 0,
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_OWNER" });
    await credit("iron", 80, `fund-wall-${randomUUID()}`);
    await credit("silver", 30, `fund-wall-${randomUUID()}`);
    const id = randomUUID();
    const wall = await queue("wall", 1, 2, id);
    expect(wall.state).toBe("active");
    await pool.query(`CREATE FUNCTION fail_building_completion() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.state = 'completed' THEN RAISE EXCEPTION 'fixture completion failure'; END IF;
      RETURN NEW; END $$`);
    await pool.query(
      "CREATE TRIGGER fail_building_completion BEFORE UPDATE ON building_instructions FOR EACH ROW EXECUTE FUNCTION fail_building_completion()",
    );
    try {
      await expect(settle(2_100_000)).rejects.toThrow("fixture completion failure");
    } finally {
      await pool.query("DROP TRIGGER fail_building_completion ON building_instructions");
      await pool.query("DROP FUNCTION fail_building_completion()");
    }
    expect(
      (await pool.query("SELECT level FROM kingdom_buildings WHERE kingdom_id = $1 AND kind = 'wall'", [kingdomId]))
        .rows[0]?.level,
    ).toBe(1);
    expect((await pool.query("SELECT state FROM building_instructions WHERE id = $1", [id])).rows[0]?.state).toBe(
      "active",
    );
    await settle(2_100_000);
    expect(
      (await pool.query("SELECT level FROM kingdom_buildings WHERE kingdom_id = $1 AND kind = 'wall'", [kingdomId]))
        .rows[0]?.level,
    ).toBe(2);
  });

  it("can build the complete legal level-I through level-VI dependency ladder", async () => {
    const ladderAccount = randomUUID();
    const ladderKingdom = randomUUID();
    await pool.query(
      `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
       VALUES ($1, 'pact', $2, 'fixture-only', clock_timestamp(), 'terms-v1')`,
      [ladderAccount, `${ladderAccount}@example.test`],
    );
    await withTransaction(pool, async (client) => {
      await client.query(
        `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
           activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms,
           activation_event_id)
         VALUES ($1, 'pact', $2, $3, 'Ladder', 'portrait.wolf', clock_timestamp(),
           0, 0, 60000, $4)`,
        [ladderKingdom, ladderAccount, `ladder_${randomUUID().slice(0, 8)}`, randomUUID()],
      );
      await ledger.initializeKingdom(client, ladderKingdom, 0);
      for (const kind of ["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"]) {
        await client.query(
          "INSERT INTO kingdom_buildings(product_scope, kingdom_id, kind, level) VALUES ('pact', $1, $2, 1)",
          [ladderKingdom, kind],
        );
      }
    });
    let gameTimeMs = 0;
    let instructionCount = 0;
    async function build(kind: BuildingKind, targetLevel: number): Promise<void> {
      const quote = upgradeQuote(kind, targetLevel, gameTimeMs);
      const instructionId = randomUUID();
      const queued = await withTransaction(pool, async (client) => {
        for (const [resource, required] of [
          ["iron", quote.iron],
          ["silver", quote.silver],
        ] as const) {
          const balance = await ledger.readBalance(client, ladderKingdom, resource);
          const shortage = required - balance.ordinary - balance.allowance;
          if (shortage > 0n) {
            await ledger.creditOrdinary(client, {
              kingdomId: ladderKingdom,
              resource,
              amount: shortage,
              operationKey: `ladder-funding:${instructionId}:${resource}`,
              reason: "test_production",
              gameTimeMs,
            });
          }
        }
        return engine.queue(client, {
          accountId: ladderAccount,
          kingdomId: ladderKingdom,
          instructionId,
          slot: 1,
          kind,
          targetLevel,
          actor: "agent",
          mandateVersion: 1,
          gameTimeMs,
        });
      });
      expect(queued.state).toBe("active");
      if (queued.dueGameTimeMs === null) throw new Error("Ladder build missing deadline");
      gameTimeMs = queued.dueGameTimeMs;
      await withTransaction(pool, async (client) => {
        const context = {
          productScope: "pact",
          sequence: BigInt(gameTimeMs / 60_000),
          gameTimeMs,
          dueAt: new Date(),
        };
        await ledger.expireFoundingAllowances(client, context);
        await engine.settleMinute(client, context);
      });
      instructionCount += 1;
      expect(
        (
          await pool.query("SELECT level FROM kingdom_buildings WHERE kingdom_id = $1 AND kind = $2", [
            ladderKingdom,
            kind,
          ])
        ).rows[0]?.level,
      ).toBe(targetLevel);
    }
    for (let target = 2; target <= 6; target += 1) {
      for (const kind of ["storehouse", "farm", "barracks", "hall", "mine", "market", "wall"] as const) {
        await build(kind, target);
      }
    }
    expect(instructionCount).toBe(35);
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM building_instructions WHERE kingdom_id = $1 AND state = 'completed'",
          [ladderKingdom],
        )
      ).rows[0]?.count,
    ).toBe(35);
  });
});
