import { randomUUID } from "node:crypto";
import { ExactHumanPermitService } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import { type SupplyTerms, upgradeQuote } from "@pact/kingdom";
import { TICK_PHASES, type TickPhase } from "@pact/world";
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRulesRuntime } from "../../workers/rules/src/runtime.js";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const scope = "pact";
const minute = 3_600_000;
const worker = "combined-rules-worker";
const raidId = "00000000-0000-4000-8000-000000000301";
const phases: TickPhase[] = [
  "season_rollover",
  "boundaries_and_completions",
  "production",
  "upkeep",
  "capture_obligations",
  "settle_deliveries",
  "defaults_and_bonds",
  "battle_and_scouts",
  "views_and_achievements",
];
let admin: Pool;
let pool: Pool;
let schema: string;
const runtime = () => createRulesRuntime(pool, scope, Buffer.alloc(32, 7), (size) => Buffer.alloc(size, 3));

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "rules_runtime");
  pool = createSchemaPool(connectionString, schema);
  await pool.query("CREATE TABLE phase_trace (ordinal integer PRIMARY KEY, phase text NOT NULL)");
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

type Owner = { accountId: string; kingdomId: string };
async function kingdom(guardCount: number, ordinaryCount: number): Promise<Owner> {
  const owner = { accountId: randomUUID(), kingdomId: randomUUID() };
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
       VALUES ($1,$2,$3,'fixture-only',clock_timestamp(),'terms-v1')`,
      [owner.accountId, scope, `${owner.accountId}@example.test`],
    );
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1,$2,$3,$4,'Combined Fixture','portrait.wolf',clock_timestamp(),0,0,60000,$5)`,
      [owner.kingdomId, scope, owner.accountId, `combined_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await runtime().ledger.initializeKingdom(client, owner.kingdomId, 0);
    for (const kind of ["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"])
      await client.query("INSERT INTO kingdom_buildings VALUES ($1,$2,$3,1)", [scope, owner.kingdomId, kind]);
    await client.query(
      "INSERT INTO kingdom_score_baselines(product_scope, kingdom_id, game_time_ms) VALUES ($1,$2,0)",
      [scope, owner.kingdomId],
    );
    for (const [kind, capacity] of [
      ["raid", 3],
      ["scout", 4],
    ] as const)
      await client.query(
        `INSERT INTO kingdom_charges(product_scope, kingdom_id, kind, available, capacity,
           last_regenerated_game_time_ms) VALUES ($1,$2,$3,$4,$4,0)`,
        [scope, owner.kingdomId, kind, capacity],
      );
    for (let i = 0; i < guardCount + ordinaryCount; i++)
      await client.query(
        `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id, type,
           home_guard, placement, created_game_time_ms, created_at)
         VALUES ($1,$2,$3,$3,'spearman',$4,'home',0,clock_timestamp())`,
        [randomUUID(), scope, owner.kingdomId, i < guardCount],
      );
  });
  return owner;
}

async function credit(owner: Owner, resource: "iron" | "silver" | "grain", whole: number) {
  await withTransaction(pool, (client) =>
    runtime().ledger.creditOrdinary(client, {
      kingdomId: owner.kingdomId,
      resource,
      amount: wholeResources(whole),
      operationKey: `fixture:${owner.kingdomId}:${resource}`,
      reason: "fixture",
      gameTimeMs: 0,
    }),
  );
}

async function contract(a: Owner, b: Owner, terms: SupplyTerms) {
  const offerId = randomUUID();
  const contractId = randomUUID();
  // Synthetic pre-tick active contract, as in supply-settlement.test.ts; signature admission is tested separately.
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO supply_offers(id, product_scope, kingdom_a, kingdom_b, version, terms, status,
         expires_game_time_ms, created_game_time_ms, updated_game_time_ms)
       VALUES ($1,$2,$3,$4,1,$5::jsonb,'active',$6,0,0)`,
      [offerId, scope, a.kingdomId, b.kingdomId, JSON.stringify(terms), minute],
    );
    if (terms.aBond)
      await runtime().ledger.lockBond(client, {
        kingdomId: a.kingdomId,
        resource: terms.aBond.resource,
        amount: wholeResources(terms.aBond.wholeAmount),
        operationKey: `fixture-bond:${contractId}`,
        gameTimeMs: 0,
      });
    await client.query(
      `INSERT INTO supply_contracts(id, product_scope, offer_id, offer_version, kingdom_a, kingdom_b,
         terms, start_game_time_ms, end_game_time_ms, status)
       VALUES ($1,$2,$3,1,$4,$5,$6::jsonb,$7,$8,'active')`,
      [contractId, scope, offerId, a.kingdomId, b.kingdomId, JSON.stringify(terms), minute, minute + 3_600_000],
    );
  });
  return contractId;
}

async function balance(client: PoolClient, owner: Owner, resource: "silver" | "grain") {
  return (await runtime().ledger.readBalance(client, owner.kingdomId, resource)).ordinary;
}

/** Compare every durable table, including receipts/outbox/awards, not just selected stock rows. */
async function snapshot() {
  const tables = await pool.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name",
  );
  const rows: Record<string, unknown> = {};
  for (const { table_name: table } of tables.rows) {
    if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error("UNEXPECTED_FIXTURE_TABLE");
    rows[table] = (await pool.query(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows;
  }
  return rows;
}

describe("production rules composition", () => {
  it("rolls back every phase, then atomically commits the combined real-domain minute once", async () => {
    expect(TICK_PHASES).toEqual(phases);
    const attacker = await kingdom(0, 8);
    const defender = await kingdom(11, 0);
    const observer = await kingdom(0, 2);
    await credit(attacker, "grain", 200);
    await credit(defender, "grain", 200);
    await credit(defender, "iron", 10);
    await credit(defender, "silver", 4);
    await credit(observer, "grain", 6);
    await credit(observer, "silver", 10);
    const services = runtime();
    const farmId = randomUUID();
    const waitingId = randomUUID();
    const sessionId = randomUUID();
    await pool.query(
      `INSERT INTO sessions(id, product_scope, account_id, audience, token_hash, expires_at, idle_expires_at)
       VALUES ($1,$2,$3,'human',$4,clock_timestamp() + interval '1 hour',clock_timestamp() + interval '1 hour')`,
      [sessionId, scope, observer.accountId, randomUUID()],
    );
    for (const [instructionId, kind] of [
      [farmId, "farm"],
      [waitingId, "mine"],
    ] as const) {
      await withTransaction(pool, async (client) => {
        const quote = upgradeQuote(kind, 2, 2_999_000);
        const permitId = await new ExactHumanPermitService(scope).issue(client, {
          accountId: observer.accountId,
          humanSessionId: sessionId,
          action: "building.queue",
          operationKey: `building:${instructionId}`,
          assets: { iron: quote.iron, silver: quote.silver },
        });
        const queued = await services.buildings.queue(client, {
          ...observer,
          instructionId,
          kind,
          slot: 1,
          targetLevel: 2,
          actor: "human",
          permitId,
          gameTimeMs: 2_999_000,
        });
        expect(queued.state).toBe(kind === "farm" ? "active" : "waiting");
        if (kind === "farm") expect(queued.dueGameTimeMs).toBe(minute);
      });
    }
    const batchId = randomUUID();
    await withTransaction(pool, (client) =>
      services.troops.queueTraining(client, {
        ...defender,
        batchId,
        type: "spearman",
        count: 1,
        gameTimeMs: 3_419_000,
      }),
    );
    const raid = await withTransaction(pool, (client) =>
      services.raids.declare(client, {
        accountId: attacker.accountId,
        targetKingdomId: defender.kingdomId,
        raidId,
        units: [{ type: "spearman", count: 8 }],
        lootPriority: ["silver", "iron", "grain"],
        actorKind: "human",
        gameTimeMs: 2_399_000,
      }),
    );
    expect(raid.resolutionGameTimeMs).toBe(minute);
    const operationId = randomUUID();
    const scout = await withTransaction(pool, (client) =>
      services.scouting.start(client, {
        accountId: observer.accountId,
        targetKingdomId: defender.kingdomId,
        operationId,
        operationKey: `scout:${operationId}`,
        actorKind: "human",
        gameTimeMs: 2_999_000,
      }),
    );
    expect(scout.dueGameTimeMs).toBe(minute);
    await withTransaction(pool, (client) => services.raids.lockDue(client, raid.lockGameTimeMs));
    const funded = await contract(observer, defender, {
      aToB: { resource: "silver", wholePerHour: 8 },
      bToA: { resource: "grain", wholePerHour: 8 },
      aBond: null,
      bBond: null,
      durationHours: 1,
      noticeHours: 0,
    });
    const defaulted = await contract(attacker, observer, {
      aToB: { resource: "silver", wholePerHour: 11 },
      bToA: null,
      aBond: { resource: "grain", wholeAmount: 1 },
      bBond: null,
      durationHours: 1,
      noticeHours: 0,
    });
    await services.world.bootstrap();
    const token = await services.world.acquireLease(worker);
    expect(token).toBeTruthy();
    await pool.query(
      `UPDATE world_clocks SET committed_game_time_ms = $1, tick_sequence = 59,
         next_tick_due_at = clock_timestamp() - interval '1 second',
         last_heartbeat_at = clock_timestamp(), lease_expires_at = clock_timestamp() + interval '30 seconds'
       WHERE product_scope = $2`,
      [minute - 60_000, scope],
    );
    const before = await snapshot();

    const compose = (fault: TickPhase | null) => {
      const fresh = runtime(); // A restart must not depend on a previous settlement service's in-memory capture.
      for (const [ordinal, phase] of phases.entries()) {
        const original = fresh.handlers[phase];
        fresh.handlers[phase] = async (client, context) => {
          expect(
            (await client.query("SELECT phase FROM phase_trace ORDER BY ordinal")).rows.map((r) => r.phase),
          ).toEqual(phases.slice(0, ordinal));
          await original?.(client, context);
          expect((await client.query("SELECT 1 FROM world_ticks")).rowCount).toBe(0);
          if (phase === "boundaries_and_completions") {
            expect(
              (await client.query("SELECT state FROM building_instructions WHERE id = $1", [farmId])).rows[0]?.state,
            ).toBe("completed");
            expect(
              (await client.query("SELECT state FROM building_instructions WHERE id = $1", [waitingId])).rows[0]?.state,
            ).toBe("active");
            expect(
              (await client.query("SELECT status, completed_count FROM training_batches WHERE id = $1", [batchId]))
                .rows[0],
            ).toEqual({ status: "completed", completed_count: 1 });
          }
          if (phase === "production") {
            expect(await balance(client, observer, "silver")).toBe(100n);
            expect(await balance(client, observer, "grain")).toBe(1050n); // Farm II's 450 + 600 remaining provisions stock.
          }
          if (phase === "upkeep") expect(await balance(client, observer, "grain")).toBe(1030n);
          if (phase === "capture_obligations") {
            expect(await balance(client, observer, "silver")).toBe(100n);
            expect((await client.query("SELECT 1 FROM supply_installments")).rowCount).toBe(0);
          }
          if (phase === "settle_deliveries") {
            expect(await balance(client, defender, "silver")).toBe(180n);
            expect(await balance(client, observer, "silver")).toBe(120n); // 100 - 80 + 100.
            expect(await balance(client, observer, "grain")).toBe(1110n);
            expect(
              (await client.query("SELECT status FROM supply_contracts WHERE id = $1", [defaulted])).rows[0]?.status,
            ).toBe("active");
          }
          if (phase === "defaults_and_bonds") {
            expect(
              (await client.query("SELECT status FROM supply_contracts WHERE id = $1", [defaulted])).rows[0]?.status,
            ).toBe("defaulted");
            expect(await balance(client, observer, "grain")).toBe(1710n);
          }
          if (phase === "battle_and_scouts") {
            const surviving =
              (
                await client.query<{ count: number }>(
                  "SELECT count(*)::int AS count FROM kingdom_troops WHERE host_kingdom_id = $1",
                  [defender.kingdomId],
                )
              ).rows[0]?.count ?? 0;
            expect(surviving).toBeLessThan(12);
            const report = await fresh.scouting.readReport(client, observer.accountId, operationId);
            expect(report.observedGameTimeMs).toBe(minute);
            expect(report.homeTroops.spearman).toBe(surviving === 0 ? "0" : surviving <= 10 ? "1-10" : "11-25");
            expect(
              (
                await client.query(
                  "SELECT count(*)::int AS count FROM kingdom_troops WHERE owner_kingdom_id = $1 AND placement = 'home'",
                  [observer.kingdomId],
                )
              ).rows[0]?.count,
            ).toBe(2);
          }
          if (phase === "views_and_achievements") {
            // A separate connection must still see the pre-tick state, even after all real effects were written.
            expect(await snapshot()).toEqual(before);
            for (const owner of [attacker, defender, observer]) {
              const wealth = await fresh.fortune.wealth(client, owner.kingdomId);
              expect(
                (
                  await client.query(
                    "SELECT wealth_quarter_units FROM fortune_hourly_snapshots WHERE kingdom_id = $1",
                    [owner.kingdomId],
                  )
                ).rows[0]?.wealth_quarter_units,
              ).toBe(wealth.totalQuarterUnits.toString());
            }
            expect((await fresh.achievements.read(client, observer.accountId)).achievements).toEqual(
              expect.arrayContaining(["first_stone", "first_pact"]),
            );
          }
          await client.query("INSERT INTO phase_trace VALUES ($1,$2)", [ordinal, phase]);
          if (phase === fault) throw new Error(`FAULT_AFTER_${phase}`);
        };
      }
      return fresh;
    };
    for (const phase of phases) {
      await expect(compose(phase).world.advance(worker, token ?? "")).rejects.toThrow(`FAULT_AFTER_${phase}`);
      expect(await snapshot(), `durable rollback after ${phase}`).toEqual(before);
    }
    const recovered = compose(null);
    expect((await recovered.world.advance(worker, token ?? "")).kind).toBe("committed");
    expect((await pool.query("SELECT phase FROM phase_trace ORDER BY ordinal")).rows.map((r) => r.phase)).toEqual(
      phases,
    );
    expect((await pool.query("SELECT 1 FROM world_ticks")).rowCount).toBe(1);
    expect((await pool.query("SELECT 1 FROM outbox_events WHERE type = 'world.tick.committed.v1'")).rowCount).toBe(1);
    expect((await pool.query("SELECT 1 FROM outbox_events WHERE type = 'raid.resolved.v1'")).rowCount).toBe(1);
    expect(
      (await pool.query("SELECT delivered_units, due_units FROM supply_installments WHERE contract_id = $1", [funded]))
        .rows,
    ).toEqual([
      { delivered_units: "80", due_units: "80" },
      { delivered_units: "80", due_units: "80" },
    ]);
    expect(
      (
        await pool.query("SELECT delivered_units, due_units FROM supply_installments WHERE contract_id = $1", [
          defaulted,
        ])
      ).rows,
    ).toEqual([{ delivered_units: "100", due_units: "110" }]);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM resource_balances WHERE ordinary_units < 0 OR allowance_units < 0 OR locked_units < 0",
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await pool.query(
          `SELECT b.kingdom_id, b.resource FROM resource_balances b
       LEFT JOIN resource_movements m ON m.product_scope = b.product_scope
         AND m.kingdom_id = b.kingdom_id AND m.resource = b.resource
       GROUP BY b.kingdom_id, b.resource, b.ordinary_units, b.allowance_units, b.locked_units
       HAVING b.ordinary_units <> COALESCE(sum(m.ordinary_delta),0)
         OR b.allowance_units <> COALESCE(sum(m.allowance_delta),0)
         OR b.locked_units <> COALESCE(sum(m.locked_delta),0)`,
        )
      ).rows,
    ).toEqual([]);
    const after = await snapshot();
    expect((await recovered.world.advance(worker, token ?? "")).kind).toBe("not_due");
    expect(await snapshot()).toEqual(after);
  });
});
