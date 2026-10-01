import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { SocialService } from "./social.js";

export type DestinationType = "contact" | "court" | "notice" | "story";
export type InvitationStatus = "available" | "expired" | "revoked" | "full" | "unavailable" | "unknown";
export interface InvitationDestinationView {
  type: DestinationType;
  id: string;
  title: string;
  public: boolean;
  available?: boolean;
  /** Notice deadlines are authoritative game time, not a browser clock. */
  expiresGameTimeMs?: number;
}
export interface InvitationDestinationPort {
  read(client: PoolClient, id: string, gameTimeMs: number): Promise<InvitationDestinationView | null>;
  authorizeIssue(client: PoolClient, issuerKingdomId: string, id: string): Promise<void>;
  accept(client: PoolClient, accountId: string, id: string, gameTimeMs: number): Promise<void>;
}
interface InvitationRow {
  id: string;
  issuer_kingdom_id: string;
  destination_type: DestinationType;
  destination_id: string;
  expires_at: Date | null;
  expires_game_time_ms: string | null;
  redemption_limit: number;
  redemption_count: number;
  version: number;
  revoked_at: Date | null;
}
export interface InvitationView {
  invitationId: string | null;
  version: number | null;
  status: InvitationStatus;
  destination: InvitationDestinationView | null;
  expiresAt: string | null;
  expiresGameTimeMs: number | null;
  remainingUses: number;
  accepted: boolean;
}
export class InvitationError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "INVALID_INVITATION"
      | "INVITATION_LIMIT"
      | "DESTINATION_UNAVAILABLE"
      | "INVITATION_EXPIRED"
      | "INVITATION_REVOKED"
      | "INVITATION_FULL",
  ) {
    super(code);
    this.name = "InvitationError";
  }
}
const day = 86_400_000;
function digest(token: string): Buffer {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new InvitationError("INVALID_INVITATION");
  return createHash("sha256").update(token).digest();
}

/** Destination effects and use counts share the caller's command transaction. Never performs network work. */
export class InvitationService {
  constructor(
    private readonly pool: Pool,
    private readonly productScope: string,
    private readonly social: SocialService,
    private readonly clock: { now(): Date },
    private readonly destinations: Partial<Record<Exclude<DestinationType, "contact">, InvitationDestinationPort>> = {},
  ) {}

  private async owner(client: PoolClient, accountId: string): Promise<string> {
    const result = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.productScope, accountId],
    );
    if (!result.rows[0]) throw new InvitationError("FORBIDDEN");
    return result.rows[0].id;
  }
  private async destination(
    client: PoolClient,
    type: DestinationType,
    id: string,
    gameTimeMs: number,
  ): Promise<InvitationDestinationView | null> {
    if (type !== "contact") return this.destinations[type]?.read(client, id, gameTimeMs) ?? null;
    const result = await client.query<{ handle: string; display_name: string }>(
      "SELECT handle, display_name FROM kingdoms WHERE product_scope = $1 AND id = $2 AND status = 'ranked'",
      [this.productScope, id],
    );
    const row = result.rows[0];
    return row ? { type, id, title: `${row.display_name} (@${row.handle})`, public: true } : null;
  }
  async issue(
    client: PoolClient,
    accountId: string,
    input: { destinationType: DestinationType; destinationId: string; redemptionLimit?: number },
    gameTimeMs: number,
  ): Promise<{ invitationId: string; token: string }> {
    const issuer = await this.owner(client, accountId);
    await client.query("SELECT id FROM kingdoms WHERE id = $1 FOR UPDATE", [issuer]);
    const destination = await this.destination(client, input.destinationType, input.destinationId, gameTimeMs);
    if (!destination || destination.available === false) throw new InvitationError("DESTINATION_UNAVAILABLE");
    if (input.destinationType === "contact") {
      if (input.destinationId !== issuer) throw new InvitationError("FORBIDDEN");
    } else {
      const port = this.destinations[input.destinationType];
      if (!port) throw new InvitationError("DESTINATION_UNAVAILABLE");
      await port.authorizeIssue(client, issuer, input.destinationId);
    }
    const now = this.clock.now();
    const limit = input.redemptionLimit ?? 1;
    const publicReuse = input.destinationType === "story" || (input.destinationType === "court" && destination.public);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > (publicReuse ? 10000 : 100))
      throw new InvitationError("INVITATION_LIMIT");
    const counts = await client.query<{ active: number; daily: number }>(
      `SELECT count(*) FILTER (WHERE (expires_at IS NULL OR expires_at > $3) AND (expires_game_time_ms IS NULL OR expires_game_time_ms > $4) AND revoked_at IS NULL AND redemption_count < redemption_limit)::int AS active,
       count(*) FILTER (WHERE issued_game_time_ms > $4::bigint - 86400000)::int AS daily
       FROM destination_invitations WHERE product_scope = $1 AND issuer_kingdom_id = $2`,
      [this.productScope, issuer, now, gameTimeMs],
    );
    const legacy = await client.query<{ active: number; daily: number }>(
      `SELECT count(*) FILTER (WHERE expires_at > $3 AND revoked_at IS NULL AND redeemed_at IS NULL)::int AS active,
       count(*) FILTER (WHERE issued_game_time_ms > $4::bigint - 86400000)::int AS daily
       FROM direct_contact_invitations WHERE product_scope = $1 AND issuer_kingdom_id = $2`,
      [this.productScope, issuer, now, gameTimeMs],
    );
    if (
      (counts.rows[0]?.active ?? 0) + (legacy.rows[0]?.active ?? 0) >= 20 ||
      (counts.rows[0]?.daily ?? 0) + (legacy.rows[0]?.daily ?? 0) >= 20
    )
      throw new InvitationError("INVITATION_LIMIT");
    const noticeDeadline =
      input.destinationType === "notice"
        ? Math.min(destination.expiresGameTimeMs ?? gameTimeMs, gameTimeMs + day)
        : null;
    if (noticeDeadline !== null && noticeDeadline <= gameTimeMs) throw new InvitationError("DESTINATION_UNAVAILABLE");
    const token = randomBytes(24).toString("base64url");
    const invitationId = randomUUID();
    await client.query(
      `INSERT INTO destination_invitations(id, product_scope, issuer_kingdom_id, destination_type, destination_id, token_hash, issued_game_time_ms, issued_at, expires_at, expires_game_time_ms, redemption_limit)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        invitationId,
        this.productScope,
        issuer,
        input.destinationType,
        input.destinationId,
        digest(token),
        gameTimeMs,
        now,
        noticeDeadline === null ? new Date(now.getTime() + day * (publicReuse ? 30 : 7)) : null,
        noticeDeadline,
        limit,
      ],
    );
    return { invitationId, token };
  }
  async read(client: PoolClient, token: string, gameTimeMs: number, accountId?: string): Promise<InvitationView> {
    const rows = await client.query<InvitationRow>(
      "SELECT * FROM destination_invitations WHERE product_scope = $1 AND token_hash = $2",
      [this.productScope, digest(token)],
    );
    return this.view(client, rows.rows[0], gameTimeMs, accountId);
  }
  private async view(
    client: PoolClient,
    row: InvitationRow | undefined,
    gameTimeMs: number,
    accountId?: string,
  ): Promise<InvitationView> {
    if (!row)
      return {
        invitationId: null,
        version: null,
        status: "unknown",
        destination: null,
        expiresAt: null,
        expiresGameTimeMs: null,
        remainingUses: 0,
        accepted: false,
      };
    const destination = await this.destination(client, row.destination_type, row.destination_id, gameTimeMs);
    const accepted = accountId
      ? Boolean(
          (
            await client.query("SELECT 1 FROM invitation_redemptions WHERE invitation_id = $1 AND account_id = $2", [
              row.id,
              accountId,
            ])
          ).rowCount,
        )
      : false;
    const status: InvitationStatus = row.revoked_at
      ? "revoked"
      : (row.expires_at !== null && row.expires_at <= this.clock.now()) ||
          (row.expires_game_time_ms !== null && Number(row.expires_game_time_ms) <= gameTimeMs)
        ? "expired"
        : row.redemption_count >= row.redemption_limit
          ? "full"
          : !destination || destination.available === false
            ? "unavailable"
            : "available";
    return {
      invitationId: row.id,
      version: row.version,
      status,
      destination,
      expiresAt: row.expires_at?.toISOString() ?? null,
      expiresGameTimeMs: row.expires_game_time_ms === null ? null : Number(row.expires_game_time_ms),
      remainingUses: Math.max(0, row.redemption_limit - row.redemption_count),
      accepted,
    };
  }
  async remember(client: PoolClient, accountId: string, token: string, gameTimeMs: number): Promise<InvitationView> {
    const account = await client.query(
      "SELECT id FROM accounts WHERE product_scope = $1 AND id = $2 AND status = 'active' AND email_verified_at IS NOT NULL FOR UPDATE",
      [this.productScope, accountId],
    );
    if (!account.rowCount) throw new InvitationError("FORBIDDEN");
    const existing = await this.remembered(client, accountId, gameTimeMs);
    if (existing) return existing; // Signup/login/recovery cannot replace the first server-bound destination.
    const view = await this.read(client, token, gameTimeMs);
    if (!view.invitationId) throw new InvitationError("INVALID_INVITATION");
    await client.query(
      "INSERT INTO account_invitation_destinations(product_scope, account_id, invitation_id, remembered_at) VALUES ($1,$2,$3,$4)",
      [this.productScope, accountId, view.invitationId, this.clock.now()],
    );
    if (view.destination)
      await client.query(
        `UPDATE kingdom_drafts SET invitation_destination_type = $3, invitation_destination_id = $4
      WHERE product_scope = $1 AND account_id = $2 AND invitation_destination_id IS NULL`,
        [this.productScope, accountId, view.destination.type, view.destination.id],
      );
    return view;
  }
  async remembered(client: PoolClient, accountId: string, gameTimeMs: number): Promise<InvitationView | null> {
    const rows = await client.query<InvitationRow>(
      `SELECT i.* FROM account_invitation_destinations d JOIN destination_invitations i ON i.id = d.invitation_id
      WHERE d.product_scope = $1 AND d.account_id = $2`,
      [this.productScope, accountId],
    );
    return rows.rows[0] ? this.view(client, rows.rows[0], gameTimeMs, accountId) : null;
  }
  async accept(
    client: PoolClient,
    accountId: string,
    reference: { token: string } | { remembered: true },
    gameTimeMs: number,
  ): Promise<InvitationView> {
    // Pair locks in SocialService follow this lock consistently; any retry rolls back all effects.
    const rows =
      "token" in reference
        ? await client.query<InvitationRow>(
            "SELECT * FROM destination_invitations WHERE product_scope = $1 AND token_hash = $2 FOR UPDATE",
            [this.productScope, digest(reference.token)],
          )
        : await client.query<InvitationRow>(
            `SELECT i.* FROM destination_invitations i JOIN account_invitation_destinations d ON d.invitation_id = i.id WHERE d.product_scope = $1 AND d.account_id = $2 FOR UPDATE OF i`,
            [this.productScope, accountId],
          );
    const row = rows.rows[0];
    if (!row) throw new InvitationError("INVALID_INVITATION");
    const view = await this.view(client, row, gameTimeMs, accountId);
    if (view.accepted) return view; // Even after expiry/revoke, return the recorded acceptance; never recreate a removed relationship.
    if (view.status !== "available")
      throw new InvitationError(
        view.status === "expired"
          ? "INVITATION_EXPIRED"
          : view.status === "revoked"
            ? "INVITATION_REVOKED"
            : view.status === "full"
              ? "INVITATION_FULL"
              : "DESTINATION_UNAVAILABLE",
      );
    await this.owner(client, accountId);
    if (row.destination_type === "contact")
      await this.social.acceptInvitedContact(client, accountId, row.destination_id, gameTimeMs);
    else {
      const port = this.destinations[row.destination_type];
      if (!port) throw new InvitationError("DESTINATION_UNAVAILABLE");
      await port.accept(client, accountId, row.destination_id, gameTimeMs);
    }
    await client.query("INSERT INTO invitation_redemptions(invitation_id, account_id, redeemed_at) VALUES ($1,$2,$3)", [
      row.id,
      accountId,
      this.clock.now(),
    ]);
    await client.query(
      "UPDATE destination_invitations SET redemption_count = redemption_count + 1, version = version + 1 WHERE id = $1",
      [row.id],
    );
    return { ...view, accepted: true, remainingUses: view.remainingUses - 1, version: row.version + 1 };
  }
  async revoke(client: PoolClient, accountId: string, invitationId: string): Promise<number> {
    const issuer = await this.owner(client, accountId);
    const result = await client.query<{ version: number }>(
      "UPDATE destination_invitations SET revoked_at = COALESCE(revoked_at, $4), version = version + CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END WHERE product_scope = $1 AND issuer_kingdom_id = $2 AND id = $3 RETURNING version",
      [this.productScope, issuer, invitationId, this.clock.now()],
    );
    if (!result.rowCount) throw new InvitationError("FORBIDDEN");
    return result.rows[0]?.version ?? 1;
  }
  async prune(client: PoolClient, before: Date, gameTimeMs?: number): Promise<number> {
    return (
      (
        await client.query(
          "DELETE FROM destination_invitations WHERE product_scope = $1 AND (expires_at <= $2 OR (issued_at <= $2 AND expires_game_time_ms <= $3::bigint))",
          [this.productScope, before, gameTimeMs ?? null],
        )
      ).rowCount ?? 0
    );
  }
  async forgetAccount(client: PoolClient, accountId: string): Promise<void> {
    await client.query("DELETE FROM account_invitation_destinations WHERE product_scope = $1 AND account_id = $2", [
      this.productScope,
      accountId,
    ]);
    await client.query(
      `DELETE FROM destination_invitations WHERE product_scope = $1 AND issuer_kingdom_id IN (SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2)`,
      [this.productScope, accountId],
    );
  }
  async exportAccount(client: PoolClient, accountId: string): Promise<unknown> {
    const issued = await client.query(
      `SELECT i.id, i.destination_type, i.destination_id, i.issued_at, i.expires_at,
      i.expires_game_time_ms, i.redemption_limit, i.redemption_count, i.revoked_at FROM destination_invitations i
      JOIN kingdoms k ON k.id = i.issuer_kingdom_id WHERE i.product_scope = $1 AND k.account_id = $2`,
      [this.productScope, accountId],
    );
    const accepted = await client.query(
      `SELECT r.invitation_id, r.redeemed_at FROM invitation_redemptions r JOIN destination_invitations i ON i.id = r.invitation_id WHERE i.product_scope = $1 AND r.account_id = $2`,
      [this.productScope, accountId],
    );
    const remembered = await client.query(
      "SELECT invitation_id, remembered_at FROM account_invitation_destinations WHERE product_scope = $1 AND account_id = $2",
      [this.productScope, accountId],
    );
    return { issued: issued.rows, accepted: accepted.rows, remembered: remembered.rows };
  }
  async withRead<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
