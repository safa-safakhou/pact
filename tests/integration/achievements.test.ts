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
import { AchievementService, CollectionService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
const scope = "pact";
const awards = new AchievementService(scope);
const ledger = new ResourceLedger(scope);

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "achievements");
  pool = createSchemaPool(connectionString, schema);
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function kingdom() {
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
       VALUES ($1,'pact',$2,$3,'Achievement Fixture','portrait.wolf',clock_timestamp(),0,0,60000,$4)`,
      [kingdomId, accountId, `award_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
  });
  return { accountId, kingdomId };
}

async function event(type: string, payload: Record<string, unknown>, id = randomUUID()) {
  await withTransaction(pool, (client) => appendOutbox(client, { productScope: scope, eventId: id, type, payload }));
  return id;
}
async function processEvents() {
  return withTransaction(pool, async (client) => {
    const count = await awards.processPending(client);
    await new CollectionService("pact").processPending(client, 604800000);
    return count;
  });
}
async function read(accountId: string) {
  return withTransaction(pool, (client) => awards.read(client, accountId));
}

describe("earned cosmetic achievements", () => {
  it("awards First Stone only once across event replay, with one ornament and one wallet credit", async () => {
    const owner = await kingdom();
    const instructionId = randomUUID();
    await pool.query(
      `INSERT INTO building_instructions(id, product_scope, kingdom_id, account_id, builder_slot,
         building_kind, target_level, actor_kind, authority_ref, state, queued_game_time_ms, settled_game_time_ms)
       VALUES ($1,'pact',$2,$3,1,'farm',2,'human','test','completed',0,60000)`,
      [instructionId, owner.kingdomId, owner.accountId],
    );
    await event("building.completed.v1", { instructionId, kingdomId: owner.kingdomId, gameTimeMs: 60_000 });
    expect(await processEvents()).toBe(1);
    expect(await processEvents()).toBe(0);
    await event("building.completed.v1", { instructionId, kingdomId: owner.kingdomId, gameTimeMs: 60_000 });
    expect(await processEvents()).toBe(1);
    expect(await read(owner.accountId)).toEqual({
      earnedGems: 25,
      achievements: ["first_stone"],
      ornaments: ["ornament.stone_marker"],
    });
    const gameplay = await pool.query(
      "SELECT ordinary_units FROM resource_balances WHERE kingdom_id = $1 AND resource = 'iron'",
      [owner.kingdomId],
    );
    expect(gameplay.rows[0]?.ordinary_units).toBe("0");
  });

  it("checks signed bidirectional delivery and six-hour natural completion for both parties", async () => {
    const a = await kingdom();
    const b = await kingdom();
    const offerId = randomUUID();
    const contractId = randomUUID();
    const terms = {
      aToB: { resource: "iron", wholePerHour: 1 },
      bToA: { resource: "silver", wholePerHour: 1 },
      aBond: null,
      bBond: null,
      durationHours: 6,
      noticeHours: 0,
    };
    await pool.query(
      `INSERT INTO supply_offers(id, product_scope, kingdom_a, kingdom_b, version, terms, status,
         expires_game_time_ms, created_game_time_ms, updated_game_time_ms)
       VALUES ($1,'pact',$2,$3,1,$4,'active',3600000,0,0)`,
      [offerId, a.kingdomId, b.kingdomId, JSON.stringify(terms)],
    );
    await pool.query(
      `INSERT INTO supply_contracts(id, product_scope, offer_id, offer_version, kingdom_a, kingdom_b,
         terms, start_game_time_ms, end_game_time_ms, status, close_reason, closed_game_time_ms)
       VALUES ($1,'pact',$2,1,$3,$4,$5,0,21600000,'expired','natural_expiry',21600000)`,
      [contractId, offerId, a.kingdomId, b.kingdomId, JSON.stringify(terms)],
    );
    for (const [payer, recipient, resource] of [
      [a.kingdomId, b.kingdomId, "iron"],
      [b.kingdomId, a.kingdomId, "silver"],
    ])
      await pool.query(
        `INSERT INTO supply_installments(product_scope, contract_id, game_time_ms, payer_kingdom_id,
         recipient_kingdom_id, resource, due_units, delivered_units)
       VALUES ('pact',$1,60000,$2,$3,$4,10,10)`,
        [contractId, payer, recipient, resource],
      );
    await event("supply.full_both_delivered.v1", { contractId, gameTimeMs: 60_000 });
    await event("supply.contract.closed.v1", { contractId, gameTimeMs: 21_600_000, reason: "natural_expiry" });
    expect(await processEvents()).toBe(2);
    expect((await read(a.accountId)).achievements).toEqual(["first_pact", "kept_the_table"]);
    expect((await read(b.accountId)).earnedGems).toBe(50);
  });

  it("uses battle evidence for defense, breach and later rebuilding; future Seal/week fixtures stay private", async () => {
    const visitor = await kingdom();
    const defender = await kingdom();
    const attacker = await kingdom();
    const raidId = randomUUID();
    const visitorUnit = randomUUID();
    const attackerUnit = randomUUID();
    const homeGuard = randomUUID();
    const report = {
      gameTimeMs: 120_000,
      targetKingdomId: defender.kingdomId,
      leaderKingdomId: attacker.kingdomId,
      eligibleUnits: [
        { id: visitorUnit, ownerId: visitor.kingdomId, side: "defender" },
        { id: homeGuard, ownerId: defender.kingdomId, side: "defender" },
        { id: attackerUnit, ownerId: attacker.kingdomId, side: "attacker" },
      ],
      eligibleOrdinaryUnitIds: [visitorUnit, attackerUnit],
      trace: {
        winner: "defender",
        casualtyGroups: [
          { ownerId: visitor.kingdomId, lostUnitIds: [visitorUnit] },
          { ownerId: defender.kingdomId, lostUnitIds: [homeGuard] },
        ],
      },
    };
    await insertRaid(raidId, attacker.kingdomId, defender.kingdomId, report);
    await event("raid.resolved.v1", { raidId, gameTimeMs: 120_000 });
    expect(await processEvents()).toBe(1);
    expect((await read(visitor.accountId)).achievements).toContain("answered_the_call");
    expect((await read(visitor.accountId)).achievements).toContain("took_the_field");
    expect((await read(attacker.accountId)).achievements).toContain("took_the_field");
    expect((await read(defender.accountId)).achievements).not.toContain("took_the_field");
    expect((await read(defender.accountId)).achievements).not.toContain("came_back");
    await trainingBatch(visitor);
    await event("training.unit.completed.v1", {
      batchId: trainingId,
      kingdomId: visitor.kingdomId,
      gameTimeMs: 180_000,
    });
    await processEvents();
    expect((await read(visitor.accountId)).achievements).toContain("came_back");
    const winningRaid = randomUUID();
    await insertRaid(winningRaid, attacker.kingdomId, defender.kingdomId, {
      ...report,
      gameTimeMs: 240_000,
      trace: { winner: "attacker", casualtyGroups: [] },
    });
    await event("raid.resolved.v1", { raidId: winningRaid, gameTimeMs: 240_000 });
    await processEvents();
    expect((await read(attacker.accountId)).achievements).toContain("breach");
    await event("seal.published.v1", { kingdomId: visitor.kingdomId, gameTimeMs: 300_000, valid: true });
    await pool.query(
      `INSERT INTO achievement_upkeep_checks(product_scope, kingdom_id, game_time_ms, fully_funded)
       SELECT 'pact', $1, minute * 60000, true FROM generate_series(0, 10079) AS minute`,
      [visitor.kingdomId],
    );
    await event("season.low_harvest_week.completed.v1", {
      kingdomId: visitor.kingdomId,
      week: 3,
      startGameTimeMs: 0,
      endGameTimeMs: 604_800_000,
    });
    await pool.query(
      `INSERT INTO achievement_upkeep_checks(product_scope, kingdom_id, game_time_ms, fully_funded)
       SELECT 'pact', $1, minute * 60000, minute <> 1 FROM generate_series(0, 10079) AS minute`,
      [defender.kingdomId],
    );
    await event("season.low_harvest_week.completed.v1", {
      kingdomId: defender.kingdomId,
      week: 3,
      startGameTimeMs: 0,
      endGameTimeMs: 604_800_000,
    });
    await processEvents();
    const future = await read(visitor.accountId);
    // The real signing-worker route is covered in seals.test; a claimed valid flag cannot award it.
    expect(future.achievements).not.toContain("own_your_words");
    expect(future.achievements).toContain("winter_stores");
    expect((await read(defender.accountId)).achievements).not.toContain("winter_stores");
  });
});

let trainingId = "";
async function trainingBatch(owner: { accountId: string; kingdomId: string }) {
  trainingId = randomUUID();
  await withTransaction(pool, async (client) => {
    for (const resource of ["iron", "silver"] as const)
      await ledger.creditOrdinary(client, {
        kingdomId: owner.kingdomId,
        resource,
        amount: wholeResources(30),
        operationKey: randomUUID(),
        reason: "fixture",
        gameTimeMs: 150_000,
      });
    const iron = await ledger.payCost(client, {
      kingdomId: owner.kingdomId,
      resource: "iron",
      kind: "training",
      amount: wholeResources(10),
      operationKey: randomUUID(),
      gameTimeMs: 150_000,
    });
    const silver = await ledger.payCost(client, {
      kingdomId: owner.kingdomId,
      resource: "silver",
      kind: "training",
      amount: wholeResources(4),
      operationKey: randomUUID(),
      gameTimeMs: 150_000,
    });
    await client.query(
      `INSERT INTO training_batches(id, product_scope, kingdom_id, account_id, troop_type, requested_count,
         completed_count, unit_minutes, status, queued_game_time_ms, next_unit_due_game_time_ms,
         settled_game_time_ms, iron_cost_id, silver_cost_id)
       VALUES ($1,'pact',$2,$3,'spearman',1,1,3,'completed',150000,180000,180000,$4,$5)`,
      [trainingId, owner.kingdomId, owner.accountId, iron.id, silver.id],
    );
  });
}

async function insertRaid(id: string, leader: string, target: string, report: Record<string, unknown>) {
  await pool.query(
    `INSERT INTO raids(id, product_scope, leader_kingdom_id, target_kingdom_id, rules_version,
       declared_game_time_ms, lock_game_time_ms, resolution_game_time_ms, status, loot_priority,
       declaration_terms, resolved_game_time_ms, participant_report)
     VALUES ($1,'pact',$2,$3,'pact-s1-v1',0,60000,120000,'resolved',ARRAY['silver','iron','grain'],'{}',$4,$5)`,
    [id, leader, target, report.gameTimeMs, JSON.stringify(report)],
  );
}
