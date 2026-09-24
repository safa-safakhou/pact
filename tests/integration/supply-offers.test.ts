import { randomUUID } from "node:crypto";
import { ExactHumanPermitService, ExposureService } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import {
  ActionLimitService,
  SocialService,
  SupplyExposureAdapter,
  SupplyService,
  SupplySettlementService,
  type SupplyTerms,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
let ledger: ResourceLedger;
let limits: ActionLimitService;
let social: SocialService;
let supply: SupplyService;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "supply_offers");
  pool = createSchemaPool(connectionString, schema);
  ledger = new ResourceLedger("pact");
  limits = new ActionLimitService("pact");
  social = new SocialService("pact", ledger, limits, { now: () => new Date("2026-09-23T00:00:00Z") });
  await pool.query("CREATE TABLE test_authority(ref text PRIMARY KEY, state text NOT NULL, exposure jsonb NOT NULL)");
  supply = new SupplyService("pact", ledger, limits, social, {
    reserve: async (client: PoolClient, input) => {
      const ref = randomUUID();
      await client.query("INSERT INTO test_authority(ref, state, exposure) VALUES ($1, 'reserved', $2::jsonb)", [
        ref,
        JSON.stringify(input.exposure, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
      ]);
      return ref;
    },
    release: async (client: PoolClient, ref: string) => {
      await client.query("UPDATE test_authority SET state = 'released' WHERE ref = $1", [ref]);
    },
    activate: async (client: PoolClient, ref: string) => {
      await client.query("UPDATE test_authority SET state = 'active' WHERE ref = $1", [ref]);
    },
  });
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
       VALUES ($1, 'pact', $2, $3, 'Supply Fixture', 'portrait.wolf', clock_timestamp(),
         0, 0, 60000, $4)`,
      [kingdomId, accountId, `supply_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
  });
  return { accountId, kingdomId };
}

async function credit(kingdomId: string, resource: "iron" | "silver" | "grain", whole: number): Promise<void> {
  await withTransaction(pool, (client) =>
    ledger.creditOrdinary(client, {
      kingdomId,
      resource,
      amount: wholeResources(whole),
      operationKey: `fixture:${randomUUID()}`,
      reason: "fixture",
      gameTimeMs: 0,
    }),
  );
}

const terms = (override: Partial<SupplyTerms> = {}): SupplyTerms => ({
  aToB: { resource: "silver", wholePerHour: 8 },
  bToA: null,
  aBond: { resource: "silver", wholeAmount: 2 },
  bBond: null,
  durationHours: 6,
  noticeHours: 1,
  ...override,
});

describe("versioned supply offers and activation", () => {
  it("invalidates old signatures on counter and atomically locks bonds on activation", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await credit(a.kingdomId, "silver", 10);
    const offerId = randomUUID();
    await withTransaction(pool, (client) =>
      supply.createOffer(client, {
        accountId: a.accountId,
        counterpartyKingdomId: b.kingdomId,
        offerId,
        terms: terms(),
        gameTimeMs: 60_000,
        operationKey: `create:${offerId}`,
      }),
    );
    expect(
      await withTransaction(pool, (client) =>
        supply.signOffer(client, {
          accountId: a.accountId,
          offerId,
          version: 1,
          actorKind: "agent",
          gameTimeMs: 120_000,
          operationKey: "sign-old",
        }),
      ),
    ).toMatchObject({ contractId: null });
    expect((await pool.query("SELECT state, exposure FROM test_authority")).rows).toEqual([
      { state: "reserved", exposure: { silver: "30000" } },
    ]);
    expect(
      await withTransaction(pool, (client) =>
        supply.counterOffer(client, {
          accountId: b.accountId,
          offerId,
          expectedVersion: 1,
          terms: terms({ noticeHours: 0 }),
          gameTimeMs: 180_000,
          operationKey: "counter",
        }),
      ),
    ).toBe(2);
    expect((await pool.query("SELECT state FROM test_authority")).rows).toEqual([{ state: "released" }]);
    await expect(
      withTransaction(pool, (client) =>
        supply.signOffer(client, {
          accountId: b.accountId,
          offerId,
          version: 1,
          actorKind: "human",
          gameTimeMs: 240_000,
          operationKey: "stale",
        }),
      ),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    await withTransaction(pool, (client) =>
      supply.signOffer(client, {
        accountId: a.accountId,
        offerId,
        version: 2,
        actorKind: "agent",
        gameTimeMs: 240_000,
        operationKey: "sign-new-a",
      }),
    );
    const second = await withTransaction(pool, (client) =>
      supply.signOffer(client, {
        accountId: b.accountId,
        offerId,
        version: 2,
        actorKind: "human",
        gameTimeMs: 300_000,
        operationKey: "sign-new-b",
      }),
    );
    expect(second.contractId).toBeTruthy();
    expect(
      await withTransaction(pool, (client) =>
        supply.signOffer(client, {
          accountId: b.accountId,
          offerId,
          version: 2,
          actorKind: "human",
          gameTimeMs: 300_000,
          operationKey: "sign-new-b",
        }),
      ),
    ).toEqual(second);
    const contract = await pool.query("SELECT * FROM supply_contracts WHERE id = $1", [second.contractId]);
    expect(contract.rows[0].start_game_time_ms).toBe("360000");
    expect(contract.rows[0].end_game_time_ms).toBe(String(360_000 + 6 * 3_600_000));
    expect((await withTransaction(pool, (client) => ledger.readBalance(client, a.kingdomId, "silver"))).locked).toBe(
      wholeResources(2),
    );
    expect((await pool.query("SELECT state FROM test_authority ORDER BY state")).rows).toEqual([
      { state: "active" },
      { state: "released" },
    ]);
  });

  it("rejects invalid terms and half-funded bonds without a partial contract", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await credit(a.kingdomId, "silver", 2);
    const offerId = randomUUID();
    const create = (t: SupplyTerms, id: string) =>
      withTransaction(pool, (client) =>
        supply.createOffer(client, {
          accountId: a.accountId,
          counterpartyKingdomId: b.kingdomId,
          offerId: id,
          terms: t,
          gameTimeMs: 60_000,
          operationKey: `create:${id}`,
        }),
      );
    await expect(create(terms({ aToB: null, aBond: null }), randomUUID())).rejects.toThrow("ZERO_SUPPLY_FLOWS");
    await expect(create(terms({ durationHours: 1, noticeHours: 6 }), randomUUID())).rejects.toThrow(
      "INVALID_SUPPLY_DURATION_OR_NOTICE",
    );
    await expect(
      create(
        terms({ bToA: { resource: "iron", wholePerHour: 8 }, bBond: { resource: "iron", wholeAmount: 2 } }),
        offerId,
      ),
    ).resolves.toBeTruthy();
    await withTransaction(pool, (client) =>
      supply.signOffer(client, {
        accountId: a.accountId,
        offerId,
        version: 1,
        actorKind: "human",
        gameTimeMs: 120_000,
        operationKey: "a",
      }),
    );
    await expect(
      withTransaction(pool, (client) =>
        supply.signOffer(client, {
          accountId: b.accountId,
          offerId,
          version: 1,
          actorKind: "human",
          gameTimeMs: 180_000,
          operationKey: "b",
        }),
      ),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    expect(
      (await pool.query("SELECT count(*)::integer AS count FROM supply_contracts WHERE offer_id = $1", [offerId]))
        .rows[0].count,
    ).toBe(0);
    expect(
      (
        await pool.query("SELECT count(*)::integer AS count FROM supply_offer_signatures WHERE offer_id = $1", [
          offerId,
        ])
      ).rows[0].count,
    ).toBe(1);
    expect((await withTransaction(pool, (client) => ledger.readBalance(client, a.kingdomId, "silver"))).locked).toBe(
      0n,
    );
  });

  it("deduplicates simultaneous final signatures and prevents new offers across a block", async () => {
    const a = await kingdom();
    const b = await kingdom();
    const offerId = randomUUID();
    await withTransaction(pool, (client) =>
      supply.createOffer(client, {
        accountId: a.accountId,
        counterpartyKingdomId: b.kingdomId,
        offerId,
        terms: terms({ aBond: null }),
        gameTimeMs: 60_000,
        operationKey: `create:${offerId}`,
      }),
    );
    await withTransaction(pool, (client) =>
      supply.signOffer(client, {
        accountId: a.accountId,
        offerId,
        version: 1,
        actorKind: "human",
        gameTimeMs: 120_000,
        operationKey: "a",
      }),
    );
    const second = () =>
      withTransaction(pool, (client) =>
        supply.signOffer(client, {
          accountId: b.accountId,
          offerId,
          version: 1,
          actorKind: "human",
          gameTimeMs: 180_000,
          operationKey: "b",
        }),
      );
    const results = await Promise.all([second(), second()]);
    expect(results[0].contractId).toBe(results[1].contractId);
    expect(
      (await pool.query("SELECT count(*)::integer AS count FROM supply_contracts WHERE offer_id = $1", [offerId]))
        .rows[0].count,
    ).toBe(1);
    await withTransaction(pool, (client) => social.setBlock(client, b.accountId, a.kingdomId, true, 240_000));
    await expect(
      withTransaction(pool, (client) =>
        supply.createOffer(client, {
          accountId: a.accountId,
          counterpartyKingdomId: b.kingdomId,
          offerId: randomUUID(),
          terms: terms({ aBond: null }),
          gameTimeMs: 300_000,
          operationKey: "blocked-offer",
        }),
      ),
    ).rejects.toMatchObject({ code: "BLOCKED" });
  });

  it("releases provisional authority on expiry and enforces aggregate bond capacity", async () => {
    const a = await kingdom();
    const b = await kingdom();
    const expiringId = randomUUID();
    await withTransaction(pool, (client) =>
      supply.createOffer(client, {
        accountId: a.accountId,
        counterpartyKingdomId: b.kingdomId,
        offerId: expiringId,
        terms: terms({ aBond: null }),
        expiryMinutes: 5,
        gameTimeMs: 60_000,
        operationKey: "expire-create",
      }),
    );
    await withTransaction(pool, (client) =>
      supply.signOffer(client, {
        accountId: a.accountId,
        offerId: expiringId,
        version: 1,
        actorKind: "agent",
        gameTimeMs: 120_000,
        operationKey: "expire-sign",
      }),
    );
    expect(await withTransaction(pool, (client) => supply.expireOffers(client, 360_000))).toBe(1);
    expect((await pool.query("SELECT state FROM test_authority WHERE state = 'released'")).rowCount).toBeGreaterThan(0);
    await expect(
      withTransaction(pool, (client) =>
        supply.signOffer(client, {
          accountId: b.accountId,
          offerId: expiringId,
          version: 1,
          actorKind: "human",
          gameTimeMs: 360_000,
          operationKey: "late",
        }),
      ),
    ).rejects.toMatchObject({ code: "OFFER_CLOSED" });
    await credit(a.kingdomId, "silver", 65);
    const cappedId = randomUUID();
    await withTransaction(pool, (client) =>
      supply.createOffer(client, {
        accountId: a.accountId,
        counterpartyKingdomId: b.kingdomId,
        offerId: cappedId,
        terms: terms({
          aToB: { resource: "silver", wholePerHour: 100 },
          aBond: { resource: "silver", wholeAmount: 61 },
        }),
        gameTimeMs: 420_000,
        operationKey: "capped-create",
      }),
    );
    await withTransaction(pool, (client) =>
      supply.signOffer(client, {
        accountId: a.accountId,
        offerId: cappedId,
        version: 1,
        actorKind: "human",
        gameTimeMs: 480_000,
        operationKey: "capped-a",
      }),
    );
    await expect(
      withTransaction(pool, (client) =>
        supply.signOffer(client, {
          accountId: b.accountId,
          offerId: cappedId,
          version: 1,
          actorKind: "human",
          gameTimeMs: 540_000,
          operationKey: "capped-b",
        }),
      ),
    ).rejects.toMatchObject({ code: "BOND_CAPACITY" });
  });

  it("enforces eight active outgoing/incoming slots even under a ninth acceptance", async () => {
    const a = await kingdom();
    const b = await kingdom();
    const simple = terms({ aToB: { resource: "iron", wholePerHour: 1 }, aBond: null });
    for (let n = 0; n < 9; n += 1) {
      const offerId = randomUUID();
      await withTransaction(pool, (client) =>
        supply.createOffer(client, {
          accountId: a.accountId,
          counterpartyKingdomId: b.kingdomId,
          offerId,
          terms: simple,
          gameTimeMs: 60_000,
          operationKey: `slot-create-${n}`,
        }),
      );
      await withTransaction(pool, (client) =>
        supply.signOffer(client, {
          accountId: a.accountId,
          offerId,
          version: 1,
          actorKind: "human",
          gameTimeMs: 120_000,
          operationKey: `slot-a-${n}`,
        }),
      );
      const last = withTransaction(pool, (client) =>
        supply.signOffer(client, {
          accountId: b.accountId,
          offerId,
          version: 1,
          actorKind: "human",
          gameTimeMs: 180_000,
          operationKey: `slot-b-${n}`,
        }),
      );
      if (n === 8) await expect(last).rejects.toMatchObject({ code: "CONTRACT_CAPACITY" });
      else await expect(last).resolves.toMatchObject({ signed: true });
    }
    expect(
      (await pool.query("SELECT count(*)::integer AS count FROM supply_contracts WHERE kingdom_a = $1", [a.kingdomId]))
        .rows[0].count,
    ).toBe(8);
  });

  it("rejects self-contracts and exact-expiry signatures without charging quota", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await expect(
      withTransaction(pool, (client) =>
        supply.createOffer(client, {
          accountId: a.accountId,
          counterpartyKingdomId: a.kingdomId,
          offerId: randomUUID(),
          terms: terms({ aBond: null }),
          gameTimeMs: 60_000,
          operationKey: "self",
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_PARTY" });
    const offerId = randomUUID();
    await withTransaction(pool, (client) =>
      supply.createOffer(client, {
        accountId: a.accountId,
        counterpartyKingdomId: b.kingdomId,
        offerId,
        terms: terms({ aBond: null }),
        expiryMinutes: 5,
        gameTimeMs: 60_000,
        operationKey: "expiry-create",
      }),
    );
    await expect(
      withTransaction(pool, (client) =>
        supply.signOffer(client, {
          accountId: a.accountId,
          offerId,
          version: 1,
          actorKind: "human",
          gameTimeMs: 360_000,
          operationKey: "expiry-sign",
        }),
      ),
    ).rejects.toMatchObject({ code: "OFFER_EXPIRED" });
    expect(
      await withTransaction(pool, (client) => limits.rollingStatus(client, a.kingdomId, "offer_action", 360_000)),
    ).toMatchObject({ used: 1 });
  });

  it("converts agent supply reservations to bond and installment spend, then releases the remainder", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await credit(a.kingdomId, "silver", 60);
    await pool.query(
      `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions, resource_limits)
       VALUES ('pact', $1, ARRAY['supply.sign'], $2::jsonb)`,
      [a.accountId, JSON.stringify({ silver: String(wholeResources(49)) })],
    );
    const exposure = new ExposureService("pact");
    const adapter = new SupplyExposureAdapter(exposure);
    const liveSupply = new SupplyService("pact", ledger, limits, social, adapter);
    const settlement = new SupplySettlementService("pact", ledger, { read: async () => 0n }, adapter);
    const offerId = randomUUID();
    await withTransaction(pool, (client) =>
      liveSupply.createOffer(client, {
        accountId: a.accountId,
        counterpartyKingdomId: b.kingdomId,
        offerId,
        terms: terms({ aBond: { resource: "silver", wholeAmount: 1 }, noticeHours: 0 }),
        gameTimeMs: 60_000,
        operationKey: `create:${offerId}`,
      }),
    );
    await withTransaction(pool, (client) =>
      liveSupply.signOffer(client, {
        accountId: a.accountId,
        offerId,
        version: 1,
        actorKind: "agent",
        gameTimeMs: 60_000,
        operationKey: `sign-a:${offerId}`,
      }),
    );
    expect(
      (
        await pool.query("SELECT reserved_units FROM authority_ledger WHERE account_id = $1 AND asset = 'silver'", [
          a.accountId,
        ])
      ).rows[0]?.reserved_units,
    ).toBe(String(wholeResources(49)));
    const activated = await withTransaction(pool, (client) =>
      liveSupply.signOffer(client, {
        accountId: b.accountId,
        offerId,
        version: 1,
        actorKind: "human",
        gameTimeMs: 60_000,
        operationKey: `sign-b:${offerId}`,
      }),
    );
    const contractId = activated.contractId;
    if (!contractId) throw new Error("CONTRACT_MISSING");
    expect(
      (
        await pool.query("SELECT reserved_units FROM authority_ledger WHERE account_id = $1 AND asset = 'silver'", [
          a.accountId,
        ])
      ).rows[0]?.reserved_units,
    ).toBe(String(wholeResources(48)));
    await withTransaction(pool, async (client) => {
      await settlement.capture(client, 120_000);
      await settlement.settleDeliveries(client, 120_000);
      await settlement.settleDefaults(client, 120_000);
      expect(await settlement.giveNotice(client, a.accountId, contractId, 120_000)).toBe(180_000);
    });
    await withTransaction(pool, (client) => settlement.settleBoundaries(client, 180_000));
    expect(
      (
        await pool.query("SELECT reserved_units FROM authority_ledger WHERE account_id = $1 AND asset = 'silver'", [
          a.accountId,
        ])
      ).rows[0]?.reserved_units,
    ).toBe("0");
    expect(
      (await pool.query("SELECT sum(units)::text AS total FROM authority_spends WHERE account_id = $1", [a.accountId]))
        .rows[0]?.total,
    ).toBe(String(wholeResources(1) + 80n));
  });

  it("keeps an exact approved human supply exposure separate from the agent allowance", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await credit(a.kingdomId, "silver", 60);
    const offerId = randomUUID();
    const humanSessionId = randomUUID();
    await pool.query(
      `INSERT INTO sessions(id, product_scope, account_id, audience, token_hash, expires_at, idle_expires_at)
       VALUES ($1, 'pact', $2, 'human', $3, clock_timestamp() + interval '1 hour',
         clock_timestamp() + interval '1 hour')`,
      [humanSessionId, a.accountId, randomUUID()],
    );
    const permitService = new ExactHumanPermitService("pact");
    const exposure = new ExposureService("pact", permitService);
    const adapter = new SupplyExposureAdapter(exposure);
    const liveSupply = new SupplyService("pact", ledger, limits, social, adapter);
    const settlement = new SupplySettlementService("pact", ledger, { read: async () => 0n }, adapter);
    await withTransaction(pool, (client) =>
      liveSupply.createOffer(client, {
        accountId: a.accountId,
        counterpartyKingdomId: b.kingdomId,
        offerId,
        terms: terms({ aBond: null }),
        gameTimeMs: 60_000,
        operationKey: `create:${offerId}`,
      }),
    );
    const permitId = await withTransaction(pool, (client) =>
      permitService.issue(client, {
        accountId: a.accountId,
        humanSessionId,
        action: "supply.sign",
        operationKey: `supply:${offerId}:1:${a.kingdomId}`,
        assets: { silver: wholeResources(48) },
      }),
    );
    await expect(
      withTransaction(pool, (client) =>
        liveSupply.signOffer(client, {
          accountId: a.accountId,
          offerId,
          version: 1,
          actorKind: "agent",
          permitId,
          gameTimeMs: 60_000,
          operationKey: `agent-permit:${offerId}`,
        }),
      ),
    ).rejects.toThrow("OPERATION_CONFLICT");
    await expect(
      withTransaction(pool, (client) =>
        liveSupply.signOffer(client, {
          accountId: a.accountId,
          offerId,
          version: 1,
          actorKind: "human",
          permitId: randomUUID(),
          gameTimeMs: 60_000,
          operationKey: `bad-sign-a:${offerId}`,
        }),
      ),
    ).rejects.toThrow("INVALID_EXACT_PERMIT");
    await withTransaction(pool, (client) =>
      liveSupply.signOffer(client, {
        accountId: a.accountId,
        offerId,
        version: 1,
        actorKind: "human",
        permitId,
        gameTimeMs: 60_000,
        operationKey: `sign-a:${offerId}`,
      }),
    );
    await withTransaction(pool, (client) =>
      liveSupply.signOffer(client, {
        accountId: b.accountId,
        offerId,
        version: 1,
        actorKind: "human",
        gameTimeMs: 60_000,
        operationKey: `sign-b:${offerId}`,
      }),
    );
    await withTransaction(pool, async (client) => {
      await settlement.capture(client, 120_000);
      await settlement.settleDeliveries(client, 120_000);
      await settlement.settleDefaults(client, 120_000);
    });
    expect(
      (await pool.query("SELECT count_against_limit FROM authority_spends WHERE account_id = $1", [a.accountId]))
        .rows[0]?.count_against_limit,
    ).toBe(false);
    expect(
      (await pool.query("SELECT used_at IS NOT NULL AS used FROM authority_human_permits WHERE id = $1", [permitId]))
        .rows[0]?.used,
    ).toBe(true);
  });

  it("releases a replaced agent offer reservation exactly once", async () => {
    const a = await kingdom();
    const b = await kingdom();
    await pool.query(
      `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions, resource_limits)
       VALUES ('pact', $1, ARRAY['supply.sign'], $2::jsonb)`,
      [a.accountId, JSON.stringify({ silver: String(wholeResources(49)) })],
    );
    const liveSupply = new SupplyService(
      "pact",
      ledger,
      limits,
      social,
      new SupplyExposureAdapter(new ExposureService("pact")),
    );
    const offerId = randomUUID();
    await withTransaction(pool, (client) =>
      liveSupply.createOffer(client, {
        accountId: a.accountId,
        counterpartyKingdomId: b.kingdomId,
        offerId,
        terms: terms({ aBond: { resource: "silver", wholeAmount: 1 } }),
        gameTimeMs: 60_000,
        operationKey: `create:${offerId}`,
      }),
    );
    await withTransaction(pool, (client) =>
      liveSupply.signOffer(client, {
        accountId: a.accountId,
        offerId,
        version: 1,
        actorKind: "agent",
        gameTimeMs: 60_000,
        operationKey: `sign:${offerId}`,
      }),
    );
    await withTransaction(pool, (client) =>
      liveSupply.counterOffer(client, {
        accountId: b.accountId,
        offerId,
        expectedVersion: 1,
        terms: terms({ aBond: null, aToB: { resource: "silver", wholePerHour: 4 } }),
        gameTimeMs: 120_000,
        operationKey: `counter:${offerId}`,
      }),
    );
    await withTransaction(pool, (client) => liveSupply.withdrawOffer(client, a.accountId, offerId, 180_000));
    expect(
      (
        await pool.query("SELECT reserved_units FROM authority_ledger WHERE account_id = $1 AND asset = 'silver'", [
          a.accountId,
        ])
      ).rows[0]?.reserved_units,
    ).toBe("0");
    expect(
      (
        await pool.query(
          "SELECT count(*)::text FROM authority_commitments WHERE account_id = $1 AND status = 'closed'",
          [a.accountId],
        )
      ).rows[0]?.count,
    ).toBe("1");
  });
});
