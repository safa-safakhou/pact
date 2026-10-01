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
  /** Module-owned lifecycle hooks; reusable privacy does not import product tables or types. */
  readonly ownedData?: readonly {
    name: string;
    forgetAccount(client: PoolClient, accountId: string): Promise<void>;
    prune(client: PoolClient, now: Date): Promise<number>;
    exportAccount?(client: PoolClient, accountId: string): Promise<unknown>;
  }[];
  /** Product-owned game cleanup, committed with credential/session revocation. */
  readonly retirement?: {
    begin(client: PoolClient, accountId: string): Promise<void>;
    eraseIdentity(client: PoolClient, accountId: string): Promise<void>;
    pruneHistory(client: PoolClient, before: Date): Promise<number>;
    pruneKingdoms(client: PoolClient, before: Date): Promise<number>;
  };
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
      await this.beginRetirement(client, accountId);
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
          await this.beginRetirement(client, record.account_id);
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
      const directMessages = await client.query("DELETE FROM direct_messages WHERE created_at <= $1", [
        new Date(now.getTime() - days(90)),
      ]);
      const coldRequests = await client.query("DELETE FROM cold_contact_requests WHERE created_at <= $1", [
        new Date(now.getTime() - days(90)),
      ]);
      const directTransfers = await client.query("DELETE FROM direct_transfers WHERE created_at <= $1", [
        new Date(now.getTime() - days(180)),
      ]);
      const contactInvitations = await client.query("DELETE FROM direct_contact_invitations WHERE expires_at <= $1", [
        new Date(now.getTime() - days(1)),
      ]);
      const closedSupplyOffers = await client.query(
        "DELETE FROM supply_offers WHERE status IN ('withdrawn', 'expired') AND closed_at <= $1",
        [new Date(now.getTime() - days(180))],
      );
      const closedSupplyContracts = await client.query<{ offer_id: string }>(
        "DELETE FROM supply_contracts WHERE status <> 'active' AND closed_at <= $1 RETURNING offer_id",
        [new Date(now.getTime() - days(180))],
      );
      if (closedSupplyContracts.rows.length) {
        await client.query("DELETE FROM supply_offers WHERE id = ANY($1::uuid[])", [
          closedSupplyContracts.rows.map((row) => row.offer_id),
        ]);
      }
      await client.query("DELETE FROM garrison_offers WHERE status IN ('withdrawn', 'expired') AND closed_at <= $1", [
        new Date(now.getTime() - days(180)),
      ]);
      const closedGarrisons = await client.query<{ offer_id: string; id: string }>(
        "DELETE FROM garrison_contracts WHERE status = 'closed' AND closed_at <= $1 RETURNING offer_id, id",
        [new Date(now.getTime() - days(180))],
      );
      if (closedGarrisons.rows.length) {
        await client.query("DELETE FROM garrison_offers WHERE id = ANY($1::uuid[])", [
          closedGarrisons.rows.map((row) => row.offer_id),
        ]);
        await client.query("DELETE FROM garrison_upkeep_defaults WHERE detachment_ref = ANY($1::uuid[])", [
          closedGarrisons.rows.map((row) => row.id),
        ]);
      }
      await client.query("DELETE FROM scout_operations WHERE status = 'completed' AND completed_at <= $1", [
        new Date(now.getTime() - days(180)),
      ]);
      const closedRaids = await client.query<{ id: string }>(
        "DELETE FROM raids WHERE status IN ('resolved','canceled') AND closed_at <= $1 RETURNING id",
        [new Date(now.getTime() - days(180))],
      );
      if (closedRaids.rows.length) {
        await client.query("DELETE FROM battle_eligibility_snapshots WHERE battle_id = ANY($1::uuid[])", [
          closedRaids.rows.map((row) => row.id),
        ]);
      }
      const authoritySpends = await client.query("DELETE FROM authority_spends WHERE created_at <= $1", [
        new Date(now.getTime() - days(180)),
      ]);
      const closedAuthorityCommitments = await client.query(
        "DELETE FROM authority_commitments WHERE status = 'closed' AND closed_at <= $1",
        [new Date(now.getTime() - days(180))],
      );
      const authorityHumanPermits = await client.query(
        "DELETE FROM authority_human_permits WHERE expires_at <= $1 AND created_at <= $2",
        [now, new Date(now.getTime() - days(1))],
      );
      const oldRaidEvidence = await client.query(
        "DELETE FROM raid_seed_commitments WHERE status <> 'committed' AND revealed_at <= $1",
        [new Date(now.getTime() - days(180))],
      );
      const retiredMovements =
        (await this.options.retirement?.pruneHistory(client, new Date(now.getTime() - days(180)))) ?? 0;
      const retiredKingdoms =
        (await this.options.retirement?.pruneKingdoms(client, new Date(now.getTime() - days(180)))) ?? 0;
      const bootstraps = await client.query("DELETE FROM telegram_link_bootstraps WHERE expires_at <= $1", [now]);
      const deletionRegistry = await client.query(
        "DELETE FROM privacy_deletion_registry WHERE backup_suppress_until <= $1",
        [now],
      );
      return {
        replayClosed: replay.closed,
        ...Object.fromEntries(
          await Promise.all(
            (this.options.ownedData ?? []).map(async (owner) => [owner.name, await owner.prune(client, now)]),
          ),
        ),
        accountsPurged: replay.purged,
        exports: exports.rowCount ?? 0,
        sessions: sessions.rowCount ?? 0,
        tokens: tokenResults.reduce((sum, result) => sum + (result.rowCount ?? 0), 0),
        drafts: drafts.rowCount ?? 0,
        runs: runs.rowCount ?? 0,
        inbox: inbox.rowCount ?? 0,
        directMessages: directMessages.rowCount ?? 0,
        coldRequests: coldRequests.rowCount ?? 0,
        directTransfers: directTransfers.rowCount ?? 0,
        contactInvitations: contactInvitations.rowCount ?? 0,
        closedSupplyOffers: closedSupplyOffers.rowCount ?? 0,
        closedSupplyContracts: closedSupplyContracts.rowCount ?? 0,
        authoritySpends: authoritySpends.rowCount ?? 0,
        closedAuthorityCommitments: closedAuthorityCommitments.rowCount ?? 0,
        authorityHumanPermits: authorityHumanPermits.rowCount ?? 0,
        raidEvidence: oldRaidEvidence.rowCount ?? 0,
        retiredMovements,
        retiredKingdoms,
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
    const authorityCommitments = await query(`SELECT c.id, c.operation_key AS "operationKey", c.action,
                    c.actor_kind AS "actorKind", c.subject_ref AS "subjectRef", c.troop_count AS "troopCount",
                    c.status, c.created_game_time_ms AS "createdGameTimeMs",
                    c.closed_game_time_ms AS "closedGameTimeMs",
                    COALESCE(jsonb_agg(jsonb_build_object('asset', a.asset, 'originalUnits', a.original_units,
                      'remainingUnits', a.remaining_units, 'spentUnits', a.spent_units))
                      FILTER (WHERE a.asset IS NOT NULL), '[]'::jsonb) AS assets
             FROM authority_commitments c LEFT JOIN authority_commitment_assets a ON a.commitment_id = c.id
             WHERE c.product_scope = $1 AND c.account_id = $2 GROUP BY c.id`);
    const authoritySpends = await query(`SELECT asset, units, game_time_ms AS "gameTimeMs",
                    operation_key AS "operationKey", count_against_limit AS "countAgainstLimit"
             FROM authority_spends WHERE product_scope = $1 AND account_id = $2`);
    const authorityHumanPermits = await query(`SELECT id, action, operation_key AS "operationKey",
                    assets, troop_count AS "troopCount", used_at AS "usedAt",
                    expires_at AS "expiresAt"
             FROM authority_human_permits WHERE product_scope = $1 AND account_id = $2`);
    const runs = await query(`SELECT run_id AS "runId", subject_id AS "subjectId", status, objective, provider, model,
                    client_kind AS "clientKind", used_conversations AS "usedConversations",
                    used_messages AS "usedMessages", used_calls AS "usedCalls", used_tokens AS "usedTokens",
                    created_at AS "createdAt", updated_at AS "updatedAt", stopped_at AS "stoppedAt"
             FROM envoy_runs WHERE product_scope = $1 AND account_id = $2`);
    const runToolResults = await query(`SELECT t.run_id AS "runId", t.request_id AS "requestId",
                    t.call_id AS "callId", t.summary, t.created_at AS "createdAt"
             FROM envoy_run_tool_results t JOIN envoy_runs r ON r.run_id = t.run_id
             WHERE t.product_scope = $1 AND r.product_scope = $1 AND r.account_id = $2
             ORDER BY t.id`);
    const inbox = await query(`SELECT sequence, event_id AS "eventId", type, payload, occurred_at AS "occurredAt"
             FROM inbox_events WHERE product_scope = $1 AND account_id = $2 ORDER BY sequence`);
    const telegram =
      await query(`SELECT display_username AS "displayUsername", linked_at AS "linkedAt", revoked_at AS "revokedAt"
             FROM telegram_account_links WHERE product_scope = $1 AND account_id = $2`);
    const messages = await query(`SELECT m.id, m.sender_kingdom_id AS "senderKingdomId",
                    m.recipient_kingdom_id AS "recipientKingdomId", m.body,
                    m.sent_game_time_ms AS "sentGameTimeMs", m.read_game_time_ms AS "readGameTimeMs"
             FROM direct_messages m JOIN kingdoms k ON k.product_scope = m.product_scope
             WHERE m.product_scope = $1 AND k.account_id = $2
               AND (k.id = m.sender_kingdom_id OR k.id = m.recipient_kingdom_id)`);
    const contacts = await query(`SELECT c.kingdom_a AS "kingdomA", c.kingdom_b AS "kingdomB",
                    c.accepted_game_time_ms AS "acceptedGameTimeMs"
             FROM social_contacts c JOIN kingdoms k ON k.product_scope = c.product_scope
             WHERE c.product_scope = $1 AND k.account_id = $2 AND (k.id = c.kingdom_a OR k.id = c.kingdom_b)`);
    const transfers = await query(`SELECT t.id, t.sender_kingdom_id AS "senderKingdomId",
                    t.recipient_kingdom_id AS "recipientKingdomId", t.resource,
                    t.requested_units AS "requestedUnits", t.credited_units AS "creditedUnits",
                    t.overflow_units AS "overflowUnits", t.game_time_ms AS "gameTimeMs"
             FROM direct_transfers t JOIN kingdoms k ON k.product_scope = t.product_scope
             WHERE t.product_scope = $1 AND k.account_id = $2
               AND (k.id = t.sender_kingdom_id OR k.id = t.recipient_kingdom_id)`);
    const supplyOffers = await query(`SELECT o.id, o.kingdom_a AS "kingdomA", o.kingdom_b AS "kingdomB",
                    o.version, o.terms, o.status, o.created_game_time_ms AS "createdGameTimeMs",
                    o.expires_game_time_ms AS "expiresGameTimeMs"
             FROM supply_offers o JOIN kingdoms k ON k.product_scope = o.product_scope
             WHERE o.product_scope = $1 AND k.account_id = $2 AND (k.id = o.kingdom_a OR k.id = o.kingdom_b)`);
    const supplyContracts = await query(`SELECT c.id, c.offer_id AS "offerId", c.offer_version AS "offerVersion",
                    c.kingdom_a AS "kingdomA", c.kingdom_b AS "kingdomB", c.terms, c.status,
                    c.start_game_time_ms AS "startGameTimeMs", c.end_game_time_ms AS "endGameTimeMs",
                    c.close_reason AS "closeReason", c.closed_game_time_ms AS "closedGameTimeMs"
             FROM supply_contracts c JOIN kingdoms k ON k.product_scope = c.product_scope
             WHERE c.product_scope = $1 AND k.account_id = $2 AND (k.id = c.kingdom_a OR k.id = c.kingdom_b)`);
    const supplyInstallments = await query(`SELECT i.contract_id AS "contractId", i.game_time_ms AS "gameTimeMs",
                    i.payer_kingdom_id AS "payerKingdomId", i.recipient_kingdom_id AS "recipientKingdomId",
                    i.resource, i.due_units AS "dueUnits", i.delivered_units AS "deliveredUnits",
                    i.overflow_units AS "overflowUnits", i.failure_reason AS "failureReason"
             FROM supply_installments i JOIN supply_contracts c ON c.id = i.contract_id
             JOIN kingdoms k ON k.product_scope = c.product_scope
             WHERE i.product_scope = $1 AND k.account_id = $2 AND (k.id = c.kingdom_a OR k.id = c.kingdom_b)`);
    const garrisonOffers = await query(`SELECT o.id, o.lender_kingdom_id AS "lenderKingdomId",
                    o.host_kingdom_id AS "hostKingdomId", o.version, o.terms, o.status,
                    o.created_game_time_ms AS "createdGameTimeMs", o.expires_game_time_ms AS "expiresGameTimeMs"
             FROM garrison_offers o JOIN kingdoms k ON k.product_scope = o.product_scope
             WHERE o.product_scope = $1 AND k.account_id = $2
               AND (k.id = o.lender_kingdom_id OR k.id = o.host_kingdom_id)`);
    const garrisonContracts = await query(`SELECT c.id, c.offer_id AS "offerId",
                    c.lender_kingdom_id AS "lenderKingdomId", c.host_kingdom_id AS "hostKingdomId",
                    c.terms, c.status, c.start_game_time_ms AS "startGameTimeMs",
                    c.end_game_time_ms AS "endGameTimeMs", c.lender_default AS "lenderDefault",
                    c.host_default AS "hostDefault", c.close_reason AS "closeReason",
                    c.closed_game_time_ms AS "closedGameTimeMs"
             FROM garrison_contracts c JOIN kingdoms k ON k.product_scope = c.product_scope
             WHERE c.product_scope = $1 AND k.account_id = $2
               AND (k.id = c.lender_kingdom_id OR k.id = c.host_kingdom_id)`);
    const scoutReports = await query(`SELECT o.id, o.scout_kingdom_id AS "scoutKingdomId",
                    o.target_kingdom_id AS "targetKingdomId", o.status,
                    o.started_game_time_ms AS "startedGameTimeMs",
                    o.due_game_time_ms AS "dueGameTimeMs",
                    o.completed_game_time_ms AS "completedGameTimeMs", o.report
             FROM scout_operations o JOIN kingdoms k ON k.product_scope = o.product_scope
             WHERE o.product_scope = $1 AND k.account_id = $2
               AND (k.id = o.scout_kingdom_id OR EXISTS (
                 SELECT 1 FROM scout_report_shares s WHERE s.product_scope = o.product_scope
                   AND s.operation_id = o.id AND s.recipient_kingdom_id = k.id))`);
    const raidReports = await query(`SELECT r.id, r.leader_kingdom_id AS "leaderKingdomId",
                    r.target_kingdom_id AS "targetKingdomId", r.status,
                    r.declared_game_time_ms AS "declaredGameTimeMs",
                    r.resolution_game_time_ms AS "resolutionGameTimeMs", r.participant_report AS "participantReport"
             FROM raids r JOIN kingdoms k ON k.product_scope = r.product_scope
             WHERE r.product_scope = $1 AND k.account_id = $2
               AND (k.id = r.target_kingdom_id OR EXISTS (
                 SELECT 1 FROM raid_contributions c WHERE c.product_scope = r.product_scope
                   AND c.raid_id = r.id AND c.kingdom_id = k.id AND c.status = 'committed'))`);
    return {
      account: account.rows[0],
      ...(this.options.ownedData?.length
        ? {
            ownedData: Object.fromEntries(
              await Promise.all(
                this.options.ownedData.map(async (owner) => [
                  owner.name,
                  (await owner.exportAccount?.(client, accountId)) ?? null,
                ]),
              ),
            ),
          }
        : {}),
      drafts,
      modelConnections: connections,
      grants,
      approvals,
      mandates,
      authorityLedger: ledger,
      authorityCommitments,
      authoritySpends,
      authorityHumanPermits,
      runs,
      runToolResults,
      inbox,
      telegram,
      messages,
      contacts,
      transfers,
      supplyOffers,
      supplyContracts,
      supplyInstallments,
      garrisonOffers,
      garrisonContracts,
      scoutReports,
      raidReports,
    };
  }

  private async beginRetirement(client: PoolClient, accountId: string): Promise<void> {
    for (const owner of this.options.ownedData ?? []) await owner.forgetAccount(client, accountId);
    if (this.options.retirement) return this.options.retirement.begin(client, accountId);
    const kingdom = await client.query("SELECT 1 FROM kingdoms WHERE product_scope = $1 AND account_id = $2 LIMIT 1", [
      this.options.productScope,
      accountId,
    ]);
    if (kingdom.rowCount) throw new Error("RETIREMENT_PORT_REQUIRED");
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
    await this.options.retirement?.eraseIdentity(client, accountId);
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
