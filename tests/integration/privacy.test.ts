import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import { type DeletionTombstone, PrivacyService } from "@pact/privacy";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const baseTime = new Date("2026-09-22T10:00:00.000Z");
let now = new Date(baseTime);
let admin: Pool;
let pool: Pool;
let schema: string;
let privacy: PrivacyService;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "privacy");
  pool = createSchemaPool(connectionString, schema);
  privacy = new PrivacyService(pool, { productScope: "pact", clock: { now: () => new Date(now) } });
});

beforeEach(() => {
  now = new Date(baseTime);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function account(email: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO accounts(product_scope, email, password_hash, email_verified_at, status)
     VALUES ('pact', $1, 'secret-password-hash', $2, 'active') RETURNING id`,
    [email, now],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Account fixture missing");
  return id;
}

describe("phase-0 account privacy", () => {
  it("exports only owned readable data and never credential material", async () => {
    const owner = await account(`privacy-${randomUUID()}@example.test`);
    const other = await account(`other-${randomUUID()}@example.test`);
    await pool.query(
      `INSERT INTO kingdom_drafts(product_scope, account_id, state, display_name, proposed_handle, portrait)
       VALUES ('pact', $1, '{"internal":"legacy"}', 'Private Kingdom', 'private_kingdom', 'portrait.owl')`,
      [owner],
    );
    await pool.query(
      `INSERT INTO model_connections(
         product_scope, account_id, provider, label, suffix, revoked_at, created_at, updated_at
       ) VALUES ('pact', $1, 'openai', 'Primary', '1234', $2, $2, $2)`,
      [owner, now],
    );
    await pool.query(
      `INSERT INTO inbox_events(product_scope, event_id, account_id, type, payload, occurred_at)
       VALUES ('pact', $1, $2, 'private.fixture', '{"message":"mine"}', $4),
              ('pact', $3, $5, 'private.fixture', '{"message":"other-player-secret"}', $4)`,
      [randomUUID(), owner, randomUUID(), now, other],
    );

    const ticket = await privacy.requestExport(owner);
    expect(ticket.expiresAt).toEqual(new Date(baseTime.getTime() + 7 * 24 * 60 * 60_000));
    const archive = await privacy.downloadExport(owner, ticket.downloadToken);
    const serialized = JSON.stringify(archive);
    expect(archive.index).toContain("Security credentials");
    expect(serialized).toContain("Private Kingdom");
    expect(serialized).toContain("mine");
    expect(serialized).not.toContain("other-player-secret");
    expect(serialized).not.toContain("secret-password-hash");
    expect(serialized).not.toContain("credential_ciphertext");
    await expect(privacy.downloadExport(other, ticket.downloadToken)).rejects.toMatchObject({ code: "NOT_FOUND" });

    now = new Date(baseTime.getTime() + 7 * 24 * 60 * 60_000);
    await expect(privacy.downloadExport(owner, ticket.downloadToken)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("revokes access immediately and reapplies a deletion tombstone after restore", async () => {
    const owner = await account(`delete-${randomUUID()}@example.test`);
    const externalTombstones: DeletionTombstone[] = [];
    const restorePrivacy = new PrivacyService(pool, {
      productScope: "pact",
      clock: { now: () => new Date(now) },
      deletionRegistry: {
        append: async (tombstone) => {
          externalTombstones.push(tombstone);
        },
        read: async () => externalTombstones,
      },
    });
    const sessionId = randomUUID();
    await pool.query(
      `INSERT INTO sessions(
         id, product_scope, account_id, audience, token_hash, expires_at, idle_expires_at, authenticated_at
       ) VALUES ($1, 'pact', $2, 'human', $3, $4, $4, $5)`,
      [sessionId, owner, randomUUID(), new Date(baseTime.getTime() + 86_400_000), now],
    );
    await pool.query(
      `INSERT INTO envoy_runs(
         product_scope, account_id, subject_id, status, objective, provider, model, client_kind,
         deadline_at, max_conversations, max_messages, max_calls, max_tokens
       ) VALUES ('pact', $1, $2, 'running', 'private objective', 'fixture', 'fixture', 'pact',
                 $3, 1, 1, 1, 100)`,
      [owner, randomUUID(), new Date(baseTime.getTime() + 60_000)],
    );
    const credentialId = randomUUID();
    await pool.query(
      `INSERT INTO model_connections(
         id, product_scope, account_id, provider, label, suffix, credential_ciphertext, credential_nonce,
         credential_auth_tag, wrapped_data_key, wrapping_algorithm, wrapping_key_id, created_at, updated_at
       ) VALUES ($1, 'pact', $2, 'fixture', 'Restored credential', '1234', $3, $4, $5, 'wrapped', 'RSA-OAEP-256', 'key-1', $6, $6)`,
      [credentialId, owner, Buffer.from("encrypted"), Buffer.alloc(12, 1), Buffer.alloc(16, 2), now],
    );
    const telegramLinkId = randomUUID();
    await pool.query(
      `INSERT INTO telegram_account_links(id, product_scope, account_id, telegram_user_id, display_username, linked_at)
       VALUES ($1, 'pact', $2, 10101, 'restored_user', $3)`,
      [telegramLinkId, owner, now],
    );

    const deletion = await restorePrivacy.requestDeletion(owner);
    expect(deletion.purgeDueAt).toEqual(new Date(baseTime.getTime() + 30 * 24 * 60 * 60_000));
    expect((await pool.query("SELECT status FROM accounts WHERE id = $1", [owner])).rows[0]?.status).toBe("closing");
    expect(
      (await pool.query("SELECT revoked_at FROM sessions WHERE id = $1", [sessionId])).rows[0]?.revoked_at,
    ).toEqual(now);
    expect((await pool.query("SELECT status FROM envoy_runs WHERE account_id = $1", [owner])).rows[0]?.status).toBe(
      "stopped",
    );
    expect(externalTombstones).toHaveLength(1);

    // Simulate a pre-deletion backup restoring live data and losing the database copy of the tombstone.
    await pool.query("DELETE FROM privacy_deletion_registry WHERE account_id = $1", [owner]);
    await pool.query("UPDATE accounts SET status = 'active' WHERE id = $1", [owner]);
    await pool.query("UPDATE sessions SET revoked_at = NULL WHERE id = $1", [sessionId]);
    await pool.query(
      `UPDATE model_connections SET revoked_at = NULL, credential_ciphertext = $2, credential_nonce = $3,
         credential_auth_tag = $4, wrapped_data_key = 'wrapped', wrapping_algorithm = 'RSA-OAEP-256',
         wrapping_key_id = 'key-1' WHERE id = $1`,
      [credentialId, Buffer.from("encrypted"), Buffer.alloc(12, 1), Buffer.alloc(16, 2)],
    );
    await pool.query(
      `INSERT INTO telegram_account_links(id, product_scope, account_id, telegram_user_id, display_username, linked_at)
       VALUES ($1, 'pact', $2, 10101, 'restored_user', $3)`,
      [telegramLinkId, owner, now],
    );
    expect(await restorePrivacy.replayDeletionRegistry()).toEqual({ closed: 1, purged: 0 });
    expect((await pool.query("SELECT status FROM accounts WHERE id = $1", [owner])).rows[0]?.status).toBe("closing");
    expect(
      (await pool.query("SELECT revoked_at FROM sessions WHERE id = $1", [sessionId])).rows[0]?.revoked_at,
    ).toEqual(now);
    expect(
      (await pool.query("SELECT credential_ciphertext FROM model_connections WHERE id = $1", [credentialId])).rows[0]
        ?.credential_ciphertext,
    ).toBeNull();
    expect((await pool.query("SELECT 1 FROM telegram_account_links WHERE account_id = $1", [owner])).rowCount).toBe(0);

    now = new Date(baseTime.getTime() + 30 * 24 * 60 * 60_000);
    expect(await restorePrivacy.replayDeletionRegistry()).toEqual({ closed: 1, purged: 1 });
    expect((await pool.query("SELECT 1 FROM accounts WHERE id = $1", [owner])).rowCount).toBe(0);
    expect(
      (await pool.query("SELECT completed_at FROM privacy_deletion_registry WHERE account_id = $1", [owner])).rows[0]
        ?.completed_at,
    ).toEqual(now);
  });

  it("honors reviewed legal-hold metadata until release", async () => {
    const owner = await account(`hold-${randomUUID()}@example.test`);
    await privacy.requestDeletion(owner);
    const holdId = await privacy.placeLegalHold({
      accountId: owner,
      dataScope: "security_events",
      legalBasis: "fixture-litigation-hold",
      reviewAt: new Date(baseTime.getTime() + 90 * 24 * 60 * 60_000),
    });
    now = new Date(baseTime.getTime() + 31 * 24 * 60 * 60_000);
    expect(await privacy.replayDeletionRegistry()).toEqual({ closed: 1, purged: 0 });
    expect((await pool.query("SELECT 1 FROM accounts WHERE id = $1", [owner])).rowCount).toBe(1);
    await privacy.releaseLegalHold(holdId);
    expect(await privacy.replayDeletionRegistry()).toEqual({ closed: 1, purged: 1 });
    expect((await pool.query("SELECT 1 FROM accounts WHERE id = $1", [owner])).rowCount).toBe(0);
  });
});
