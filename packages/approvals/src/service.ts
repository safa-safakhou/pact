import { randomUUID } from "node:crypto";
import { type AuthenticatedPrincipal, type CommandDispatcher, describeApprovalEffects } from "@pact/application";
import {
  ApprovalProposalSchema,
  type CommandEnvelope,
  CommandEnvelopeSchema,
  type CommandReceipt,
  ProductScopeSchema,
  SCHEMA_VERSION,
} from "@pact/contracts";
import { appendOutbox, withTransaction } from "@pact/db";
import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import type { Pool, PoolClient } from "pg";
import { hashExactCommand } from "./portable.js";
import { approvalReviewPath } from "./review-link.js";

export class ApprovalError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "EXPIRED" | "INVALID_TERMS" | "ALREADY_RESOLVED" | "NOT_COMMITTED",
  ) {
    super(code);
    this.name = "ApprovalError";
  }
}

export interface ApprovalView {
  readonly approvalId: string;
  readonly status: string;
  readonly effectsSummary: string;
  readonly commandId: string;
  readonly expiresAt: Date;
  readonly receipt: CommandReceipt | null;
  readonly deepLinkPath: string;
}

interface ApprovalRow {
  approval_id: string;
  account_id: string;
  command_id: string;
  canonical_command_hash: string;
  action: CommandEnvelope["action"];
  effects_summary: string;
  status: string;
  receipt: CommandReceipt | null;
  expires_at: Date;
  created_at: Date;
}

export class ApprovalService {
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      identity?: IdentityService;
      dispatcher: CommandDispatcher;
      clock: { now(): Date };
      origin?: string;
      webBasePath?: string;
      assertAgentWriteLease?: (client: PoolClient, accountId: string, holderId: string) => Promise<void>;
      inbox?: {
        publishForAccount(
          client: PoolClient,
          input: { accountId: string; type: string; payload: unknown },
        ): Promise<string>;
      };
    },
  ) {}

  async createRequest(input: {
    accountId: string;
    command: CommandEnvelope;
    effectsSummary: string;
    requestingClientId?: string;
    runId?: string;
    mandateVersion?: number;
  }): Promise<ApprovalView> {
    return withTransaction(this.pool, (client) => this.createRequestInTransaction(client, input));
  }

  /** Agent proposal is not a human approval or an agent game command. */
  async proposeAgent(principal: AuthenticatedPrincipal, rawProposal: unknown, runId?: string): Promise<ApprovalView> {
    const holderId = principal.sessionId;
    if (
      principal.audience !== "agent" ||
      principal.productScope !== this.options.productScope ||
      !principal.agentScopes?.includes("game:act") ||
      !holderId ||
      !this.options.assertAgentWriteLease
    ) {
      throw new ApprovalError("FORBIDDEN");
    }
    const parsed = ApprovalProposalSchema.safeParse(rawProposal);
    if (!parsed.success) throw new ApprovalError("INVALID_TERMS");
    const { commandId, action } = parsed.data;
    const command: CommandEnvelope = {
      schemaVersion: SCHEMA_VERSION,
      commandId,
      actor: {
        principalId: principal.accountId,
        productScope: principal.productScope,
        audience: "agent",
        subject: { type: "account", id: principal.accountId },
        sessionId: holderId,
      },
      action,
      submittedAt: this.options.clock.now().toISOString(),
    };
    const effectsSummary = describeApprovalEffects(action);
    const mandateVersion = "mandateVersion" in action ? action.mandateVersion : undefined;
    return withTransaction(this.pool, async (client) => {
      await this.options.assertAgentWriteLease?.(client, principal.accountId, holderId);
      return this.createRequestInTransaction(client, {
        accountId: principal.accountId,
        command,
        effectsSummary,
        requestingClientId: holderId,
        ...(runId ? { runId } : {}),
        ...(mandateVersion !== undefined ? { mandateVersion } : {}),
      });
    });
  }

  private async createRequestInTransaction(
    client: PoolClient,
    input: {
      accountId: string;
      command: CommandEnvelope;
      effectsSummary: string;
      requestingClientId?: string;
      runId?: string;
      mandateVersion?: number;
    },
  ): Promise<ApprovalView> {
    const command = CommandEnvelopeSchema.parse(input.command);
    if (
      command.actor.principalId !== input.accountId ||
      command.actor.productScope !== this.options.productScope ||
      command.actor.subject.type !== "account" ||
      command.actor.subject.id !== input.accountId
    ) {
      throw new ApprovalError("FORBIDDEN");
    }
    const hash = hashCommand(command);
    const now = this.options.clock.now();
    // Serialize equivalent proposals per owner. Preserve the first exact command ID;
    // never replace an uncertain command with the later caller's generated ID.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `approval:${this.options.productScope}:${input.accountId}`,
    ]);
    const sameId = (
      await client.query<ApprovalRow>("SELECT * FROM approval_requests WHERE product_scope=$1 AND command_id=$2", [
        this.options.productScope,
        command.commandId,
      ])
    ).rows[0];
    if (sameId) {
      if (sameId.account_id !== input.accountId) throw new ApprovalError("FORBIDDEN");
      if (sameId.canonical_command_hash !== hash) throw new ApprovalError("INVALID_TERMS");
      return this.toView(this.maybeExpire(sameId));
    }
    await client.query(
      "UPDATE approval_requests SET status='expired',resolved_at=$3 WHERE product_scope=$1 AND account_id=$2 AND status='pending' AND expires_at<=$3",
      [this.options.productScope, input.accountId, now],
    );
    const equivalent = (
      await client.query<ApprovalRow>(
        "SELECT * FROM approval_requests WHERE product_scope=$1 AND account_id=$2 AND status='pending' AND expires_at>$3 AND action=$4::jsonb ORDER BY created_at,approval_id LIMIT 1",
        [this.options.productScope, input.accountId, now, JSON.stringify(command.action)],
      )
    ).rows[0];
    if (equivalent) return this.toView(equivalent);
    const expiresAt = new Date(now.getTime() + 15 * 60_000);
    const inserted = await client.query<ApprovalRow>(
      `INSERT INTO approval_requests(
         product_scope, account_id, command_id, canonical_command_hash, action, effects_summary,
         mandate_version, requesting_client_id, run_id, expires_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
       ON CONFLICT(product_scope, command_id) DO NOTHING
       RETURNING *`,
      [
        this.options.productScope,
        input.accountId,
        command.commandId,
        hash,
        JSON.stringify(command.action),
        input.effectsSummary,
        input.mandateVersion ?? null,
        input.requestingClientId ?? null,
        input.runId ?? null,
        expiresAt,
      ],
    );
    const row =
      inserted.rows[0] ??
      (
        await client.query<ApprovalRow>(
          `SELECT * FROM approval_requests WHERE product_scope = $1 AND command_id = $2`,
          [this.options.productScope, command.commandId],
        )
      ).rows[0];
    if (!row) throw new Error("approval insert failed");
    if (row.account_id !== input.accountId) throw new ApprovalError("FORBIDDEN");
    if (row.canonical_command_hash !== hash) throw new ApprovalError("INVALID_TERMS");
    if (inserted.rows[0]) {
      await this.options.inbox?.publishForAccount(client, {
        accountId: input.accountId,
        type: "approval.requested.v1",
        payload: { approvalId: row.approval_id, commandId: command.commandId, actionKind: command.action.kind },
      });
      await appendOutbox(client, {
        productScope: this.options.productScope,
        eventId: randomUUID(),
        type: "approval.requested.v1",
        payload: { approvalId: row.approval_id, commandId: command.commandId },
      });
    }
    return this.toView(row);
  }

  /** Read-only owner projection; expired requests never become pending decisions. */
  async pendingForAccount(accountId: string): Promise<{ approvals: ApprovalView[]; truncated: boolean }> {
    const rows = (
      await this.pool.query<ApprovalRow>(
        "SELECT * FROM approval_requests WHERE product_scope=$1 AND account_id=$2 AND status='pending' AND expires_at>$3 ORDER BY created_at,approval_id LIMIT 11",
        [this.options.productScope, accountId, this.options.clock.now()],
      )
    ).rows;
    return { approvals: rows.slice(0, 10).map((row) => this.toView(row)), truncated: rows.length > 10 };
  }

  async review(approvalId: string, accountId: string): Promise<ApprovalView> {
    const row = this.maybeExpire(await this.load(approvalId));
    if (row.account_id !== accountId) throw new ApprovalError("FORBIDDEN");
    return this.toView(row);
  }

  async approve(sessionToken: string, approvalId: string): Promise<ApprovalView> {
    const session = await this.requireHuman(sessionToken);
    return this.approveForHumanPrincipal(session.accountId, session.sessionId, approvalId);
  }

  /** First-party human transports may call this only after authenticating a human-scoped principal. */
  async approveForHumanPrincipal(accountId: string, sessionId: string, approvalId: string): Promise<ApprovalView> {
    const outcome = await withTransaction(this.pool, async (client) => {
      const loaded = await client.query<ApprovalRow>(
        `SELECT * FROM approval_requests WHERE approval_id = $1 AND product_scope = $2 FOR UPDATE`,
        [approvalId, this.options.productScope],
      );
      let row = loaded.rows[0];
      if (!row) throw new ApprovalError("NOT_FOUND");
      if (row.account_id !== accountId) throw new ApprovalError("FORBIDDEN");
      row = this.maybeExpire(row);
      if (row.status === "approved" && row.receipt) return { kind: "done" as const, view: this.toView(row) };
      if (row.status === "expired") {
        await client.query(
          `UPDATE approval_requests SET status = 'expired', resolved_at = COALESCE(resolved_at, $2) WHERE approval_id = $1`,
          [approvalId, this.options.clock.now()],
        );
        return { kind: "expired" as const };
      }
      if (row.status !== "pending") throw new ApprovalError("ALREADY_RESOLVED");
      // Keep the approval row locked through command dispatch and resolution.
      // A concurrent reject or second approval must observe the final status,
      // never race between a committed game command and its approval receipt.
      const productScope = ProductScopeSchema.parse(this.options.productScope);
      const command: CommandEnvelope = {
        schemaVersion: SCHEMA_VERSION,
        commandId: row.command_id,
        actor: {
          principalId: accountId,
          productScope,
          audience: "human",
          subject: { type: "account", id: accountId },
          sessionId,
        },
        action: row.action,
        submittedAt: this.options.clock.now().toISOString(),
      };
      if (hashCommand(command) !== row.canonical_command_hash) throw new ApprovalError("INVALID_TERMS");
      const principal: AuthenticatedPrincipal = { accountId, productScope, audience: "human", sessionId };
      const receipt = await this.options.dispatcher.dispatch(principal, command);
      if (receipt.code !== "COMMITTED" && receipt.code !== "ALREADY_COMMITTED") {
        // A paused world cannot consume the exact approval. Roll back this
        // transaction so it stays pending for a later human retry.
        throw new ApprovalError("NOT_COMMITTED");
      }
      const updated = await client.query<ApprovalRow>(
        `UPDATE approval_requests SET status = 'approved', receipt = $2::jsonb, resolved_at = $3
         WHERE approval_id = $1 AND status = 'pending' RETURNING *`,
        [approvalId, JSON.stringify({ ...receipt, approvalId }), this.options.clock.now()],
      );
      const next =
        updated.rows[0] ??
        (await client.query<ApprovalRow>(`SELECT * FROM approval_requests WHERE approval_id = $1`, [approvalId]))
          .rows[0];
      if (!next) throw new Error("approval update failed");
      if (updated.rowCount === 1) {
        await this.options.inbox?.publishForAccount(client, {
          accountId,
          type: "approval.resolved.v1",
          payload: { approvalId, status: "approved", commandId: row.command_id },
        });
        await appendOutbox(client, {
          productScope: this.options.productScope,
          eventId: randomUUID(),
          type: "approval.resolved.v1",
          payload: { approvalId, status: "approved", commandId: row.command_id },
        });
      }
      return { kind: "done" as const, view: this.toView(next) };
    });
    if (outcome.kind === "expired") throw new ApprovalError("EXPIRED");
    return outcome.view;
  }

  async reject(sessionToken: string, approvalId: string): Promise<ApprovalView> {
    const session = await this.requireHuman(sessionToken);
    const outcome = await withTransaction(this.pool, async (client) => {
      const loaded = await client.query<ApprovalRow>(
        `SELECT * FROM approval_requests WHERE approval_id = $1 AND product_scope = $2 FOR UPDATE`,
        [approvalId, this.options.productScope],
      );
      let row = loaded.rows[0];
      if (!row) throw new ApprovalError("NOT_FOUND");
      if (row.account_id !== session.accountId) throw new ApprovalError("FORBIDDEN");
      row = this.maybeExpire(row);
      if (row.status === "rejected" && row.receipt) return { kind: "done" as const, view: this.toView(row) };
      if (row.status === "expired") {
        await client.query(
          `UPDATE approval_requests SET status = 'expired', resolved_at = COALESCE(resolved_at, $2) WHERE approval_id = $1`,
          [approvalId, this.options.clock.now()],
        );
        return { kind: "expired" as const };
      }
      if (row.status !== "pending") throw new ApprovalError("ALREADY_RESOLVED");
      const receipt: CommandReceipt = {
        schemaVersion: SCHEMA_VERSION,
        commandId: row.command_id,
        code: "FORBIDDEN",
        committedEventIds: [],
        recordVersions: {},
        charged: [],
        approvalId: row.approval_id,
      };
      const updated = await client.query<ApprovalRow>(
        `UPDATE approval_requests SET status = 'rejected', receipt = $2::jsonb, resolved_at = $3
         WHERE approval_id = $1 RETURNING *`,
        [approvalId, JSON.stringify(receipt), this.options.clock.now()],
      );
      const next = updated.rows[0];
      if (!next) throw new Error("reject update failed");
      await this.options.inbox?.publishForAccount(client, {
        accountId: session.accountId,
        type: "approval.resolved.v1",
        payload: { approvalId, status: "rejected", commandId: row.command_id },
      });
      await appendOutbox(client, {
        productScope: this.options.productScope,
        eventId: randomUUID(),
        type: "approval.resolved.v1",
        payload: { approvalId, status: "rejected", commandId: row.command_id },
      });
      return { kind: "done" as const, view: this.toView(next) };
    });
    if (outcome.kind === "expired") throw new ApprovalError("EXPIRED");
    return outcome.view;
  }

  private async requireHuman(sessionToken: string) {
    try {
      if (!this.options.identity) throw new ApprovalError("FORBIDDEN");
      return await this.options.identity.authenticate(sessionToken);
    } catch (error) {
      if (error instanceof IdentityError) throw new ApprovalError("FORBIDDEN");
      throw error;
    }
  }

  private async load(approvalId: string): Promise<ApprovalRow> {
    const result = await this.pool.query<ApprovalRow>(
      `SELECT * FROM approval_requests WHERE approval_id = $1 AND product_scope = $2`,
      [approvalId, this.options.productScope],
    );
    const row = result.rows[0];
    if (!row) throw new ApprovalError("NOT_FOUND");
    return row;
  }

  private maybeExpire(row: ApprovalRow): ApprovalRow {
    if (row.status === "pending" && row.expires_at <= this.options.clock.now()) {
      return { ...row, status: "expired" };
    }
    return row;
  }

  private toView(row: ApprovalRow): ApprovalView {
    return {
      approvalId: row.approval_id,
      status: row.status,
      effectsSummary: row.effects_summary,
      commandId: row.command_id,
      expiresAt: row.expires_at,
      receipt: row.receipt,
      deepLinkPath: approvalReviewPath(row.approval_id, this.options.webBasePath),
    };
  }
}

function hashCommand(command: CommandEnvelope): string {
  // JSONB reorders object keys. Parse into the versioned schema's key order
  // before hashing both a submitted proposal and the stored approval action.
  const parsed = CommandEnvelopeSchema.parse(command);
  return hashExactCommand(parsed.commandId, parsed.action);
}
