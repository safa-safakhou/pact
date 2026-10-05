import type { CommandReceipt } from "@pact/contracts";
import type { Pool } from "pg";
import { approvalReviewPath } from "./review-link.js";

export interface ApprovalStatusView {
  readonly untrustedContent: true;
  readonly approvalId: string;
  readonly commandId: string;
  readonly status: string;
  readonly effectsSummary: string;
  readonly expiresAt: Date;
  readonly receipt: CommandReceipt | null;
  readonly deepLinkPath: string;
}

interface ApprovalStatusRow {
  approval_id: string;
  command_id: string;
  status: string;
  effects_summary: string;
  expires_at: Date;
  receipt: CommandReceipt | null;
}

/** Owner-scoped status only; a model or MCP grant cannot resolve an approval. */
export class ApprovalStatusReader {
  constructor(
    private readonly pool: Pool,
    private readonly productScope: string,
    private readonly clock: { now(): Date },
    private readonly webBasePath = "/",
  ) {}

  async read(accountId: string, approvalId: string): Promise<ApprovalStatusView | null> {
    const row = (
      await this.pool.query<ApprovalStatusRow>(
        `SELECT approval_id, command_id, status, effects_summary, expires_at, receipt
         FROM approval_requests WHERE product_scope = $1 AND account_id = $2 AND approval_id = $3`,
        [this.productScope, accountId, approvalId],
      )
    ).rows[0];
    if (!row) return null;
    return {
      untrustedContent: true,
      approvalId: row.approval_id,
      commandId: row.command_id,
      status: row.status === "pending" && row.expires_at <= this.clock.now() ? "expired" : row.status,
      effectsSummary: row.effects_summary,
      expiresAt: row.expires_at,
      receipt: row.receipt,
      deepLinkPath: approvalReviewPath(row.approval_id, this.webBasePath),
    };
  }
}
