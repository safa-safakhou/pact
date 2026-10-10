import { createHash } from "node:crypto";
import {
  CollectionCommandSchema,
  type CollectionDisplay,
  CollectionQuerySchema,
  collectionPieces,
  collectionSets,
} from "@pact/contracts";
import { withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
import { CollectionService } from "./collections.js";
import { MemorySourceReader } from "./memory-sources.js";

export class CollectionError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "STALE_VERSION"
      | "OPERATION_CONFLICT"
      | "NOT_OWNED"
      | "INCOMPATIBLE_SLOT"
      | "STORY_LIMIT",
  ) {
    super(code);
  }
}
export function collectionIncidentId(account: string, event: string, kind: string) {
  const hex = createHash("sha256").update(`pact.collection.incident.v1:${account}:${event}:${kind}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export async function recordCollectionIncident(
  c: PoolClient,
  scope: string,
  account: string,
  event: string,
  kind: string,
  sourceKind: string,
  sourceId: string | null,
  at: number,
  facts: Record<string, unknown>,
  campaign = false,
) {
  const id = collectionIncidentId(account, event, kind);
  await c.query(
    "INSERT INTO collection_incidents(product_scope,account_id,id,kind,source_kind,source_id,game_time_ms,facts) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT DO NOTHING",
    [scope, account, id, kind, sourceKind, sourceId, at, JSON.stringify(facts)],
  );
  if (campaign) {
    const pattern = ["lines", "chevrons", "circles", "stars"][parseInt(id.slice(0, 2), 16) % 4];
    await c.query(
      "INSERT INTO collection_campaign_instances(product_scope,account_id,id,pattern,incident_id) VALUES($1,$2,$3,$4,$3) ON CONFLICT DO NOTHING",
      [scope, account, id, pattern],
    );
  }
}
const empty: CollectionDisplay = {
  slots: { hall: null, banner: null, frame: null, stamp: null },
  goals: [],
  publicCard: { enabled: false, title: "", slots: [] },
};
export class CollectionStoriesService {
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
  ) {}
  async read(account: string, raw: unknown = {}) {
    const query = CollectionQuerySchema.parse(raw);
    return withTransaction(
      this.pool,
      async (c) => {
        const collection = await new CollectionService(this.scope).read(c, account);
        const incidentRows = (
          await c.query(
            'SELECT id,kind,game_time_ms::text AS "gameTimeMs",facts,source_kind,source_id FROM collection_incidents WHERE product_scope=$1 AND account_id=$2 AND ($3::uuid IS NULL OR (game_time_ms,id)<(SELECT game_time_ms,id FROM collection_incidents WHERE product_scope=$1 AND account_id=$2 AND id=$3)) ORDER BY game_time_ms DESC,id DESC LIMIT 51',
            [this.scope, account, query.beforeIncidentId ?? null],
          )
        ).rows;
        const instanceRows = (
          await c.query(
            'SELECT id,item_id AS "itemId",pattern,incident_id AS "incidentId" FROM collection_campaign_instances WHERE product_scope=$1 AND account_id=$2 AND ($3::uuid IS NULL OR id<$3) ORDER BY id DESC LIMIT 51',
            [this.scope, account, query.beforeInstanceId ?? null],
          )
        ).rows;
        const display = (
          await c.query("SELECT version,display FROM collection_display WHERE product_scope=$1 AND account_id=$2", [
            this.scope,
            account,
          ])
        ).rows[0] ?? { version: 0, display: empty };
        const stories = (
          await c.query(
            'SELECT id,version,title,annotation,incident_ids AS "incidentIds" FROM collection_stories WHERE product_scope=$1 AND account_id=$2 AND NOT deleted ORDER BY id',
            [this.scope, account],
          )
        ).rows;
        const entitlements = (
          await c.query<{ item_id: string }>(
            "SELECT item_id FROM cosmetic_entitlements WHERE product_scope=$1 AND account_id=$2 ORDER BY item_id",
            [this.scope, account],
          )
        ).rows.map((r) => r.item_id);
        const incidents = [];
        for (const row of incidentRows.slice(0, 50))
          incidents.push({ ...row, source: await this.source(c, account, row.source_kind, row.source_id) });
        return {
          ...collection,
          incidents,
          instances: instanceRows.slice(0, 50),
          nextIncidentId: incidentRows.length > 50 ? incidentRows[49].id : null,
          nextInstanceId: instanceRows.length > 50 ? instanceRows[49].id : null,
          stories,
          display: display.display,
          displayVersion: display.version,
          entitlements,
          randomFinishesEnabled: false,
        };
      },
      { isolation: "REPEATABLE READ" },
    );
  }
  private async source(c: PoolClient, account: string, kind: string, id: string | null) {
    if (!id) return null;
    if (kind === "battle" || kind === "message" || kind === "supply")
      return new MemorySourceReader(this.scope).read(c, account, {
        kind: kind === "battle" ? "raid" : kind === "supply" ? "supply-contract" : "message",
        id,
      });
    if (kind === "court") {
      const row = (
        await c.query(
          "SELECT c.handle FROM courts c JOIN court_memberships m ON m.court_id=c.id JOIN kingdoms k ON k.id=m.kingdom_id WHERE c.product_scope=$1 AND c.id=$3 AND k.account_id=$2 AND k.product_scope=$1",
          [this.scope, account, id],
        )
      ).rows[0];
      return row ? { kind: "court", id, handle: row.handle } : null;
    }
    return null;
  }
  async command(account: string, raw: unknown) {
    const command = CollectionCommandSchema.parse(raw),
      hash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
    return withTransaction(this.pool, async (c) => {
      const owner = (
        await c.query("SELECT status FROM accounts WHERE product_scope=$1 AND id=$2 FOR UPDATE", [this.scope, account])
      ).rows[0];
      if (owner?.status !== "active") throw new CollectionError("FORBIDDEN");
      const prior = (
        await c.query(
          "SELECT request_hash,receipt FROM collection_command_receipts WHERE product_scope=$1 AND account_id=$2 AND command_id=$3",
          [this.scope, account, command.commandId],
        )
      ).rows[0];
      if (prior) {
        if (prior.request_hash !== hash) throw new CollectionError("OPERATION_CONFLICT");
        return { ...prior.receipt, code: "ALREADY_COMMITTED" };
      }
      let version: number;
      if (command.kind === "display") {
        const head = (
          await c.query("SELECT version FROM collection_display WHERE product_scope=$1 AND account_id=$2", [
            this.scope,
            account,
          ])
        ).rows[0];
        if ((head?.version ?? 0) !== command.expectedVersion) throw new CollectionError("STALE_VERSION");
        for (const [slot, item] of Object.entries(command.display.slots))
          if (item) await this.assertEquipment(c, account, slot, item);
        version = command.expectedVersion + 1;
        await c.query(
          "INSERT INTO collection_display(product_scope,account_id,version,display) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(product_scope,account_id) DO UPDATE SET version=EXCLUDED.version,display=EXCLUDED.display",
          [this.scope, account, version, JSON.stringify(command.display)],
        );
      } else {
        const head = (
          await c.query("SELECT version FROM collection_stories WHERE product_scope=$1 AND account_id=$2 AND id=$3", [
            this.scope,
            account,
            command.storyId,
          ])
        ).rows[0];
        if ((head?.version ?? 0) !== command.expectedVersion) throw new CollectionError("STALE_VERSION");
        if (
          !head &&
          (
            await c.query(
              "SELECT count(*)::int AS n FROM collection_stories WHERE product_scope=$1 AND account_id=$2",
              [this.scope, account],
            )
          ).rows[0].n >= 50
        )
          throw new CollectionError("STORY_LIMIT");
        const ids = command.deleted ? [] : command.incidentIds;
        if (
          ids.length !==
          (
            await c.query(
              "SELECT id FROM collection_incidents WHERE product_scope=$1 AND account_id=$2 AND id=ANY($3::uuid[])",
              [this.scope, account, ids],
            )
          ).rowCount
        )
          throw new CollectionError("NOT_OWNED");
        version = command.expectedVersion + 1;
        await c.query(
          "INSERT INTO collection_stories(product_scope,account_id,id,version,title,annotation,incident_ids,deleted) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(product_scope,account_id,id) DO UPDATE SET version=EXCLUDED.version,title=EXCLUDED.title,annotation=EXCLUDED.annotation,incident_ids=EXCLUDED.incident_ids,deleted=EXCLUDED.deleted",
          [
            this.scope,
            account,
            command.storyId,
            version,
            command.deleted ? "" : command.title,
            command.deleted ? "" : command.annotation,
            ids,
            command.deleted,
          ],
        );
      }
      const receipt = {
        schemaVersion: "pact.collection-receipt.v2",
        commandId: command.commandId,
        kind: command.kind,
        version,
        code: "COMMITTED",
      };
      await c.query(
        "INSERT INTO collection_command_receipts(product_scope,account_id,command_id,request_hash,receipt) VALUES($1,$2,$3,$4,$5::jsonb)",
        [this.scope, account, command.commandId, hash, JSON.stringify(receipt)],
      );
      return receipt;
    });
  }
  private async assertEquipment(c: PoolClient, account: string, slot: string, item: string) {
    if (slot === "hall" && item.startsWith("campaign:")) {
      const id = item.slice(9);
      if (
        !/^[a-f0-9-]{36}$/.test(id) ||
        !(
          await c.query(
            "SELECT 1 FROM collection_campaign_instances WHERE product_scope=$1 AND account_id=$2 AND id=$3",
            [this.scope, account, id],
          )
        ).rowCount
      )
        throw new CollectionError("NOT_OWNED");
      return;
    }
    if (
      !(
        await c.query("SELECT 1 FROM cosmetic_entitlements WHERE product_scope=$1 AND account_id=$2 AND item_id=$3", [
          this.scope,
          account,
          item,
        ])
      ).rowCount
    )
      throw new CollectionError("NOT_OWNED");
    const compatible =
      slot === "hall"
        ? collectionPieces.some((p) => p.item === item) || collectionSets.some((s) => s.trophy === item)
        : slot === "banner"
          ? item.startsWith("banner.")
          : slot === "frame"
            ? item.startsWith("frame.")
            : item.startsWith("stamp.");
    if (!compatible) throw new CollectionError("INCOMPATIBLE_SLOT");
  }
  async publicCard(handle: string) {
    return withTransaction(
      this.pool,
      async (c) => {
        const row = (
          await c.query(
            "SELECT d.account_id,d.display FROM collection_display d JOIN kingdoms k ON k.account_id=d.account_id AND k.product_scope=d.product_scope WHERE d.product_scope=$1 AND k.handle=$2 AND k.status='ranked' AND d.display->'publicCard'->>'enabled'='true'",
            [this.scope, handle],
          )
        ).rows[0];
        if (!row) return null;
        const display = row.display as CollectionDisplay,
          items = [];
        for (const slot of display.publicCard.slots) {
          const item = display.slots[slot];
          if (!item) continue;
          try {
            await this.assertEquipment(c, row.account_id, slot, item);
            if (item.startsWith("campaign:")) {
              const pattern = (
                await c.query(
                  "SELECT pattern FROM collection_campaign_instances WHERE product_scope=$1 AND account_id=$2 AND id=$3",
                  [this.scope, row.account_id, item.slice(9)],
                )
              ).rows[0]?.pattern;
              items.push({ slot, itemId: "campaign.medallion", appearance: pattern });
            } else items.push({ slot, itemId: item });
          } catch {}
        }
        return {
          title: display.publicCard.title,
          items,
          meaning: "Appearance only; no strength, wealth, honesty or strategic success implied.",
        };
      },
      { isolation: "REPEATABLE READ" },
    );
  }
  readonly retention = {
    name: "collectionStories",
    exportAccount: async (c: PoolClient, id: string) => {
      const result: Record<string, unknown> = {};
      for (const table of [
        "collection_incidents",
        "collection_campaign_instances",
        "collection_display",
        "collection_stories",
        "collection_command_receipts",
      ])
        result[table] = (
          await c.query(`SELECT * FROM ${table} WHERE product_scope=$1 AND account_id=$2`, [this.scope, id])
        ).rows;
      return result;
    },
    forgetAccount: async (c: PoolClient, id: string) => {
      for (const table of [
        "collection_campaign_instances",
        "collection_incidents",
        "collection_display",
        "collection_stories",
        "collection_command_receipts",
      ])
        await c.query(`DELETE FROM ${table} WHERE product_scope=$1 AND account_id=$2`, [this.scope, id]);
    },
    prune: async (c: PoolClient, now: Date) => {
      const before = new Date(now.getTime() - 180 * 86400000);
      await c.query(
        "UPDATE collection_stories s SET incident_ids=ARRAY(SELECT id FROM unnest(s.incident_ids) id WHERE EXISTS(SELECT 1 FROM collection_incidents i WHERE i.product_scope=s.product_scope AND i.account_id=s.account_id AND i.id=id AND i.created_at>=$2)) WHERE s.product_scope=$1",
        [this.scope, before],
      );
      let count = 0;
      for (const table of ["collection_incidents", "collection_command_receipts"])
        count +=
          (await c.query(`DELETE FROM ${table} WHERE product_scope=$1 AND created_at<$2`, [this.scope, before]))
            .rowCount ?? 0;
      return count;
    },
  };
}
