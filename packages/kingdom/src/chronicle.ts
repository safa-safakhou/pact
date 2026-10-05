import type { ChronicleCommand, ChronicleReadQuery, ChronicleSelection } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import { canonicalJson, sha256 } from "@pact/evidence";
import type { Pool, PoolClient } from "pg";
import { ActionLimitService } from "./action-limits.js";
import type { InvitationDestinationPort } from "./invitations.js";
import type { SealService } from "./seals.js";
import type { SocialService } from "./social.js";
import { uuidV7 } from "./uuid-v7.js";

export interface ChronicleFactPort {
  read(client: PoolClient, accountId: string, commandId: string): Promise<Record<string, unknown> | null>;
  list(client: PoolClient, accountId: string): Promise<Record<string, unknown>[]>;
}
export class ChronicleError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "POST_UNAVAILABLE"
      | "STALE_VERSION"
      | "PREVIEW_CHANGED"
      | "SOURCE_UNAVAILABLE"
      | "NOTICE_LIMIT",
  ) {
    super(code);
    this.name = "ChronicleError";
  }
}
interface Post {
  id: string;
  type: "notice" | "story";
  version: number;
  title: string;
  commentary: string;
  fact: Record<string, unknown> | null;
  seal_ids: string[];
  expires_game_time_ms: string | null;
  status: string;
  published_at: Date;
  author_kingdom_id: string | null;
  author_handle: string | null;
  court_handle: string | null;
  author_account_id: string | null;
}

export class ChronicleService {
  private readonly limits: ActionLimitService;
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly clock: { now(): Date },
    private readonly seals: SealService,
    private readonly facts: ChronicleFactPort,
    private readonly social: SocialService,
  ) {
    this.limits = new ActionLimitService(scope);
  }
  private async actor(c: PoolClient, accountId: string) {
    const r = (
      await c.query<{ id: string; handle: string }>(
        "SELECT k.id,k.handle FROM kingdoms k JOIN accounts a ON a.id=k.account_id WHERE k.product_scope=$1 AND k.account_id=$2 AND k.status='ranked' AND a.status='active' AND (a.email_verified_at IS NOT NULL OR a.is_guest) FOR UPDATE OF k",
        [this.scope, accountId],
      )
    ).rows[0];
    if (!r) throw new ChronicleError("FORBIDDEN");
    return r;
  }
  async previewInTransaction(c: PoolClient, accountId: string, selection: ChronicleSelection) {
    const actor = await this.actor(c, accountId);
    let court: { id: string; handle: string } | null = null;
    if (selection.courtHandle) {
      court =
        (
          await c.query<{ id: string; handle: string }>(
            "SELECT c.id,c.handle FROM courts c JOIN court_memberships m ON m.court_id=c.id WHERE c.product_scope=$1 AND c.handle=$2 AND c.status='active' AND m.kingdom_id=$3",
            [this.scope, selection.courtHandle, actor.id],
          )
        ).rows[0] ?? null;
      if (!court) throw new ChronicleError("FORBIDDEN");
    }
    let fact: Record<string, unknown> | null = null;
    const evidence: unknown[] = [];
    if (selection.type === "story") {
      fact = await this.facts.read(c, accountId, selection.factCommandId);
      if (!fact) throw new ChronicleError("SOURCE_UNAVAILABLE");
      if (new Set(selection.sealIds).size !== selection.sealIds.length) throw new ChronicleError("SOURCE_UNAVAILABLE");
      for (const id of selection.sealIds) {
        const seal = await this.seals.readInTransaction(c, id);
        if (seal.status !== "published" || !seal.verification?.authentic)
          throw new ChronicleError("SOURCE_UNAVAILABLE");
        evidence.push(seal);
      }
    } else if (selection.postId) {
      const row = (
        await c.query<{ version: number }>(
          "SELECT version FROM chronicle_posts WHERE product_scope=$1 AND id=$2 AND author_kingdom_id=$3 AND type='notice' AND status='published' FOR UPDATE",
          [this.scope, selection.postId, actor.id],
        )
      ).rows[0];
      if (!row) throw new ChronicleError("POST_UNAVAILABLE");
      if (row.version !== selection.expectedVersion) throw new ChronicleError("STALE_VERSION");
    } else if (selection.expectedVersion !== undefined) throw new ChronicleError("STALE_VERSION");
    const payload = {
      selection,
      author: actor,
      court,
      fact,
      evidence,
      commentaryLabel: "Player commentary — untrusted claim, not an engine fact",
      warning:
        "Only this preview is published. A committed instruction is not a completed consequence. Evidence authenticity is not truth. Public copies cannot be recalled.",
    };
    return { ...payload, previewDigest: sha256(canonicalJson(payload)) };
  }
  preview(accountId: string, selection: ChronicleSelection) {
    return withTransaction(this.pool, (c) => this.previewInTransaction(c, accountId, selection));
  }
  async execute(c: PoolClient, accountId: string, command: ChronicleCommand, gameTimeMs: number) {
    const actor = await this.actor(c, accountId),
      action = command.action;
    let id: string, version: number;
    if (action.kind === "chronicle.remove") {
      id = action.postId;
      const row = (
        await c.query<{ version: number }>(
          "UPDATE chronicle_posts SET status='removed',title='',commentary='',seal_ids='{}',version=version+1 WHERE product_scope=$1 AND id=$2 AND author_kingdom_id=$3 AND version=$4 RETURNING version",
          [this.scope, id, actor.id, action.expectedVersion],
        )
      ).rows[0];
      if (!row) throw new ChronicleError("STALE_VERSION");
      version = row.version;
    } else {
      const p = await this.previewInTransaction(c, accountId, action.selection);
      if (p.previewDigest !== action.previewDigest) throw new ChronicleError("PREVIEW_CHANGED");
      await this.limits.recordSuccessfulAction(c, {
        kingdomId: actor.id,
        kind: "public_post",
        operationKey: command.commandId,
        gameTimeMs,
      });
      const s = action.selection;
      id = s.type === "notice" && s.postId ? s.postId : uuidV7(this.clock.now());
      version = s.type === "notice" && s.postId ? (s.expectedVersion ?? 0) + 1 : 1;
      if (
        s.type === "notice" &&
        ((
          await c.query(
            "SELECT 1 FROM chronicle_posts WHERE product_scope=$1 AND author_kingdom_id=$2 AND type='notice' AND status='published' AND expires_game_time_ms>$3 AND id<>$4",
            [this.scope, actor.id, gameTimeMs, id],
          )
        ).rowCount ?? 0) >= 2
      )
        throw new ChronicleError("NOTICE_LIMIT");
      await c.query(
        `INSERT INTO chronicle_posts(id,product_scope,author_kingdom_id,court_id,type,version,title,commentary,fact,seal_ids,expires_game_time_ms,status,published_at,command_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,'published',$12,$13)
        ON CONFLICT(id) DO UPDATE SET court_id=EXCLUDED.court_id,version=EXCLUDED.version,title=EXCLUDED.title,commentary=EXCLUDED.commentary,expires_game_time_ms=EXCLUDED.expires_game_time_ms,published_at=EXCLUDED.published_at,command_id=EXCLUDED.command_id`,
        [
          id,
          this.scope,
          actor.id,
          p.court?.id ?? null,
          s.type,
          version,
          s.title,
          s.commentary,
          p.fact === null ? null : JSON.stringify(p.fact),
          s.type === "story" ? s.sealIds : [],
          s.type === "notice" ? gameTimeMs + s.durationHours * 3600000 : null,
          this.clock.now(),
          command.commandId,
        ],
      );
    }
    return {
      recordVersions: { [`chronicle:${id}`]: version },
      result: { postId: id, version, path: `/pact/?post=${id}` },
    };
  }
  private async rows(c: PoolClient, q: ChronicleReadQuery) {
    return (
      await c.query<Post>(
        `SELECT p.*,k.handle AS author_handle,k.account_id AS author_account_id,c.handle AS court_handle FROM chronicle_posts p LEFT JOIN kingdoms k ON k.id=p.author_kingdom_id LEFT JOIN courts c ON c.id=p.court_id WHERE p.product_scope=$1 AND ($2::uuid IS NULL OR p.id=$2) AND ($3::text IS NULL OR p.type=$3) AND ($4::text IS NULL OR k.handle=$4) AND ($5::text IS NULL OR c.handle=$5) AND p.published_at>$6 ORDER BY p.published_at DESC,p.id DESC LIMIT 50 OFFSET $7`,
        [
          this.scope,
          q.postId ?? null,
          q.type ?? null,
          q.authorHandle ?? null,
          q.courtHandle ?? null,
          new Date(this.clock.now().getTime() - 180 * 86400000),
          q.offset,
        ],
      )
    ).rows;
  }
  async readInTransaction(c: PoolClient, q: ChronicleReadQuery, gameTimeMs: number, accountId?: string) {
    const rows = await this.rows(c, q),
      posts: Record<string, unknown>[] = [];
    const viewer = accountId
      ? (
          await c.query<{ id: string }>("SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2", [
            this.scope,
            accountId,
          ])
        ).rows[0]?.id
      : undefined;
    for (const row of rows) {
      if (row.status !== "published") {
        if (q.postId) posts.push({ id: row.id, status: "removed" });
        continue;
      }
      const expired = row.type === "notice" && Number(row.expires_game_time_ms) <= gameTimeMs;
      if (expired && !q.postId) continue;
      const evidence = [];
      for (const id of row.seal_ids) evidence.push(await this.seals.readInTransaction(c, id));
      const blocked = Boolean(
        viewer &&
          row.author_kingdom_id &&
          viewer !== row.author_kingdom_id &&
          (await this.social.isBlocked(c, viewer, row.author_kingdom_id)),
      );
      posts.push({
        id: row.id,
        type: row.type,
        version: row.version,
        title: blocked ? "Blocked player's prose collapsed" : row.title,
        commentary: blocked ? "" : row.commentary,
        proseCollapsed: blocked,
        commentaryLabel: "Player commentary — untrusted claim, not an engine fact",
        fact: row.fact,
        evidence,
        author: { id: row.author_kingdom_id, handle: row.author_handle },
        courtHandle: row.court_handle,
        publishedAt: row.published_at.toISOString(),
        status: expired ? "expired" : "published",
        expiresGameTimeMs: row.expires_game_time_ms === null ? null : Number(row.expires_game_time_ms),
        path: `/pact/?post=${row.id}`,
        destination: {
          type: row.type,
          id: row.id,
          path: `/pact/?post=${row.id}`,
          effect:
            row.type === "notice"
              ? "An issuer invitation offers a conversation, not an accepted contract."
              : "View this published story; no automatic contact, Court membership or contract.",
        },
        canRemove: row.author_account_id === accountId,
        untrustedContent: true,
      });
    }
    return {
      posts,
      nextOffset: rows.length === 50 ? q.offset + 50 : null,
      humanDecision: { path: "/pact/?chronicle=1", publicationRequiresHuman: true },
    };
  }
  read(q: ChronicleReadQuery, gameTimeMs: number, accountId?: string) {
    return withTransaction(this.pool, (c) => this.readInTransaction(c, q, gameTimeMs, accountId));
  }
  ownFacts(accountId: string) {
    return withTransaction(this.pool, async (c) => {
      await this.actor(c, accountId);
      return { facts: await this.facts.list(c, accountId) };
    });
  }
  destination(type: "notice" | "story"): InvitationDestinationPort {
    return {
      read: async (c, id, time) => {
        const p = (await this.rows(c, { postId: id, offset: 0 }))[0];
        if (!p || p.type !== type || p.status !== "published") return null;
        return {
          type,
          id,
          title: p.title,
          public: true,
          path: `/pact/?post=${id}`,
          version: p.version,
          available: type === "story" || Number(p.expires_game_time_ms) > time,
          ...(type === "notice" ? { expiresGameTimeMs: Number(p.expires_game_time_ms) } : {}),
        };
      },
      authorizeIssue: async (c, issuer, id) => {
        if (
          !(
            await c.query(
              "SELECT 1 FROM chronicle_posts WHERE product_scope=$1 AND id=$2 AND author_kingdom_id=$3 AND type=$4 AND status='published'",
              [this.scope, id, issuer, type],
            )
          ).rowCount
        )
          throw new ChronicleError("FORBIDDEN");
      },
      accept: async (c, accountId, id, time) => {
        const p = (await this.rows(c, { postId: id, offset: 0 }))[0];
        if (
          !p ||
          p.type !== type ||
          p.status !== "published" ||
          (type === "notice" && Number(p.expires_game_time_ms) <= time)
        )
          throw new ChronicleError("POST_UNAVAILABLE");
        if (type === "notice") {
          const actor = await this.actor(c, accountId);
          if (!p.author_kingdom_id || actor.id === p.author_kingdom_id) throw new ChronicleError("FORBIDDEN");
          await this.social.acceptNoticeConversation(c, accountId, p.author_kingdom_id, time);
        }
      },
    };
  }
  async forgetAccount(c: PoolClient, accountId: string) {
    await c.query(
      "UPDATE chronicle_posts SET status='removed',title='',commentary='',fact=NULL,seal_ids='{}' WHERE product_scope=$1 AND author_kingdom_id IN(SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2)",
      [this.scope, accountId],
    );
  }
  async exportAccount(c: PoolClient, accountId: string) {
    return (
      await c.query(
        "SELECT p.* FROM chronicle_posts p JOIN kingdoms k ON k.id=p.author_kingdom_id WHERE p.product_scope=$1 AND k.account_id=$2",
        [this.scope, accountId],
      )
    ).rows;
  }
  async prune(c: PoolClient, now: Date) {
    return (
      (
        await c.query("DELETE FROM chronicle_posts WHERE product_scope=$1 AND published_at<=$2", [
          this.scope,
          new Date(now.getTime() - 180 * 86400000),
        ])
      ).rowCount ?? 0
    );
  }
}
