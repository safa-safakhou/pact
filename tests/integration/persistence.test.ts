import { randomUUID } from "node:crypto";
import {
  acquireJob,
  appendOutbox,
  claimOutboxDelivery,
  createPool,
  createSchemaPool,
  createTestSchema,
  dropTestSchema,
  enqueueJob,
  markOutboxDelivered,
  withTransaction,
} from "@pact/db";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "persistence");
  pool = createSchemaPool(connectionString, schema);
});

afterAll(async () => {
  await pool.end();
  await dropTestSchema(admin, schema);
  await admin.end();
});

describe("durable job leases", () => {
  it("prevents concurrent holders and recovers an abandoned lease", async () => {
    await withTransaction(pool, (client) =>
      enqueueJob(client, { productScope: "pact", uniqueKey: "lease-fixture", type: "fixture", payload: { value: 1 } }),
    );
    const first = await acquireJob(pool, "worker-one", 60_000);
    expect(first?.type).toBe("fixture");
    expect(await acquireJob(pool, "worker-two", 60_000)).toBeUndefined();
    await pool.query("UPDATE durable_jobs SET lease_expires_at = now() - interval '1 second' WHERE id = $1", [
      first?.id,
    ]);
    const recovered = await acquireJob(pool, "worker-two", 60_000);
    expect(recovered?.id).toBe(first?.id);
    expect(recovered?.attempts).toBe(2);
  });
});

describe("receipts and outbox transaction", () => {
  it("rolls back the receipt and outbox event together", async () => {
    const commandId = randomUUID();
    const eventId = randomUUID();
    await expect(
      withTransaction(
        pool,
        async (client) => {
          await client.query(
            "INSERT INTO command_receipts(product_scope, command_id, canonical_payload_hash, code, receipt) VALUES ($1, $2, $3, $4, $5::jsonb)",
            ["pact", commandId, "fixture", "COMMITTED", "{}"],
          );
          await appendOutbox(client, { productScope: "pact", eventId, type: "fixture", payload: {} });
          throw new Error("force rollback");
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow("force rollback");
    expect((await pool.query("SELECT 1 FROM command_receipts WHERE command_id = $1", [commandId])).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM outbox_events WHERE event_id = $1", [eventId])).rowCount).toBe(0);
  });

  it("survives pool restart and deduplicates delivery per consumer", async () => {
    const commandId = randomUUID();
    const eventId = randomUUID();
    await withTransaction(pool, async (client) => {
      await client.query(
        "INSERT INTO command_receipts(product_scope, command_id, canonical_payload_hash, code, receipt) VALUES ($1, $2, $3, $4, $5::jsonb)",
        ["pact", commandId, "fixture", "COMMITTED", "{}"],
      );
      await appendOutbox(client, { productScope: "pact", eventId, type: "fixture", payload: { commandId } });
    });
    await pool.end();
    pool = createSchemaPool(connectionString, schema);
    expect((await pool.query("SELECT 1 FROM command_receipts WHERE command_id = $1", [commandId])).rowCount).toBe(1);
    await withTransaction(pool, async (client) => {
      const claim = { consumer: "fixture-consumer", eventId, workerId: "worker-one", leaseMilliseconds: 60_000 };
      expect(await claimOutboxDelivery(client, claim)).toBe(true);
      expect(await claimOutboxDelivery(client, { ...claim, workerId: "worker-two" })).toBe(false);
      expect(await markOutboxDelivered(client, claim.consumer, eventId, claim.workerId)).toBe(true);
      expect(await claimOutboxDelivery(client, { ...claim, workerId: "worker-two" })).toBe(false);
    });
  });
});
