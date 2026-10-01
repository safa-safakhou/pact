import type { PoolClient } from "pg";
import type { InvitationDestinationPort, InvitationDestinationView } from "./invitations.js";

export class CourtInvitationError extends Error {
  constructor(readonly code: "FORBIDDEN" | "COURT_UNAVAILABLE" | "COURT_MEMBERSHIP_LIMIT") {
    super(code);
    this.name = "CourtInvitationError";
  }
}
/** Minimal real Court invitation boundary; community management is PACT-056. No stocks, troops or allegiance are touched. */
export class CourtInvitationDestination implements InvitationDestinationPort {
  constructor(
    private readonly productScope: string,
    private readonly clock: { now(): Date },
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
    // One kingdom lock enforces the cross-Court limit even when distinct invitations race.
    const owner = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked' FOR UPDATE",
      [this.productScope, accountId],
    );
    const kingdomId = owner.rows[0]?.id;
    if (!kingdomId) throw new CourtInvitationError("FORBIDDEN");
    const court = await client.query(
      "SELECT id FROM courts WHERE product_scope = $1 AND id = $2 AND status = 'active' FOR UPDATE",
      [this.productScope, id],
    );
    if (!court.rowCount) throw new CourtInvitationError("COURT_UNAVAILABLE");
    if (
      (await client.query("SELECT 1 FROM court_memberships WHERE court_id = $1 AND kingdom_id = $2", [id, kingdomId]))
        .rowCount
    )
      return;
    const count = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM court_memberships m JOIN courts c ON c.id = m.court_id WHERE c.product_scope = $1 AND m.kingdom_id = $2 AND c.status = 'active'`,
      [this.productScope, kingdomId],
    );
    if ((count.rows[0]?.count ?? 0) >= 3) throw new CourtInvitationError("COURT_MEMBERSHIP_LIMIT");
    await client.query(
      "INSERT INTO court_memberships(court_id, kingdom_id, role, joined_game_time_ms) VALUES ($1,$2,'member',$3)",
      [id, kingdomId, gameTimeMs],
    );
    await client.query("UPDATE courts SET version = version + 1 WHERE id = $1", [id]);
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
    return (
      await client.query(
        `SELECT c.id, c.handle, c.title, c.status, m.role FROM courts c JOIN court_memberships m ON m.court_id = c.id JOIN kingdoms k ON k.id = m.kingdom_id WHERE c.product_scope = $1 AND k.account_id = $2`,
        [this.productScope, accountId],
      )
    ).rows;
  }
}
