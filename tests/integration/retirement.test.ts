import { randomUUID } from "node:crypto";
import { ExposureService } from "@pact/authority";
import {
  appendOutbox,
  createPool,
  createSchemaPool,
  createTestSchema,
  dropTestSchema,
  withTransaction,
} from "@pact/db";
import {
  ActionLimitService,
  BuildingEngine,
  ConstructionExposureAdapter,
  GarrisonService,
  ImmediateExposureAdapter,
  KingdomRetirementService,
  RaidRandomnessService,
  RaidService,
  SocialService,
  SupplyExposureAdapter,
  SupplyService,
  SupplySettlementService,
  TroopService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { PrivacyService } from "@pact/privacy";
import { WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
let privacy: PrivacyService;
let retirement: KingdomRetirementService;
let world: WorldClockService;
let garrison: GarrisonService;
let social: SocialService;
let raids: RaidService;
const baseTime = new Date("2026-09-24T10:00:00.000Z");
let now = new Date(baseTime);

beforeAll(async () => {
  admin = createPool(databaseUrl);
  schema = await createTestSchema(admin, "retirement");
  pool = createSchemaPool(databaseUrl, schema);
  world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  const ledger = new ResourceLedger("pact");
  const exposure = new ExposureService("pact");
  const limits = new ActionLimitService("pact");
  social = new SocialService("pact", ledger, limits, { now: () => now }, new ImmediateExposureAdapter(exposure));
  const troops = new TroopService("pact", ledger, new ImmediateExposureAdapter(exposure));
  const authority = new SupplyExposureAdapter(exposure);
  garrison = new GarrisonService("pact", ledger, troops, exposure);
  raids = new RaidService(
    "pact",
    ledger,
    troops,
    limits,
    exposure,
    new RaidRandomnessService("pact", Buffer.alloc(32, 7), (size) => Buffer.alloc(size, 3)),
    garrison,
  );
  retirement = new KingdomRetirementService(
    "pact",
    world,
    ledger,
    new SupplyService("pact", ledger, limits, social, authority),
    new SupplySettlementService("pact", ledger, { read: async () => 0n }, authority),
    garrison,
    new BuildingEngine("pact", ledger, new ConstructionExposureAdapter("pact", exposure, ledger)),
    troops,
  );
  privacy = new PrivacyService(pool, { productScope: "pact", clock: { now: () => now }, retirement });
});

beforeEach(() => {
  now = new Date(baseTime);
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
      `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at)
       VALUES ($1, 'pact', $2, 'synthetic-hash', $3)`,
      [accountId, `${accountId}@example.test`, now],
    );
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1, 'pact', $2, $3, 'Private name', 'portrait.wolf', $4, 0, 0, 60000, $5)`,
      [kingdomId, accountId, `ret_${accountId.slice(0, 8)}`, now, randomUUID()],
    );
    await new ResourceLedger("pact").initializeKingdom(client, kingdomId, 0);
    await new ResourceLedger("pact").creditOrdinary(client, {
      kingdomId,
      resource: "iron",
      amount: 100n,
      operationKey: `fixture:${kingdomId}`,
      reason: "synthetic-test",
      gameTimeMs: 0,
    });
  });
  return { accountId, kingdomId };
}

it("keeps accepted raids through real-time erasure in a paused world, then retires both owners exactly once", async () => {
  const attacker = await kingdom();
  const defender = await kingdom();
  const profileEventId = randomUUID();
  await withTransaction(pool, (client) =>
    appendOutbox(client, {
      productScope: "pact",
      eventId: profileEventId,
      type: "kingdom.activated.v1",
      payload: { kingdomId: attacker.kingdomId, handle: "private_handle" },
    }),
  );
  const raidId = randomUUID();
  await pool.query(
    `INSERT INTO raids(id, product_scope, leader_kingdom_id, target_kingdom_id, rules_version,
       declared_game_time_ms, lock_game_time_ms, resolution_game_time_ms, status, loot_priority,
       declaration_terms)
     VALUES ($1, 'pact', $2, $3, 'pact-s1-v1', 0, 60000, 120000, 'declared',
       ARRAY['iron','silver','grain'], '{"selection":[],"nominees":[]}'::jsonb)`,
    [raidId, attacker.kingdomId, defender.kingdomId],
  );
  const messageId = randomUUID();
  await pool.query(
    `INSERT INTO direct_messages(id, product_scope, sender_kingdom_id, recipient_kingdom_id,
       body, agent_originated, operation_key, sent_game_time_ms)
     VALUES ($1, 'pact', $2, $3, 'private fixture prose', false, $4, 0)`,
    [messageId, attacker.kingdomId, defender.kingdomId, `message:${messageId}`],
  );
  await world.pause();
  await privacy.requestDeletion(attacker.accountId);
  await privacy.requestDeletion(defender.accountId);
  expect(await withTransaction(pool, (client) => retirement.retireDue(client, 0))).toBe(0);
  const closing = await pool.query<{ status: string; display_name: string }>(
    "SELECT status, display_name FROM kingdoms WHERE id IN ($1, $2)",
    [attacker.kingdomId, defender.kingdomId],
  );
  expect(closing.rows).toHaveLength(2);
  expect(closing.rows.every((row) => row.status === "closing" && row.display_name === "Retired kingdom")).toBe(true);

  now = new Date(now.getTime() + 30 * 86_400_000);
  await privacy.replayDeletionRegistry();
  expect(
    (await pool.query("SELECT 1 FROM accounts WHERE id IN ($1, $2)", [attacker.accountId, defender.accountId]))
      .rowCount,
  ).toBe(0);
  expect((await pool.query("SELECT status FROM raids WHERE id = $1", [raidId])).rows[0]?.status).toBe("declared");
  expect(
    (await pool.query("SELECT payload->>'handle' AS handle FROM outbox_events WHERE event_id = $1", [profileEventId]))
      .rows[0]?.handle,
  ).toMatch(/^retired_/);
  expect((await pool.query("SELECT body FROM direct_messages WHERE id = $1", [messageId])).rows[0]?.body).toBe(
    "[deleted]",
  );
  expect(
    (await pool.query("SELECT account_id FROM kingdoms WHERE id = $1", [attacker.kingdomId])).rows[0]?.account_id,
  ).toBeNull();
  expect(await withTransaction(pool, (client) => retirement.retireDue(client, 0))).toBe(0);

  // Stand in for the normal frozen-game raid resolver after the world resumes.
  await pool.query(
    "UPDATE raids SET status = 'resolved', resolved_game_time_ms = 120000, closed_at = clock_timestamp() WHERE id = $1",
    [raidId],
  );
  expect(await withTransaction(pool, (client) => retirement.retireDue(client, 120000))).toBe(2);
  expect(await withTransaction(pool, (client) => retirement.retireDue(client, 120000))).toBe(0);
  expect((await pool.query("SELECT status FROM kingdoms WHERE id = $1", [defender.kingdomId])).rows[0]?.status).toBe(
    "retired",
  );
  const balance = await pool.query<{ ordinary_units: string; production_per_minute_units: string }>(
    "SELECT ordinary_units, production_per_minute_units FROM resource_balances WHERE kingdom_id = $1 AND resource = 'iron'",
    [attacker.kingdomId],
  );
  expect(balance.rows[0]).toMatchObject({ ordinary_units: "0", production_per_minute_units: "0" });
  now = new Date(baseTime.getTime() + 181 * 86_400_000);
  const retention = await privacy.runRetention();
  expect(retention.retiredMovements).toBeGreaterThan(0);
  expect(retention.retiredKingdoms).toBe(2);
  expect(
    (await pool.query("SELECT 1 FROM kingdoms WHERE id IN ($1, $2)", [attacker.kingdomId, defender.kingdomId]))
      .rowCount,
  ).toBe(0);
});

it("defaults a supply contract at closure without gifting the closing owner's stock", async () => {
  const owner = await kingdom();
  const counterparty = await kingdom();
  const offerId = randomUUID();
  const contractId = randomUUID();
  await pool.query(
    `INSERT INTO supply_offers(id, product_scope, kingdom_a, kingdom_b, version, terms, status,
       expires_game_time_ms, created_game_time_ms, updated_game_time_ms)
     VALUES ($1, 'pact', $2, $3, 1, '{}'::jsonb, 'active', 300000, 0, 0)`,
    [offerId, owner.kingdomId, counterparty.kingdomId],
  );
  await pool.query(
    `INSERT INTO supply_contracts(id, product_scope, offer_id, offer_version, kingdom_a, kingdom_b,
       terms, start_game_time_ms, end_game_time_ms, status)
     VALUES ($1, 'pact', $2, 1, $3, $4, '{}'::jsonb, 0, 300000, 'active')`,
    [contractId, offerId, owner.kingdomId, counterparty.kingdomId],
  );
  const before = await pool.query<{ ordinary_units: string }>(
    "SELECT ordinary_units FROM resource_balances WHERE kingdom_id = $1 AND resource = 'iron'",
    [counterparty.kingdomId],
  );
  await privacy.requestDeletion(owner.accountId);
  const gameTimeMs = (await world.read()).gameTimeMs;
  await expect(
    withTransaction(pool, (client) =>
      social.transfer(client, {
        accountId: counterparty.accountId,
        recipientKingdomId: owner.kingdomId,
        resource: "iron",
        wholeAmount: 1,
        operationKey: randomUUID(),
        gameTimeMs,
      }),
    ),
  ).rejects.toThrow("KINGDOM_NOT_FOUND");
  const contract = await pool.query<{ status: string; close_reason: string }>(
    "SELECT status, close_reason FROM supply_contracts WHERE id = $1",
    [contractId],
  );
  expect(contract.rows[0]).toMatchObject({ status: "defaulted", close_reason: "owner_retirement" });
  const after = await pool.query<{ ordinary_units: string }>(
    "SELECT ordinary_units FROM resource_balances WHERE kingdom_id = $1 AND resource = 'iron'",
    [counterparty.kingdomId],
  );
  expect(after.rows[0]?.ordinary_units).toBe(before.rows[0]?.ordinary_units);
});

it("waits for locked visiting troops, then returns them before retirement", async () => {
  const lender = await kingdom();
  const host = await kingdom();
  const gameTimeMs = (await world.read()).gameTimeMs;
  const offerId = randomUUID();
  const contractId = randomUUID();
  const troopId = randomUUID();
  const battleId = randomUUID();
  const terms = JSON.stringify({
    units: [{ type: "spearman", count: 1 }],
    durationHours: 1,
    lenderBond: null,
    hostBond: null,
  });
  await pool.query(
    `INSERT INTO garrison_offers(id, product_scope, lender_kingdom_id, host_kingdom_id,
       terms, status, expires_game_time_ms, created_game_time_ms)
     VALUES ($1, 'pact', $2, $3, $4::jsonb, 'active', $5, $5)`,
    [offerId, lender.kingdomId, host.kingdomId, terms, gameTimeMs],
  );
  await pool.query(
    `INSERT INTO garrison_contracts(id, product_scope, offer_id, lender_kingdom_id, host_kingdom_id,
       terms, status, start_game_time_ms, end_game_time_ms)
     VALUES ($1, 'pact', $2, $3, $4, $5::jsonb, 'active', $6, $7)`,
    [contractId, offerId, lender.kingdomId, host.kingdomId, terms, gameTimeMs, gameTimeMs + 3_600_000],
  );
  await pool.query(
    `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
       type, placement, placement_ref, created_game_time_ms, created_at)
     VALUES ($1, 'pact', $2, $3, 'spearman', 'visiting', $4, $5, clock_timestamp())`,
    [troopId, lender.kingdomId, host.kingdomId, contractId, gameTimeMs],
  );
  await pool.query(
    `INSERT INTO battle_eligibility_snapshots(product_scope, battle_id, host_kingdom_id,
       raid_id, locked_until_game_time_ms) VALUES ('pact', $1, $2, $3, $4)`,
    [battleId, host.kingdomId, randomUUID(), gameTimeMs + 120_000],
  );
  await pool.query(
    `INSERT INTO battle_unit_eligibility(product_scope, battle_id, troop_id, side,
       host_kingdom_id, locked_until_game_time_ms)
     VALUES ('pact', $1, $2, 'defender', $3, $4)`,
    [battleId, troopId, host.kingdomId, gameTimeMs + 120_000],
  );

  await privacy.requestDeletion(lender.accountId);
  expect((await pool.query("SELECT status FROM garrison_contracts WHERE id = $1", [contractId])).rows[0]?.status).toBe(
    "exit_pending",
  );
  await withTransaction(pool, (client) => retirement.retireDue(client, gameTimeMs));
  expect((await pool.query("SELECT status FROM kingdoms WHERE id = $1", [lender.kingdomId])).rows[0]?.status).toBe(
    "closing",
  );
  now = new Date(now.getTime() + 30 * 86_400_000);
  await privacy.replayDeletionRegistry();
  expect((await pool.query("SELECT 1 FROM accounts WHERE id = $1", [lender.accountId])).rowCount).toBe(0);
  await withTransaction(pool, (client) => garrison.settleMinute(client, gameTimeMs + 120_000));
  expect((await pool.query("SELECT status FROM garrison_contracts WHERE id = $1", [contractId])).rows[0]?.status).toBe(
    "closed",
  );
  await withTransaction(pool, (client) => retirement.retireDue(client, gameTimeMs + 120_000));
  expect((await pool.query("SELECT status FROM kingdoms WHERE id = $1", [lender.kingdomId])).rows[0]?.status).toBe(
    "retired",
  );
  expect((await pool.query("SELECT 1 FROM kingdom_troops WHERE id = $1", [troopId])).rowCount).toBe(0);
});

it("resolves an accepted enemy raid after deletion instead of canceling it", async () => {
  await world.resume();
  const attacker = await kingdom();
  const defender = await kingdom();
  const gameTimeMs = (await world.read()).gameTimeMs;
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO kingdom_charges(product_scope, kingdom_id, kind, available, capacity,
         last_regenerated_game_time_ms) VALUES ('pact', $1, 'raid', 3, 3, $2)`,
      [attacker.kingdomId, gameTimeMs],
    );
    await client.query(
      `INSERT INTO kingdom_buildings(product_scope, kingdom_id, kind, level)
       VALUES ('pact', $1, 'wall', 1)`,
      [defender.kingdomId],
    );
    await new ResourceLedger("pact").creditOrdinary(client, {
      kingdomId: attacker.kingdomId,
      resource: "grain",
      amount: 120_000n,
      operationKey: `raid-grain:${attacker.kingdomId}`,
      reason: "synthetic-test",
      gameTimeMs,
    });
    for (let index = 0; index < 8; index += 1) {
      await client.query(
        `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
           type, placement, created_game_time_ms, created_at)
         VALUES ($1, 'pact', $2, $2, 'spearman', 'home', $3, clock_timestamp())`,
        [randomUUID(), attacker.kingdomId, gameTimeMs],
      );
    }
  });
  const raidId = randomUUID();
  const declared = await withTransaction(pool, (client) =>
    raids.declare(client, {
      accountId: attacker.accountId,
      targetKingdomId: defender.kingdomId,
      raidId,
      units: [{ type: "spearman", count: 8 }],
      actorKind: "human",
      gameTimeMs,
    }),
  );
  await world.pause();
  await privacy.requestDeletion(attacker.accountId);
  await privacy.requestDeletion(defender.accountId);
  now = new Date(now.getTime() + 30 * 86_400_000);
  await privacy.replayDeletionRegistry();
  expect((await pool.query("SELECT 1 FROM accounts WHERE id = $1", [defender.accountId])).rowCount).toBe(0);
  expect((await pool.query("SELECT status FROM raids WHERE id = $1", [raidId])).rows[0]?.status).toBe("declared");
  await world.resume();
  expect(await withTransaction(pool, (client) => raids.lockDue(client, declared.lockGameTimeMs))).toBe(1);
  expect(await withTransaction(pool, (client) => raids.resolveDue(client, declared.resolutionGameTimeMs))).toBe(1);
  expect((await pool.query("SELECT status FROM raids WHERE id = $1", [raidId])).rows[0]?.status).toBe("resolved");
  await withTransaction(pool, (client) => retirement.retireDue(client, declared.resolutionGameTimeMs));
  expect((await pool.query("SELECT status FROM kingdoms WHERE id = $1", [defender.kingdomId])).rows[0]?.status).toBe(
    "retired",
  );
});
