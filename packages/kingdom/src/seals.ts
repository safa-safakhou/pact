import type { JsonWebKey } from "node:crypto";
import type { SealCommand, SealSelection } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import { canonicalJson, selectExcerpt, sha256, verifyPayload } from "@pact/evidence";
import type { Pool, PoolClient } from "pg";
import { ActionLimitService } from "./action-limits.js";
import type { GameReportReader } from "./report-reader.js";
import { uuidV7 } from "./uuid-v7.js";

export const SEAL_DOMAIN = "PACT-SEAL-V1\n";
export class SealError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "SOURCE_UNAVAILABLE" | "INVALID_SELECTION" | "PREVIEW_CHANGED" | "SEAL_UNAVAILABLE",
  ) {
    super(code);
    this.name = "SealError";
  }
}
export class SealService {
  private readonly limits: ActionLimitService;
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly clock: { now(): Date },
    private readonly reports: GameReportReader,
  ) {
    this.limits = new ActionLimitService(scope);
  }
  private async actor(client: PoolClient, accountId: string) {
    const row = (
      await client.query<{ id: string }>(
        "SELECT k.id FROM kingdoms k JOIN accounts a ON a.id=k.account_id WHERE k.product_scope=$1 AND k.account_id=$2 AND k.status='ranked' AND a.status='active' AND (a.email_verified_at IS NOT NULL OR a.is_guest) FOR UPDATE OF k",
        [this.scope, accountId],
      )
    ).rows[0];
    if (!row) throw new SealError("FORBIDDEN");
    return row.id;
  }
  async previewInTransaction(client: PoolClient, accountId: string, selection: SealSelection) {
    const actor = await this.actor(client, accountId);
    if (
      (
        await client.query(
          "SELECT 1 FROM seal_source_removals WHERE product_scope=$1 AND record_type=$2 AND record_id=$3",
          [this.scope, selection.recordType, selection.recordId],
        )
      ).rowCount
    )
      throw new SealError("SOURCE_UNAVAILABLE");
    let content: Record<string, unknown>;
    let participants: string[],
      originalTimestamp: string,
      observed: number | null = null;
    if (selection.recordType === "message") {
      const source = (
        await client.query<{ body: string; sender_kingdom_id: string; recipient_kingdom_id: string; created_at: Date }>(
          "SELECT body,sender_kingdom_id,recipient_kingdom_id,created_at FROM direct_messages WHERE product_scope=$1 AND id=$2 AND (sender_kingdom_id=$3 OR recipient_kingdom_id=$3) AND created_at>$4 FOR SHARE",
          [this.scope, selection.recordId, actor, new Date(this.clock.now().getTime() - 90 * 86400000)],
        )
      ).rows[0];
      if (!source) throw new SealError("SOURCE_UNAVAILABLE");
      try {
        content = selectExcerpt(
          source.body,
          selection.ranges ?? [{ start: 0, end: Buffer.byteLength(source.body, "utf8") }],
        );
      } catch {
        throw new SealError("INVALID_SELECTION");
      }
      participants = [source.sender_kingdom_id, source.recipient_kingdom_id];
      originalTimestamp = source.created_at.toISOString();
      content = {
        ...content,
        message_id: selection.recordId,
        sender_kingdom_id: source.sender_kingdom_id,
        recipient_kingdom_id: source.recipient_kingdom_id,
      };
    } else {
      const source = await this.reports.sealSource(client, accountId, selection.recordType, selection.recordId);
      if (!source || source.createdAt.getTime() <= this.clock.now().getTime() - 180 * 86400000)
        throw new SealError("SOURCE_UNAVAILABLE");
      const allowed = Object.keys(source.fields).sort(),
        fields = selection.fields ?? allowed;
      if (new Set(fields).size !== fields.length || fields.some((f) => !allowed.includes(f)))
        throw new SealError("INVALID_SELECTION");
      const selected = Object.fromEntries(fields.map((f) => [f, source.fields[f]])),
        omitted = allowed.filter((f) => !fields.includes(f));
      content = {
        content_digest: sha256(canonicalJson(source.fields)),
        selected_fields: selected,
        omitted_fields: omitted,
        context: omitted.length
          ? "Selected fields; context omitted"
          : "Complete source excerpt; not a complete account",
      };
      participants = source.participants;
      originalTimestamp = source.createdAt.toISOString();
      observed = source.observedGameTimeMs;
    }
    const payload = {
      schema_version: 1,
      record_type: selection.recordType,
      record_id: selection.recordId,
      original_timestamp: originalTimestamp,
      participant_kingdom_ids: participants,
      ...(observed === null ? {} : { observed_game_time_ms: observed }),
      ...content,
    };
    const names = (
      await client.query<{ id: string; handle: string }>(
        "SELECT id,handle FROM kingdoms WHERE product_scope=$1 AND id=ANY($2::uuid[]) ORDER BY id",
        [this.scope, participants],
      )
    ).rows;
    return {
      payload,
      previewDigest: sha256(canonicalJson(payload)),
      participants: names,
      warning: "Authentic excerpts are not proof of truth or complete context. Public copies cannot be recalled.",
    };
  }
  async preview(accountId: string, selection: SealSelection) {
    return withTransaction(this.pool, (c) => this.previewInTransaction(c, accountId, selection));
  }
  async execute(client: PoolClient, accountId: string, command: SealCommand, gameTime: number) {
    const actor = await this.actor(client, accountId),
      action = command.action;
    let id: string;
    if (action.kind === "seal.remove") {
      id = action.sealId;
      const row = await client.query(
        "UPDATE evidence_seals SET status='removed' WHERE product_scope=$1 AND id=$2 AND creator_kingdom_id=$3 RETURNING id",
        [this.scope, id, actor],
      );
      if (!row.rowCount) throw new SealError("SEAL_UNAVAILABLE");
    } else {
      const preview = await this.previewInTransaction(client, accountId, action.selection);
      if (preview.previewDigest !== action.previewDigest) throw new SealError("PREVIEW_CHANGED");
      await this.limits.recordSuccessfulAction(client, {
        kingdomId: actor,
        kind: "public_post",
        operationKey: command.commandId,
        gameTimeMs: gameTime,
      });
      id = uuidV7(this.clock.now());
      await client.query(
        "INSERT INTO evidence_seals(id,product_scope,creator_kingdom_id,record_type,record_id,preview_payload,status,created_at,command_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,'pending',$7,$8)",
        [
          id,
          this.scope,
          actor,
          action.selection.recordType,
          action.selection.recordId,
          JSON.stringify(preview.payload),
          this.clock.now(),
          command.commandId,
        ],
      );
    }
    return {
      recordVersions: { [`seal:${id}`]: 1 },
      result: { sealId: id, status: action.kind === "seal.remove" ? "removed" : "pending" },
    };
  }
  async keys() {
    return {
      keys: (
        await this.pool.query<{ public_jwk: JsonWebKey }>(
          "SELECT public_jwk FROM seal_signing_keys WHERE product_scope=$1 ORDER BY created_at,kid",
          [this.scope],
        )
      ).rows.map((r) => r.public_jwk),
      compromisedKeyIds: (
        await this.pool.query<{ kid: string }>(
          "SELECT kid FROM seal_signing_keys WHERE product_scope=$1 AND compromised ORDER BY kid",
          [this.scope],
        )
      ).rows.map((r) => r.kid),
    };
  }
  async read(id: string, accountId?: string) {
    return withTransaction(this.pool, (c) => this.readInTransaction(c, id, accountId));
  }
  async readInTransaction(client: PoolClient, id: string, accountId?: string) {
    const row = (
      await client.query<{
        status: string;
        creator_account_id: string | null;
        preview_payload: Record<string, unknown>;
        signed_payload: Record<string, unknown> | null;
        signature: string | null;
        public_jwk: JsonWebKey | null;
        compromised: boolean;
        removed_source: boolean;
        expired: boolean;
      }>(
        "SELECT s.status,k.account_id AS creator_account_id,s.preview_payload,s.signed_payload,s.signature,key.public_jwk,COALESCE(key.compromised,false) AS compromised,EXISTS(SELECT 1 FROM seal_source_removals r WHERE r.product_scope=s.product_scope AND r.record_type=s.record_type AND r.record_id=s.record_id) AS removed_source,s.created_at<=$3 AS expired FROM evidence_seals s LEFT JOIN kingdoms k ON k.id=s.creator_kingdom_id LEFT JOIN seal_signing_keys key ON key.kid=s.kid WHERE s.product_scope=$1 AND s.id=$2",
        [this.scope, id, new Date(this.clock.now().getTime() - 180 * 86400000)],
      )
    ).rows[0];
    if (!row) return { found: false };
    if (row.status === "removed" || row.removed_source || row.expired)
      return { found: true, sealId: id, status: "removed" };
    if (row.compromised) return { found: true, sealId: id, status: "key_compromised" };
    if (row.status === "pending")
      return row.creator_account_id === accountId
        ? {
            found: true,
            sealId: id,
            status: "pending",
            humanDecision: { path: `/pact/?seal=${id}`, required: true, canRemove: true },
          }
        : { found: false };
    const authentic =
      !!row.signed_payload &&
      !!row.signature &&
      !!row.public_jwk &&
      verifyPayload(SEAL_DOMAIN, row.signed_payload, row.signature, row.public_jwk);
    return {
      found: true,
      sealId: id,
      status: "published",
      payload: row.signed_payload,
      signature: row.signature,
      verificationKey: row.public_jwk,
      verification: {
        authentic,
        label: authentic ? "Authentic excerpt" : "Verification failed",
        provesTruth: false,
        provesCompleteAccount: false,
      },
      untrustedContent: true,
      humanDecision: { path: `/pact/?seal=${id}`, required: true, canRemove: row.creator_account_id === accountId },
    };
  }
  /** Module port for moderation/removal: source tombstone blocks pending and existing copies. Not a public command. */
  async hideSource(client: PoolClient, recordType: string, recordId: string) {
    await client.query("INSERT INTO seal_source_removals VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [
      this.scope,
      recordType,
      recordId,
      this.clock.now(),
    ]);
    await client.query(
      "UPDATE evidence_seals SET status='removed' WHERE product_scope=$1 AND record_type=$2 AND record_id=$3",
      [this.scope, recordType, recordId],
    );
  }
  async forgetAccount(client: PoolClient, accountId: string) {
    const ids = (
      await client.query<{ id: string }>("SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2", [
        this.scope,
        accountId,
      ])
    ).rows.map((r) => r.id);
    await client.query(
      "UPDATE evidence_seals SET status='removed',preview_payload='{}',signed_payload=NULL,signature=NULL WHERE product_scope=$1 AND (creator_kingdom_id=ANY($2::uuid[]) OR preview_payload->'participant_kingdom_ids' ?| $2::text[])",
      [this.scope, ids],
    );
  }
  async exportAccount(client: PoolClient, accountId: string) {
    return (
      await client.query(
        "SELECT s.id,s.record_type,s.record_id,s.status,s.created_at,CASE WHEN s.status='published' THEN s.signed_payload ELSE NULL END AS payload,s.signature FROM evidence_seals s JOIN kingdoms k ON k.id=s.creator_kingdom_id WHERE s.product_scope=$1 AND k.account_id=$2",
        [this.scope, accountId],
      )
    ).rows;
  }
  async prune(client: PoolClient, now: Date) {
    const cutoff = new Date(now.getTime() - 180 * 86400000);
    await client.query("DELETE FROM seal_source_removals WHERE product_scope=$1 AND removed_at<=$2", [
      this.scope,
      cutoff,
    ]);
    return (
      (await client.query("DELETE FROM evidence_seals WHERE product_scope=$1 AND created_at<=$2", [this.scope, cutoff]))
        .rowCount ?? 0
    );
  }
}
