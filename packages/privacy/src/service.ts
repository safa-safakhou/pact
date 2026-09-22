import { createHash, randomBytes, randomUUID } from "node:crypto";
import { appendOutbox, withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";

const days = (value: number): number => value * 24 * 60 * 60_000;

export class PrivacyError extends Error {
  constructor(readonly code: "NOT_FOUND" | "FORBIDDEN" | "ALREADY_CLOSING") {
    super(code);
    this.name = "PrivacyError";
  }
}

export interface PrivacyClock {
  now(): Date;
}

export interface PrivacyServiceOptions {
  readonly productScope: string;
  readonly clock: PrivacyClock;
  readonly deletionRegistry?: DeletionRegistryStore;
}

export interface DeletionTombstone {
  readonly deletionId: string;
  readonly productScope: string;
  readonly accountId: string;
  readonly requestedAt: Date;
  readonly livePurgeDueAt: Date;
  readonly backupSuppressUntil: Date;
}

export interface DeletionRegistryStore {
  append(tombstone: DeletionTombstone): Promise<void>;
  read(): Promise<readonly DeletionTombstone[]>;
  compact?(now: Date): Promise<void>;
}

export interface PrivacyExportTicket {
  readonly exportId: string;
  readonly downloadToken: string;
  readonly expiresAt: Date;
}

export interface PrivacyArchive {
  readonly format: "pact-account-export-v1";
  readonly generatedAt: string;
  readonly index: string;
  readonly data: Record<string, unknown>;
}

type JsonRow = Record<string, unknown>;

function digest(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

function iso(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(iso);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, iso(child)]));
  }
  return value;
}

export class PrivacyService {
  constructor(
    private readonly pool: Pool,
    private readonly options: PrivacyServiceOptions,
  ) {}

  async requestExport(accountId: string): Promise<PrivacyExportTicket> {
    const now = this.options.clock.now();
    const expiresAt = new Date(now.getTime() + days(7));
    const downloadToken = randomBytes(32).toString("base64url");
    const exportId = randomUUID();
    await withTransaction(this.pool, async (client) => {
      const data = await this.collectAccountData(client, accountId);
      const sections = Object.entries(data)
        .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value !== null))
        .map(([name, value]) => `${name}: ${Array.isArray(value) ? `${value.length} record(s)` : "included"}`);
      const readableIndex = [
        "PACT account export",
        `Generated: ${now.toISOString()}`,
        ...sections,
        "Security credentials, token hashes, encrypted secrets, and other players' data are excluded.",
      ].join("\n");
      await client.query(
        `INSERT INTO privacy_exports(
           export_id, product_scope, account_id, token_hash, archive, readable_index, created_at, expires_at
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
        [
          exportId,
          this.options.productScope,
          accountId,
          digest(downloadToken),
          JSON.stringify(iso(data)),
          readableIndex,
          now,
          expiresAt,
        ],
      );
    });
    return { exportId, downloadToken, expiresAt };
  }

  async downloadExport(accountId: string, downloadToken: string): Promise<PrivacyArchive> {
    const now = this.options.clock.now();
    return withTransaction(this.pool, async (client) => {
      const result = await client.query<{ archive: Record<string, unknown>; readable_index: string; created_at: Date }>(
        `UPDATE privacy_exports SET downloaded_at = COALESCE(downloaded_at, $4)
         WHERE product_scope = $1 AND account_id = $2 AND token_hash = $3 AND expires_at > $4
         RETURNING archive, readable_index, created_at`,
        [this.options.productScope, accountId, digest(downloadToken), now],
      );
      const row = result.rows[0];
      if (!row) throw new PrivacyError("NOT_FOUND");
      return {
        format: "pact-account-export-v1",
        generatedAt: row.created_at.toISOString(),
        index: row.readable_index,
        data: row.archive,
      };
    });
  }

  async requestDeletion(accountId: string, requestId?: string): Promise<{ requestedAt: Date; purgeDueAt: Date }> {
    const now = this.options.clock.now();
    const purgeDueAt = new Date(now.getTime() + days(30));
    const suppressUntil = new Date(now.getTime() + days(65));
    const eligible = await this.pool.query<{ status: string }>(
      "SELECT status FROM accounts WHERE product_scope = $1 AND id = $2",
      [this.options.productScope, accountId],
    );
    if (!eligible.rows[0]) throw new PrivacyError("FORBIDDEN");
    if (eligible.rows[0].status !== "active") throw new PrivacyError("ALREADY_CLOSING");
    const tombstone: DeletionTombstone = {
      deletionId: randomUUID(),
      productScope: this.options.productScope,
      accountId,
      requestedAt: now,
      livePurgeDueAt: purgeDueAt,
      backupSuppressUntil: suppressUntil,
    };
    // The external append-only store is the restore authority. Record it before
    // mutating live data so a successful deletion can never lack a tombstone.
    await this.options.deletionRegistry?.append(tombstone);
    await withTransaction(this.pool, async (client) => {
      const account = await client.query<{ status: string }>(
        "SELECT status FROM accounts WHERE product_scope = $1 AND id = $2 FOR UPDATE",
        [this.options.productScope, accountId],
      );
      if (!account.rows[0]) throw new PrivacyError("FORBIDDEN");
      if (account.rows[0].status !== "active") throw new PrivacyError("ALREADY_CLOSING");
      await client.query(
        `INSERT INTO privacy_deletion_registry(
           deletion_id, product_scope, account_id, requested_at, live_purge_due_at, backup_suppress_until
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT(product_scope, account_id) DO UPDATE SET
           requested_at = LEAST(privacy_deletion_registry.requested_at, EXCLUDED.requested_at),
           live_purge_due_at = LEAST(privacy_deletion_registry.live_purge_due_at, EXCLUDED.live_purge_due_at),
           backup_suppress_until = GREATEST(privacy_deletion_registry.backup_suppress_until, EXCLUDED.backup_suppress_until),
           completed_at = NULL`,
        [tombstone.deletionId, this.options.productScope, accountId, now, purgeDueAt, suppressUntil],
      );
      await this.closeAccount(client, accountId, now);
      await appendOutbox(client, {
        productScope: this.options.productScope,
        eventId: randomUUID(),
        type: "account.deletion_requested.v1",
        payload: { accountId, purgeDueAt: purgeDueAt.toISOString() },
        ...(requestId ? { correlation: { requestId } } : {}),
      });
    });
    return { requestedAt: now, purgeDueAt };
  }

  async status(accountId: string): Promise<{ status: string; requestedAt?: Date; purgeDueAt?: Date }> {
    const result = await this.pool.query<{
      status: string;
      requested_at: Date | null;
      live_purge_due_at: Date | null;
    }>(
      `SELECT a.status, d.requested_at, d.live_purge_due_at
       FROM accounts a LEFT JOIN privacy_deletion_registry d
         ON d.product_scope = a.product_scope AND d.account_id = a.id
       WHERE a.product_scope = $1 AND a.id = $2`,
      [this.options.productScope, accountId],
    );
    const row = result.rows[0];
    if (!row) throw new PrivacyError("NOT_FOUND");
    return {
      status: row.status,
      ...(row.requested_at ? { requestedAt: row.requested_at } : {}),
      ...(row.live_purge_due_at ? { purgeDueAt: row.live_purge_due_at } : {}),
    };
  }

  /** Must run after migrations and before accepting traffic following any restore. */
  async replayDeletionRegistry(): Promise<{ closed: number; purged: number }> {
    const now = this.options.clock.now();
    const external = (await this.options.deletionRegistry?.read()) ?? [];
    return withTransaction(this.pool, async (client) => {
      for (const tombstone of external) {
        if (tombstone.productScope !== this.options.productScope) continue;
        await client.query(
          `INSERT INTO privacy_deletion_registry(
             deletion_id, product_scope, account_id, requested_at, live_purge_due_at, backup_suppress_until
           ) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT(product_scope, account_id) DO UPDATE SET
             requested_at = LEAST(privacy_deletion_registry.requested_at, EXCLUDED.requested_at),
             live_purge_due_at = LEAST(privacy_deletion_registry.live_purge_due_at, EXCLUDED.live_purge_due_at),
             backup_suppress_until = GREATEST(privacy_deletion_registry.backup_suppress_until, EXCLUDED.backup_suppress_until)`,
          [
            tombstone.deletionId,
            tombstone.productScope,
            tombstone.accountId,
            tombstone.requestedAt,
            tombstone.livePurgeDueAt,
            tombstone.backupSuppressUntil,
          ],
        );
      }
      const records = await client.query<{ account_id: string; live_purge_due_at: Date }>(
        `SELECT account_id, live_purge_due_at FROM privacy_deletion_registry
         WHERE product_scope = $1 AND backup_suppress_until > $2 FOR UPDATE`,
        [this.options.productScope, now],
      );
      let closed = 0;
      let purged = 0;
      for (const record of records.rows) {
        const exists = await client.query("SELECT 1 FROM accounts WHERE id = $1", [record.account_id]);
        if (exists.rowCount === 1) {
          await this.closeAccount(client, record.account_id, now);
          closed += 1;
          if (record.live_purge_due_at <= now && !(await this.hasLegalHold(client, record.account_id))) {
            await this.purgeAccount(client, record.account_id, now);
            purged += 1;
          }
        }
        await client.query(
          `UPDATE privacy_deletion_registry SET last_replayed_at = $3,
             completed_at = CASE WHEN NOT EXISTS(SELECT 1 FROM accounts WHERE id = $2) THEN COALESCE(completed_at, $3) ELSE completed_at END
           WHERE product_scope = $1 AND account_id = $2`,
          [this.options.productScope, record.account_id, now],
        );
      }
      return { closed, purged };
    });
  }

  async runRetention(): Promise<Record<string, number>> {
    const now = this.options.clock.now();
    const replay = await this.replayDeletionRegistry();
    const result = await withTransaction(this.pool, async (client) => {
      const exports = await client.query("DELETE FROM privacy_exports WHERE expires_at <= $1", [now]);
      const sessions = await client.query(
        `DELETE FROM sessions WHERE
           (revoked_at IS NOT NULL AND revoked_at <= $1) OR
           (expires_at <= $2) OR (idle_expires_at <= $2)`,
        [new Date(now.getTime() - days(1)), now],
      );
      const tokenCutoff = new Date(now.getTime() - days(1));
      const tokenResults = [];
      tokenResults.push(
        await client.query(
          "DELETE FROM email_verification_tokens WHERE (used_at IS NOT NULL OR expires_at <= $1) AND created_at <= $2",
          [now, tokenCutoff],
        ),
      );
      tokenResults.push(
        await client.query(
          "DELETE FROM password_reset_tokens WHERE (used_at IS NOT NULL OR expires_at <= $1) AND created_at <= $2",
          [now, tokenCutoff],
        ),
      );
      tokenResults.push(
        await client.query(
          "DELETE FROM email_change_tokens WHERE (used_at IS NOT NULL OR expires_at <= $1) AND created_at <= $2",
          [now, tokenCutoff],
        ),
      );
      const drafts = await client.query("DELETE FROM kingdom_drafts WHERE activated_at IS NULL AND expires_at <= $1", [
        now,
      ]);
      const runs = await client.query(
        `DELETE FROM envoy_runs WHERE status IN ('finished', 'stopped', 'failed') AND updated_at <= $1`,
        [new Date(now.getTime() - days(30))],
      );
      const inbox = await client.query("DELETE FROM inbox_events WHERE created_at <= $1", [
        new Date(now.getTime() - days(90)),
      ]);
      const bootstraps = await client.query("DELETE FROM telegram_link_bootstraps WHERE expires_at <= $1", [now]);
      const deletionRegistry = await client.query(
        "DELETE FROM privacy_deletion_registry WHERE backup_suppress_until <= $1",
        [now],
      );
      return {
        replayClosed: replay.closed,
        accountsPurged: replay.purged,
        exports: exports.rowCount ?? 0,
        sessions: sessions.rowCount ?? 0,
        tokens: tokenResults.reduce((sum, result) => sum + (result.rowCount ?? 0), 0),
        drafts: drafts.rowCount ?? 0,
        runs: runs.rowCount ?? 0,
        inbox: inbox.rowCount ?? 0,
        telegramBootstraps: bootstraps.rowCount ?? 0,
        deletionRegistry: deletionRegistry.rowCount ?? 0,
      };
    });
    await this.options.deletionRegistry?.compact?.(now);
    return result;
  }

  async placeLegalHold(input: {
    accountId: string;
    dataScope: string;
    legalBasis: string;
    reviewAt: Date;
  }): Promise<string> {
    const now = this.options.clock.now();
    if (input.reviewAt <= now) throw new PrivacyError("FORBIDDEN");
    const holdId = randomUUID();
    await this.pool.query(
      `INSERT INTO privacy_legal_holds(
         hold_id, product_scope, account_id, data_scope, legal_basis, placed_at, review_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [holdId, this.options.productScope, input.accountId, input.dataScope, input.legalBasis, now, input.reviewAt],
    );
    return holdId;
  }

  async releaseLegalHold(holdId: string): Promise<void> {
    await this.pool.query(
      `UPDATE privacy_legal_holds SET released_at = $3
       WHERE product_scope = $1 AND hold_id = $2 AND released_at IS NULL`,
      [this.options.productScope, holdId, this.options.clock.now()],
    );
  }

  private async collectAccountData(client: PoolClient, accountId: string): Promise<Record<string, unknown>> {
    const account = await client.query<JsonRow>(
      `SELECT id, email, email_verified_at AS "emailVerifiedAt", terms_version AS "termsVersion",
              terms_accepted_at AS "termsAcceptedAt", age_18_declared_at AS "age18DeclaredAt",
              role, status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM accounts WHERE product_scope = $1 AND id = $2 AND status = 'active'`,
      [this.options.productScope, accountId],
    );
    if (!account.rows[0]) throw new PrivacyError("FORBIDDEN");
    const query = (sql: string) =>
      client.query<JsonRow>(sql, [this.options.productScope, accountId]).then((r) => r.rows);
    const drafts = await query(`SELECT display_name AS "displayName", proposed_handle AS "proposedHandle", portrait,
                    invitation_destination_type AS "invitationDestinationType",
                    invitation_destination_id AS "invitationDestinationId", version,
                    connection_checked_at AS "connectionCheckedAt", activated_at AS "activatedAt",
                    created_at AS "createdAt", updated_at AS "updatedAt"
             FROM kingdom_drafts WHERE product_scope = $1 AND account_id = $2`);
    const connections = await query(`SELECT provider, label, suffix, version, revoked_at AS "revokedAt",
                    created_at AS "createdAt", updated_at AS "updatedAt"
             FROM model_connections WHERE product_scope = $1 AND account_id = $2`);
    const grants =
      await query(`SELECT client_id AS "clientId", audience, resource, subject_label AS "subjectLabel", scopes,
                    expires_at AS "expiresAt", revoked_at AS "revokedAt", created_at AS "createdAt"
             FROM oauth_grants WHERE product_scope = $1 AND account_id = $2`);
    const approvals =
      await query(`SELECT approval_id AS "approvalId", action, effects_summary AS "effectsSummary", status,
                    created_at AS "createdAt", expires_at AS "expiresAt", resolved_at AS "resolvedAt"
             FROM approval_requests WHERE product_scope = $1 AND account_id = $2`);
    const mandates =
      await query(`SELECT version, allowed_actions AS "allowedActions", target_restrictions AS "targetRestrictions",
                    resource_limits AS "resourceLimits", reserve_floors AS "reserveFloors",
                    troop_limit AS "troopLimit", session_limit AS "sessionLimit", updated_at AS "updatedAt"
             FROM kingdom_mandates WHERE product_scope = $1 AND account_id = $2`);
    const ledger =
      await query(`SELECT asset, spent_units AS "spentUnits", reserved_units AS "reservedUnits", updated_at AS "updatedAt"
             FROM authority_ledger WHERE product_scope = $1 AND account_id = $2`);
    const runs = await query(`SELECT run_id AS "runId", subject_id AS "subjectId", status, objective, provider, model,
                    client_kind AS "clientKind", used_conversations AS "usedConversations",
                    used_messages AS "usedMessages", used_calls AS "usedCalls", used_tokens AS "usedTokens",
                    created_at AS "createdAt", updated_at AS "updatedAt", stopped_at AS "stoppedAt"
             FROM envoy_runs WHERE product_scope = $1 AND account_id = $2`);
    const inbox = await query(`SELECT sequence, event_id AS "eventId", type, payload, occurred_at AS "occurredAt"
             FROM inbox_events WHERE product_scope = $1 AND account_id = $2 ORDER BY sequence`);
    const telegram =
      await query(`SELECT display_username AS "displayUsername", linked_at AS "linkedAt", revoked_at AS "revokedAt"
             FROM telegram_account_links WHERE product_scope = $1 AND account_id = $2`);
    return {
      account: account.rows[0],
      drafts,
      modelConnections: connections,
      grants,
      approvals,
      mandates,
      authorityLedger: ledger,
      runs,
      inbox,
      telegram,
    };
  }

  private async closeAccount(client: PoolClient, accountId: string, now: Date): Promise<void> {
    await client.query(
      "UPDATE accounts SET status = 'closing', updated_at = $3 WHERE product_scope = $1 AND id = $2 AND status <> 'closed'",
      [this.options.productScope, accountId, now],
    );
    await client.query("UPDATE sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE account_id = $1", [
      accountId,
      now,
    ]);
    await client.query(
      "UPDATE oauth_grants SET revoked_at = COALESCE(revoked_at, $2), access_token_hash = NULL WHERE account_id = $1",
      [accountId, now],
    );
    await client.query(
      `UPDATE oauth_refresh_tokens SET revoked_at = COALESCE(revoked_at, $2)
       WHERE grant_id IN (SELECT id FROM oauth_grants WHERE account_id = $1)`,
      [accountId, now],
    );
    await client.query("DELETE FROM oauth_authorization_codes WHERE account_id = $1", [accountId]);
    await client.query("UPDATE mcp_sessions SET closed_at = COALESCE(closed_at, $2) WHERE account_id = $1", [
      accountId,
      now,
    ]);
    await client.query(
      `UPDATE model_connections SET revoked_at = COALESCE(revoked_at, $2), credential_ciphertext = NULL,
         credential_nonce = NULL, credential_auth_tag = NULL, wrapped_data_key = NULL,
         wrapping_algorithm = NULL, wrapping_key_id = NULL, updated_at = $2 WHERE account_id = $1`,
      [accountId, now],
    );
    await client.query("DELETE FROM openrouter_oauth_flows WHERE account_id = $1", [accountId]);
    await client.query(
      `UPDATE envoy_runs SET status = 'stopped', stopped_at = COALESCE(stopped_at, $2), updated_at = $2,
         in_flight_request_id = NULL WHERE account_id = $1 AND status IN ('running', 'waiting')`,
      [accountId, now],
    );
    await client.query(
      `UPDATE write_leases SET released_at = COALESCE(released_at, $2)
       WHERE run_id IN (SELECT run_id FROM envoy_runs WHERE account_id = $1)`,
      [accountId, now],
    );
    await client.query(
      `UPDATE approval_requests SET status = 'revoked', resolved_at = COALESCE(resolved_at, $2)
       WHERE account_id = $1 AND status = 'pending'`,
      [accountId, now],
    );
    await client.query("DELETE FROM telegram_link_bootstraps WHERE account_id = $1", [accountId]);
    await client.query("DELETE FROM telegram_account_links WHERE account_id = $1", [accountId]);
  }

  private async purgeAccount(client: PoolClient, accountId: string, now: Date): Promise<void> {
    await client.query("DELETE FROM outbox_events WHERE product_scope = $1 AND payload->>'accountId' = $2", [
      this.options.productScope,
      accountId,
    ]);
    await client.query("DELETE FROM durable_jobs WHERE product_scope = $1 AND payload->>'accountId' = $2", [
      this.options.productScope,
      accountId,
    ]);
    await client.query("DELETE FROM accounts WHERE product_scope = $1 AND id = $2", [
      this.options.productScope,
      accountId,
    ]);
    await client.query(
      `UPDATE privacy_deletion_registry SET completed_at = COALESCE(completed_at, $3), last_replayed_at = $3
       WHERE product_scope = $1 AND account_id = $2`,
      [this.options.productScope, accountId, now],
    );
  }

  private async hasLegalHold(client: PoolClient, accountId: string): Promise<boolean> {
    const result = await client.query(
      `SELECT 1 FROM privacy_legal_holds
       WHERE product_scope = $1 AND account_id = $2 AND released_at IS NULL LIMIT 1`,
      [this.options.productScope, accountId],
    );
    return result.rowCount === 1;
  }
}
