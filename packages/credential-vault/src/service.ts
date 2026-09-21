import { randomBytes, randomUUID } from "node:crypto";
import { withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
import { decryptCredential, type EncryptedCredential, encryptCredential } from "./crypto.js";
import type {
  CredentialAdmission,
  CredentialClock,
  CredentialIdFactory,
  CredentialKeyUnwrapper,
  CredentialKeyWrapper,
  CredentialSummary,
  CredentialWrapContext,
  ModelProvider,
  WrappedDataKey,
} from "./types.js";
import { CredentialVaultError, MODEL_PROVIDERS } from "./types.js";

const MAX_CONNECTIONS = 5;
const MAX_CREDENTIAL_BYTES = 16_384;

interface CredentialRow {
  id: string;
  account_id: string;
  provider: ModelProvider;
  label: string;
  suffix: string;
  credential_ciphertext: Buffer | null;
  credential_nonce: Buffer | null;
  credential_auth_tag: Buffer | null;
  wrapped_data_key: string | null;
  wrapping_algorithm: "RSA-OAEP-256" | null;
  wrapping_key_id: string | null;
  version: number;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface VaultOptions {
  readonly productScope: string;
  readonly clock: CredentialClock;
  readonly ids?: CredentialIdFactory;
}

interface WriteOptions extends VaultOptions {
  readonly wrapper: CredentialKeyWrapper;
  readonly randomBytes?: (size: number) => Uint8Array;
}

interface ResolveOptions extends VaultOptions {
  readonly unwrapper: CredentialKeyUnwrapper;
}

function assertProvider(provider: string): asserts provider is ModelProvider {
  if (!(MODEL_PROVIDERS as readonly string[]).includes(provider)) throw new CredentialVaultError("INVALID_INPUT");
}

function toSummary(row: CredentialRow): CredentialSummary {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    suffix: row.suffix,
    version: row.version,
    status: row.revoked_at ? "revoked" : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
  };
}

function context(
  options: VaultOptions,
  row: Pick<CredentialRow, "account_id" | "id" | "provider" | "version">,
): CredentialWrapContext {
  return {
    productScope: options.productScope,
    accountId: row.account_id,
    credentialId: row.id,
    provider: row.provider,
    version: row.version,
  };
}

function encryptedFromRow(row: CredentialRow): EncryptedCredential {
  if (
    !row.credential_ciphertext ||
    !row.credential_nonce ||
    !row.credential_auth_tag ||
    !row.wrapped_data_key ||
    row.wrapping_algorithm !== "RSA-OAEP-256" ||
    !row.wrapping_key_id
  ) {
    throw new CredentialVaultError("DECRYPTION_FAILED");
  }
  const wrappedDataKey: WrappedDataKey = {
    algorithm: row.wrapping_algorithm,
    keyId: row.wrapping_key_id,
    wrappedKey: row.wrapped_data_key,
  };
  return {
    ciphertext: row.credential_ciphertext,
    nonce: row.credential_nonce,
    authTag: row.credential_auth_tag,
    wrappedDataKey,
  };
}

function credentialBytes(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CREDENTIAL_BYTES) {
    bytes.fill(0);
    throw new CredentialVaultError("INVALID_INPUT");
  }
  return bytes;
}

function normalizedLabel(value: string): string {
  const label = value.trim();
  if (!label || label.length > 80) throw new CredentialVaultError("INVALID_INPUT");
  return label;
}

async function insertAudit(
  client: PoolClient,
  options: VaultOptions,
  row: Pick<CredentialRow, "account_id" | "id" | "version">,
  eventType: "saved" | "replaced" | "revoked",
): Promise<void> {
  await client.query(
    `INSERT INTO model_credential_audit_events(
       product_scope, account_id, credential_id, event_type, credential_version, occurred_at
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [options.productScope, row.account_id, row.id, eventType, row.version, options.clock.now()],
  );
}

export class CredentialVaultService {
  readonly #ids: CredentialIdFactory;
  readonly #randomBytes: (size: number) => Uint8Array;

  constructor(
    private readonly pool: Pool,
    private readonly options: WriteOptions,
  ) {
    this.#ids = options.ids ?? { create: randomUUID };
    this.#randomBytes = options.randomBytes ?? randomBytes;
  }

  async save(
    accountId: string,
    input: { provider: ModelProvider; label: string; credential: string },
  ): Promise<CredentialSummary> {
    assertProvider(input.provider);
    const label = normalizedLabel(input.label);
    const plaintext = credentialBytes(input.credential);
    const id = this.#ids.create();
    const version = 1;
    const rowContext: CredentialWrapContext = {
      productScope: this.options.productScope,
      accountId,
      credentialId: id,
      provider: input.provider,
      version,
    };
    let encrypted: EncryptedCredential;
    try {
      encrypted = await encryptCredential(plaintext, rowContext, this.options.wrapper, this.#randomBytes);
    } finally {
      plaintext.fill(0);
    }
    const suffix = [...input.credential].slice(-4).join("");
    try {
      return await withTransaction(this.pool, async (client) => {
        const account = await client.query(
          "SELECT id FROM accounts WHERE product_scope = $1 AND id = $2 AND status = 'active' FOR UPDATE",
          [this.options.productScope, accountId],
        );
        if (account.rowCount !== 1) throw new CredentialVaultError("FORBIDDEN");
        const count = await client.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM model_connections WHERE product_scope = $1 AND account_id = $2 AND revoked_at IS NULL",
          [this.options.productScope, accountId],
        );
        if (Number(count.rows[0]?.count ?? "0") >= MAX_CONNECTIONS) throw new CredentialVaultError("LIMIT_REACHED");
        const inserted = await client.query<CredentialRow>(
          `INSERT INTO model_connections(
             id, product_scope, account_id, provider, label, suffix, credential_ciphertext,
             credential_nonce, credential_auth_tag, wrapped_data_key, wrapping_algorithm,
             wrapping_key_id, version, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
           RETURNING *`,
          [
            id,
            this.options.productScope,
            accountId,
            input.provider,
            label,
            suffix,
            Buffer.from(encrypted.ciphertext),
            Buffer.from(encrypted.nonce),
            Buffer.from(encrypted.authTag),
            encrypted.wrappedDataKey.wrappedKey,
            encrypted.wrappedDataKey.algorithm,
            encrypted.wrappedDataKey.keyId,
            version,
            this.options.clock.now(),
          ],
        );
        const row = inserted.rows[0];
        if (!row) throw new Error("credential insert failed");
        await insertAudit(client, this.options, row, "saved");
        return toSummary(row);
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new CredentialVaultError("ALREADY_EXISTS");
      }
      throw error;
    }
  }

  async replace(
    accountId: string,
    credentialId: string,
    input: { credential: string; label?: string; expectedVersion: number },
  ): Promise<CredentialSummary> {
    const existing = await this.loadOwned(accountId, credentialId);
    if (!existing || existing.revoked_at) throw new CredentialVaultError("NOT_FOUND");
    if (existing.version !== input.expectedVersion) throw new CredentialVaultError("STALE_VERSION");
    const nextVersion = existing.version + 1;
    const plaintext = credentialBytes(input.credential);
    let encrypted: EncryptedCredential;
    try {
      encrypted = await encryptCredential(
        plaintext,
        context(this.options, { ...existing, version: nextVersion }),
        this.options.wrapper,
        this.#randomBytes,
      );
    } finally {
      plaintext.fill(0);
    }
    const label = input.label === undefined ? existing.label : normalizedLabel(input.label);
    const suffix = [...input.credential].slice(-4).join("");
    return withTransaction(this.pool, async (client) => {
      const current = await client.query<CredentialRow>(
        `SELECT * FROM model_connections
         WHERE product_scope = $1 AND account_id = $2 AND id = $3 FOR UPDATE`,
        [this.options.productScope, accountId, credentialId],
      );
      const row = current.rows[0];
      if (!row || row.revoked_at) throw new CredentialVaultError("NOT_FOUND");
      if (row.version !== input.expectedVersion) throw new CredentialVaultError("STALE_VERSION");
      const updated = await client.query<CredentialRow>(
        `UPDATE model_connections SET
           label = $4, suffix = $5, credential_ciphertext = $6, credential_nonce = $7,
           credential_auth_tag = $8, wrapped_data_key = $9, wrapping_algorithm = $10,
           wrapping_key_id = $11, version = $12, updated_at = $13
         WHERE product_scope = $1 AND account_id = $2 AND id = $3 RETURNING *`,
        [
          this.options.productScope,
          accountId,
          credentialId,
          label,
          suffix,
          Buffer.from(encrypted.ciphertext),
          Buffer.from(encrypted.nonce),
          Buffer.from(encrypted.authTag),
          encrypted.wrappedDataKey.wrappedKey,
          encrypted.wrappedDataKey.algorithm,
          encrypted.wrappedDataKey.keyId,
          nextVersion,
          this.options.clock.now(),
        ],
      );
      const next = updated.rows[0];
      if (!next) throw new Error("credential replace failed");
      await insertAudit(client, this.options, next, "replaced");
      return toSummary(next);
    });
  }

  async revoke(accountId: string, credentialId: string): Promise<CredentialSummary> {
    return withTransaction(this.pool, async (client) => {
      const current = await client.query<CredentialRow>(
        `SELECT * FROM model_connections
         WHERE product_scope = $1 AND account_id = $2 AND id = $3 FOR UPDATE`,
        [this.options.productScope, accountId, credentialId],
      );
      const row = current.rows[0];
      if (!row) throw new CredentialVaultError("NOT_FOUND");
      if (row.revoked_at) return toSummary(row);
      const revokedAt = this.options.clock.now();
      const updated = await client.query<CredentialRow>(
        `UPDATE model_connections SET
           credential_ciphertext = NULL, credential_nonce = NULL, credential_auth_tag = NULL,
           wrapped_data_key = NULL, wrapping_algorithm = NULL, wrapping_key_id = NULL,
           revoked_at = $4, updated_at = $4, version = version + 1
         WHERE product_scope = $1 AND account_id = $2 AND id = $3 RETURNING *`,
        [this.options.productScope, accountId, credentialId, revokedAt],
      );
      const next = updated.rows[0];
      if (!next) throw new Error("credential revoke failed");
      await insertAudit(client, this.options, next, "revoked");
      await client.query(
        `INSERT INTO outbox_events(product_scope, event_id, type, payload, created_at)
         VALUES ($1, gen_random_uuid(), 'model-credential.revoked.v1', $2::jsonb, $3)`,
        [this.options.productScope, JSON.stringify({ accountId, credentialId, provider: next.provider }), revokedAt],
      );
      return toSummary(next);
    });
  }

  async list(accountId: string): Promise<CredentialSummary[]> {
    const result = await this.pool.query<CredentialRow>(
      `SELECT * FROM model_connections
       WHERE product_scope = $1 AND account_id = $2
       ORDER BY (revoked_at IS NULL) DESC, created_at, id`,
      [this.options.productScope, accountId],
    );
    return result.rows.map(toSummary);
  }

  private async loadOwned(accountId: string, credentialId: string): Promise<CredentialRow | null> {
    const result = await this.pool.query<CredentialRow>(
      "SELECT * FROM model_connections WHERE product_scope = $1 AND account_id = $2 AND id = $3",
      [this.options.productScope, accountId, credentialId],
    );
    return result.rows[0] ?? null;
  }
}

export class CredentialResolver {
  readonly #ids: CredentialIdFactory;

  constructor(
    private readonly pool: Pool,
    private readonly options: ResolveOptions,
  ) {
    this.#ids = options.ids ?? { create: randomUUID };
  }

  async withCredential<T>(
    accountId: string,
    credentialId: string,
    operation: (credential: Uint8Array, admission: CredentialAdmission) => Promise<T>,
  ): Promise<T> {
    const { row, admission } = await this.admit(accountId, credentialId);
    let plaintext: Buffer | undefined;
    try {
      plaintext = Buffer.from(
        await decryptCredential(encryptedFromRow(row), context(this.options, row), this.options.unwrapper),
      );
      const result = await operation(plaintext, admission);
      await this.completeUse(admission.useId, "completed");
      return result;
    } catch (error) {
      await this.completeUse(admission.useId, "failed");
      throw error;
    } finally {
      plaintext?.fill(0);
    }
  }

  private async admit(
    accountId: string,
    credentialId: string,
  ): Promise<{ row: CredentialRow; admission: CredentialAdmission }> {
    return withTransaction(this.pool, async (client) => {
      const selected = await client.query<CredentialRow>(
        `SELECT * FROM model_connections
         WHERE product_scope = $1 AND account_id = $2 AND id = $3 FOR UPDATE`,
        [this.options.productScope, accountId, credentialId],
      );
      const row = selected.rows[0];
      if (!row) throw new CredentialVaultError("NOT_FOUND");
      if (row.revoked_at) throw new CredentialVaultError("REVOKED");
      const useId = this.#ids.create();
      const admittedAt = this.options.clock.now();
      await client.query(
        `INSERT INTO model_credential_uses(
           id, product_scope, account_id, credential_id, credential_version, status, admitted_at
         ) VALUES ($1, $2, $3, $4, $5, 'admitted', $6)`,
        [useId, this.options.productScope, accountId, credentialId, row.version, admittedAt],
      );
      return {
        row,
        admission: {
          useId,
          credentialId,
          provider: row.provider,
          label: row.label,
          admittedAt,
          revocationNotice: "A provider request admitted before revocation may complete.",
        },
      };
    });
  }

  private async completeUse(useId: string, status: "completed" | "failed"): Promise<void> {
    await this.pool.query(
      `UPDATE model_credential_uses SET status = $3, completed_at = $4
       WHERE product_scope = $1 AND id = $2 AND status = 'admitted'`,
      [this.options.productScope, useId, status, this.options.clock.now()],
    );
  }
}
