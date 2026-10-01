import { randomUUID } from "node:crypto";
import {
  appendOutbox,
  createPool,
  createSchemaPool,
  createTestSchema,
  dropTestSchema,
  withTransaction,
} from "@pact/db";
import { wholeResources } from "@pact/domain";
import {
  ActionLimitService,
  GAME_DAY_MS,
  GAME_WEEK_MS,
  readSeasonOverview,
  SEASON_MS,
  SeasonService,
  SocialService,
  WorldViewService,
} from "@pact/kingdom";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRulesRuntime } from "../../workers/rules/src/runtime.js";

const connection = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool, pool: Pool, schema: string;
const runtime = () => createRulesRuntime(pool, "pact", Buffer.alloc(32, 7), (n) => Buffer.alloc(n, 3), 0);
beforeAll(async () => {
  admin = createPool(connection);
  schema = await createTestSchema(admin, "seasons");
  pool = createSchemaPool(connection, schema);
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});
async function player(at: number, ordinary = 0) {
  const accountId = randomUUID(),
    kingdomId = randomUUID();
  await withTransaction(pool, async (c) => {
    await c.query(
      "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture-only',clock_timestamp(),'terms-v1')",
      [accountId, `${accountId}@example.test`],
    );
    await c.query(
      `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Season fixture','portrait.wolf',clock_timestamp(),$4,0,$5,$6)`,
      [kingdomId, accountId, `season_${randomUUID().slice(0, 8)}`, at, at + 60000, randomUUID()],
    );
    await runtime().ledger.initializeKingdom(c, kingdomId, at);
    for (const kind of ["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"])
      await c.query("INSERT INTO kingdom_buildings VALUES('pact',$1,$2,1)", [kingdomId, kind]);
    await c.query("INSERT INTO kingdom_score_baselines(product_scope,kingdom_id,game_time_ms) VALUES('pact',$1,$2)", [
      kingdomId,
      at,
    ]);
    for (const [kind, capacity] of [
      ["raid", 3],
      ["scout", 4],
    ] as const)
      await c.query(
        "INSERT INTO kingdom_charges(product_scope,kingdom_id,kind,available,capacity,last_regenerated_game_time_ms) VALUES('pact',$1,$2,$3,$3,$4)",
        [kingdomId, kind, capacity, at],
      );
    for (let i = 0; i < ordinary; i++)
      await c.query(
        "INSERT INTO kingdom_troops(id,product_scope,owner_kingdom_id,host_kingdom_id,type,home_guard,placement,created_game_time_ms,created_at) VALUES($1,'pact',$2,$2,'spearman',false,'home',$3,clock_timestamp())",
        [randomUUID(), kingdomId, at],
      );
  });
  return { accountId, kingdomId };
}
async function credit(k: string, amount: number) {
  await withTransaction(pool, (c) =>
    runtime().ledger.creditOrdinary(c, {
      kingdomId: k,
      resource: "grain",
      amount: wholeResources(amount),
      operationKey: randomUUID(),
      reason: "fixture",
      gameTimeMs: 0,
    }),
  );
}
/** Acceleration is confined to this disposable schema. Never change live clocks this way. */
async function prepareTick(at: number) {
  await pool.query("UPDATE season_clock SET last_processed_game_time_ms=$1 WHERE product_scope='pact'", [at - 60000]);
  await pool.query(
    "UPDATE world_clocks SET committed_game_time_ms=$1,next_tick_due_at=clock_timestamp()-interval '1 second',last_heartbeat_at=clock_timestamp(),lease_holder=NULL,lease_token=NULL,lease_expires_at=NULL WHERE product_scope='pact'",
    [at - 60000],
  );
}
async function tick(at: number) {
  await prepareTick(at);
  const r = runtime(),
    token = await r.world.acquireLease("season-worker");
  expect(token).toBeTruthy();
  expect((await r.world.advance("season-worker", token ?? "")).kind).toBe("committed");
}
async function read() {
  return withTransaction(pool, (c) => runtime().seasons.readCurrent(c));
}

describe("authoritative season lifecycle", () => {
  it("accelerates six weeks, captures equal-age scores and atomically rolls over without erasing engagements", async () => {
    const owner = await player(0),
      target = await player(0);
    await runtime().world.bootstrap();
    await tick(60000);
    const rates = [100, 100, 90, 80, 80, 100];
    for (let week = 1; week <= 6; week++) {
      const at = week === 1 ? 120000 : (week - 1) * GAME_WEEK_MS;
      const before = await withTransaction(pool, (c) => runtime().ledger.readBalance(c, owner.kingdomId, "grain"));
      await tick(at);
      const after = await withTransaction(pool, (c) => runtime().ledger.readBalance(c, owner.kingdomId, "grain"));
      expect(after.ordinary - before.ordinary).toBe((300n * BigInt(rates[week - 1] ?? 0)) / 100n);
      expect((await read()).current).toMatchObject({ week, harvestPercent: rates[week - 1] });
      // Other production is unaffected by the harvest schedule.
      const view = await new WorldViewService(pool, "pact").read(owner.accountId, owner.kingdomId);
      expect(view?.audience).toBe("owner");
      if (view?.audience === "owner") {
        expect(view.balances.grain.productionPerMinuteUnits).toBe(
          ((300n * BigInt(rates[week - 1] ?? 0)) / 100n).toString(),
        );
        expect(view.balances.iron.productionPerMinuteUnits).toBe("200");
        expect(view.balances.silver.productionPerMinuteUnits).toBe("100");
      }
    }
    const arrivals = await pool.query(
      "SELECT fortune_quarter_units,captured_game_time_ms FROM newcomer_snapshots WHERE kingdom_id=$1",
      [owner.kingdomId],
    );
    expect(arrivals.rows[0]?.captured_game_time_ms).toBe(GAME_WEEK_MS.toString());
    expect(arrivals.rows[0]?.fortune_quarter_units).not.toBeNull();
    const arrivalScore = arrivals.rows[0]?.fortune_quarter_units;
    await credit(owner.kingdomId, 100);
    expect(
      (await pool.query("SELECT fortune_quarter_units FROM newcomer_snapshots WHERE kingdom_id=$1", [owner.kingdomId]))
        .rows[0]?.fortune_quarter_units,
    ).toBe(arrivalScore);

    // A late arrival reaches exactly seven days at the season boundary; its original baseline stays zero.
    const attacker = await player(SEASON_MS - GAME_WEEK_MS, 8);
    await credit(attacker.kingdomId, 100);
    await tick(SEASON_MS - GAME_WEEK_MS + 60000);
    const raid = await withTransaction(pool, (c) =>
      runtime().raids.declare(c, {
        accountId: attacker.accountId,
        targetKingdomId: target.kingdomId,
        raidId: randomUUID(),
        units: [{ type: "spearman", count: 8 }],
        lootPriority: ["silver", "iron", "grain"],
        actorKind: "human",
        gameTimeMs: SEASON_MS - 10 * 60000 - 1,
      }),
    );
    const raidBefore = (await pool.query("SELECT to_jsonb(r) AS value FROM raids r WHERE id=$1", [raid.raidId])).rows;
    const terms = {
      aToB: { resource: "grain", wholePerHour: 1 },
      bToA: null,
      aBond: null,
      bBond: null,
      durationHours: 1,
      noticeHours: 0,
    };
    const offerId = randomUUID(),
      contractId = randomUUID();
    await pool.query(
      "INSERT INTO supply_offers(id,product_scope,kingdom_a,kingdom_b,version,terms,status,expires_game_time_ms,created_game_time_ms,updated_game_time_ms) VALUES($1,'pact',$2,$3,1,$4,'active',$5,$6,$6)",
      [offerId, owner.kingdomId, target.kingdomId, JSON.stringify(terms), SEASON_MS + 60000, SEASON_MS - 60000],
    );
    await pool.query(
      "INSERT INTO supply_contracts(id,product_scope,offer_id,offer_version,kingdom_a,kingdom_b,terms,start_game_time_ms,end_game_time_ms,status) VALUES($1,'pact',$2,1,$3,$4,$5,$6,$7,'active')",
      [
        contractId,
        offerId,
        owner.kingdomId,
        target.kingdomId,
        JSON.stringify(terms),
        SEASON_MS - 60000,
        SEASON_MS + 3600000,
      ],
    );
    const contractBefore = (
      await pool.query("SELECT to_jsonb(c) AS value FROM supply_contracts c WHERE id=$1", [contractId])
    ).rows;
    const troopIds = (await pool.query("SELECT id,placement FROM kingdom_troops ORDER BY id")).rows;
    const buildings = (await pool.query("SELECT * FROM kingdom_buildings ORDER BY kingdom_id,kind")).rows;
    const beforeWealth = await withTransaction(pool, (c) => runtime().fortune.wealth(c, owner.kingdomId));
    await prepareTick(SEASON_MS);
    await runtime().world.pause("fixture pause");
    expect(await runtime().world.acquireLease("season-worker")).toBeNull();
    expect((await read()).current).toMatchObject({ number: 1 });
    await runtime().world.resume();
    await prepareTick(SEASON_MS);
    const failing = runtime();
    const original = failing.handlers.production;
    if (!original) throw new Error("MISSING_PRODUCTION_HANDLER");
    failing.handlers.production = async (c, ctx) => {
      await original(c, ctx);
      throw new Error("AFTER_ROLLOVER_FAULT");
    };
    const token = await failing.world.acquireLease("season-worker");
    await expect(failing.world.advance("season-worker", token ?? "")).rejects.toThrow("AFTER_ROLLOVER_FAULT");
    expect((await pool.query("SELECT 1 FROM season_entries WHERE closed_game_time_ms IS NOT NULL")).rowCount).toBe(0);
    expect((await pool.query("SELECT to_jsonb(r) AS value FROM raids r WHERE id=$1", [raid.raidId])).rows).toEqual(
      raidBefore,
    );
    expect(
      (await pool.query("SELECT to_jsonb(c) AS value FROM supply_contracts c WHERE id=$1", [contractId])).rows,
    ).toEqual(contractBefore);
    const fresh = runtime();
    expect((await fresh.world.advance("season-worker", token ?? "")).kind).toBe("committed");
    expect((await fresh.world.advance("season-worker", token ?? "")).kind).toBe("not_due");
    const entry = (
      await pool.query("SELECT * FROM season_entries WHERE kingdom_id=$1 ORDER BY season_number", [owner.kingdomId])
    ).rows;
    expect(entry[0]?.closing_wealth_quarter_units).toBe(beforeWealth.totalQuarterUnits.toString());
    expect(entry[1]?.baseline_quarter_units).toBe(beforeWealth.totalQuarterUnits.toString());
    const finalWealth = await withTransaction(pool, (c) => fresh.fortune.wealth(c, owner.kingdomId));
    const view = await withTransaction(pool, (c) => fresh.seasons.readCurrent(c, undefined, attacker.accountId));
    expect(view.current).toMatchObject({ number: 2, week: 1, harvestPercent: 100 });
    expect(view.standings.find((p) => p.kingdomId === owner.kingdomId)?.fortuneQuarterUnits).toBe(
      (finalWealth.totalQuarterUnits - beforeWealth.totalQuarterUnits).toString(),
    );
    expect(view.cohorts.find((p) => p.kingdomId === attacker.kingdomId)).toMatchObject({
      status: "captured",
      dueGameTimeMs: SEASON_MS,
    });
    expect(
      (
        await pool.query("SELECT activation_baseline_quarter_units FROM newcomer_snapshots WHERE kingdom_id=$1", [
          attacker.kingdomId,
        ])
      ).rows[0]?.activation_baseline_quarter_units,
    ).toBe("0");
    expect((await pool.query("SELECT id,placement FROM kingdom_troops ORDER BY id")).rows).toEqual(troopIds);
    expect((await pool.query("SELECT * FROM kingdom_buildings ORDER BY kingdom_id,kind")).rows).toEqual(buildings);
    expect((await pool.query("SELECT to_jsonb(r) AS value FROM raids r WHERE id=$1", [raid.raidId])).rows).toEqual(
      raidBefore,
    );
    expect(
      (await pool.query("SELECT to_jsonb(c) AS value FROM supply_contracts c WHERE id=$1", [contractId])).rows,
    ).toEqual(contractBefore);
    expect((await pool.query("SELECT * FROM supply_installments WHERE contract_id=$1", [contractId])).rowCount).toBe(1);
    expect((await withTransaction(pool, (c) => fresh.honors.read(c, owner.accountId))).ownMeaningfulDays).toBe(1);
    expect((await withTransaction(pool, (c) => fresh.honors.read(c, target.accountId))).ownMeaningfulDays).toBe(1);
    expect(view.standings[0]).not.toHaveProperty("wealthQuarterUnits");
    expect(view.standings[0]).not.toHaveProperty("baselineQuarterUnits");
    await expect(
      withTransaction(pool, (c) =>
        new SeasonService("pact", 60000).beforeTick(c, {
          productScope: "pact",
          sequence: 999n,
          gameTimeMs: SEASON_MS + 60000,
          dueAt: new Date(),
        }),
      ),
    ).rejects.toThrow("SEASON_CONFIGURATION_CHANGED");
  });
  it("exports only the owner and prunes closed history in real time, preserving active baselines", async () => {
    const account = (await pool.query("SELECT account_id FROM kingdoms LIMIT 1")).rows[0].account_id as string;
    const service = new SeasonService("pact");
    const exported = await withTransaction(pool, (c) => service.exportAccount(c, account));
    expect(exported.seasons.length).toBeGreaterThan(0);
    await pool.query(
      "UPDATE season_entries SET closed_at=clock_timestamp()-interval '181 days' WHERE closed_at IS NOT NULL",
    );
    expect(await withTransaction(pool, (c) => service.prune(c, new Date()))).toBeGreaterThan(0);
    expect((await pool.query("SELECT 1 FROM season_entries WHERE season_number=2")).rowCount).toBeGreaterThan(0);
    await withTransaction(pool, (c) => service.forgetAccount(c, account));
    expect((await withTransaction(pool, (c) => service.exportAccount(c, account))).seasons).toHaveLength(0);
  });
  it("counts actual meaningful actions, issues neutral cosmetics once and never finalizes competitive honors", async () => {
    const a = await player(SEASON_MS),
      b = await player(SEASON_MS + GAME_DAY_MS),
      idle = await player(SEASON_MS);
    await credit(a.kingdomId, 100);
    const [low, high] = [a.kingdomId, b.kingdomId].sort();
    await pool.query(
      "INSERT INTO social_contacts(product_scope,kingdom_a,kingdom_b,accepted_game_time_ms) VALUES('pact',$1,$2,$3)",
      [low, high, SEASON_MS],
    );
    const social = new SocialService("pact", runtime().ledger, new ActionLimitService("pact"), {
      now: () => new Date(),
    });
    for (const day of [1, 1, 2, 3]) {
      await withTransaction(pool, (c) =>
        social.transfer(c, {
          accountId: a.accountId,
          recipientKingdomId: b.kingdomId,
          resource: "grain",
          wholeAmount: 1,
          actorKind: "human",
          operationKey: randomUUID(),
          gameTimeMs: SEASON_MS + day * GAME_DAY_MS,
        }),
      );
    }
    // Login, prose and training events do not count; forged completion without a durable record does not count.
    for (const type of ["session.started.v1", "message.sent.v1", "training.unit.completed.v1", "building.completed.v1"])
      await withTransaction(pool, (c) =>
        appendOutbox(c, {
          productScope: "pact",
          eventId: randomUUID(),
          type,
          payload: {
            kingdomId: idle.kingdomId,
            instructionId: randomUUID(),
            batchId: randomUUID(),
            gameTimeMs: SEASON_MS + GAME_DAY_MS,
          },
        }),
      );
    await tick(SEASON_MS + GAME_WEEK_MS);
    const first = (
      await pool.query("SELECT fortune_quarter_units FROM newcomer_snapshots WHERE kingdom_id=$1", [a.kingdomId])
    ).rows[0]?.fortune_quarter_units;
    const beforeNext = await withTransaction(pool, (c) => readSeasonOverview(c, "pact", undefined, b.accountId));
    expect(beforeNext.cohorts.find((r) => r.kingdomId === b.kingdomId)?.status).toBe("pending");
    await tick(SEASON_MS + GAME_WEEK_MS + GAME_DAY_MS);
    expect(
      (await pool.query("SELECT fortune_quarter_units FROM newcomer_snapshots WHERE kingdom_id=$1", [a.kingdomId]))
        .rows[0]?.fortune_quarter_units,
    ).toBe(first);
    const captured = await withTransaction(pool, (c) => readSeasonOverview(c, "pact", undefined, b.accountId));
    expect(captured.cohorts.find((r) => r.kingdomId === b.kingdomId)?.status).toBe("captured");
    expect(captured.honors.ownCosmetics).toContain("medal.arrival");
    expect(captured.honors.ownMeaningfulDays).toBe(3);
    expect((await withTransaction(pool, (c) => runtime().honors.read(c, idle.accountId))).ownMeaningfulDays).toBe(0);
    await pool.query("UPDATE season_entries SET highest_hall=6 WHERE kingdom_id=$1 AND season_number=2", [a.kingdomId]);
    expect(
      (
        await withTransaction(pool, (c) => runtime().fortune.provisional(c, SEASON_MS + GAME_WEEK_MS + GAME_DAY_MS))
      ).find((r) => r.kingdomId === a.kingdomId)?.band,
    ).toBe("V-VI");
    await tick(2 * SEASON_MS);
    const result = await withTransaction(pool, (c) => readSeasonOverview(c, "pact", undefined, a.accountId));
    expect(result.honors).toMatchObject({ seasonNumber: 2, competitiveStatus: "provisional", finalized: false });
    expect(result.honors.results.find((r) => r.kingdomId === a.kingdomId)).toMatchObject({
      eligible: true,
      meaningfulDays: 3,
      band: "V-VI",
      provisionalBorder: null,
      provisionalPlaque: true,
    });
    expect(result.honors.results.find((r) => r.kingdomId === idle.kingdomId)).toMatchObject({
      eligible: false,
      provisionalPlaque: false,
    });
    expect(result.honors.ownCosmetics).toEqual(["banner.season.2", "medal.arrival"]);
    const assets = (
      await pool.query("SELECT to_jsonb(b) AS value FROM resource_balances b ORDER BY kingdom_id,resource")
    ).rows;
    const troops = (await pool.query("SELECT to_jsonb(t) AS value FROM kingdom_troops t ORDER BY id")).rows;
    const score = (await pool.query("SELECT * FROM kingdom_score_baselines ORDER BY kingdom_id")).rows;
    const cosmetics = (await pool.query("SELECT * FROM cosmetic_entitlements ORDER BY account_id,item_id")).rows;
    await withTransaction(pool, async (c) => {
      await runtime().honors.processActivity(c, 2 * SEASON_MS);
      await runtime().honors.closeSeasons(c);
      await runtime().honors.arrivals(c);
    });
    expect((await pool.query("SELECT * FROM cosmetic_entitlements ORDER BY account_id,item_id")).rows).toEqual(
      cosmetics,
    );
    expect(
      (await pool.query("SELECT to_jsonb(b) AS value FROM resource_balances b ORDER BY kingdom_id,resource")).rows,
    ).toEqual(assets);
    expect((await pool.query("SELECT to_jsonb(t) AS value FROM kingdom_troops t ORDER BY id")).rows).toEqual(troops);
    expect((await pool.query("SELECT * FROM kingdom_score_baselines ORDER BY kingdom_id")).rows).toEqual(score);
    expect(
      (
        await pool.query(
          "SELECT item_id FROM cosmetic_entitlements WHERE item_id LIKE 'border.%' OR item_id LIKE 'plaque.%'",
        )
      ).rowCount,
    ).toBe(0);
    expect((await withTransaction(pool, (c) => runtime().honors.exportAccount(c, a.accountId))).results).toHaveLength(
      1,
    );
    await withTransaction(pool, (c) => runtime().honors.forgetAccount(c, a.accountId));
    expect((await withTransaction(pool, (c) => runtime().honors.exportAccount(c, a.accountId))).results).toHaveLength(
      0,
    );
    await pool.query("UPDATE season_honor_results SET recorded_at=clock_timestamp()-interval '181 days'");
    await pool.query("UPDATE season_meaningful_days SET recorded_at=clock_timestamp()-interval '181 days'");
    await withTransaction(pool, (c) => runtime().honors.prune(c, new Date()));
    expect((await pool.query("SELECT 1 FROM season_honor_results")).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM season_meaningful_days WHERE season_number=2")).rowCount).toBe(0);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM cosmetic_entitlements WHERE account_id=$1 AND item_id IN ('banner.season.2','medal.arrival')",
          [b.accountId],
        )
      ).rowCount,
    ).toBe(2);
  });
});
