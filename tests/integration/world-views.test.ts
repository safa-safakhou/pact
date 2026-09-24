import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { WorldViewService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
const scope = "pact";

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "views");
  pool = createSchemaPool(connectionString, schema);
  await new WorldClockService(pool, scope).bootstrap();
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
       VALUES ($1, 'pact', $2, 'fixture-only', clock_timestamp(), 'terms-v1')`,
      [accountId, `${accountId}@example.test`],
    );
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
        activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1, 'pact', $2, $3, 'View Fixture', 'portrait.wolf', clock_timestamp(), 0, 0, 60000, $4)`,
      [kingdomId, accountId, `view_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await new ResourceLedger(scope).initializeKingdom(client, kingdomId, 0);
    await client.query(
      "INSERT INTO kingdom_buildings(product_scope, kingdom_id, kind, level) VALUES ('pact', $1, 'hall', 2)",
      [kingdomId],
    );
    await client.query("INSERT INTO kingdom_builder_slots(product_scope, kingdom_id, slot) VALUES ('pact', $1, 1)", [
      kingdomId,
    ]);
  });
  return { accountId, kingdomId };
}

describe("authorized world views", () => {
  it("returns only a public profile for arbitrary IDs, then distinct contact and participant records", async () => {
    const a = await kingdom();
    const b = await kingdom();
    const service = new WorldViewService(pool, scope);
    expect(await service.read(null, randomUUID())).toBeNull();
    const publicView = await service.read(null, a.kingdomId);
    expect(publicView?.audience).toBe("public");
    expect(JSON.stringify(publicView)).not.toMatch(/ordinaryUnits|buildings|terms|model|accountId|commitment/);
    const unknown = await service.read(b.accountId, a.kingdomId);
    expect(unknown?.audience).toBe("public");
    await pool.query(
      "INSERT INTO social_contacts(product_scope, kingdom_a, kingdom_b, accepted_game_time_ms) VALUES ('pact', LEAST($1::uuid,$2::uuid), GREATEST($1::uuid,$2::uuid), 0)",
      [a.kingdomId, b.kingdomId],
    );
    expect((await service.read(b.accountId, a.kingdomId))?.audience).toBe("contact");
    await pool.query(
      `INSERT INTO supply_contracts(id, product_scope, offer_id, offer_version, kingdom_a, kingdom_b,
        terms, start_game_time_ms, end_game_time_ms, status)
       VALUES ($1, 'pact', $2, 1, $3, $4, $5, 0, 3600000, 'active')`,
      [
        randomUUID(),
        await offer(a.kingdomId, b.kingdomId),
        a.kingdomId,
        b.kingdomId,
        JSON.stringify({
          aToB: { resource: "iron", wholePerHour: 1 },
          bToA: null,
          aBond: null,
          bBond: null,
          durationHours: 1,
          noticeHours: 0,
        }),
      ],
    );
    const participant = await service.read(b.accountId, a.kingdomId);
    expect(participant?.audience).toBe("participant");
    expect(JSON.stringify(participant)).not.toMatch(/ordinaryUnits|buildings|terms|model|accountId|commitment/);
  });

  it("owner reads exact committed state and a bounded conditional forecast", async () => {
    const owner = await kingdom();
    const view = await new WorldViewService(pool, scope).read(owner.accountId, owner.kingdomId, 1);
    expect(view?.audience).toBe("owner");
    if (view?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(view.balances.iron.foundingAllowanceUnits).not.toBe("0");
    expect(view.buildings).toContainEqual({ kind: "hall", level: 2 });
    expect(view.forecast.harvestPercentByMinute).toHaveLength(1);
    expect(view.forecast.assumption).toMatch(/Scenario only/);
    expect(view.committedTickSequence).toBe("0");
    expect(view.lastCommittedEventId).toBe("0");
    await expect(new WorldViewService(pool, scope).read(owner.accountId, owner.kingdomId, 61)).rejects.toThrow(
      "INVALID_FORECAST_HORIZON",
    );
  });

  it("recomputes from committed default and casualty state, including assumed harvest changes", async () => {
    const owner = await kingdom();
    const other = await kingdom();
    const now = (await new WorldClockService(pool, scope).read()).gameTimeMs;
    const offerId = await offer(owner.kingdomId, other.kingdomId);
    const contractId = randomUUID();
    await pool.query(
      `INSERT INTO supply_contracts(id, product_scope, offer_id, offer_version, kingdom_a, kingdom_b,
        terms, start_game_time_ms, end_game_time_ms, status)
       VALUES ($1, 'pact', $2, 1, $3, $4, $5, $6, $7, 'active')`,
      [
        contractId,
        offerId,
        owner.kingdomId,
        other.kingdomId,
        JSON.stringify({
          aToB: { resource: "iron", wholePerHour: 6 },
          bToA: null,
          aBond: null,
          bBond: null,
          durationHours: 1,
          noticeHours: 0,
        }),
        now,
        now + 3_600_000,
      ],
    );
    const firstTroop = randomUUID();
    const secondTroop = randomUUID();
    for (const id of [firstTroop, secondTroop]) {
      await pool.query(
        `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
          type, home_guard, placement, created_game_time_ms, created_at)
         VALUES ($1, 'pact', $2, $2, 'spearman', false, 'home', $3, clock_timestamp())`,
        [id, owner.kingdomId, now],
      );
    }
    const service = new WorldViewService(pool, scope, (at) => (at > now + 60_000 ? 80 : 100));
    const before = await service.read(owner.accountId, owner.kingdomId, 2);
    expect(before?.audience).toBe("owner");
    if (before?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(before.forecast.harvestPercentByMinute).toEqual([100, 80]);
    expect(before.forecast.assumedDeliveries[0]?.units).toBe("120");
    expect(before.upkeep.perMinuteUnits).toBe("20");
    await pool.query("UPDATE supply_contracts SET status = 'defaulted', closed_game_time_ms = $2 WHERE id = $1", [
      contractId,
      now,
    ]);
    await pool.query("DELETE FROM kingdom_troops WHERE id = $1", [secondTroop]);
    const after = await service.read(owner.accountId, owner.kingdomId, 2);
    expect(after?.audience).toBe("owner");
    if (after?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(after.forecast.assumedDeliveries).toEqual([]);
    expect(after.forecast.expected.iron.ordinaryUnits).not.toBe(before.forecast.expected.iron.ordinaryUnits);
    expect(after.upkeep.perMinuteUnits).toBe("10");
    expect(after.troops.reduce((sum, troop) => sum + troop.count, 0)).toBe(1);
    const publicView = await service.read(null, owner.kingdomId);
    expect(publicView?.audience).toBe("public");
    if (publicView?.audience !== "public") throw new Error("PUBLIC_VIEW_MISSING");
    expect(publicView.publicEvents).toContainEqual({
      kind: "default",
      id: contractId,
      gameTimeMs: now,
      parties: [owner.kingdomId, other.kingdomId],
      outcome: "defaulted",
    });
  });
});

async function offer(a: string, b: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO supply_offers(id, product_scope, kingdom_a, kingdom_b, version, terms, status,
      expires_game_time_ms, created_game_time_ms, updated_game_time_ms)
     VALUES ($1, 'pact', $2, $3, 1, '{}', 'active', 3600000, 0, 0)`,
    [id, a, b],
  );
  return id;
}
