import { randomUUID } from "node:crypto";
import { ExposureService } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import {
  ActionLimitService,
  GarrisonService,
  RaidRandomnessService,
  RaidService,
  ScoutService,
  TroopService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { type TickHandlers, WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GameReportReader } from "../../services/api/src/game-report-reader.js";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
const ledger = new ResourceLedger("pact");
const exposure = new ExposureService("pact");
const troops = new TroopService("pact", ledger);
const random = new RaidRandomnessService("pact", Buffer.alloc(32, 7), (size) => Buffer.alloc(size, 3));
const garrison = new GarrisonService("pact", ledger, troops, exposure);
const raids = new RaidService("pact", ledger, troops, new ActionLimitService("pact"), exposure, random, garrison);

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "raids");
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
       VALUES ($1,'pact',$2,$3,'Raid Fixture','portrait.wolf',clock_timestamp(),0,0,60000,$4)`,
      [kingdomId, accountId, `raid_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
    await client.query(
      `INSERT INTO kingdom_charges(product_scope, kingdom_id, kind, available, capacity, last_regenerated_game_time_ms)
       VALUES ('pact',$1,'raid',3,3,0)`,
      [kingdomId],
    );
    for (const kind of ["wall", "barracks"])
      await client.query(
        "INSERT INTO kingdom_buildings(product_scope, kingdom_id, kind, level) VALUES ('pact',$1,$2,1)",
        [kingdomId, kind],
      );
    for (const [resource, amount] of [
      ["grain", 200],
      ["silver", 200],
      ["iron", 100],
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

async function units(kingdomId: string, count: number, homeGuard = false): Promise<string[]> {
  const ids = Array.from({ length: count }, () => randomUUID());
  for (const id of ids)
    await pool.query(
      `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
       type, home_guard, placement, created_game_time_ms, created_at)
     VALUES ($1,'pact',$2,$2,'spearman',$3,'home',0,clock_timestamp())`,
      [id, kingdomId, homeGuard],
    );
  return ids;
}

function declaration(accountId: string, targetKingdomId: string, raidId = randomUUID(), gameTimeMs = 61_000) {
  return {
    accountId,
    targetKingdomId,
    raidId,
    units: [{ type: "spearman" as const, count: 8 }],
    lootPriority: ["silver", "iron", "grain"] as const,
    actorKind: "human" as const,
    gameTimeMs,
  };
}

describe("raid lifecycle", () => {
  it("commits one charge/provision spend, reveals cancellation, and rejects lock-time withdrawal", async () => {
    const leader = await kingdom();
    const target = await kingdom();
    await units(leader.kingdomId, 8, true);
    const input = declaration(leader.accountId, target.kingdomId);
    await expect(withTransaction(pool, (client) => raids.declare(client, input))).rejects.toThrow("UNITS_UNAVAILABLE");
    await expect(
      withTransaction(pool, (client) => raids.declare(client, { ...input, targetKingdomId: leader.kingdomId })),
    ).rejects.toThrow("INVALID_TARGET");
    await units(leader.kingdomId, 8);
    const started = await withTransaction(pool, (client) => raids.declare(client, input));
    expect(started.lockGameTimeMs).toBe(1_020_000);
    expect(started.resolutionGameTimeMs).toBe(1_320_000);
    expect(await withTransaction(pool, (client) => raids.declare(client, input))).toEqual(started);
    await expect(
      withTransaction(pool, (client) => raids.declare(client, { ...input, raidId: randomUUID() })),
    ).rejects.toThrow("ATTACK_ALREADY_ACTIVE");
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM kingdom_charge_spends WHERE kingdom_id = $1 AND kind = 'raid'",
          [leader.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(1);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM kingdom_troops WHERE owner_kingdom_id = $1 AND placement = 'attacking'",
          [leader.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(8);
    await expect(
      withTransaction(pool, (client) =>
        raids.withdraw(client, {
          accountId: leader.accountId,
          raidId: input.raidId,
          gameTimeMs: started.lockGameTimeMs,
        }),
      ),
    ).rejects.toThrow("RAID_LOCKED");
    await withTransaction(pool, (client) =>
      raids.withdraw(client, {
        accountId: leader.accountId,
        raidId: input.raidId,
        gameTimeMs: started.lockGameTimeMs - 1,
      }),
    );
    await withTransaction(pool, (client) =>
      raids.withdraw(client, {
        accountId: leader.accountId,
        raidId: input.raidId,
        gameTimeMs: started.lockGameTimeMs - 1,
      }),
    );
    expect((await withTransaction(pool, (client) => random.publicEvidence(client, input.raidId))).status).toBe(
      "canceled",
    );
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM kingdom_troops WHERE owner_kingdom_id = $1 AND placement = 'attacking'",
          [leader.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(0);
  });

  it("resolves same-deadline raids in declaration order without resurrecting earlier casualties", async () => {
    const first = await kingdom();
    const second = await kingdom();
    const target = await kingdom();
    const stranger = await kingdom();
    await units(first.kingdomId, 8);
    await units(second.kingdomId, 8);
    await units(target.kingdomId, 12, true);
    const firstRaid = declaration(first.accountId, target.kingdomId, randomUUID(), 61_000);
    const secondRaid = declaration(second.accountId, target.kingdomId, randomUUID(), 62_000);
    await withTransaction(pool, (client) => raids.declare(client, firstRaid));
    await withTransaction(pool, (client) => raids.declare(client, secondRaid));
    expect(await withTransaction(pool, (client) => raids.lockDue(client, 1_019_999))).toBe(0);
    expect(await withTransaction(pool, (client) => raids.lockDue(client, 1_020_000))).toBe(2);
    const overlap = await pool.query(
      `SELECT count(*)::int AS count FROM battle_unit_eligibility
       WHERE side = 'defender' AND battle_id IN ($1,$2)`,
      [firstRaid.raidId, secondRaid.raidId],
    );
    expect(overlap.rows[0]?.count).toBe(24);
    expect(await withTransaction(pool, (client) => raids.resolveDue(client, 1_319_999))).toBe(0);
    expect(await withTransaction(pool, (client) => raids.resolveDue(client, 1_320_000))).toBe(2);
    const firstReport = await withTransaction(pool, (client) =>
      raids.readParticipantReport(client, target.accountId, firstRaid.raidId),
    );
    const secondReport = await withTransaction(pool, (client) =>
      raids.readParticipantReport(client, target.accountId, secondRaid.raidId),
    );
    const firstDefenders = (
      (firstReport.trace as Record<string, unknown>).casualtyGroups as Array<Record<string, unknown>>
    ).find((group) => group.ownerId === target.kingdomId && group.side === "defender");
    const secondDefenders = (
      (secondReport.trace as Record<string, unknown>).casualtyGroups as Array<Record<string, unknown>>
    ).find((group) => group.ownerId === target.kingdomId && group.side === "defender");
    expect(Number(secondDefenders?.participating)).toBeLessThan(Number(firstDefenders?.participating));
    const firstLosses = new Set(firstDefenders?.lostUnitIds as string[]);
    expect((secondReport.eligibleUnitIds as string[]).some((id) => firstLosses.has(id))).toBe(false);
    expect(await withTransaction(pool, (client) => raids.resolveDue(client, 1_320_000))).toBe(0);
    const publicReport = await withTransaction(pool, (client) => raids.readPublicReport(client, firstRaid.raidId));
    const reader = new GameReportReader(
      pool,
      new ScoutService("pact", ledger, troops, new ActionLimitService("pact"), exposure),
      raids,
    );
    expect(await reader.read(target.accountId, "raid_participant", firstRaid.raidId)).toEqual(firstReport);
    expect(await reader.read(stranger.accountId, "raid_participant", firstRaid.raidId)).toBeNull();
    expect(await reader.read(stranger.accountId, "raid_public", firstRaid.raidId)).toEqual(publicReport);
    expect(JSON.stringify(publicReport)).not.toContain("eligibleUnitIds");
    expect(JSON.stringify(publicReport)).not.toContain("lootTaken");
    await expect(
      withTransaction(pool, (client) => raids.readParticipantReport(client, stranger.accountId, firstRaid.raidId)),
    ).rejects.toThrow("REPORT_NOT_FOUND");
  });

  it("samples a same-minute scout after battle and rolls back both on a tick fault", async () => {
    const attacker = await kingdom();
    const defender = await kingdom();
    const observer = await kingdom();
    await units(attacker.kingdomId, 8);
    await units(defender.kingdomId, 11, true);
    await units(observer.kingdomId, 2);
    await pool.query(
      `INSERT INTO kingdom_charges(product_scope, kingdom_id, kind, available, capacity,
         last_regenerated_game_time_ms) VALUES ('pact',$1,'scout',4,4,0)`,
      [observer.kingdomId],
    );
    const raid = declaration(attacker.accountId, defender.kingdomId);
    const operationId = randomUUID();
    const scouts = new ScoutService("pact", ledger, troops, new ActionLimitService("pact"), exposure);
    await withTransaction(pool, (client) => raids.declare(client, raid));
    expect(
      await withTransaction(pool, (client) =>
        scouts.start(client, {
          accountId: observer.accountId,
          operationId,
          operationKey: `scout:${operationId}`,
          targetKingdomId: defender.kingdomId,
          actorKind: "human",
          gameTimeMs: 661_000,
        }),
      ),
    ).toEqual({ operationId, dueGameTimeMs: 1_320_000 });
    expect(await withTransaction(pool, (client) => raids.lockDue(client, 1_020_000))).toBe(1);

    const handlers: TickHandlers = {
      battle_and_scouts: async (client, context) => {
        await raids.resolveDue(client, context.gameTimeMs);
        throw new Error("FAULT_AFTER_BATTLE");
      },
    };
    const clock = new WorldClockService(pool, "pact", handlers);
    await clock.bootstrap();
    const token = await clock.acquireLease("battle-scout-worker");
    expect(token).toBeTruthy();
    await pool.query(
      `UPDATE world_clocks SET committed_game_time_ms = 1260000,
         next_tick_due_at = clock_timestamp() - interval '1 second',
         last_heartbeat_at = clock_timestamp(), lease_expires_at = clock_timestamp() + interval '30 seconds'
       WHERE product_scope = 'pact'`,
    );
    await expect(clock.advance("battle-scout-worker", token ?? "")).rejects.toThrow("FAULT_AFTER_BATTLE");
    expect((await pool.query("SELECT 1 FROM world_ticks WHERE product_scope = 'pact'")).rowCount).toBe(0);
    expect(
      (await pool.query("SELECT participant_report FROM raids WHERE id = $1", [raid.raidId])).rows[0]
        ?.participant_report,
    ).toBeNull();
    expect(
      (await pool.query("SELECT report FROM scout_operations WHERE id = $1", [operationId])).rows[0]?.report,
    ).toBeNull();
    expect(
      (
        await pool.query("SELECT count(*)::int AS count FROM kingdom_troops WHERE host_kingdom_id = $1", [
          defender.kingdomId,
        ])
      ).rows[0]?.count,
    ).toBe(11);

    handlers.battle_and_scouts = async (client, context) => {
      await raids.resolveDue(client, context.gameTimeMs);
      await scouts.finishDue(client, context.gameTimeMs);
    };
    const recovered = new WorldClockService(pool, "pact", handlers);
    expect((await recovered.advance("battle-scout-worker", token ?? "")).kind).toBe("committed");
    const surviving =
      (
        await pool.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM kingdom_troops
         WHERE host_kingdom_id = $1 AND placement = 'home'`,
          [defender.kingdomId],
        )
      ).rows[0]?.count ?? 0;
    expect(surviving).toBeLessThan(11);
    const report = await withTransaction(pool, (client) => scouts.readReport(client, observer.accountId, operationId));
    expect(report.homeTroops.spearman).toBe(surviving === 0 ? "0" : "1-10");
    expect(report.observedGameTimeMs).toBe(1_320_000);
    expect((await recovered.advance("battle-scout-worker", token ?? "")).kind).toBe("not_due");
    expect(
      (await pool.query("SELECT participant_report FROM raids WHERE id = $1", [raid.raidId])).rows[0]
        ?.participant_report,
    ).not.toBeNull();
    expect((await pool.query("SELECT 1 FROM world_ticks WHERE product_scope = 'pact'")).rowCount).toBe(1);
  });

  it("rolls back an overlapping resolution and commits each battle once on retry", async () => {
    const first = await kingdom();
    const second = await kingdom();
    const target = await kingdom();
    await units(first.kingdomId, 8);
    await units(second.kingdomId, 8);
    await units(target.kingdomId, 12, true);
    const firstRaid = declaration(first.accountId, target.kingdomId, randomUUID(), 61_000);
    const secondRaid = declaration(second.accountId, target.kingdomId, randomUUID(), 62_000);
    await withTransaction(pool, (client) => raids.declare(client, firstRaid));
    await withTransaction(pool, (client) => raids.declare(client, secondRaid));
    expect(await withTransaction(pool, (client) => raids.lockDue(client, 1_020_000))).toBe(2);

    const raidIds = [firstRaid.raidId, secondRaid.raidId];
    const kingdomIds = [first.kingdomId, second.kingdomId, target.kingdomId];
    const troopSnapshot = () =>
      pool.query(
        `SELECT id, owner_kingdom_id, host_kingdom_id, placement, placement_ref
         FROM kingdom_troops WHERE owner_kingdom_id = ANY($1::uuid[]) ORDER BY id`,
        [kingdomIds],
      );
    const balanceSnapshot = () =>
      pool.query(
        `SELECT kingdom_id, resource, ordinary_units, locked_units
         FROM resource_balances WHERE kingdom_id = ANY($1::uuid[]) ORDER BY kingdom_id, resource`,
        [kingdomIds],
      );
    const beforeTroops = (await troopSnapshot()).rows;
    const beforeBalances = (await balanceSnapshot()).rows;
    await expect(
      withTransaction(pool, async (client) => {
        expect(await raids.resolveDue(client, 1_320_000)).toBe(2);
        throw new Error("INJECTED_RAID_RESOLUTION_DEATH");
      }),
    ).rejects.toThrow("INJECTED_RAID_RESOLUTION_DEATH");
    expect((await troopSnapshot()).rows).toEqual(beforeTroops);
    expect((await balanceSnapshot()).rows).toEqual(beforeBalances);
    expect(
      (await pool.query("SELECT status FROM raids WHERE id = ANY($1::uuid[]) ORDER BY id", [raidIds])).rows,
    ).toEqual([{ status: "locked" }, { status: "locked" }]);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM outbox_events WHERE type = 'raid.resolved.v1' AND payload->>'raidId' = ANY($1::text[])",
          [raidIds],
        )
      ).rows[0]?.count,
    ).toBe(0);

    expect(await withTransaction(pool, (client) => raids.resolveDue(client, 1_320_000))).toBe(2);
    const committedTroops = (await troopSnapshot()).rows;
    const committedBalances = (await balanceSnapshot()).rows;
    const reports = (
      await pool.query("SELECT id, status, participant_report FROM raids WHERE id = ANY($1::uuid[]) ORDER BY id", [
        raidIds,
      ])
    ).rows;
    expect(reports).toHaveLength(2);
    expect(reports.every((report) => report.status === "resolved" && report.participant_report)).toBe(true);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM outbox_events WHERE type = 'raid.resolved.v1' AND payload->>'raidId' = ANY($1::text[])",
          [raidIds],
        )
      ).rows[0]?.count,
    ).toBe(2);
    expect(await withTransaction(pool, (client) => raids.resolveDue(client, 1_320_000))).toBe(0);
    expect((await troopSnapshot()).rows).toEqual(committedTroops);
    expect((await balanceSnapshot()).rows).toEqual(committedBalances);
  });

  it("accepts one nominated contributor and pins visitors/wall while hunger is sampled at resolution", async () => {
    const leader = await kingdom();
    const contributor = await kingdom();
    const lateContributor = await kingdom();
    const target = await kingdom();
    const visitorOwner = await kingdom();
    await units(leader.kingdomId, 8);
    await units(contributor.kingdomId, 8);
    await units(lateContributor.kingdomId, 8);
    const targetHomeIds = await units(target.kingdomId, 8, true);
    const visitorId = (await units(visitorOwner.kingdomId, 1))[0] as string;
    await pool.query(
      "UPDATE kingdom_troops SET host_kingdom_id = $2, placement = 'visiting', placement_ref = $3 WHERE id = $1",
      [visitorId, target.kingdomId, randomUUID()],
    );
    const input = {
      ...declaration(leader.accountId, target.kingdomId),
      nominees: [contributor.kingdomId, lateContributor.kingdomId],
    };
    await withTransaction(pool, (client) => raids.declare(client, input));
    const accepted = {
      accountId: contributor.accountId,
      raidId: input.raidId,
      units: [{ type: "spearman" as const, count: 8 }],
      actorKind: "human" as const,
      gameTimeMs: 62_000,
    };
    await withTransaction(pool, (client) => raids.accept(client, accepted));
    await withTransaction(pool, (client) => raids.accept(client, accepted));
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM kingdom_charge_spends WHERE kingdom_id = $1 AND kind = 'raid'",
          [contributor.kingdomId],
        )
      ).rows[0]?.count,
    ).toBe(1);
    const boundaryUnitId = randomUUID();
    await withTransaction(pool, async (client) => {
      await client.query("UPDATE kingdom_buildings SET level = 2 WHERE kingdom_id = $1 AND kind = 'wall'", [
        target.kingdomId,
      ]);
      await client.query(
        `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
           type, home_guard, placement, created_game_time_ms, created_at)
         VALUES ($1,'pact',$2,$2,'spearman',false,'home',1_020_000,clock_timestamp())`,
        [boundaryUnitId, target.kingdomId],
      );
      await raids.lockDue(client, 1_020_000);
    });
    await expect(
      withTransaction(pool, (client) =>
        raids.accept(client, {
          accountId: lateContributor.accountId,
          raidId: input.raidId,
          units: [{ type: "spearman", count: 8 }],
          actorKind: "human",
          gameTimeMs: 1_020_000,
        }),
      ),
    ).rejects.toThrow("RAID_LOCKED");
    expect(
      (
        await pool.query("SELECT side FROM battle_unit_eligibility WHERE battle_id = $1 AND troop_id = $2", [
          input.raidId,
          visitorId,
        ])
      ).rows[0]?.side,
    ).toBe("defender");
    const visitorRef = (await pool.query("SELECT placement_ref FROM kingdom_troops WHERE id = $1", [visitorId])).rows[0]
      ?.placement_ref as string;
    await expect(
      withTransaction(pool, (client) =>
        troops.returnPlacement(client, {
          ownerKingdomId: visitorOwner.kingdomId,
          placement: "visiting",
          referenceId: visitorRef,
          gameTimeMs: 1_020_001,
        }),
      ),
    ).rejects.toThrow("UNIT_LOCKED");
    await expect(
      withTransaction(pool, (client) =>
        raids.withdraw(client, {
          accountId: contributor.accountId,
          raidId: input.raidId,
          gameTimeMs: 1_020_000,
        }),
      ),
    ).rejects.toThrow("RAID_LOCKED");
    await pool.query("UPDATE kingdom_buildings SET level = 3 WHERE kingdom_id = $1 AND kind = 'wall'", [
      target.kingdomId,
    ]);
    const lateUnitId = (await units(target.kingdomId, 1))[0] as string;
    await pool.query("DELETE FROM kingdom_troops WHERE id = $1", [targetHomeIds[0]]);
    await pool.query(
      "INSERT INTO kingdom_upkeep_state(product_scope, payer_kingdom_id, hungry, last_game_time_ms) VALUES ('pact',$1,true,1_319_000)",
      [target.kingdomId],
    );
    await withTransaction(pool, (client) => raids.resolveDue(client, 1_320_000));
    const report = await withTransaction(pool, (client) =>
      raids.readParticipantReport(client, contributor.accountId, input.raidId),
    );
    expect(report.lockedWallLevel).toBe(2);
    const trace = report.trace as Record<string, unknown>;
    expect(trace.wallBeforeSuppression).toEqual({ numerator: "40", denominator: "1" });
    expect(report.eligibleUnitIds as string[]).toContain(visitorId);
    expect(report.eligibleUnitIds as string[]).toContain(boundaryUnitId);
    expect(report.eligibleUnitIds as string[]).not.toContain(lateUnitId);
    expect(report.eligibleUnitIds as string[]).not.toContain(targetHomeIds[0]);
    expect(report.hungryPayerKingdomIds).toContain(target.kingdomId);
  });

  it("moves ordinary loot to the leader once and leaves restricted or locked stock untouched", async () => {
    const leader = await kingdom();
    const target = await kingdom();
    await units(leader.kingdomId, 20);
    const input = {
      ...declaration(leader.accountId, target.kingdomId),
      units: [{ type: "spearman" as const, count: 20 }],
    };
    const targetBefore = await withTransaction(pool, (client) =>
      ledger.readBalance(client, target.kingdomId, "silver"),
    );
    const leaderBefore = await withTransaction(pool, (client) =>
      ledger.readBalance(client, leader.kingdomId, "silver"),
    );
    await withTransaction(pool, (client) => raids.declare(client, input));
    await withTransaction(pool, (client) => raids.lockDue(client, 1_020_000));
    await withTransaction(pool, (client) => raids.resolveDue(client, 1_320_000));
    const report = await withTransaction(pool, (client) =>
      raids.readParticipantReport(client, leader.accountId, input.raidId),
    );
    const trace = report.trace as Record<string, unknown>;
    expect(trace.winner).toBe("attacker");
    expect((trace.lootTaken as Record<string, string>).silver).toBe(String(wholeResources(50)));
    const targetAfter = await withTransaction(pool, (client) => ledger.readBalance(client, target.kingdomId, "silver"));
    const leaderAfter = await withTransaction(pool, (client) => ledger.readBalance(client, leader.kingdomId, "silver"));
    expect(targetBefore.ordinary - targetAfter.ordinary).toBe(wholeResources(50));
    expect(leaderAfter.ordinary - leaderBefore.ordinary).toBe(wholeResources(50));
    expect(await withTransaction(pool, (client) => raids.resolveDue(client, 1_320_000))).toBe(0);
    const leaderReplay = await withTransaction(pool, (client) =>
      ledger.readBalance(client, leader.kingdomId, "silver"),
    );
    expect(leaderReplay.ordinary).toBe(leaderAfter.ordinary);
  });

  it("keeps agent troop authority until resolution and rolls back an unauthorized declaration", async () => {
    const leader = await kingdom();
    const target = await kingdom();
    await units(leader.kingdomId, 8);
    const input = { ...declaration(leader.accountId, target.kingdomId), actorKind: "agent" as const };
    await expect(withTransaction(pool, (client) => raids.declare(client, input))).rejects.toThrow();
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM raids WHERE id = $1", [input.raidId])).rows[0]?.count,
    ).toBe(0);
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM raid_seed_commitments WHERE raid_id = $1", [input.raidId]))
        .rows[0]?.count,
    ).toBe(0);
    await pool.query(
      `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions, resource_limits, troop_limit)
       VALUES ('pact',$1,ARRAY['raid.commit'],$2::jsonb,8)`,
      [leader.accountId, JSON.stringify({ grain: String(wholeResources(21)) })],
    );
    await withTransaction(pool, (client) => raids.declare(client, input));
    expect(
      (
        await pool.query("SELECT status, troop_count FROM authority_commitments WHERE account_id = $1", [
          leader.accountId,
        ])
      ).rows[0],
    ).toMatchObject({ status: "active", troop_count: 8 });
    await withTransaction(pool, (client) => raids.lockDue(client, 1_020_000));
    await withTransaction(pool, (client) => raids.resolveDue(client, 1_320_000));
    expect(
      (await pool.query("SELECT status FROM authority_commitments WHERE account_id = $1", [leader.accountId])).rows[0]
        ?.status,
    ).toBe("closed");
  });
});
