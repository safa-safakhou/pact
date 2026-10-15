import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { ExactHumanPermitService, ExposureService, type HumanPermitPort, readExposureContext } from "@pact/authority";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { ConstructionExposureAdapter } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
const accepted = new Set<string>();
const permits: HumanPermitPort = {
  async assertExact(_client, input) {
    const key = `${input.accountId}:${input.permitRef}:${input.action}:${input.operationKey}`;
    if (!accepted.has(key)) throw new Error("INVALID_EXACT_PERMIT");
    accepted.delete(key);
  },
};
const exposure = new ExposureService("pact", permits);
const ledger = new ResourceLedger("pact");

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "authority_exposure");
  pool = createSchemaPool(connectionString, schema);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function account(options: { limit?: string; actions?: string[]; troopLimit?: number } = {}): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
     VALUES ($1, 'pact', $2, 'fixture-only', clock_timestamp(), 'terms-v1')`,
    [id, `${id}@example.test`],
  );
  await pool.query(
    `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions, resource_limits, troop_limit)
     VALUES ('pact', $1, $2, $3::jsonb, $4)`,
    [
      id,
      options.actions ?? ["supply.sign", "building.queue", "garrison.upkeep", "transfer"],
      JSON.stringify({ silver: options.limit ?? "100", grain: options.limit ?? "100", iron: options.limit ?? "100" }),
      options.troopLimit ?? 10,
    ],
  );
  return id;
}

async function kingdom(accountId: string): Promise<string> {
  const id = randomUUID();
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1, 'pact', $2, $3, 'Exposure Fixture', 'portrait.wolf', clock_timestamp(),
         0, 0, 60000, $4)`,
      [id, accountId, `exposure_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, id, 0);
    for (const resource of ["iron", "silver"] as const) {
      await ledger.creditOrdinary(client, {
        kingdomId: id,
        resource,
        amount: 100n,
        operationKey: `fixture:${resource}`,
        reason: "fixture",
        gameTimeMs: 0,
      });
    }
  });
  return id;
}

const reserve = (client: PoolClient, accountId: string, operationKey: string, units: bigint, gameTimeMs = 60_000) =>
  exposure.reserve(client, {
    accountId,
    operationKey,
    action: "supply.sign",
    actor: "agent",
    assets: { silver: units },
    gameTimeMs,
  });

describe("future authority exposure", () => {
  it("serializes concurrent signatures against the one account allowance and releases once", async () => {
    const id = await account();
    const outcomes = await Promise.allSettled([
      withTransaction(pool, (client) => reserve(client, id, "offer:a", 80n)),
      withTransaction(pool, (client) =>
        new ExposureService("pact").reserve(client, {
          accountId: id,
          operationKey: "offer:b",
          action: "supply.sign",
          actor: "agent",
          assets: { silver: 80n },
          gameTimeMs: 60_000,
        }),
      ),
    ]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === "rejected")).toHaveLength(1);
    const ref = (outcomes.find((item) => item.status === "fulfilled") as PromiseFulfilledResult<string>).value;
    await withTransaction(pool, async (client) => {
      await exposure.release(client, ref, 120_000);
      await exposure.release(client, ref, 120_000);
    });
    expect(
      (await pool.query("SELECT reserved_units FROM authority_ledger WHERE account_id = $1 AND asset = 'silver'", [id]))
        .rows[0]?.reserved_units,
    ).toBe("0");
    await withTransaction(pool, (client) => reserve(client, id, "offer:c", 80n));
  });

  it("moves actual outgoing amounts to rolling spent without credit/refund replenishment", async () => {
    const id = await account();
    const ref = await withTransaction(pool, (client) => reserve(client, id, "flow", 90n));
    await withTransaction(pool, async (client) => {
      await exposure.activate(client, ref, "contract:one");
      await exposure.consume(client, {
        ref,
        asset: "silver",
        units: 30n,
        operationKey: "minute:1",
        gameTimeMs: 60_000,
      });
      await exposure.consume(client, {
        ref,
        asset: "silver",
        units: 30n,
        operationKey: "minute:1",
        gameTimeMs: 60_000,
      });
      await exposure.release(client, ref, 120_000);
    });
    expect(
      (await pool.query("SELECT reserved_units FROM authority_ledger WHERE account_id = $1 AND asset = 'silver'", [id]))
        .rows[0]?.reserved_units,
    ).toBe("0");
    expect(
      (await pool.query("SELECT sum(units)::text AS spent FROM authority_spends WHERE account_id = $1", [id])).rows[0]
        ?.spent,
    ).toBe("30");
    await expect(
      withTransaction(pool, (client) => reserve(client, id, "too-soon", 80n, 120_000)),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ALLOWANCE" });
    await withTransaction(pool, (client) => reserve(client, id, "after-window", 80n, 60_000 + 24 * 3_600_000));
  });

  it("keeps signed reservations valid after a mandate decrease but rejects new spend", async () => {
    const id = await account();
    const ref = await withTransaction(pool, (client) => reserve(client, id, "existing", 80n));
    await pool.query(
      `UPDATE kingdom_mandates SET version = version + 1, resource_limits = '{"silver":"10"}'::jsonb
       WHERE account_id = $1`,
      [id],
    );
    await expect(withTransaction(pool, (client) => reserve(client, id, "new", 1n))).rejects.toMatchObject({
      code: "INSUFFICIENT_ALLOWANCE",
    });
    await withTransaction(pool, (client) =>
      exposure.consume(client, {
        ref,
        asset: "silver",
        units: 10n,
        operationKey: "existing:minute",
        gameTimeMs: 120_000,
      }),
    );
    expect(await withTransaction(pool, (client) => exposure.canStartWaiting(client, ref, "supply.sign"))).toBe(false);
  });

  it("tracks approved exceptions separately and enforces one-use exact permits", async () => {
    const id = await account({ limit: "0" });
    const permitRef = randomUUID();
    const operationKey = "approved:one";
    accepted.add(`${id}:${permitRef}:supply.sign:${operationKey}`);
    const ref = await withTransaction(pool, (client) =>
      exposure.reserve(client, {
        accountId: id,
        operationKey,
        action: "supply.sign",
        actor: "human_exception",
        permitRef,
        assets: { silver: 80n, grain: 4n },
        gameTimeMs: 60_000,
      }),
    );
    await withTransaction(pool, async (client) => {
      await exposure.activate(client, ref, "approved-contract");
      await exposure.consume(client, {
        ref,
        asset: "silver",
        units: 80n,
        operationKey: "approved:minute",
        gameTimeMs: 120_000,
      });
    });
    expect(
      (await pool.query("SELECT count_against_limit FROM authority_spends WHERE commitment_id = $1", [ref])).rows[0]
        ?.count_against_limit,
    ).toBe(false);
    await expect(
      withTransaction(pool, (client) =>
        exposure.reserve(client, {
          accountId: id,
          operationKey: "approved:other",
          action: "supply.sign",
          actor: "human_exception",
          permitRef,
          assets: { silver: 80n },
          gameTimeMs: 60_000,
        }),
      ),
    ).rejects.toThrow("INVALID_EXACT_PERMIT");
  });

  it("issues durable exact permits only for a human session and consumes them once", async () => {
    const id = await account({ limit: "0" });
    const humanSessionId = randomUUID();
    const agentSessionId = randomUUID();
    for (const [sessionId, audience] of [
      [humanSessionId, "human"],
      [agentSessionId, "agent"],
    ] as const) {
      await pool.query(
        `INSERT INTO sessions(id, product_scope, account_id, audience, token_hash, expires_at, idle_expires_at)
         VALUES ($1, 'pact', $2, $3, $4, clock_timestamp() + interval '1 hour',
           clock_timestamp() + interval '1 hour')`,
        [sessionId, id, audience, randomUUID()],
      );
    }
    const permitService = new ExactHumanPermitService("pact");
    await expect(
      withTransaction(pool, (client) =>
        permitService.issue(client, {
          accountId: id,
          humanSessionId: agentSessionId,
          action: "supply.sign",
          operationKey: "exact:one",
          assets: { silver: 80n },
        }),
      ),
    ).rejects.toThrow("HUMAN_SESSION_REQUIRED");
    const permitRef = await withTransaction(pool, (client) =>
      permitService.issue(client, {
        accountId: id,
        humanSessionId,
        action: "supply.sign",
        operationKey: "exact:one",
        assets: { silver: 80n, grain: 4n },
      }),
    );
    expect(
      await withTransaction(pool, (client) =>
        permitService.issue(client, {
          accountId: id,
          humanSessionId,
          action: "supply.sign",
          operationKey: "exact:one",
          assets: { grain: 4n, silver: 80n },
        }),
      ),
    ).toBe(permitRef);
    const durable = new ExposureService("pact", permitService);
    await expect(
      withTransaction(pool, (client) =>
        durable.reserve(client, {
          accountId: id,
          operationKey: "exact:one",
          action: "supply.sign",
          actor: "human_exception",
          permitRef,
          assets: { silver: 81n, grain: 4n },
          gameTimeMs: 60_000,
        }),
      ),
    ).rejects.toThrow("INVALID_EXACT_PERMIT");
    const ref = await withTransaction(pool, (client) =>
      durable.reserve(client, {
        accountId: id,
        operationKey: "exact:one",
        action: "supply.sign",
        actor: "human_exception",
        permitRef,
        assets: { silver: 80n, grain: 4n },
        gameTimeMs: 60_000,
      }),
    );
    expect(
      (await pool.query("SELECT used_at IS NOT NULL AS used FROM authority_human_permits WHERE id = $1", [permitRef]))
        .rows[0]?.used,
    ).toBe(true);
    expect(
      (await pool.query("SELECT actor_kind FROM authority_commitments WHERE id = $1", [ref])).rows[0]?.actor_kind,
    ).toBe("human_exception");
  });

  it("accepts an active first-party human OAuth grant, but not an agent or revoked grant", async () => {
    const id = await account({ limit: "0" });
    const humanGrant = randomUUID();
    const agentGrant = randomUUID();
    for (const [grantId, audience] of [
      [humanGrant, "human"],
      [agentGrant, "mcp"],
    ] as const) {
      await pool.query(
        `INSERT INTO oauth_grants(id, product_scope, account_id, client_id, token_family_id,
           scopes, audience, expires_at)
         VALUES ($1, 'pact', $2, 'pact-native', $3, ARRAY['game:act'], $4,
           clock_timestamp() + interval '1 hour')`,
        [grantId, id, randomUUID(), audience],
      );
    }
    const permitService = new ExactHumanPermitService("pact");
    await expect(
      withTransaction(pool, (client) =>
        permitService.issue(client, {
          accountId: id,
          humanSessionId: agentGrant,
          action: "building.queue",
          operationKey: "native:agent",
          assets: { iron: 100n },
        }),
      ),
    ).rejects.toThrow("HUMAN_SESSION_REQUIRED");
    const permitRef = await withTransaction(pool, (client) =>
      permitService.issue(client, {
        accountId: id,
        humanSessionId: humanGrant,
        action: "building.queue",
        operationKey: "native:human",
        assets: { iron: 100n },
      }),
    );
    const durable = new ExposureService("pact", permitService);
    await pool.query("UPDATE oauth_grants SET revoked_at = clock_timestamp() WHERE id = $1", [humanGrant]);
    await expect(
      withTransaction(pool, (client) =>
        durable.reserve(client, {
          accountId: id,
          operationKey: "native:human",
          action: "building.queue",
          actor: "human_exception",
          permitRef,
          assets: { iron: 100n },
          gameTimeMs: 60_000,
        }),
      ),
    ).rejects.toThrow("INVALID_EXACT_PERMIT");
  });

  it("reserves troop and visiting-upkeep limits across commitments", async () => {
    const id = await account({ troopLimit: 5 });
    await withTransaction(pool, (client) =>
      exposure.reserve(client, {
        accountId: id,
        operationKey: "garrison:one",
        action: "garrison.upkeep",
        actor: "agent",
        assets: { grain: 60n },
        troopCount: 4,
        gameTimeMs: 60_000,
      }),
    );
    await expect(
      withTransaction(pool, (client) =>
        exposure.reserve(client, {
          accountId: id,
          operationKey: "garrison:two",
          action: "garrison.upkeep",
          actor: "agent",
          assets: { grain: 20n },
          troopCount: 2,
          gameTimeMs: 60_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "TROOP_LIMIT" });
  });

  it("rechecks waiting construction and charges only its actual ordinary debit", async () => {
    const id = await account();
    const kingdomId = await kingdom(id);
    const adapter = new ConstructionExposureAdapter("pact", exposure, ledger);
    const instructionId = randomUUID();
    const ref = await withTransaction(pool, (client) =>
      adapter.reserve(client, {
        accountId: id,
        kingdomId,
        instructionId,
        actor: "agent",
        mandateVersion: 1,
        iron: 80n,
        silver: 80n,
        gameTimeMs: 60_000,
      }),
    );
    expect(
      await withTransaction(pool, (client) =>
        adapter.recheckAndStart(client, {
          accountId: id,
          kingdomId,
          instructionId,
          actor: "agent",
          authorityRef: ref,
          mandateVersion: 1,
          ordinaryIron: 30n,
          ordinarySilver: 20n,
          gameTimeMs: 120_000,
        }),
      ),
    ).toBe(true);
    const rows = await pool.query<{ asset: string; units: string }>(
      "SELECT asset, units FROM authority_spends WHERE commitment_id = $1 ORDER BY asset",
      [ref],
    );
    expect(rows.rows).toEqual([
      { asset: "iron", units: "30" },
      { asset: "silver", units: "20" },
    ]);
    expect(
      (await pool.query("SELECT sum(reserved_units)::text AS total FROM authority_ledger WHERE account_id = $1", [id]))
        .rows[0]?.total,
    ).toBe("0");
    await adapter.recordActiveCancellation();
    expect(
      (await pool.query("SELECT sum(units)::text AS total FROM authority_spends WHERE account_id = $1", [id])).rows[0]
        ?.total,
    ).toBe("50");
  });
});

it("quotes rolling GAME-time spend and actual reservations read-only without foreign scope leakage", async () => {
  const id = await account({ limit: "100" }),
    other = await account();
  const ref = await withTransaction(pool, (c) => reserve(c, id, "quote-reserve", 60n, 60000));
  await withTransaction(pool, async (c) => {
    await exposure.activate(c, ref, "fixture-contract");
    await exposure.consume(c, { ref, asset: "silver", units: 20n, operationKey: "quote-spend", gameTimeMs: 60000 });
  });
  const before = (
    await pool.query("SELECT reserved_units FROM authority_ledger WHERE account_id=$1 AND asset='silver'", [id])
  ).rows;
  const read = (t: number, owner = id, scope = "pact") =>
    withTransaction(pool, (c) => readExposureContext(c, scope, owner, t), { isolation: "REPEATABLE READ" });
  const q = await read(60000);
  expect(q.resources.silver).toMatchObject({
    ceilingUnits: "100",
    rollingSpentUnits: "20",
    reservedUnits: "40",
    headroomUnits: "40",
    reserveFloorUnits: "0",
    releaseSchedule: [{ gameTimeMs: 86460000, units: "20" }],
    reservations: [{ commitmentId: ref, units: "40" }],
  });
  expect(await read(60000)).toEqual(q); // Wall time does not change a paused game clock.
  expect((await read(86460000)).resources.silver).toMatchObject({
    rollingSpentUnits: "0",
    reservedUnits: "40",
    headroomUnits: "60",
  });
  expect((await read(60000, other)).resources.silver?.headroomUnits).toBe("100");
  expect((await read(60000, id, "other-scope")).resources).toEqual({});
  expect(
    (await pool.query("SELECT reserved_units FROM authority_ledger WHERE account_id=$1 AND asset='silver'", [id])).rows,
  ).toEqual(before);
});

it("replays 106 retained aggregate spend/reservation cases against real read and atomic admission ledgers", async () => {
  const data = JSON.parse(
    readFileSync(new URL("../fixtures/admission-replays-20261014.json", import.meta.url), "utf8"),
  );
  expect(data.quotaRefusals).toHaveLength(106);
  for (const r of data.quotaRefusals) {
    const id = await account(),
      units = (n: number) => String(Math.round(n * 600));
    await pool.query("UPDATE kingdom_mandates SET resource_limits=$2 WHERE account_id=$1", [
      id,
      Object.fromEntries(["iron", "silver"].map((a) => [a, units(r.permissionWhole[a].limit)])),
    ]);
    for (const asset of ["iron", "silver"]) {
      const a = r.permissionWhole[asset];
      await pool.query(
        "INSERT INTO authority_ledger(product_scope,account_id,asset,spent_units,reserved_units) VALUES('pact',$1,$2,$3,$4)",
        [id, asset, units(a.legacy), units(a.reserved)],
      );
      if (a.rolling_spent > 0)
        await pool.query(
          "INSERT INTO authority_spends(id,product_scope,account_id,asset,units,game_time_ms,operation_key,count_against_limit) VALUES($1,'pact',$2,$3,$4,60000,$5,true)",
          [randomUUID(), id, asset, units(a.rolling_spent), `retained-aggregate:${asset}`],
        );
    }
    const before = (
      await pool.query(
        "SELECT asset,spent_units,reserved_units FROM authority_ledger WHERE account_id=$1 ORDER BY asset",
        [id],
      )
    ).rows;
    const observed = await withTransaction(pool, (c) => readExposureContext(c, "pact", id, 60000));
    for (const asset of ["iron", "silver"])
      expect(observed.resources[asset]?.headroomUnits, `case ${r.case}`).toBe(
        units(r.permissionWhole[asset].remaining),
      );
    await expect(
      withTransaction(pool, (c) =>
        exposure.reserve(c, {
          accountId: id,
          operationKey: "replay-build",
          action: "building.queue",
          actor: "agent",
          assets: { iron: BigInt(units(r.costWhole.iron)), silver: BigInt(units(r.costWhole.silver)) },
          gameTimeMs: 60000,
        }),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ALLOWANCE" });
    expect(
      (
        await pool.query(
          "SELECT asset,spent_units,reserved_units FROM authority_ledger WHERE account_id=$1 ORDER BY asset",
          [id],
        )
      ).rows,
    ).toEqual(before);
    expect(
      (await pool.query("SELECT count(*)::int n FROM authority_commitments WHERE account_id=$1", [id])).rows[0].n,
    ).toBe(0);
  }
});
