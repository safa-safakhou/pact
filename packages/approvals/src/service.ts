import { createHash, randomUUID } from "node:crypto";
import type { AuthenticatedPrincipal, CommandDispatcher } from "@pact/application";
import { type CommandEnvelope, type CommandReceipt, ProductScopeSchema, SCHEMA_VERSION } from "@pact/contracts";
import { appendOutbox, withTransaction } from "@pact/db";
import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import type { Pool } from "pg";

export class ApprovalError extends Error {
  constructor(readonly code: "FORBIDDEN" | "NOT_FOUND" | "EXPIRED" | "INVALID_TERMS" | "ALREADY_RESOLVED") {
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
      identity: IdentityService;
      dispatcher: CommandDispatcher;
      clock: { now(): Date };
      origin: string;
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
    const hash = hashCommand(input.command);
    const now = this.options.clock.now();
    const expiresAt = new Date(now.getTime() + 15 * 60_000);
    const inserted = await this.pool.query<ApprovalRow>(
      `INSERT INTO approval_requests(
         product_scope, account_id, command_id, canonical_command_hash, action, effects_summary,
         mandate_version, requesting_client_id, run_id, expires_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
       ON CONFLICT(product_scope, command_id) DO NOTHING
       RETURNING *`,
      [
        this.options.productScope,
        input.accountId,
        input.command.commandId,
        hash,
        JSON.stringify(input.command.action),
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
        await this.pool.query<ApprovalRow>(
          `SELECT * FROM approval_requests WHERE product_scope = $1 AND command_id = $2`,
          [this.options.productScope, input.command.commandId],
        )
      ).rows[0];
    if (!row) throw new Error("approval insert failed");
    return this.toView(row);
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
    const prepared = await withTransaction(this.pool, async (client) => {
      const loaded = await client.query<ApprovalRow>(
        `SELECT * FROM approval_requests WHERE approval_id = $1 AND product_scope = $2 FOR UPDATE`,
        [approvalId, this.options.productScope],
      );
      let row = loaded.rows[0];
      if (!row) throw new ApprovalError("NOT_FOUND");
      if (row.account_id !== accountId) throw new ApprovalError("FORBIDDEN");
      row = this.maybeExpire(row);
      if (row.status === "approved" && row.receipt) return { kind: "done" as const, row };
      if (row.status === "expired") {
        await client.query(
          `UPDATE approval_requests SET status = 'expired', resolved_at = COALESCE(resolved_at, $2) WHERE approval_id = $1`,
          [approvalId, this.options.clock.now()],
        );
        throw new ApprovalError("EXPIRED");
      }
      if (row.status !== "pending") throw new ApprovalError("ALREADY_RESOLVED");
      if (row.expires_at <= this.options.clock.now()) {
        await client.query(`UPDATE approval_requests SET status = 'expired', resolved_at = $2 WHERE approval_id = $1`, [
          approvalId,
          this.options.clock.now(),
        ]);
        throw new ApprovalError("EXPIRED");
      }
      return { kind: "run" as const, row };
    });
    if (prepared.kind === "done") return this.toView(prepared.row);

    const productScope = ProductScopeSchema.parse(this.options.productScope);
    const command: CommandEnvelope = {
      schemaVersion: SCHEMA_VERSION,
      commandId: prepared.row.command_id,
      actor: {
        principalId: accountId,
        productScope,
        audience: "human",
        subject: { type: "account", id: accountId },
        sessionId,
      },
      action: prepared.row.action,
      submittedAt: this.options.clock.now().toISOString(),
    };
    if (hashCommand(command) !== prepared.row.canonical_command_hash) {
      throw new ApprovalError("INVALID_TERMS");
    }
    const principal: AuthenticatedPrincipal = {
      accountId,
      productScope,
      audience: "human",
      sessionId,
    };
    const receipt = await this.options.dispatcher.dispatch(principal, command);
    return withTransaction(this.pool, async (client) => {
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
        await appendOutbox(client, {
          productScope: this.options.productScope,
          eventId: randomUUID(),
          type: "approval.resolved.v1",
          payload: { approvalId, status: "approved", commandId: prepared.row.command_id },
        });
      }
      return this.toView(next);
    });
  }

  async reject(sessionToken: string, approvalId: string): Promise<ApprovalView> {
    const session = await this.requireHuman(sessionToken);
    return withTransaction(this.pool, async (client) => {
      const loaded = await client.query<ApprovalRow>(
        `SELECT * FROM approval_requests WHERE approval_id = $1 AND product_scope = $2 FOR UPDATE`,
        [approvalId, this.options.productScope],
      );
      const row = loaded.rows[0];
      if (!row) throw new ApprovalError("NOT_FOUND");
      if (row.account_id !== session.accountId) throw new ApprovalError("FORBIDDEN");
      if (row.status === "rejected" && row.receipt) return this.toView(row);
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
      return this.toView(next);
    });
  }

  private async requireHuman(sessionToken: string) {
    try {
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
      deepLinkPath: `/approvals/${row.approval_id}`,
    };
  }
}

function hashCommand(command: CommandEnvelope): string {
  return createHash("sha256")
    .update(JSON.stringify({ commandId: command.commandId, action: command.action }), "utf8")
    .digest("hex");
}
