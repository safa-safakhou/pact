import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
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
  it("survives a ledger writer killed before and after commit without losing or repeating stock", async () => {
    const scope = "killed_writer_51";
    const kingdomId = randomUUID();
    const ledger = new ResourceLedger(scope);
    await withTransaction(pool, (client) => ledger.initializeKingdom(client, kingdomId, gameTimeMs));
    const childScript = `
      const { createSchemaPool } = await import('@pact/db');
      const { ResourceLedger } = await import('@pact/ledger');
      const db = createSchemaPool(process.env.PACT_TEST_DATABASE_URL, process.env.PACT_TEST_SCHEMA);
      const client = await db.connect();
      await client.query('BEGIN');
      await new ResourceLedger('${scope}').creditOrdinary(client, {
        kingdomId: '${kingdomId}', resource: 'iron', amount: 600n,
        operationKey: process.env.PACT_TEST_OPERATION, reason: 'killed_writer_fixture', gameTimeMs: ${gameTimeMs}
      });
      if (process.env.PACT_TEST_COMMIT === '1') await client.query('COMMIT');
      process.stdout.write('READY\\n');
      setInterval(() => {}, 1000);
    `;
    const killAt = async (operationKey: string, committed: boolean) => {
      const child = spawn(process.execPath, ["--input-type=module", "-e", childScript], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PACT_TEST_DATABASE_URL: connectionString,
          PACT_TEST_SCHEMA: schema,
          PACT_TEST_OPERATION: operationKey,
          PACT_TEST_COMMIT: committed ? "1" : "0",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let readinessTimeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const ready = await Promise.race([
          once(child.stdout, "data").then(([data]) => String(data)),
          once(child, "exit").then(([code]) => {
            throw new Error(`Writer exited before ready: ${code}`);
          }),
          new Promise<never>((_, reject) => {
            readinessTimeout = setTimeout(() => reject(new Error("Writer readiness timeout")), 10_000);
          }),
        ]);
        expect(ready).toContain("READY");
      } finally {
        if (readinessTimeout) clearTimeout(readinessTimeout);
        if (child.exitCode === null) {
          const exited = once(child, "exit");
          child.kill("SIGKILL");
          await exited;
        }
      }
    };

    await killAt("precommit", false);
    expect(
      (
        await pool.query("SELECT 1 FROM resource_movements WHERE product_scope = $1 AND operation_key = 'precommit'", [
          scope,
        ])
      ).rowCount,
    ).toBe(0);
    expect((await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "iron"))).ordinary).toBe(0n);

    await killAt("postcommit", true);
    expect(
      (
        await pool.query("SELECT 1 FROM resource_movements WHERE product_scope = $1 AND operation_key = 'postcommit'", [
          scope,
        ])
      ).rowCount,
    ).toBe(1);
    const replay = await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId,
        resource: "iron",
        amount: 600n,
        operationKey: "postcommit",
        reason: "killed_writer_fixture",
        gameTimeMs,
      }),
    );
    expect(replay.ordinaryDelta).toBe(600n);
    expect((await withTransaction(pool, (client) => ledger.readBalance(client, kingdomId, "iron"))).ordinary).toBe(
      600n,
    );
    expect(
      (
        await pool.query("SELECT 1 FROM resource_movements WHERE product_scope = $1 AND operation_key = 'postcommit'", [
          scope,
        ])
      ).rowCount,
    ).toBe(1);
  });

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
