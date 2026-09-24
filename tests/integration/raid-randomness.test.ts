import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { RaidRandomnessService, verifyRaidReveal } from "@pact/kingdom";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
const seed = Buffer.from(Array.from({ length: 32 }, (_, index) => index));
const service = new RaidRandomnessService("pact", Buffer.alloc(32, 17), (size) =>
  size === 32 ? seed : Buffer.alloc(size, 19),
);

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "raid_randomness");
  pool = createSchemaPool(connectionString, schema);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

describe("raid seed storage and reveal", () => {
  it("publishes only the commitment before terminal resolution and reveals the original seed on cancel", async () => {
    const raidId = "00000000-0000-7000-8000-000000000001";
    const declared = await withTransaction(pool, (client) => service.declare(client, raidId, "pact-s1-v1"));
    expect(declared.commitment).toBe("ededa106baaea39037285ffd2cf311d2285b220865378e5883bcc8e2f047866f");
    expect(await withTransaction(pool, (client) => service.declare(client, raidId, "pact-s1-v1"))).toEqual(declared);
    await expect(withTransaction(pool, (client) => service.declare(client, raidId, "pact-s1-v2"))).rejects.toThrow(
      "RAID_RULES_VERSION_CONFLICT",
    );
    const before = await withTransaction(pool, (client) => service.publicEvidence(client, raidId));
    expect(before).toEqual(declared);
    expect("seed" in before).toBe(false);
    await expect(withTransaction(pool, (client) => service.revealedEvidence(client, raidId))).rejects.toThrow(
      "RAID_NOT_REVEALED",
    );
    const stored = await pool.query<{ seed_ciphertext: Buffer; revealed_seed: string | null }>(
      "SELECT seed_ciphertext, revealed_seed FROM raid_seed_commitments WHERE raid_id = $1",
      [raidId],
    );
    expect(stored.rows[0]?.seed_ciphertext.equals(seed)).toBe(false);
    expect(stored.rows[0]?.revealed_seed).toBeNull();

    const reveal = await withTransaction(pool, (client) =>
      service.reveal(client, { raidId, purpose: "cancel", actorRef: "rules-worker" }),
    );
    expect(reveal).toMatchObject({ ...declared, status: "canceled", attackerDie: 6, defenderDie: 1 });
    expect(reveal.seed).toBe(seed.toString("base64url"));
    expect(verifyRaidReveal(reveal)).toBe(true);
    expect(await withTransaction(pool, (client) => service.publicEvidence(client, raidId))).toEqual(reveal);
    expect(
      await withTransaction(pool, (client) =>
        service.reveal(client, { raidId, purpose: "cancel", actorRef: "rules-worker-retry" }),
      ),
    ).toEqual(reveal);
    await expect(
      withTransaction(pool, (client) => service.reveal(client, { raidId, purpose: "resolve", actorRef: "worker" })),
    ).rejects.toThrow("RAID_ALREADY_TERMINAL");
    const audit = await pool.query("SELECT purpose, actor_ref FROM raid_seed_access_audit WHERE raid_id = $1", [
      raidId,
    ]);
    expect(audit.rows).toEqual([{ purpose: "cancel", actor_ref: "rules-worker" }]);
  });

  it("rolls back a reveal and audit together, then resolves once", async () => {
    const raidId = randomUUID();
    await withTransaction(pool, (client) => service.declare(client, raidId, "pact-s1-v1"));
    await expect(
      withTransaction(pool, async (client) => {
        await service.reveal(client, { raidId, purpose: "resolve", actorRef: "worker" });
        throw new Error("ROLLBACK_FIXTURE");
      }),
    ).rejects.toThrow("ROLLBACK_FIXTURE");
    expect(await withTransaction(pool, (client) => service.publicEvidence(client, raidId))).toMatchObject({
      status: "committed",
    });
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM raid_seed_access_audit WHERE raid_id = $1", [raidId]))
        .rows[0]?.count,
    ).toBe(0);
    const reveal = await withTransaction(pool, (client) =>
      service.reveal(client, { raidId, purpose: "resolve", actorRef: "worker" }),
    );
    expect(reveal.status).toBe("resolved");
    expect(verifyRaidReveal(reveal)).toBe(true);
  });
});
