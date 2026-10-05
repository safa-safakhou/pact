import type { CourtCommand } from "@pact/contracts";
import type { Pool, PoolClient } from "pg";
import { ActionLimitService } from "./action-limits.js";
import { uuidV7 } from "./uuid-v7.js";

export class CourtError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "COURT_UNAVAILABLE"
      | "COURT_MEMBERSHIP_LIMIT"
      | "COURT_OWNERSHIP_LIMIT"
      | "COURT_MODERATOR_LIMIT"
      | "COURT_HANDLE_TAKEN"
      | "STALE_VERSION"
      | "REQUEST_REQUIRED"
      | "OWNER_MUST_TRANSFER_OR_CLOSE"
      | "TRANSFER_UNAVAILABLE",
  ) {
    super(code);
    this.name = "CourtError";
  }
}
interface CourtRow {
  id: string;
  handle: string;
  owner_kingdom_id: string;
  join_mode: string;
  status: string;
  version: number;
}
/** Transaction-bound community management only. No ledger, troops, contracts or allegiance dependencies. */
export class CourtService {
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly clock: { now(): Date },
  ) {}
  private async actor(client: PoolClient, accountId: string) {
    const result = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2 AND status='ranked' FOR UPDATE",
      [this.scope, accountId],
    );
    if (!result.rows[0]) throw new CourtError("FORBIDDEN");
    return result.rows[0].id;
  }
  private async capacity(client: PoolClient, kingdomId: string) {
    const count = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM court_memberships m JOIN courts c ON c.id=m.court_id WHERE c.product_scope=$1 AND c.status='active' AND m.kingdom_id=$2",
      [this.scope, kingdomId],
    );
    if ((count.rows[0]?.count ?? 0) >= 3) throw new CourtError("COURT_MEMBERSHIP_LIMIT");
  }
  private async audit(client: PoolClient, courtId: string, actor: string, kind: string, details: unknown) {
    await client.query(
      "INSERT INTO court_audit(id,court_id,actor_kingdom_id,kind,details,created_at) VALUES($1,$2,$3,$4,$5::jsonb,$6)",
      [uuidV7(this.clock.now()), courtId, actor, kind, JSON.stringify(details), this.clock.now()],
    );
  }
  async joinInvited(client: PoolClient, accountId: string, courtId: string, gameTime: number) {
    const actor = await this.actor(client, accountId);
    const court = await client.query(
      "SELECT id FROM courts WHERE product_scope=$1 AND id=$2 AND status='active' FOR UPDATE",
      [this.scope, courtId],
    );
    if (!court.rowCount) throw new CourtError("COURT_UNAVAILABLE");
    await this.join(client, courtId, actor, gameTime);
  }
  private async join(client: PoolClient, courtId: string, actor: string, gameTime: number) {
    if (
      (await client.query("SELECT 1 FROM court_memberships WHERE court_id=$1 AND kingdom_id=$2", [courtId, actor]))
        .rowCount
    )
      return;
    await this.capacity(client, actor);
    await client.query(
      "INSERT INTO court_memberships(court_id,kingdom_id,role,joined_game_time_ms) VALUES($1,$2,'member',$3)",
      [courtId, actor, gameTime],
    );
    await client.query("DELETE FROM court_requests WHERE court_id=$1 AND kingdom_id=$2", [courtId, actor]);
    await client.query("UPDATE courts SET version=version+1 WHERE id=$1", [courtId]);
    await this.audit(client, courtId, actor, "court.join", {});
  }
  async execute(client: PoolClient, accountId: string, command: CourtCommand, gameTime: number) {
    const actor = await this.actor(client, accountId);
    const action = command.action;
    let id: string;
    if (action.kind === "court.create") {
      if (
        (
          await client.query(
            "SELECT 1 FROM courts WHERE product_scope=$1 AND owner_kingdom_id=$2 AND status='active'",
            [this.scope, actor],
          )
        ).rowCount
      )
        throw new CourtError("COURT_OWNERSHIP_LIMIT");
      if (
        (await client.query("SELECT 1 FROM courts WHERE product_scope=$1 AND handle=$2", [this.scope, action.handle]))
          .rowCount
      )
        throw new CourtError("COURT_HANDLE_TAKEN");
      await this.capacity(client, actor);
      id = uuidV7(this.clock.now());
      // A handle race is resolved by the unique index, including different owners.
      const inserted = await client.query(
        "INSERT INTO courts(id,product_scope,handle,title,description,owner_kingdom_id,join_mode,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(product_scope,handle) DO NOTHING",
        [id, this.scope, action.handle, action.title, action.description, actor, action.joinMode, this.clock.now()],
      );
      if (!inserted.rowCount) throw new CourtError("COURT_HANDLE_TAKEN");
      await client.query(
        "INSERT INTO court_memberships(court_id,kingdom_id,role,joined_game_time_ms) VALUES($1,$2,'owner',$3)",
        [id, actor, gameTime],
      );
      await this.audit(client, id, actor, action.kind, {});
    } else {
      id = action.courtId;
      const found = await client.query<CourtRow>(
        "SELECT id,owner_kingdom_id,join_mode,status,version FROM courts WHERE product_scope=$1 AND id=$2 FOR UPDATE",
        [this.scope, id],
      );
      const court = found.rows[0];
      if (!court || (court.status !== "active" && action.kind !== "court.leave"))
        throw new CourtError("COURT_UNAVAILABLE");
      const membership = await client.query<{ role: string }>(
        "SELECT role FROM court_memberships WHERE court_id=$1 AND kingdom_id=$2",
        [id, actor],
      );
      const role = membership.rows[0]?.role;
      const owner = () => {
        if (court.owner_kingdom_id !== actor || role !== "owner") throw new CourtError("FORBIDDEN");
      };
      const moderator = () => {
        if (role !== "owner" && role !== "moderator") throw new CourtError("FORBIDDEN");
      };
      switch (action.kind) {
        case "court.edit":
          owner();
          if (action.expectedVersion !== court.version) throw new CourtError("STALE_VERSION");
          await client.query("UPDATE courts SET title=$2,description=$3,join_mode=$4 WHERE id=$1", [
            id,
            action.title,
            action.description,
            action.joinMode,
          ]);
          break;
        case "court.join":
          if (court.join_mode !== "open") throw new CourtError("REQUEST_REQUIRED");
          await this.join(client, id, actor, gameTime);
          break;
        case "court.request":
          if (court.join_mode !== "request") throw new CourtError("FORBIDDEN");
          if (!role) {
            await this.capacity(client, actor);
            await client.query(
              "INSERT INTO court_requests(court_id,kingdom_id,requested_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
              [id, actor, this.clock.now()],
            );
          }
          break;
        case "court.cancel-request":
          await client.query("DELETE FROM court_requests WHERE court_id=$1 AND kingdom_id=$2", [id, actor]);
          break;
        case "court.answer-request": {
          moderator();
          // Target lock is shared with invitation and direct joins; approval cannot bypass capacity.
          const target = await client.query(
            "SELECT id FROM kingdoms WHERE product_scope=$1 AND id=$2 AND status='ranked' FOR UPDATE",
            [this.scope, action.kingdomId],
          );
          if (!target.rowCount) throw new CourtError("FORBIDDEN");
          if (
            !(
              await client.query("SELECT 1 FROM court_requests WHERE court_id=$1 AND kingdom_id=$2", [
                id,
                action.kingdomId,
              ])
            ).rowCount
          )
            throw new CourtError("REQUEST_REQUIRED");
          if (action.accept) await this.join(client, id, action.kingdomId, gameTime);
          await client.query("DELETE FROM court_requests WHERE court_id=$1 AND kingdom_id=$2", [id, action.kingdomId]);
          break;
        }
        case "court.leave":
          if (court.status === "active" && court.owner_kingdom_id === actor)
            throw new CourtError("OWNER_MUST_TRANSFER_OR_CLOSE");
          await client.query("DELETE FROM court_memberships WHERE court_id=$1 AND kingdom_id=$2", [id, actor]);
          await client.query("DELETE FROM court_transfers WHERE court_id=$1 AND to_kingdom_id=$2", [id, actor]);
          break;
        case "court.remove": {
          moderator();
          const target = await client.query<{ role: string }>(
            "SELECT role FROM court_memberships WHERE court_id=$1 AND kingdom_id=$2",
            [id, action.kingdomId],
          );
          if (
            action.kingdomId === court.owner_kingdom_id ||
            (role === "moderator" && target.rows[0]?.role !== "member")
          )
            throw new CourtError("FORBIDDEN");
          await client.query("DELETE FROM court_memberships WHERE court_id=$1 AND kingdom_id=$2", [
            id,
            action.kingdomId,
          ]);
          await client.query("DELETE FROM court_transfers WHERE court_id=$1 AND to_kingdom_id=$2", [
            id,
            action.kingdomId,
          ]);
          break;
        }
        case "court.role": {
          owner();
          const target = await client.query<{ role: string }>(
            "SELECT role FROM court_memberships WHERE court_id=$1 AND kingdom_id=$2",
            [id, action.kingdomId],
          );
          if (!target.rowCount || target.rows[0]?.role === "owner") throw new CourtError("FORBIDDEN");
          const count = await client.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM court_memberships WHERE court_id=$1 AND role='moderator'",
            [id],
          );
          if (action.role === "moderator" && target.rows[0]?.role !== "moderator" && (count.rows[0]?.count ?? 0) >= 10)
            throw new CourtError("COURT_MODERATOR_LIMIT");
          await client.query("UPDATE court_memberships SET role=$3 WHERE court_id=$1 AND kingdom_id=$2", [
            id,
            action.kingdomId,
            action.role,
          ]);
          break;
        }
        case "court.transfer-propose":
          owner();
          if (
            action.kingdomId === actor ||
            !(
              await client.query("SELECT 1 FROM court_memberships WHERE court_id=$1 AND kingdom_id=$2", [
                id,
                action.kingdomId,
              ])
            ).rowCount
          )
            throw new CourtError("FORBIDDEN");
          await client.query(
            "INSERT INTO court_transfers(id,court_id,from_kingdom_id,to_kingdom_id,proposed_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(court_id) DO UPDATE SET id=EXCLUDED.id,from_kingdom_id=EXCLUDED.from_kingdom_id,to_kingdom_id=EXCLUDED.to_kingdom_id,proposed_at=EXCLUDED.proposed_at",
            [uuidV7(this.clock.now()), id, actor, action.kingdomId, this.clock.now()],
          );
          break;
        case "court.transfer-answer": {
          const transfer = await client.query<{ from_kingdom_id: string; to_kingdom_id: string }>(
            "SELECT from_kingdom_id,to_kingdom_id FROM court_transfers WHERE court_id=$1 AND id=$2",
            [id, action.proposalId],
          );
          const proposal = transfer.rows[0];
          if (
            !proposal ||
            proposal.to_kingdom_id !== actor ||
            !role ||
            proposal.from_kingdom_id !== court.owner_kingdom_id
          )
            throw new CourtError("TRANSFER_UNAVAILABLE");
          if (action.accept) {
            if (
              (
                await client.query(
                  "SELECT 1 FROM courts WHERE product_scope=$1 AND status='active' AND owner_kingdom_id=$2",
                  [this.scope, actor],
                )
              ).rowCount
            )
              throw new CourtError("COURT_OWNERSHIP_LIMIT");
            // Demote the old owner to an ordinary member, never exceed ten moderators.
            await client.query("UPDATE court_memberships SET role='member' WHERE court_id=$1 AND kingdom_id=$2", [
              id,
              court.owner_kingdom_id,
            ]);
            await client.query("UPDATE court_memberships SET role='owner' WHERE court_id=$1 AND kingdom_id=$2", [
              id,
              actor,
            ]);
            await client.query("UPDATE courts SET owner_kingdom_id=$2 WHERE id=$1", [id, actor]);
          }
          await client.query("DELETE FROM court_transfers WHERE court_id=$1", [id]);
          break;
        }
        case "court.pin":
          owner();
          await new ActionLimitService(this.scope).recordSuccessfulAction(client, {
            kingdomId: actor,
            kind: "public_post",
            operationKey: command.commandId,
            gameTimeMs: gameTime,
          });
          await client.query(
            "INSERT INTO court_pins(court_id,slot,author_kingdom_id,body,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(court_id,slot) DO UPDATE SET id=EXCLUDED.id,moderation_case_id=NULL,author_kingdom_id=EXCLUDED.author_kingdom_id,body=EXCLUDED.body,created_at=EXCLUDED.created_at",
            [id, action.slot, actor, action.body, this.clock.now()],
          );
          break;
        case "court.unpin":
          owner();
          await client.query("DELETE FROM court_pins WHERE court_id=$1 AND slot=$2", [id, action.slot]);
          break;
        case "court.close":
          owner();
          await client.query("UPDATE courts SET status='archived',archived_at=$2 WHERE id=$1", [id, this.clock.now()]);
          await client.query("DELETE FROM court_requests WHERE court_id=$1", [id]);
          await client.query("DELETE FROM court_transfers WHERE court_id=$1", [id]);
          break;
      }
      await client.query("UPDATE courts SET version=version+1 WHERE id=$1", [id]);
      // Text is public on the page, not duplicated into the audit journal.
      const { kind, ...details } = action;
      await this.audit(client, id, actor, kind, {
        ...details,
        ...("body" in details ? { body: undefined } : {}),
        ...("description" in details ? { description: undefined, title: undefined } : {}),
      });
    }
    const result = await client.query<{ version: number }>("SELECT version FROM courts WHERE id=$1", [id]);
    return { recordVersions: { [`court:${id}`]: result.rows[0]?.version ?? 1 }, result: { courtId: id } };
  }
  async read(handle?: string, offset = 0, accountId?: string): Promise<unknown> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      if (!handle) {
        const list = await client.query(
          'SELECT id,handle,title,description,join_mode AS "joinMode",status,version FROM courts WHERE product_scope=$1 ORDER BY handle LIMIT 51 OFFSET $2',
          [this.scope, offset],
        );
        await client.query("COMMIT");
        return {
          courts: list.rows.slice(0, 50),
          nextOffset: list.rows.length > 50 ? offset + 50 : null,
          untrustedContent: true,
        };
      }
      const found = await client.query<CourtRow>(
        "SELECT id,handle,title,description,owner_kingdom_id,join_mode,status,version FROM courts WHERE product_scope=$1 AND handle=lower($2)",
        [this.scope, handle],
      );
      const court = found.rows[0];
      if (!court) {
        await client.query("COMMIT");
        return { found: false };
      }
      const roster = await client.query(
        "SELECT m.kingdom_id AS \"kingdomId\", CASE WHEN k.status='ranked' THEN k.handle ELSE NULL END AS handle, CASE WHEN k.status='ranked' THEN k.display_name ELSE 'Departed ruler' END AS \"displayName\", m.role FROM court_memberships m JOIN kingdoms k ON k.id=m.kingdom_id WHERE court_id=$1 ORDER BY m.joined_game_time_ms,m.kingdom_id LIMIT 51 OFFSET $2",
        [court.id, offset],
      );
      const pins = await client.query(
        'SELECT id,slot,body,author_kingdom_id AS "authorKingdomId" FROM court_pins WHERE court_id=$1 ORDER BY slot',
        [court.id],
      );
      const events = await client.query<{ createdAt: Date; [key: string]: unknown }>(
        "SELECT id,kind,actor_kingdom_id AS \"actorKingdomId\",details,created_at AS \"createdAt\" FROM court_audit WHERE court_id=$1 AND kind IN ('court.create','court.join','court.leave','court.remove','court.role','court.transfer-answer','court.close','court.edit','court.pin','court.unpin') ORDER BY created_at DESC,id DESC LIMIT 50",
        [court.id],
      );
      const self = accountId
        ? await client.query<{ id: string; role: string | null }>(
            "SELECT k.id,m.role FROM kingdoms k LEFT JOIN court_memberships m ON m.kingdom_id=k.id AND m.court_id=$3 WHERE k.product_scope=$1 AND k.account_id=$2 AND k.status='ranked'",
            [this.scope, accountId, court.id],
          )
        : null;
      const viewer = self?.rows[0];
      const requests =
        viewer?.role === "owner" || viewer?.role === "moderator"
          ? (
              await client.query(
                'SELECT r.kingdom_id AS "kingdomId",k.handle FROM court_requests r JOIN kingdoms k ON k.id=r.kingdom_id WHERE r.court_id=$1 ORDER BY r.requested_at,r.kingdom_id LIMIT 51 OFFSET $2',
                [court.id, offset],
              )
            ).rows
          : [];
      const transfers = viewer
        ? (
            await client.query(
              'SELECT id,to_kingdom_id AS "toKingdomId" FROM court_transfers WHERE court_id=$1 AND (from_kingdom_id=$2 OR to_kingdom_id=$2)',
              [court.id, viewer.id],
            )
          ).rows
        : [];
      const requested = viewer
        ? !!(
            await client.query("SELECT 1 FROM court_requests WHERE court_id=$1 AND kingdom_id=$2", [
              court.id,
              viewer.id,
            ])
          ).rowCount
        : false;
      await client.query("COMMIT");
      return {
        found: true,
        court,
        roster: roster.rows.slice(0, 50),
        nextOffset: roster.rows.length > 50 ? offset + 50 : null,
        pins: pins.rows,
        events: events.rows.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
        requests: requests.slice(0, 50),
        requestsNextOffset: requests.length > 50 ? offset + 50 : null,
        transfers,
        viewerRole: viewer?.role ?? null,
        requested,
        humanDecision: { path: `/pact/?court=${court.handle}`, required: true },
        untrustedContent: true,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
