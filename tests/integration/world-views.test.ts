import { randomUUID } from "node:crypto";
import type { CommandDispatcher } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { rulesCatalog } from "@pact/domain";
import type { IdentityService } from "@pact/identity";
import { ActionLimitService, TroopService, WorldViewService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { MCP_PROTOCOL_PRIMARY, McpTransport } from "@pact/mcp";
import { WorldClockService } from "@pact/world";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerWorldViewRoutes } from "../../services/api/src/world-view-routes.js";

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
  it("finds real players by exact handle with identical public HTTP and MCP views, never owner state", async () => {
    const owner = await kingdom();
    await pool.query("UPDATE kingdoms SET handle = 'player_alpha' WHERE id = $1", [owner.kingdomId]);
    const views = new WorldViewService(pool, scope);
    const expected = await views.publicProfile("PLAYER_ALPHA");
    expect(expected).toMatchObject({
      audience: "public",
      profile: { kingdomId: owner.kingdomId, handle: "player_alpha", displayName: "View Fixture" },
    });
    expect(Object.keys(expected ?? {}).sort()).toEqual([
      "asOfGameTimeMs",
      "audience",
      "committedTickSequence",
      "profile",
      "publicEvents",
      "worldStatus",
    ]);
    expect(JSON.stringify(expected)).not.toMatch(/balances|buildings|troops|contracts|accountId|online|sharedRecords/);
    expect(await views.publicProfile("player_alph")).toBeNull();
    expect(await views.publicProfile("player_alpha%'")).toBeNull();
    expect(await new WorldViewService(pool, "other-product").publicProfile("player_alpha")).toBeNull();

    const server = Fastify();
    registerWorldViewRoutes(server, {} as IdentityService, views);
    const mcp = new McpTransport({
      pool,
      productScope: scope,
      dispatcher: {} as CommandDispatcher,
      origin: "https://pact.example",
      clock: { now: () => new Date() },
      publicProfiles: { read: (handle) => views.publicProfile(handle) },
    });
    const principal = {
      accountId: owner.accountId,
      productScope: ProductScopeSchema.parse(scope),
      audience: "agent" as const,
      agentScopes: ["world:read" as const],
    };
    const initialized = await mcp.handlePost(principal, {
      method: "initialize",
      id: 1,
      params: { protocolVersion: MCP_PROTOCOL_PRIMARY },
    });
    const find = (args: unknown, caller = principal) =>
      mcp.handlePost(
        caller,
        {
          method: "tools/call",
          id: 2,
          params: { name: "pact_player_find_v1", arguments: args },
        },
        initialized.sessionId,
      );
    try {
      const listing = await mcp.handlePost(principal, { method: "tools/list", id: 3 }, initialized.sessionId);
      expect(JSON.stringify(listing.response)).toContain("pact_player_find_v1");
      const http = await server.inject({ method: "GET", url: "/v1/people/PLAYER_ALPHA?accountId=forged" });
      const result = await find({ handle: "PLAYER_ALPHA" });
      expect(http.statusCode).toBe(200);
      expect(http.headers["cache-control"]).toBe("no-store");
      expect((result.response.result as { structuredContent: unknown }).structuredContent).toEqual(http.json());
      expect(http.json()).toEqual({ found: true, kingdom: expected, untrustedContent: true });
      await expect(find({ handle: "player_alpha", accountId: owner.accountId })).rejects.toMatchObject({
        code: "INVALID_REQUEST",
      });
      await expect(find({ handle: "player_alpha", viewer: "owner" })).rejects.toMatchObject({
        code: "INVALID_REQUEST",
      });
      const writeOnly = { ...principal, agentScopes: ["game:act" as const] };
      await expect(
        mcp.handlePost(
          writeOnly,
          {
            method: "tools/call",
            id: 4,
            params: { name: "pact_player_find_v1", arguments: { handle: "player_alpha" } },
          },
          initialized.sessionId,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const absent = await find({ handle: "no_such_player" });
      expect((absent.response.result as { structuredContent: unknown }).structuredContent).toEqual({
        found: false,
        kingdom: null,
        untrustedContent: true,
      });
      expect((await server.inject({ method: "GET", url: "/v1/people/xx" })).statusCode).toBe(400);
      await pool.query("UPDATE kingdoms SET status = 'closing' WHERE id = $1", [owner.kingdomId]);
      expect(await views.publicProfile("player_alpha")).toBeNull();
      await pool.query("DELETE FROM accounts WHERE id = $1", [owner.accountId]);
      expect(await views.publicProfile("player_alpha")).toBeNull();
      expect((await server.inject({ method: "GET", url: "/v1/people/player_alpha" })).json()).toEqual({
        found: false,
        kingdom: null,
        untrustedContent: true,
      });
    } finally {
      await server.close();
    }
  });

  it("projects lazy-exact private charges without mutating stock, timers or charge rows", async () => {
    const owner = await kingdom();
    const outsider = await kingdom();
    const now = (await new WorldClockService(pool, scope).read()).gameTimeMs;
    await pool.query(
      `INSERT INTO kingdom_charges(product_scope, kingdom_id, kind, available, capacity, last_regenerated_game_time_ms)
       VALUES ('pact', $1, 'scout', 0, 4, $2), ('pact', $1, 'raid', 3, 3, $3)`,
      [owner.kingdomId, now - 6 * 3_600_000, now - 6 * 3_600_000],
    );
    const service = new WorldViewService(pool, scope);
    const before = (
      await pool.query("SELECT * FROM kingdom_charges WHERE kingdom_id = $1 ORDER BY kind", [owner.kingdomId])
    ).rows;
    const own = await service.read(owner.accountId, owner.kingdomId);
    if (own?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(own.charges).toEqual([
      {
        kind: "raid",
        available: 3,
        capacity: 3,
        regenerationHours: 8,
        nextRegenerationGameTimeMs: null,
        retryAtGameTimeMs: null,
      },
      {
        kind: "scout",
        available: 1,
        capacity: 4,
        regenerationHours: 6,
        nextRegenerationGameTimeMs: now + 6 * 3_600_000,
        retryAtGameTimeMs: null,
      },
    ]);
    await withTransaction(pool, async (client) => {
      await client.query("SET TRANSACTION READ ONLY");
      expect(await new ActionLimitService(scope).readCharges(client, owner.kingdomId, now)).toEqual(own.charges);
      const limits = new ActionLimitService(scope);
      expect(
        (await limits.readCharges(client, owner.kingdomId, now - 1)).find((item) => item.kind === "scout"),
      ).toMatchObject({ available: 0, nextRegenerationGameTimeMs: now, retryAtGameTimeMs: now });
      expect(
        (await limits.readCharges(client, owner.kingdomId, now + 18 * 3_600_000)).find((item) => item.kind === "scout"),
      ).toMatchObject({ available: 4, nextRegenerationGameTimeMs: null, retryAtGameTimeMs: null });
      expect(await new ActionLimitService("other-product").readCharges(client, owner.kingdomId, now)).toEqual([]);
    });
    expect(
      (await pool.query("SELECT * FROM kingdom_charges WHERE kingdom_id = $1 ORDER BY kind", [owner.kingdomId])).rows,
    ).toEqual(before);
    for (const viewer of [null, outsider.accountId]) {
      const other = await service.read(viewer, owner.kingdomId);
      expect(JSON.stringify(other)).not.toMatch(/charges|Regeneration|regenerationHours/);
    }
  });

  it("shows active training progress only to its owner and removes it after cancellation", async () => {
    const owner = await kingdom();
    const outsider = await kingdom();
    const now = (await new WorldClockService(pool, scope).read()).gameTimeMs;
    const ledger = new ResourceLedger(scope);
    const troops = new TroopService(scope, ledger);
    const batchId = randomUUID();
    const batch = await withTransaction(pool, async (client) => {
      await client.query(
        "INSERT INTO kingdom_buildings(product_scope, kingdom_id, kind, level) VALUES ('pact', $1, 'barracks', 1)",
        [owner.kingdomId],
      );
      for (const resource of ["iron", "silver"] as const) {
        await ledger.creditOrdinary(client, {
          kingdomId: owner.kingdomId,
          resource,
          amount: 100n * 600n,
          operationKey: `view-training:${resource}:${batchId}`,
          reason: "synthetic_training_stock",
          gameTimeMs: now,
        });
      }
      return troops.queueTraining(client, {
        ...owner,
        batchId,
        type: "spearman",
        count: 3,
        gameTimeMs: now,
      });
    });

    const service = new WorldViewService(pool, scope);
    const ownView = await service.read(owner.accountId, owner.kingdomId);
    expect(ownView?.audience).toBe("owner");
    if (ownView?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(ownView.training).toEqual([
      {
        batchId,
        type: "spearman",
        requestedCount: 3,
        completedCount: 0,
        nextUnitDueGameTimeMs: batch.nextUnitDueGameTimeMs,
        unitMinutes: rulesCatalog.units.spearman.trainingMinutes,
      },
    ]);
    for (const viewer of [null, outsider.accountId]) {
      const view = await service.read(viewer, owner.kingdomId);
      expect(view?.audience).toBe("public");
      expect(JSON.stringify(view)).not.toMatch(/training|batchId|nextUnitDueGameTimeMs/);
    }
    await withTransaction(pool, (client) => troops.cancelTraining(client, { ...owner, batchId, gameTimeMs: now }));
    const canceledView = await service.read(owner.accountId, owner.kingdomId);
    expect(canceledView?.audience).toBe("owner");
    if (canceledView?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(canceledView.training).toEqual([]);
  });

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
    const lastOutboxId = (
      await pool.query<{ id: string }>(
        "SELECT COALESCE(max(id), 0)::text AS id FROM outbox_events WHERE product_scope = $1",
        [scope],
      )
    ).rows[0]?.id;
    expect(view.lastCommittedEventId).toBe(lastOutboxId);
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

  it("separates defensive Home Guard from ordinary troops only in the owner projection", async () => {
    const owner = await kingdom();
    const outsider = await kingdom();
    for (const homeGuard of [true, false]) {
      await pool.query(
        `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
          type, home_guard, placement, created_game_time_ms, created_at)
         VALUES ($1, 'pact', $2, $2, 'spearman', $3, 'home', 0, clock_timestamp())`,
        [randomUUID(), owner.kingdomId, homeGuard],
      );
    }
    const service = new WorldViewService(pool, scope);
    const ownView = await service.read(owner.accountId, owner.kingdomId);
    expect(ownView?.audience).toBe("owner");
    if (ownView?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(ownView.troops).toEqual([
      {
        type: "spearman",
        placement: "home",
        ownerKingdomId: owner.kingdomId,
        hostKingdomId: owner.kingdomId,
        homeGuard: false,
        count: 1,
      },
      {
        type: "spearman",
        placement: "home",
        ownerKingdomId: owner.kingdomId,
        hostKingdomId: owner.kingdomId,
        homeGuard: true,
        count: 1,
      },
    ]);
    for (const viewer of [null, outsider.accountId]) {
      const view = await service.read(viewer, owner.kingdomId);
      expect(JSON.stringify(view)).not.toMatch(/homeGuard|troops/);
    }
  });

  it("lists only an owner's participating raids with side and game-time deadline", async () => {
    const owner = await kingdom();
    const other = await kingdom();
    const outsider = await kingdom();
    const attackingRaidId = randomUUID();
    const defendingRaidId = randomUUID();
    for (const [raidId, leaderId, targetId, status, declaredAt] of [
      [attackingRaidId, owner.kingdomId, other.kingdomId, "resolved", 0],
      [defendingRaidId, other.kingdomId, owner.kingdomId, "declared", 1],
    ]) {
      await pool.query(
        `INSERT INTO raids(id, product_scope, leader_kingdom_id, target_kingdom_id, rules_version,
          declared_game_time_ms, lock_game_time_ms, resolution_game_time_ms, status, loot_priority, declaration_terms)
         VALUES ($1, 'pact', $2, $3, 'pact-s1-v1', $5, 60000, 120000, $4, ARRAY['grain'], '{}'::jsonb)`,
        [raidId, leaderId, targetId, status, declaredAt],
      );
    }
    const service = new WorldViewService(pool, scope);
    const ownView = await service.read(owner.accountId, owner.kingdomId);
    expect(ownView?.audience).toBe("owner");
    if (ownView?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(ownView.raids).toEqual([
      {
        raidId: defendingRaidId,
        status: "declared",
        side: "defender",
        role: "defender",
        otherKingdomId: other.kingdomId,
        lockGameTimeMs: 60000,
        dueGameTimeMs: 120000,
      },
      {
        raidId: attackingRaidId,
        status: "resolved",
        side: "attacker",
        role: "leader",
        otherKingdomId: other.kingdomId,
        lockGameTimeMs: 60000,
        dueGameTimeMs: 120000,
      },
    ]);
    const unrelated = await service.read(outsider.accountId, outsider.kingdomId);
    expect(unrelated?.audience).toBe("owner");
    if (unrelated?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(unrelated.raids).toEqual([]);
    await pool.query(
      `INSERT INTO raid_contributions(product_scope, raid_id, kingdom_id, role, status,
        committed_game_time_ms, provision_units, selection)
       VALUES ('pact', $1, $2, 'contributor', 'committed', 0, 0, '[]'::jsonb)`,
      [attackingRaidId, outsider.kingdomId],
    );
    const contributed = await service.read(outsider.accountId, outsider.kingdomId);
    if (contributed?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(contributed.raids).toEqual([{ ...ownView.raids[1], role: "contributor" }]);
    await pool.query(
      "UPDATE raid_contributions SET status = 'withdrawn' WHERE product_scope = 'pact' AND raid_id = $1 AND kingdom_id = $2",
      [attackingRaidId, outsider.kingdomId],
    );
    const withdrawn = await service.read(outsider.accountId, outsider.kingdomId);
    if (withdrawn?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(withdrawn.raids).toEqual([]);
    const participantView = await service.read(other.accountId, owner.kingdomId);
    expect(participantView?.audience).toBe("participant");
    expect(JSON.stringify(participantView)).not.toMatch(/lockGameTimeMs|"role"/);
    const publicView = await service.read(null, owner.kingdomId);
    expect(JSON.stringify(publicView)).not.toMatch(/raids|dueGameTimeMs|lockGameTimeMs|"role"/);
  });

  it("lists recent scout operations only to the scouting kingdom", async () => {
    const scout = await kingdom();
    const target = await kingdom();
    const unrelated = await kingdom();
    const completedId = randomUUID();
    const activeId = randomUUID();
    await pool.query(
      `INSERT INTO scout_operations(id, product_scope, scout_kingdom_id, target_kingdom_id,
        operation_key, status, started_game_time_ms, due_game_time_ms)
       VALUES ($1, 'pact', $3, $4, 'completed', 'completed', 0, 600000),
              ($2, 'pact', $3, $4, 'active', 'active', 60000, 660000)`,
      [completedId, activeId, scout.kingdomId, target.kingdomId],
    );
    const service = new WorldViewService(pool, scope);
    const ownView = await service.read(scout.accountId, scout.kingdomId);
    expect(ownView?.audience).toBe("owner");
    if (ownView?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(ownView.scouts).toEqual([
      { operationId: activeId, status: "active", targetKingdomId: target.kingdomId, dueGameTimeMs: 660000 },
      { operationId: completedId, status: "completed", targetKingdomId: target.kingdomId, dueGameTimeMs: 600000 },
    ]);
    const otherView = await service.read(unrelated.accountId, unrelated.kingdomId);
    expect(otherView?.audience).toBe("owner");
    if (otherView?.audience !== "owner") throw new Error("OWNER_VIEW_MISSING");
    expect(otherView.scouts).toEqual([]);
    for (const viewer of [null, target.accountId, unrelated.accountId]) {
      const view = await service.read(viewer, scout.kingdomId);
      expect(JSON.stringify(view)).not.toContain(completedId);
      expect(JSON.stringify(view)).not.toContain(activeId);
    }
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
