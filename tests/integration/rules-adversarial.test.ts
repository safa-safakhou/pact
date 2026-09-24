import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { ResourceLedger } from "@pact/ledger";
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const gameTimeMs = Date.parse("2026-09-24T00:00:00.000Z");
let admin: Pool;
let pool: Pool;
let schema: string;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "rules_adversarial");
  pool = createSchemaPool(connectionString, schema);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

describe("seeded transaction and replay invariants", () => {
  it("reconciles a generated credit/spend/bond sequence across rollback and idempotent replay", async () => {
    const scope = "seeded_rules_51";
    const ledger = new ResourceLedger(scope);
    const kingdomId = randomUUID();
    await withTransaction(pool, (client) => ledger.initializeKingdom(client, kingdomId, gameTimeMs));
    const next = seeded(0x51c0ffee);
    let ordinary = 0n;
    let locked = 0n;
    const cap = 600n * 600n;

    for (let index = 0; index < 120; index += 1) {
      const draw = next();
      const amount = BigInt(1 + (next() % 9_000));
      const operationKey = `seed-51-${index}`;
      const kind = draw % 4;
      const run = async (client: PoolClient) => {
        if (kind === 0) {
          return ledger.creditOrdinary(client, {
            kingdomId,
            resource: "iron",
            amount,
            operationKey,
            reason: "seeded_credit",
            gameTimeMs,
          });
        }
        if (kind === 1) {
          return (
            await ledger.debit(client, {
              kingdomId,
              resource: "iron",
              amount,
              purpose: "trade",
              operationKey,
              gameTimeMs,
            })
          ).movement;
        }
        if (kind === 2) {
          return ledger.lockBond(client, { kingdomId, resource: "iron", amount, operationKey, gameTimeMs });
        }
        return ledger.releaseBond(client, { kingdomId, resource: "iron", amount, operationKey, gameTimeMs });
      };

      if ((kind === 1 || kind === 2) && ordinary < amount) {
        await expect(withTransaction(pool, run)).rejects.toThrow("INSUFFICIENT_STOCK");
      } else if (kind === 3 && locked < amount) {
        await expect(withTransaction(pool, run)).rejects.toThrow("INSUFFICIENT_LOCKED_FUNDS");
      } else {
        if (index % 11 === 0) {
          await expect(
            withTransaction(pool, async (client) => {
              await run(client);
              throw new Error("INJECTED_PRE_COMMIT_DEATH");
            }),
          ).rejects.toThrow("INJECTED_PRE_COMMIT_DEATH");
          expect(
            (
              await pool.query("SELECT 1 FROM resource_movements WHERE product_scope = $1 AND operation_key = $2", [
                scope,
                operationKey,
              ])
            ).rowCount,
          ).toBe(0);
        }
        const committed = await withTransaction(pool, run);
        expect(await withTransaction(pool, run)).toEqual(committed);
        ordinary += committed.ordinaryDelta;
        locked += committed.lockedDelta;
      }

      const balance = await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "iron"));
      expect(balance.ordinary, `seed 0x51c0ffee step ${index}`).toBe(ordinary);
      expect(balance.locked, `seed 0x51c0ffee step ${index}`).toBe(locked);
      expect(balance.allowance).toBe(200n * 600n);
      expect(ordinary).toBeGreaterThanOrEqual(0n);
      expect(ordinary).toBeLessThanOrEqual(cap);
      expect(locked).toBeGreaterThanOrEqual(0n);
    }

    const history = await pool.query<{ ordinary: string; locked: string; allowance: string }>(
      `SELECT sum(ordinary_delta)::text AS ordinary, sum(locked_delta)::text AS locked,
              sum(allowance_delta)::text AS allowance
       FROM resource_movements WHERE product_scope = $1 AND kingdom_id = $2 AND resource = 'iron'`,
      [scope, kingdomId],
    );
    expect(BigInt(history.rows[0]?.ordinary ?? "0")).toBe(ordinary);
    expect(BigInt(history.rows[0]?.locked ?? "0")).toBe(locked);
    expect(BigInt(history.rows[0]?.allowance ?? "0")).toBe(200n * 600n);
  });
});
