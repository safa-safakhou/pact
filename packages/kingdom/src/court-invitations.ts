import type { PoolClient } from "pg";
import type { CourtService } from "./courts.js";
import type { InvitationDestinationPort, InvitationDestinationView } from "./invitations.js";

export class CourtInvitationError extends Error {
  constructor(readonly code: "FORBIDDEN" | "COURT_UNAVAILABLE" | "COURT_MEMBERSHIP_LIMIT") {
    super(code);
    this.name = "CourtInvitationError";
  }
}
/** Invitation and owned-data adapter for the shared Court community service. */
export class CourtInvitationDestination implements InvitationDestinationPort {
  constructor(
    private readonly productScope: string,
    private readonly clock: { now(): Date },
    private readonly courts: CourtService,
  ) {}
  async read(client: PoolClient, id: string): Promise<InvitationDestinationView | null> {
    const found = await client.query<{ title: string; handle: string; join_mode: string; status: string }>(
      "SELECT title, handle, join_mode, status FROM courts WHERE product_scope = $1 AND id = $2",
      [this.productScope, id],
    );
    const row = found.rows[0];
    return row
      ? {
          type: "court",
          id,
          title: `${row.title} (@${row.handle})`,
          public: row.join_mode !== "invitation_only",
          available: row.status === "active",
        }
      : null;
  }
  async authorizeIssue(client: PoolClient, issuer: string, id: string): Promise<void> {
    const found = await client.query(
      `SELECT c.id FROM courts c WHERE c.product_scope = $1 AND c.id = $2 AND c.status = 'active'
      AND (c.owner_kingdom_id = $3 OR EXISTS(SELECT 1 FROM court_memberships m WHERE m.court_id = c.id AND m.kingdom_id = $3 AND m.role = 'moderator'))`,
      [this.productScope, id, issuer],
    );
    if (!found.rowCount) throw new CourtInvitationError("FORBIDDEN");
  }
  async accept(client: PoolClient, accountId: string, id: string, gameTimeMs: number): Promise<void> {
    return this.courts.joinInvited(client, accountId, id, gameTimeMs);
  }
  async forgetAccount(client: PoolClient, accountId: string): Promise<void> {
    await client.query(
      `UPDATE courts SET status = 'archived', archived_at = $3, version = version + 1 WHERE product_scope = $1 AND status = 'active' AND owner_kingdom_id IN (SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2)`,
      [this.productScope, accountId, this.clock.now()],
    );
    await client.query(
      `DELETE FROM court_memberships WHERE kingdom_id IN (SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2)`,
      [this.productScope, accountId],
    );
    await client.query(
      `DELETE FROM court_requests WHERE kingdom_id IN (SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2) OR court_id IN (SELECT id FROM courts WHERE product_scope=$1 AND status='archived')`,
      [this.productScope, accountId],
    );
    await client.query(
      `DELETE FROM court_transfers WHERE from_kingdom_id IN (SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2) OR to_kingdom_id IN (SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2)`,
      [this.productScope, accountId],
    );
    await client.query(
      `DELETE FROM court_pins WHERE author_kingdom_id IN (SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2)`,
      [this.productScope, accountId],
    );
    await client.query(
      `UPDATE court_audit SET actor_kingdom_id=NULL,details='{}'::jsonb WHERE actor_kingdom_id IN (SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2)`,
      [this.productScope, accountId],
    );
    await client.query(
      `UPDATE court_audit SET details='{}'::jsonb WHERE details->>'kingdomId' IN (SELECT id::text FROM kingdoms WHERE product_scope=$1 AND account_id=$2)`,
      [this.productScope, accountId],
    );
  }
  async prune(client: PoolClient, now: Date): Promise<number> {
    return (
      (
        await client.query(
          "DELETE FROM courts WHERE product_scope = $1 AND status = 'archived' AND archived_at <= $2",
          [this.productScope, new Date(now.getTime() - 30 * 86_400_000)],
        )
      ).rowCount ?? 0
    );
  }
  async exportAccount(client: PoolClient, accountId: string): Promise<unknown> {
    const memberships = (
      await client.query(
        `SELECT c.id, c.handle, c.title, c.status, m.role FROM courts c JOIN court_memberships m ON m.court_id = c.id JOIN kingdoms k ON k.id = m.kingdom_id WHERE c.product_scope = $1 AND k.account_id = $2`,
        [this.productScope, accountId],
      )
    ).rows;
    const requests = (
      await client.query(
        `SELECT r.court_id,r.requested_at FROM court_requests r JOIN kingdoms k ON k.id=r.kingdom_id WHERE k.product_scope=$1 AND k.account_id=$2`,
        [this.productScope, accountId],
      )
    ).rows;
    const pins = (
      await client.query(
        `SELECT p.court_id,p.slot,p.body,p.created_at FROM court_pins p JOIN kingdoms k ON k.id=p.author_kingdom_id WHERE k.product_scope=$1 AND k.account_id=$2`,
        [this.productScope, accountId],
      )
    ).rows;
    return { memberships, requests, pins };
  }
}
