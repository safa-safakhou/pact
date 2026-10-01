import { createHash } from "node:crypto";
import type { PoliticsCommand } from "@pact/contracts";
import type { Pool, PoolClient } from "pg";
import { ActionLimitService } from "./action-limits.js";
import { uuidV7 } from "./uuid-v7.js";

export class PoliticsError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "STALE_VERSION"
      | "ARTICLE_LIMIT"
      | "ARTICLE_UNAVAILABLE"
      | "PROPOSAL_UNAVAILABLE"
      | "EXPIRED"
      | "ALREADY_HAS_PATRON"
      | "ALLEGIANCE_CYCLE"
      | "INVALID_ALLEGIANCE",
  ) {
    super(code);
    this.name = "PoliticsError";
  }
}
interface Proposal {
  id: string;
  proposer_kingdom_id: string;
  subject_kingdom_id: string;
  patron_kingdom_id: string;
  version: number;
  status: string;
  expires_game_time_ms: string;
}
export class PoliticsService {
  private readonly limits: ActionLimitService;
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly clock: { now(): Date },
  ) {
    this.limits = new ActionLimitService(scope);
  }
  private async actor(client: PoolClient, accountId: string) {
    const k = (
      await client.query<{ id: string }>(
        "SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2 AND status='ranked' FOR UPDATE",
        [this.scope, accountId],
      )
    ).rows[0];
    if (!k) throw new PoliticsError("FORBIDDEN");
    return k.id;
  }
  private async parties(client: PoolClient, subject: string, patron: string, actor: string) {
    if (subject === patron || ![subject, patron].includes(actor)) throw new PoliticsError("INVALID_ALLEGIANCE");
    const found = await client.query(
      "SELECT id FROM kingdoms WHERE product_scope=$1 AND id=ANY($2::uuid[]) AND status='ranked' ORDER BY id FOR UPDATE",
      [this.scope, [subject, patron]],
    );
    if (found.rowCount !== 2) throw new PoliticsError("FORBIDDEN");
    if (
      (
        await client.query(
          "SELECT 1 FROM social_blocks WHERE product_scope=$1 AND ((blocker_kingdom_id=$2 AND blocked_kingdom_id=$3) OR (blocker_kingdom_id=$3 AND blocked_kingdom_id=$2))",
          [this.scope, subject, patron],
        )
      ).rowCount
    )
      throw new PoliticsError("FORBIDDEN");
  }
  async execute(client: PoolClient, accountId: string, command: PoliticsCommand, gameTime: number) {
    const actor = await this.actor(client, accountId),
      action = command.action;
    let id: string,
      version = 1;
    // A product graph lock serializes even disjoint edge changes that could jointly form a cycle.
    if (action.kind.startsWith("allegiance."))
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`pact.allegiance:${this.scope}`]);
    switch (action.kind) {
      case "article.publish":
      case "article.replace": {
        let previous: { id: string; version: number } | undefined;
        if (action.kind === "article.replace") {
          previous = (
            await client.query<{ id: string; version: number }>(
              "SELECT id,version FROM kingdom_articles WHERE product_scope=$1 AND id=$2 AND author_kingdom_id=$3 AND status='active' FOR UPDATE",
              [this.scope, action.articleId, actor],
            )
          ).rows[0];
          if (!previous) throw new PoliticsError("ARTICLE_UNAVAILABLE");
          if (previous.version !== action.expectedVersion) throw new PoliticsError("STALE_VERSION");
          version = previous.version + 1;
        } else if (
          ((
            await client.query<{ count: number }>(
              "SELECT count(*)::int AS count FROM kingdom_articles WHERE product_scope=$1 AND author_kingdom_id=$2 AND status='active'",
              [this.scope, actor],
            )
          ).rows[0]?.count ?? 0) >= 3
        )
          throw new PoliticsError("ARTICLE_LIMIT");
        await this.limits.recordSuccessfulAction(client, {
          kingdomId: actor,
          kind: "public_post",
          operationKey: command.commandId,
          gameTimeMs: gameTime,
        });
        if (previous)
          await client.query("UPDATE kingdom_articles SET status='replaced',closed_at=$2 WHERE id=$1", [
            previous.id,
            this.clock.now(),
          ]);
        id = uuidV7(this.clock.now());
        const digest = createHash("sha256")
          .update(JSON.stringify({ author: actor, version, title: action.title, body: action.body }))
          .digest("hex");
        await client.query(
          "INSERT INTO kingdom_articles(id,product_scope,author_kingdom_id,version,title,body,created_at,published_at,supersedes_id,status,signed_command_id,content_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,'active',$9,$10)",
          [
            id,
            this.scope,
            actor,
            version,
            action.title,
            action.body,
            this.clock.now(),
            previous?.id ?? null,
            command.commandId,
            digest,
          ],
        );
        break;
      }
      case "article.withdraw": {
        const row = (
          await client.query<{ version: number }>(
            "SELECT version FROM kingdom_articles WHERE product_scope=$1 AND id=$2 AND author_kingdom_id=$3 AND status='active' FOR UPDATE",
            [this.scope, action.articleId, actor],
          )
        ).rows[0];
        if (!row) throw new PoliticsError("ARTICLE_UNAVAILABLE");
        if (row.version !== action.expectedVersion) throw new PoliticsError("STALE_VERSION");
        id = action.articleId;
        version = row.version;
        await client.query("UPDATE kingdom_articles SET status='withdrawn',closed_at=$2 WHERE id=$1", [
          id,
          this.clock.now(),
        ]);
        break;
      }
      case "allegiance.propose":
      case "allegiance.revise": {
        await this.parties(client, action.subjectKingdomId, action.patronKingdomId, actor);
        if (action.kind === "allegiance.revise") {
          const old = (
            await client.query<Proposal>(
              "SELECT * FROM allegiance_proposals WHERE product_scope=$1 AND id=$2 FOR UPDATE",
              [this.scope, action.proposalId],
            )
          ).rows[0];
          if (!old || old.status !== "pending" || old.proposer_kingdom_id !== actor)
            throw new PoliticsError("PROPOSAL_UNAVAILABLE");
          if (old.version !== action.expectedVersion) throw new PoliticsError("STALE_VERSION");
          if (Number(old.expires_game_time_ms) <= gameTime) throw new PoliticsError("EXPIRED");
          id = old.id;
          version = old.version + 1;
          await client.query(
            "UPDATE allegiance_proposals SET subject_kingdom_id=$2,patron_kingdom_id=$3,version=$4,expires_game_time_ms=$5,signed_command_id=$6 WHERE id=$1",
            [id, action.subjectKingdomId, action.patronKingdomId, version, gameTime + 86400000, command.commandId],
          );
        } else {
          id = uuidV7(this.clock.now());
          await client.query(
            "INSERT INTO allegiance_proposals(id,product_scope,proposer_kingdom_id,subject_kingdom_id,patron_kingdom_id,version,status,expires_game_time_ms,created_at,signed_command_id) VALUES($1,$2,$3,$4,$5,1,'pending',$6,$7,$8)",
            [
              id,
              this.scope,
              actor,
              action.subjectKingdomId,
              action.patronKingdomId,
              gameTime + 86400000,
              this.clock.now(),
              command.commandId,
            ],
          );
        }
        break;
      }
      case "allegiance.answer": {
        const proposal = (
          await client.query<Proposal>(
            "SELECT * FROM allegiance_proposals WHERE product_scope=$1 AND id=$2 FOR UPDATE",
            [this.scope, action.proposalId],
          )
        ).rows[0];
        if (
          !proposal ||
          proposal.status !== "pending" ||
          proposal.proposer_kingdom_id === actor ||
          ![proposal.subject_kingdom_id, proposal.patron_kingdom_id].includes(actor)
        )
          throw new PoliticsError("PROPOSAL_UNAVAILABLE");
        if (proposal.version !== action.expectedVersion) throw new PoliticsError("STALE_VERSION");
        if (Number(proposal.expires_game_time_ms) <= gameTime) throw new PoliticsError("EXPIRED");
        id = proposal.id;
        version = proposal.version;
        if (action.accept) {
          await this.parties(client, proposal.subject_kingdom_id, proposal.patron_kingdom_id, actor);
          if (
            (
              await client.query(
                "SELECT 1 FROM allegiance_edges WHERE product_scope=$1 AND subject_kingdom_id=$2 AND status='active'",
                [this.scope, proposal.subject_kingdom_id],
              )
            ).rowCount
          )
            throw new PoliticsError("ALREADY_HAS_PATRON");
          const cycle = await client.query(
            "WITH RECURSIVE chain(id) AS (SELECT $2::uuid UNION SELECT e.patron_kingdom_id FROM allegiance_edges e JOIN chain c ON e.subject_kingdom_id=c.id WHERE e.product_scope=$1 AND e.status='active') SELECT 1 FROM chain WHERE id=$3",
            [this.scope, proposal.patron_kingdom_id, proposal.subject_kingdom_id],
          );
          if (cycle.rowCount) throw new PoliticsError("ALLEGIANCE_CYCLE");
          const edgeId = uuidV7(this.clock.now());
          await client.query(
            "INSERT INTO allegiance_edges(id,product_scope,subject_kingdom_id,patron_kingdom_id,proposal_id,version,status,created_at) VALUES($1,$2,$3,$4,$5,1,'active',$6)",
            [edgeId, this.scope, proposal.subject_kingdom_id, proposal.patron_kingdom_id, id, this.clock.now()],
          );
        }
        await client.query("UPDATE allegiance_proposals SET status=$2,accepted_command_id=$3 WHERE id=$1", [
          id,
          action.accept ? "accepted" : "declined",
          command.commandId,
        ]);
        break;
      }
      case "allegiance.end": {
        const edge = (
          await client.query<{ id: string; version: number }>(
            "SELECT id,version FROM allegiance_edges WHERE product_scope=$1 AND subject_kingdom_id=$2 AND status='active' AND (subject_kingdom_id=$3 OR patron_kingdom_id=$3) AND id=$4 FOR UPDATE",
            [this.scope, action.subjectKingdomId, actor, action.edgeId],
          )
        ).rows[0];
        if (!edge) throw new PoliticsError("FORBIDDEN");
        if (edge.version !== action.expectedVersion) throw new PoliticsError("STALE_VERSION");
        id = edge.id;
        version = edge.version + 1;
        await client.query("UPDATE allegiance_edges SET status='ended',ended_at=$2,version=$3 WHERE id=$1", [
          id,
          this.clock.now(),
          version,
        ]);
        break;
      }
    }
    await client.query(
      "INSERT INTO politics_events(id,product_scope,kingdom_id,kind,record_id,created_at) VALUES($1,$2,$3,$4,$5,$6)",
      [uuidV7(this.clock.now()), this.scope, actor, action.kind, id, this.clock.now()],
    );
    return { recordVersions: { [`politics:${id}`]: version }, result: { recordId: id, version } };
  }
  async publicFor(client: PoolClient, kingdomId?: string, offset = 0) {
    const articles = (
      await client.query(
        'SELECT a.id,a.author_kingdom_id AS "authorKingdomId",k.handle,a.version,a.title,a.body,a.supersedes_id AS "supersedesId",a.content_digest AS "contentDigest",a.signed_command_id AS "signedCommandId" FROM kingdom_articles a JOIN kingdoms k ON k.id=a.author_kingdom_id WHERE a.product_scope=$1 AND a.status=\'active\' AND k.status=\'ranked\' AND ($2::uuid IS NULL OR a.author_kingdom_id=$2) ORDER BY a.published_at,a.id LIMIT 51 OFFSET $3',
        [this.scope, kingdomId ?? null, offset],
      )
    ).rows;
    const edges = (
      await client.query(
        'SELECT e.id,e.subject_kingdom_id AS "subjectKingdomId",s.handle AS "subjectHandle",e.patron_kingdom_id AS "patronKingdomId",p.handle AS "patronHandle",e.version FROM allegiance_edges e JOIN kingdoms s ON s.id=e.subject_kingdom_id JOIN kingdoms p ON p.id=e.patron_kingdom_id WHERE e.product_scope=$1 AND e.status=\'active\' AND s.status=\'ranked\' AND p.status=\'ranked\' AND ($2::uuid IS NULL OR e.subject_kingdom_id=$2 OR e.patron_kingdom_id=$2) ORDER BY e.created_at,e.id LIMIT 51 OFFSET $3',
        [this.scope, kingdomId ?? null, offset],
      )
    ).rows;
    return {
      articles: articles.slice(0, 50),
      allegiance: edges.slice(0, 50),
      articlesNextOffset: articles.length > 50 ? offset + 50 : null,
      allegianceNextOffset: edges.length > 50 ? offset + 50 : null,
    };
  }
  async read(handle: string | undefined, offset: number, accountId: string | undefined, gameTime: number) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const target = handle
        ? (
            await client.query<{ id: string }>(
              "SELECT id FROM kingdoms WHERE product_scope=$1 AND handle=lower($2) AND status='ranked'",
              [this.scope, handle],
            )
          ).rows[0]
        : undefined;
      if (handle && !target) {
        await client.query("COMMIT");
        return { found: false };
      }
      const viewer = accountId
        ? (
            await client.query<{ id: string }>(
              "SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2 AND status='ranked'",
              [this.scope, accountId],
            )
          ).rows[0]
        : undefined;
      const pending = viewer
        ? (
            await client.query(
              'SELECT id,subject_kingdom_id AS "subjectKingdomId",patron_kingdom_id AS "patronKingdomId",proposer_kingdom_id AS "proposerKingdomId",version,expires_game_time_ms::text AS "expiresGameTimeMs" FROM allegiance_proposals WHERE product_scope=$1 AND status=\'pending\' AND expires_game_time_ms>$3 AND (subject_kingdom_id=$2 OR patron_kingdom_id=$2) ORDER BY created_at,id LIMIT 51 OFFSET $4',
              [this.scope, viewer.id, gameTime, offset],
            )
          ).rows
        : [];
      const result = await this.publicFor(client, target?.id, offset);
      await client.query("COMMIT");
      return {
        found: true,
        ...result,
        pending: pending.slice(0, 50),
        pendingNextOffset: pending.length > 50 ? offset + 50 : null,
        humanDecision: { path: "/pact/?politics=1", required: true },
        untrustedContent: true,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async forgetAccount(client: PoolClient, accountId: string) {
    const ids = (
      await client.query<{ id: string }>("SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2", [
        this.scope,
        accountId,
      ])
    ).rows.map((r) => r.id);
    await client.query(
      "UPDATE kingdom_articles SET title='Removed',body='Removed',status='moderated',closed_at=COALESCE(closed_at,$3) WHERE product_scope=$1 AND author_kingdom_id=ANY($2::uuid[])",
      [this.scope, ids, this.clock.now()],
    );
    await client.query(
      "UPDATE allegiance_edges SET status='ended',ended_at=$3,version=version+1 WHERE product_scope=$1 AND status='active' AND (subject_kingdom_id=ANY($2::uuid[]) OR patron_kingdom_id=ANY($2::uuid[]))",
      [this.scope, ids, this.clock.now()],
    );
    await client.query(
      "UPDATE allegiance_proposals SET status='canceled' WHERE product_scope=$1 AND status='pending' AND (subject_kingdom_id=ANY($2::uuid[]) OR patron_kingdom_id=ANY($2::uuid[]))",
      [this.scope, ids],
    );
  }
  async prune(client: PoolClient, now: Date) {
    const cutoff = new Date(now.getTime() - 180 * 86400000);
    await client.query("DELETE FROM allegiance_edges WHERE product_scope=$1 AND status='ended' AND ended_at<=$2", [
      this.scope,
      cutoff,
    ]);
    await client.query(
      "DELETE FROM allegiance_proposals WHERE product_scope=$1 AND created_at<=$2 AND status<>'pending' AND NOT EXISTS(SELECT 1 FROM allegiance_edges e WHERE e.proposal_id=allegiance_proposals.id)",
      [this.scope, cutoff],
    );
    await client.query("DELETE FROM politics_events WHERE product_scope=$1 AND created_at<=$2", [this.scope, cutoff]);
    return (
      (
        await client.query(
          "DELETE FROM kingdom_articles WHERE product_scope=$1 AND status<>'active' AND closed_at<=$2",
          [this.scope, cutoff],
        )
      ).rowCount ?? 0
    );
  }
  async exportAccount(client: PoolClient, accountId: string) {
    const articles = (
      await client.query(
        "SELECT a.* FROM kingdom_articles a JOIN kingdoms k ON k.id=a.author_kingdom_id WHERE a.product_scope=$1 AND k.account_id=$2",
        [this.scope, accountId],
      )
    ).rows;
    const proposals = (
      await client.query(
        "SELECT p.* FROM allegiance_proposals p WHERE p.product_scope=$1 AND EXISTS(SELECT 1 FROM kingdoms k WHERE k.account_id=$2 AND k.product_scope=$1 AND k.id IN(p.subject_kingdom_id,p.patron_kingdom_id))",
        [this.scope, accountId],
      )
    ).rows;
    return { articles, proposals };
  }
}
