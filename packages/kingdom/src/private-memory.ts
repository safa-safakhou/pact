import { createHash } from "node:crypto";
import { MemoryReadSchema, MemorySourceSchema, MemoryWriteSchema } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import { RULES_ID } from "@pact/domain";
import type { Pool, PoolClient } from "pg";
import { MemorySourceReader } from "./memory-sources.js";

export class PrivateMemoryError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "SOURCE_UNAVAILABLE"
      | "STALE_VERSION"
      | "OPERATION_CONFLICT"
      | "PRIVATE_MEMORY_FULL"
      | "NOTE_TOO_LARGE",
  ) {
    super(code);
  }
}
export class PrivateMemoryService {
  readonly sources: MemorySourceReader;
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly clock: { read(client: PoolClient): Promise<{ gameTimeMs: number }>; now(): Date },
  ) {
    this.sources = new MemorySourceReader(scope);
  }
  readonly retention = {
    name: "privateMemory",
    forgetAccount: async (client: PoolClient, accountId: string) => {
      await client.query("DELETE FROM private_memory_entries WHERE product_scope=$1 AND account_id=$2", [
        this.scope,
        accountId,
      ]);
      await client.query(
        "UPDATE private_memory_entries SET peer_kingdom_id=NULL WHERE product_scope=$1 AND peer_kingdom_id IN(SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2)",
        [this.scope, accountId],
      );
    },
    exportAccount: async (client: PoolClient, accountId: string) => ({
      entries: (
        await client.query(
          "SELECT * FROM private_memory_entries WHERE product_scope=$1 AND account_id=$2 ORDER BY id",
          [this.scope, accountId],
        )
      ).rows,
      revisions: (
        await client.query(
          "SELECT * FROM private_memory_revisions WHERE product_scope=$1 AND account_id=$2 ORDER BY entry_id,version",
          [this.scope, accountId],
        )
      ).rows,
    }),
    prune: async (client: PoolClient, now: Date) => {
      const result = await client.query(
        `UPDATE private_memory_revisions r SET text='',source_refs='[]',content_pruned=true WHERE r.product_scope=$1 AND NOT r.content_pruned AND r.recorded_at<$2 AND EXISTS(SELECT 1 FROM private_memory_entries e WHERE e.product_scope=r.product_scope AND e.account_id=r.account_id AND e.id=r.entry_id AND (e.deleted OR r.version<e.current_version))`,
        [this.scope, new Date(now.getTime() - 30 * 86400000)],
      );
      return result.rowCount ?? 0;
    },
  };
  async write(
    accountId: string,
    authorKind: "human" | "agent",
    raw: unknown,
    guard?: (client: PoolClient) => Promise<void>,
  ) {
    const command = MemoryWriteSchema.parse(raw),
      hash = createHash("sha256").update(JSON.stringify({ authorKind, command })).digest("hex");
    if (!command.deleted && Buffer.byteLength(JSON.stringify({ text: command.text, sources: command.sources })) > 28000)
      throw new PrivateMemoryError("NOTE_TOO_LARGE");
    return withTransaction(this.pool, async (client) => {
      const owner = await client.query("SELECT id,status FROM accounts WHERE product_scope=$1 AND id=$2 FOR UPDATE", [
        this.scope,
        accountId,
      ]);
      if (owner.rows[0]?.status !== "active") throw new PrivateMemoryError("FORBIDDEN");
      await guard?.(client);
      const prior = (
        await client.query(
          "SELECT entry_id,version,request_hash FROM private_memory_revisions WHERE product_scope=$1 AND account_id=$2 AND command_id=$3",
          [this.scope, accountId, command.commandId],
        )
      ).rows[0];
      if (prior) {
        if (prior.request_hash !== hash) throw new PrivateMemoryError("OPERATION_CONFLICT");
        return {
          code: "ALREADY_COMMITTED",
          commandId: command.commandId,
          entryId: prior.entry_id,
          version: prior.version,
        };
      }
      const head = (
        await client.query(
          "SELECT current_version FROM private_memory_entries WHERE product_scope=$1 AND account_id=$2 AND id=$3",
          [this.scope, accountId, command.entryId],
        )
      ).rows[0];
      if ((head?.current_version ?? 0) !== command.expectedVersion) throw new PrivateMemoryError("STALE_VERSION");
      if (
        !command.deleted &&
        command.peerKingdomId &&
        !(
          await client.query("SELECT 1 FROM kingdoms WHERE product_scope=$1 AND id=$2 AND status='ranked'", [
            this.scope,
            command.peerKingdomId,
          ])
        ).rowCount
      )
        throw new PrivateMemoryError("SOURCE_UNAVAILABLE");
      for (const source of command.deleted ? [] : command.sources)
        if (!(await this.sources.read(client, accountId, source))) throw new PrivateMemoryError("SOURCE_UNAVAILABLE");
      const usage = (
        await client.query(
          "SELECT COALESCE(sum(octet_length(text)+octet_length(source_refs::text)),0)::text AS bytes,octet_length($3::text)+octet_length($4::jsonb::text) AS added FROM private_memory_revisions WHERE product_scope=$1 AND account_id=$2",
          [this.scope, accountId, command.text, JSON.stringify(command.sources)],
        )
      ).rows[0];
      if (!command.deleted && Number(usage.bytes) + usage.added > 1048576)
        throw new PrivateMemoryError("PRIVATE_MEMORY_FULL");
      const version = command.expectedVersion + 1,
        time = (await this.clock.read(client)).gameTimeMs;
      await client.query(
        `INSERT INTO private_memory_entries(product_scope,account_id,id,current_version,kind,topic,peer_kingdom_id,updated_game_time_ms,deleted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(product_scope,account_id,id) DO UPDATE SET current_version=EXCLUDED.current_version,kind=EXCLUDED.kind,topic=EXCLUDED.topic,peer_kingdom_id=EXCLUDED.peer_kingdom_id,updated_game_time_ms=EXCLUDED.updated_game_time_ms,deleted=EXCLUDED.deleted`,
        [
          this.scope,
          accountId,
          command.entryId,
          version,
          command.kind,
          command.topic,
          command.deleted ? null : (command.peerKingdomId ?? null),
          time,
          command.deleted,
        ],
      );
      await client.query(
        `INSERT INTO private_memory_revisions(product_scope,account_id,entry_id,version,command_id,request_hash,author_kind,kind,topic,text,source_refs,observed_game_time_ms,rules_id,deleted,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          this.scope,
          accountId,
          command.entryId,
          version,
          command.commandId,
          hash,
          authorKind,
          command.kind,
          command.topic,
          command.deleted ? "" : command.text,
          JSON.stringify(command.deleted ? [] : command.sources),
          time,
          RULES_ID,
          command.deleted,
          this.clock.now(),
        ],
      );
      return { code: "COMMITTED", commandId: command.commandId, entryId: command.entryId, version };
    });
  }
  async read(accountId: string, raw: unknown = {}) {
    const query = MemoryReadSchema.parse(raw);
    return withTransaction(
      this.pool,
      async (client) => {
        const args: unknown[] = [
          this.scope,
          accountId,
          query.peerKingdomId ?? null,
          query.topic ?? null,
          query.kind ?? null,
          query.beforeGameTimeMs ?? null,
          query.beforeEntryId ?? null,
        ];
        if (query.entryId) {
          const rows = (
            await client.query(
              `SELECT entry_id AS "entryId",version,author_kind AS "authorKind",kind,topic,text,source_refs AS sources,observed_game_time_ms::text AS "observedGameTimeMs",rules_id AS "rulesId",deleted,content_pruned AS "contentPruned" FROM private_memory_revisions WHERE product_scope=$1 AND account_id=$2 AND entry_id=$3 AND ($4::int IS NULL OR version<$4) ORDER BY version DESC LIMIT 21`,
              [this.scope, accountId, query.entryId, query.beforeVersion ?? null],
            )
          ).rows;
          const page = this.bytePage(rows, 20);
          return {
            entries: page,
            nextBeforeVersion: rows.length > page.length ? (page.at(-1)?.version ?? null) : null,
            classification: "private_note",
            meaning:
              "Revisions are interpretations/strategy, never factual receipts or permission changes. Pruned content is unavailable.",
          };
        }
        const rows = (
          await client.query(
            `SELECT e.id AS "entryId",r.version,r.author_kind AS "authorKind",r.kind,r.topic,r.text,r.source_refs AS sources,r.observed_game_time_ms::text AS "observedGameTimeMs",r.rules_id AS "rulesId",e.peer_kingdom_id AS "peerKingdomId" FROM private_memory_entries e JOIN private_memory_revisions r ON r.product_scope=e.product_scope AND r.account_id=e.account_id AND r.entry_id=e.id AND r.version=e.current_version WHERE e.product_scope=$1 AND e.account_id=$2 AND NOT e.deleted AND ($3::uuid IS NULL OR e.peer_kingdom_id=$3) AND ($4::text IS NULL OR e.topic=$4) AND ($5::text IS NULL OR e.kind=$5) AND ($6::bigint IS NULL OR (e.updated_game_time_ms,e.id)<($6::bigint,$7::uuid)) ORDER BY e.updated_game_time_ms DESC,e.id DESC LIMIT 21`,
            args,
          )
        ).rows;
        const page = this.bytePage(rows, 20),
          last = page.at(-1);
        return {
          entries: page,
          next:
            rows.length > page.length && last
              ? { beforeGameTimeMs: last.observedGameTimeMs, beforeEntryId: last.entryId }
              : null,
          classification: "private_note",
          meaning:
            "Owner/agent-authored goals, questions and assessments. Not engine facts, chain-of-thought or authority. Sources reauthorize when read.",
        };
      },
      { isolation: "REPEATABLE READ" },
    );
  }
  private bytePage(rows: Record<string, unknown>[], limit: number) {
    let bytes = 1024;
    const page: Record<string, unknown>[] = [];
    for (const row of rows.slice(0, limit)) {
      const size = Buffer.byteLength(JSON.stringify(row)) + 128;
      if (bytes + size > 36000) break;
      page.push(row);
      bytes += size;
    }
    return page;
  }
  async source(accountId: string, raw: unknown) {
    const source = MemorySourceSchema.parse(raw);
    return withTransaction(this.pool, (client) => this.sources.read(client, accountId, source), {
      isolation: "REPEATABLE READ",
    });
  }
}
