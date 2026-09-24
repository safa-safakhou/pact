import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { ActionLimitError, ActionLimitService } from "@pact/kingdom";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
let limits: ActionLimitService;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "action_limits");
  pool = createSchemaPool(connectionString, schema);
  limits = new ActionLimitService("pact");
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function kingdom(): Promise<string> {
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
       VALUES ($1, 'pact', $2, $3, 'Limits Fixture', 'portrait.wolf', clock_timestamp(),
         0, 0, 60000, $4)`,
      [kingdomId, accountId, `limit_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    for (const [kind, capacity] of [
      ["raid", 3],
      ["scout", 4],
    ] as const) {
      await client.query(
        `INSERT INTO kingdom_charges(product_scope, kingdom_id, kind, available, capacity,
           last_regenerated_game_time_ms) VALUES ('pact', $1, $2, $3, $3, 0)`,
        [kingdomId, kind, capacity],
      );
    }
  });
  return kingdomId;
}

describe("kingdom-wide action limits", () => {
  it("starts a serial raid timer on first spend, applies exact-boundary restoration, and banks no capped time", async () => {
    const kingdomId = await kingdom();
    const spend = (operationKey: string, gameTimeMs: number) =>
      withTransaction(pool, (client) =>
        limits.spendCharge(client, { kingdomId, kind: "raid", operationKey, gameTimeMs }),
      );
    expect(await spend("web-1", 60_000)).toMatchObject({ available: 2, nextRegenerationGameTimeMs: 28_860_000 });
    expect(await spend("mcp-2", 120_000)).toMatchObject({ available: 1, nextRegenerationGameTimeMs: 28_860_000 });
    expect(await spend("telegram-3", 180_000)).toMatchObject({ available: 0, retryAtGameTimeMs: 28_860_000 });
    await expect(spend("denied", 28_859_999)).rejects.toMatchObject({
      code: "CHARGE_EMPTY",
      retryAtGameTimeMs: 28_860_000,
    });
    expect(await spend("web-1", 180_000)).toMatchObject({ available: 2, alreadyCommitted: true });
    expect(await spend("at-boundary", 28_860_000)).toMatchObject({
      available: 0,
      nextRegenerationGameTimeMs: 57_660_000,
    });
    const full = await withTransaction(pool, (client) => limits.chargeStatus(client, kingdomId, "raid", 200_000_000));
    expect(full).toMatchObject({ available: 3, nextRegenerationGameTimeMs: null });
    expect(await spend("web-1", 60_000)).toMatchObject({
      available: 2,
      nextRegenerationGameTimeMs: 28_860_000,
      alreadyCommitted: true,
    });
    expect(await spend("new-cycle", 200_001_000)).toMatchObject({
      available: 2,
      nextRegenerationGameTimeMs: 228_801_000,
    });
  });

  it("counts successful public actions across clients, excludes replays and rollbacks, and exposes exact retry", async () => {
    const kingdomId = await kingdom();
    const record = (operationKey: string, gameTimeMs: number) =>
      withTransaction(pool, (client) =>
        limits.recordSuccessfulAction(client, { kingdomId, kind: "public_post", operationKey, gameTimeMs }),
      );
    for (let n = 0; n < 6; n += 1) {
      expect(await record(`client-${n}`, 60_000 + n)).toMatchObject({ used: n + 1, limit: 6 });
    }
    expect(await record("client-0", 70_000)).toMatchObject({ used: 6, alreadyCommitted: true });
    await expect(record("extra", 80_000)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAtGameTimeMs: 86_460_000,
    });
    expect(await record("at-expiry", 86_460_000)).toMatchObject({ used: 6 });
    await expect(
      withTransaction(pool, async (client) => {
        await limits.recordSuccessfulAction(client, {
          kingdomId,
          kind: "transfer",
          operationKey: "rolled-back",
          gameTimeMs: 90_000_000,
        });
        throw new Error("abort command");
      }),
    ).rejects.toThrow("abort command");
    expect(
      await withTransaction(pool, (client) => limits.rollingStatus(client, kingdomId, "transfer", 90_000_000)),
    ).toMatchObject({ used: 0, limit: 24 });
    expect(
      await withTransaction(pool, (client) => limits.rollingStatus(client, kingdomId, "state_read", 90_000_000)),
    ).toMatchObject({ used: 0, limit: 120 });
    expect(new ActionLimitError("RATE_LIMITED", 123).retryAtGameTimeMs).toBe(123);
  });
});
