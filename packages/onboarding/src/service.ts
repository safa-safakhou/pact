import { randomUUID } from "node:crypto";
import { withTransaction } from "@pact/db";
import type { Pool } from "pg";

const sevenDays = 7 * 24 * 60 * 60_000;
const destinationTypes = new Set(["contact", "court", "notice", "story"] as const);

export type InvitationDestination = Readonly<{
  type: "contact" | "court" | "notice" | "story";
  id: string;
}>;

export interface DraftView {
  readonly id: string;
  readonly accountId: string;
  readonly displayName: string | null;
  readonly proposedHandle: string | null;
  readonly portrait: string | null;
  readonly invitationDestination: InvitationDestination | null;
  readonly connectionCheckedAt: Date | null;
  readonly expiresAt: Date;
  readonly version: number;
}

export class OnboardingError extends Error {
  constructor(readonly code: "FORBIDDEN" | "DRAFT_EXPIRED" | "DRAFT_INCOMPLETE" | "CONNECTION_STALE") {
    super(code);
    this.name = "OnboardingError";
  }
}

interface DraftRow {
  id: string;
  account_id: string;
  display_name: string | null;
  proposed_handle: string | null;
  portrait: string | null;
  invitation_destination_type: InvitationDestination["type"] | null;
  invitation_destination_id: string | null;
  connection_checked_at: Date | null;
  expires_at: Date;
  version: number;
}

export class OnboardingService {
  constructor(
    private readonly pool: Pool,
    private readonly options: { productScope: string; currentTermsVersion: string; now: () => Date },
  ) {}

  async ensureDraft(accountId: string, destination?: InvitationDestination): Promise<DraftView> {
    if (destination && (!destinationTypes.has(destination.type) || !/^[0-9a-f-]{36}$/i.test(destination.id))) {
      throw new OnboardingError("FORBIDDEN");
    }
    const now = this.options.now();
    return withTransaction(this.pool, async (client) => {
      const account = await client.query<{ email_verified_at: Date | null }>(
        "SELECT email_verified_at FROM accounts WHERE id = $1 AND product_scope = $2 FOR UPDATE",
        [accountId, this.options.productScope],
      );
      if (!account.rows[0]?.email_verified_at) throw new OnboardingError("FORBIDDEN");
      const existing = await client.query<DraftRow>(
        "SELECT * FROM kingdom_drafts WHERE account_id = $1 AND product_scope = $2 FOR UPDATE",
        [accountId, this.options.productScope],
      );
      const row = existing.rows[0];
      if (row && row.expires_at > now) return this.toView(row);
      if (row) await client.query("DELETE FROM kingdom_drafts WHERE id = $1", [row.id]);
      const created = await client.query<DraftRow>(
        `INSERT INTO kingdom_drafts(
           product_scope, account_id, invitation_destination_type, invitation_destination_id, expires_at
         ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          this.options.productScope,
          accountId,
          destination?.type ?? null,
          destination?.id ?? null,
          new Date(now.getTime() + sevenDays),
        ],
      );
      const createdRow = created.rows[0];
      if (!createdRow) throw new Error("Draft insert returned no row");
      return this.toView(createdRow);
    });
  }

  async getDraft(accountId: string): Promise<DraftView> {
    const result = await this.pool.query<DraftRow>(
      "SELECT * FROM kingdom_drafts WHERE account_id = $1 AND product_scope = $2",
      [accountId, this.options.productScope],
    );
    const row = result.rows[0];
    if (!row || row.expires_at <= this.options.now()) throw new OnboardingError("DRAFT_EXPIRED");
    return this.toView(row);
  }

  async updateDraft(
    accountId: string,
    input: { displayName: string; proposedHandle: string; portrait: string; expectedVersion: number },
  ): Promise<DraftView> {
    const displayName = input.displayName.trim();
    const handle = input.proposedHandle.toLowerCase();
    if (
      [...displayName].length < 2 ||
      [...displayName].length > 40 ||
      /\p{Cc}/u.test(displayName) ||
      !/^[a-z][a-z0-9_]{2,23}$/.test(handle) ||
      !/^[a-zA-Z0-9._:-]{1,128}$/.test(input.portrait)
    ) {
      throw new OnboardingError("DRAFT_INCOMPLETE");
    }
    const now = this.options.now();
    const result = await this.pool.query<DraftRow>(
      `UPDATE kingdom_drafts SET display_name = $3, proposed_handle = $4, portrait = $5,
         version = version + 1, updated_at = $6
       WHERE account_id = $1 AND product_scope = $2 AND version = $7 AND expires_at > $6
       RETURNING *`,
      [accountId, this.options.productScope, displayName, handle, input.portrait, now, input.expectedVersion],
    );
    const row = result.rows[0];
    if (!row) throw new OnboardingError("DRAFT_EXPIRED");
    return this.toView(row);
  }

  async recordConnectionCheck(accountId: string): Promise<DraftView> {
    const now = this.options.now();
    const result = await this.pool.query<DraftRow>(
      `UPDATE kingdom_drafts SET connection_checked_at = $3, version = version + 1, updated_at = $3
       WHERE account_id = $1 AND product_scope = $2 AND expires_at > $3 RETURNING *`,
      [accountId, this.options.productScope, now],
    );
    const row = result.rows[0];
    if (!row) throw new OnboardingError("DRAFT_EXPIRED");
    return this.toView(row);
  }

  async activateSandboxFixture(accountId: string): Promise<{ receiptId: string; draftId: string }> {
    const now = this.options.now();
    return withTransaction(
      this.pool,
      async (client) => {
        const account = await client.query<{ email_verified_at: Date | null; terms_version: string | null }>(
          "SELECT email_verified_at, terms_version FROM accounts WHERE id = $1 AND product_scope = $2 FOR UPDATE",
          [accountId, this.options.productScope],
        );
        const accountRow = account.rows[0];
        if (!accountRow?.email_verified_at || accountRow.terms_version !== this.options.currentTermsVersion) {
          throw new OnboardingError("FORBIDDEN");
        }
        const draftResult = await client.query<DraftRow>(
          "SELECT * FROM kingdom_drafts WHERE account_id = $1 AND product_scope = $2 FOR UPDATE",
          [accountId, this.options.productScope],
        );
        const draft = draftResult.rows[0];
        if (!draft || draft.expires_at <= now) throw new OnboardingError("DRAFT_EXPIRED");
        if (!draft.display_name || !draft.proposed_handle || !draft.portrait) {
          throw new OnboardingError("DRAFT_INCOMPLETE");
        }
        if (!draft.connection_checked_at || now.getTime() - draft.connection_checked_at.getTime() > sevenDays) {
          throw new OnboardingError("CONNECTION_STALE");
        }
        const receiptId = randomUUID();
        const inserted = await client.query<{ receipt_id: string }>(
          `INSERT INTO sandbox_activation_fixtures(product_scope, account_id, draft_id, receipt_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT(product_scope, account_id) DO NOTHING RETURNING receipt_id`,
          [this.options.productScope, accountId, draft.id, receiptId],
        );
        const finalReceipt =
          inserted.rows[0]?.receipt_id ??
          (
            await client.query<{ receipt_id: string }>(
              "SELECT receipt_id FROM sandbox_activation_fixtures WHERE product_scope = $1 AND account_id = $2",
              [this.options.productScope, accountId],
            )
          ).rows[0]?.receipt_id;
        if (!finalReceipt) throw new Error("Sandbox activation receipt missing");
        await client.query("UPDATE kingdom_drafts SET activated_at = COALESCE(activated_at, $2) WHERE id = $1", [
          draft.id,
          now,
        ]);
        return { receiptId: finalReceipt, draftId: draft.id };
      },
      { isolation: "SERIALIZABLE" },
    );
  }

  async purgeExpiredDrafts(): Promise<number> {
    const result = await this.pool.query(
      "DELETE FROM kingdom_drafts WHERE product_scope = $1 AND activated_at IS NULL AND expires_at <= $2",
      [this.options.productScope, this.options.now()],
    );
    return result.rowCount ?? 0;
  }

  private toView(row: DraftRow): DraftView {
    return {
      id: row.id,
      accountId: row.account_id,
      displayName: row.display_name,
      proposedHandle: row.proposed_handle,
      portrait: row.portrait,
      invitationDestination:
        row.invitation_destination_type && row.invitation_destination_id
          ? { type: row.invitation_destination_type, id: row.invitation_destination_id }
          : null,
      connectionCheckedAt: row.connection_checked_at,
      expiresAt: row.expires_at,
      version: row.version,
    };
  }
}
