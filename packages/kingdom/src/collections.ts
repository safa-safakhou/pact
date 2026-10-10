import { randomUUID } from "node:crypto";
import {
  COLLECTION_CATALOG_VERSION,
  type CollectionAchievementId,
  collectionPieces,
  collectionSets,
} from "@pact/contracts";
import { appendOutbox } from "@pact/db";
import type { PoolClient } from "pg";
import { z } from "zod";
import { recordCollectionIncident } from "./collection-stories.js";

const types = [
  "message.acknowledged.v2",
  "supply.full_both_delivered.v1",
  "raid.resolved.v1",
  "season.participation.awarded.v2",
];
type Event = { id: string; event_id: string; type: string; payload: Record<string, unknown> };
type Contract = {
  id: string;
  offer_id: string;
  offer_version: number;
  kingdom_a: string;
  kingdom_b: string;
  start_game_time_ms: string;
  terms: Record<string, unknown>;
};
const raidEvidenceSchema = z.object({
  gameTimeMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  targetKingdomId: z.uuid(),
  eligibleUnits: z.array(z.object({ id: z.uuid(), ownerId: z.uuid(), side: z.enum(["attacker", "defender"]) })),
  eligibleOrdinaryUnitIds: z.array(z.uuid()),
  trace: z.object({
    winner: z.enum(["attacker", "defender"]),
    casualtyGroups: z.array(z.object({ ownerId: z.uuid(), lostUnitIds: z.array(z.uuid()) })),
  }),
});
/** Trusted, transaction-bound cosmetic projection. No public event injection or model capability. */
export class CollectionService {
  constructor(private readonly scope: string) {}
  /** Cosmetic projection failure must not roll back authoritative world settlement. */
  async processSafely(c: PoolClient, gameTime: number) {
    const previous =
      (await c.query<{ statement_timeout: string }>("SHOW statement_timeout")).rows[0]?.statement_timeout ?? "0";
    await c.query("SAVEPOINT collection_batch");
    try {
      await c.query("SELECT set_config('statement_timeout','2000',true)");
      const count = await this.processPending(c, gameTime);
      await c.query("RELEASE SAVEPOINT collection_batch");
      await c.query("SELECT set_config('statement_timeout',$1,true)", [previous]);
      return { processed: count, failed: false };
    } catch {
      await c.query("ROLLBACK TO SAVEPOINT collection_batch");
      await c.query("RELEASE SAVEPOINT collection_batch");
      return { processed: 0, failed: true };
    }
  }
  async processPending(c: PoolClient, gameTime: number, limit = 500) {
    if (!Number.isSafeInteger(gameTime) || gameTime < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000)
      throw Error("INVALID_COLLECTION_BATCH");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`collections:${this.scope}`]);
    await c.query(
      "INSERT INTO collection_projection_state(product_scope,started_game_time_ms,processed_game_time_ms) VALUES($1,$2,$2) ON CONFLICT DO NOTHING",
      [this.scope, gameTime],
    );
    const events = await c.query<Event>(
      `SELECT e.id::text,e.event_id,e.type,e.payload FROM outbox_events e WHERE e.product_scope=$1 AND e.type=ANY($2::text[]) AND e.created_at>=clock_timestamp()-interval '180 days' AND NOT EXISTS(SELECT 1 FROM collection_processed_events p WHERE p.product_scope=e.product_scope AND p.event_id=e.event_id) ORDER BY e.id LIMIT $3`,
      [this.scope, types, limit],
    );
    for (const e of events.rows) {
      await c.query("SAVEPOINT collection_event");
      try {
        if (e.type === "message.acknowledged.v2") await this.channel(c, e);
        if (e.type === "supply.full_both_delivered.v1") await this.delivery(c, e);
        if (e.type === "raid.resolved.v1") await this.battle(c, e);
        if (e.type === "season.participation.awarded.v2") {
          const proof = await c.query<{ account_id: string }>(
            "SELECT account_id FROM cosmetic_entitlements WHERE product_scope=$1 AND item_id=$2 AND source_achievement_id=$3",
            [
              this.scope,
              `banner.season.${Number(e.payload.seasonNumber)}`,
              `season:${Number(e.payload.seasonNumber)}:participation`,
            ],
          );
          for (const r of proof.rows)
            if (r.account_id === e.payload.accountId)
              await this.award(c, r.account_id, "through_season", e, "season", null, null, gameTime);
        }
        await c.query(
          "INSERT INTO collection_processed_events(product_scope,event_id,event_type,outbox_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [this.scope, e.event_id, e.type, e.id],
        );
        await c.query("RELEASE SAVEPOINT collection_event");
      } catch (error) {
        await c.query("ROLLBACK TO SAVEPOINT collection_event");
        await c.query("RELEASE SAVEPOINT collection_event");
        const code = String((error as { code?: string }).code ?? "");
        if (!/^(22|23)[A-Z0-9]{3}$/.test(code) && code !== "COLLECTION_SOURCE_INVALID") throw error;
        await c.query(
          "INSERT INTO collection_processed_events(product_scope,event_id,event_type,outbox_id,failure_code) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [this.scope, e.event_id, e.type, e.id, code],
        );
      }
    }
    const courts = await c.query<{ id: string; court_id: string; account_id: string; at: string }>(
      `SELECT i.id,i.court_id,k.account_id,(i.start_game_time_ms+21600000)::text AS at FROM collection_court_intervals i JOIN kingdoms k ON k.id=i.kingdom_id AND k.product_scope=i.product_scope WHERE i.product_scope=$1 AND k.status='ranked' AND LEAST(COALESCE(i.end_game_time_ms,$2),$2)-i.start_game_time_ms>=21600000 AND NOT EXISTS(SELECT 1 FROM achievement_awards a WHERE a.product_scope=$1 AND a.account_id=k.account_id AND a.achievement_id='place_at_council') ORDER BY i.start_game_time_ms,i.id LIMIT $3`,
      [this.scope, gameTime, limit],
    );
    for (const r of courts.rows)
      await this.award(
        c,
        r.account_id,
        "place_at_council",
        { event_id: r.id },
        "court",
        r.court_id,
        null,
        Number(r.at),
      );
    await this.trophies(c);
    await c.query(
      "UPDATE collection_projection_state SET last_outbox_id=GREATEST(last_outbox_id,$2),processed_game_time_ms=$3 WHERE product_scope=$1",
      [this.scope, events.rows.at(-1)?.id ?? 0, gameTime],
    );
    return events.rows.length;
  }
  private async channel(c: PoolClient, e: Event) {
    const proof = await c.query<{ a: string; b: string; at: string }>(
      `SELECT sc.kingdom_a AS a,sc.kingdom_b AS b,GREATEST(m.sent_game_time_ms,m.read_game_time_ms)::text AS at FROM direct_messages m JOIN social_contacts sc ON sc.product_scope=m.product_scope AND sc.kingdom_a=LEAST(m.sender_kingdom_id,m.recipient_kingdom_id) AND sc.kingdom_b=GREATEST(m.sender_kingdom_id,m.recipient_kingdom_id) JOIN kingdoms a ON a.id=sc.kingdom_a JOIN kingdoms b ON b.id=sc.kingdom_b WHERE m.product_scope=$1 AND m.id=$2 AND m.read_game_time_ms IS NOT NULL AND a.account_id<>b.account_id AND m.sent_game_time_ms>=sc.accepted_game_time_ms AND EXISTS(SELECT 1 FROM direct_messages r WHERE r.product_scope=m.product_scope AND r.sender_kingdom_id=m.recipient_kingdom_id AND r.recipient_kingdom_id=m.sender_kingdom_id AND r.sent_game_time_ms>=sc.accepted_game_time_ms AND r.read_game_time_ms IS NOT NULL)`,
      [this.scope, e.payload.messageId],
    );
    for (const r of proof.rows)
      for (const [owner, peer] of [
        [r.a, r.b],
        [r.b, r.a],
      ])
        await this.awardKingdom(
          c,
          owner ?? "",
          "opened_channel",
          e,
          "message",
          String(e.payload.messageId),
          peer ?? null,
          Number(r.at),
        );
  }
  private async delivery(c: PoolClient, e: Event) {
    const at = Number(e.payload.gameTimeMs);
    if (!Number.isSafeInteger(at) || at < 0) return;
    const row = (
      await c.query<Contract>(
        `SELECT c.* FROM supply_contracts c JOIN kingdoms a ON a.id=c.kingdom_a JOIN kingdoms b ON b.id=c.kingdom_b WHERE c.product_scope=$1 AND c.id=$2 AND a.account_id<>b.account_id AND (SELECT count(*) FROM supply_installments i WHERE i.product_scope=$1 AND i.contract_id=c.id AND i.game_time_ms=$3 AND i.due_units>0 AND i.delivered_units=i.due_units AND i.overflow_units=0 AND ((i.payer_kingdom_id=c.kingdom_a AND i.recipient_kingdom_id=c.kingdom_b AND i.resource=c.terms->'aToB'->>'resource') OR (i.payer_kingdom_id=c.kingdom_b AND i.recipient_kingdom_id=c.kingdom_a AND i.resource=c.terms->'bToA'->>'resource')))=2`,
        [this.scope, e.payload.contractId, at],
      )
    ).rows[0];
    if (!row) return;
    const changed = (
      await c.query(
        `SELECT 1 FROM supply_offer_versions initial JOIN supply_offer_versions counter ON counter.product_scope=initial.product_scope AND counter.offer_id=initial.offer_id WHERE initial.product_scope=$1 AND initial.offer_id=$2 AND initial.version=1 AND NOT initial.historical_baseline AND counter.version>1 AND counter.version<=$3 AND NOT counter.historical_baseline AND counter.proposed_by IS NOT NULL AND (initial.terms->'aToB' IS DISTINCT FROM counter.terms->'aToB' OR initial.terms->'bToA' IS DISTINCT FROM counter.terms->'bToA' OR initial.terms->'durationHours' IS DISTINCT FROM counter.terms->'durationHours') AND (SELECT count(*) FROM supply_offer_signatures s WHERE s.product_scope=$1 AND s.offer_id=$2 AND s.version=$3 AND s.kingdom_id IN($4,$5))=2`,
        [this.scope, row.offer_id, row.offer_version, row.kingdom_a, row.kingdom_b],
      )
    ).rowCount;
    const resources = (
      await c.query<{ resource: string }>(
        "SELECT DISTINCT resource FROM supply_installments WHERE product_scope=$1 AND contract_id=$2 AND game_time_ms=$3",
        [this.scope, row.id, at],
      )
    ).rows;
    const renewed = (
      await c.query(
        `SELECT 1 FROM supply_contracts previous WHERE previous.product_scope=$1 AND previous.id<>$2 AND LEAST(previous.kingdom_a,previous.kingdom_b)=LEAST($3::uuid,$4::uuid) AND GREATEST(previous.kingdom_a,previous.kingdom_b)=GREATEST($3::uuid,$4::uuid) AND previous.status='expired' AND previous.close_reason='natural_expiry' AND (previous.terms->>'durationHours')::int>=6 AND previous.closed_game_time_ms<=$5 AND NOT EXISTS(SELECT 1 FROM supply_installments i WHERE i.product_scope=$1 AND i.contract_id=previous.id AND i.delivered_units<i.due_units) LIMIT 1`,
        [this.scope, row.id, row.kingdom_a, row.kingdom_b, row.start_game_time_ms],
      )
    ).rowCount;
    for (const [kingdom, peer] of [
      [row.kingdom_a, row.kingdom_b],
      [row.kingdom_b, row.kingdom_a],
    ]) {
      const account = await this.account(c, kingdom ?? "");
      if (!account) continue;
      await c.query(
        "INSERT INTO collection_partner_keys(product_scope,account_id,peer_kingdom_id,first_game_time_ms) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [this.scope, account, peer, at],
      );
      for (const r of resources)
        await c.query(
          "INSERT INTO collection_resource_keys(product_scope,account_id,resource) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [this.scope, account, r.resource],
        );
      if (changed) await this.award(c, account, "terms_changed", e, "supply", row.id, peer ?? null, at);
      if (renewed) await this.award(c, account, "another_agreement", e, "supply", row.id, peer ?? null, at);
      const keys = (
        await c.query<{ partners: number; resources: number }>(
          "SELECT (SELECT count(*)::int FROM collection_partner_keys WHERE product_scope=$1 AND account_id=$2) AS partners,(SELECT count(*)::int FROM collection_resource_keys WHERE product_scope=$1 AND account_id=$2) AS resources",
          [this.scope, account],
        )
      ).rows[0];
      if ((keys?.partners ?? 0) >= 3)
        await this.award(c, account, "three_trading_partners", e, "supply", row.id, peer ?? null, at);
      if (keys?.resources === 3)
        await this.award(c, account, "three_resources_exchanged", e, "supply", row.id, peer ?? null, at);
    }
  }
  private async battle(c: PoolClient, e: Event) {
    const r = (
      await c.query<{
        participant_report: {
          gameTimeMs: number;
          targetKingdomId: string;
          eligibleUnits: { id: string; ownerId: string; side: string }[];
          eligibleOrdinaryUnitIds?: string[];
          trace: { winner: string; casualtyGroups: { ownerId: string; lostUnitIds: string[] }[] };
        };
      }>("SELECT participant_report FROM raids WHERE product_scope=$1 AND id=$2 AND status='resolved'", [
        this.scope,
        e.payload.raidId,
      ])
    ).rows[0]?.participant_report;
    if (!r) return;
    if (!raidEvidenceSchema.safeParse(r).success)
      throw Object.assign(new Error("COLLECTION_SOURCE_INVALID"), { code: "COLLECTION_SOURCE_INVALID" });
    const ordinary = new Set(r.eligibleOrdinaryUnitIds ?? []),
      owners = new Set(r.eligibleUnits.filter((u) => ordinary.has(u.id)).map((u) => u.ownerId));
    for (const owner of new Set([...owners, r.targetKingdomId])) {
      const account = await this.account(c, owner);
      if (!account) continue;
      const own = r.eligibleUnits.filter((u) => u.ownerId === owner && ordinary.has(u.id));
      const losses =
        r.trace.casualtyGroups.find((g) => g.ownerId === owner)?.lostUnitIds.filter((id) => ordinary.has(id)).length ??
        0;
      await recordCollectionIncident(
        c,
        this.scope,
        account,
        e.event_id,
        "battle",
        "battle",
        String(e.payload.raidId),
        r.gameTimeMs,
        {
          classification: "engine_record",
          winner: r.trace.winner,
          ownSide: own[0]?.side ?? "defender",
          ownOrdinaryUnits: own.length,
          ownOrdinaryLosses: losses,
          replacements: "Not automatic or free; inspect ordinary stock and training.",
        },
        owners.has(owner),
      );
    }
    for (const owner of owners)
      await this.awardKingdom(c, owner, "took_the_field", e, "battle", String(e.payload.raidId), null, r.gameTimeMs);
  }
  private async account(c: PoolClient, kingdom: string): Promise<string | null> {
    return (
      (
        await c.query<{ account_id: string }>(
          "SELECT account_id FROM kingdoms WHERE product_scope=$1 AND id=$2 AND status='ranked'",
          [this.scope, kingdom],
        )
      ).rows[0]?.account_id ?? null
    );
  }
  private async awardKingdom(
    c: PoolClient,
    kingdom: string,
    id: CollectionAchievementId,
    e: { event_id: string },
    kind: string,
    source: string | null,
    peer: string | null,
    at: number,
  ) {
    const account = await this.account(c, kingdom);
    if (account) await this.award(c, account, id, e, kind, source, peer, at);
  }
  private async award(
    c: PoolClient,
    account: string,
    id: CollectionAchievementId,
    e: { event_id: string },
    kind: string,
    source: string | null,
    peer: string | null,
    at: number,
  ) {
    const piece = collectionPieces.find((p) => p.id === id);
    if (piece?.earnedGems !== 0) throw Error("NEW_ACHIEVEMENT_NOT_COSMETIC_ONLY");
    const inserted = await c.query(
      "INSERT INTO achievement_awards(product_scope,account_id,achievement_id,source_event_id,awarded_game_time_ms) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING achievement_id",
      [this.scope, account, id, e.event_id, at],
    );
    if (!inserted.rowCount) return;
    if (kind !== "battle")
      await recordCollectionIncident(c, this.scope, account, e.event_id, id, kind, source, at, {
        classification: "engine_record",
        achievementId: id,
        itemId: piece.item,
      });
    await c.query(
      "INSERT INTO cosmetic_entitlements(product_scope,account_id,item_id,source_achievement_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [this.scope, account, piece.item, id],
    );
    await c.query(
      "INSERT INTO collection_award_sources(product_scope,account_id,achievement_id,source_kind,source_id,peer_kingdom_id,game_time_ms) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [this.scope, account, id, kind, source, peer, at],
    );
    await appendOutbox(c, {
      productScope: this.scope,
      eventId: randomUUID(),
      type: "collection.awarded.v2",
      payload: {
        accountId: account,
        achievementId: id,
        itemId: piece.item,
        catalogVersion: COLLECTION_CATALOG_VERSION,
        gameTimeMs: at,
      },
    });
  }
  private async trophies(c: PoolClient) {
    for (const set of collectionSets)
      await c.query(
        `INSERT INTO cosmetic_entitlements(product_scope,account_id,item_id,source_achievement_id) SELECT $1,a.account_id,$2,$3 FROM achievement_awards a WHERE a.product_scope=$1 AND a.achievement_id=ANY($4::text[]) GROUP BY a.account_id HAVING count(*)=4 ON CONFLICT DO NOTHING`,
        [
          this.scope,
          set.trophy,
          `collection:${set.id}`,
          collectionPieces.filter((p) => p.set === set.id).map((p) => p.id),
        ],
      );
  }
  async read(c: PoolClient, accountId: string) {
    const owned = (
      await c.query<{ achievement_id: string; awarded_game_time_ms: string }>(
        "SELECT achievement_id,awarded_game_time_ms::text FROM achievement_awards WHERE product_scope=$1 AND account_id=$2 ORDER BY achievement_id",
        [this.scope, accountId],
      )
    ).rows;
    const source = (
      await c.query(
        "SELECT achievement_id,source_kind,source_id,peer_kingdom_id,game_time_ms FROM collection_award_sources WHERE product_scope=$1 AND account_id=$2",
        [this.scope, accountId],
      )
    ).rows;
    const keys = (
      await c.query(
        "SELECT (SELECT count(*)::int FROM collection_partner_keys WHERE product_scope=$1 AND account_id=$2) AS partners,ARRAY(SELECT resource FROM collection_resource_keys WHERE product_scope=$1 AND account_id=$2 ORDER BY resource) AS resources",
        [this.scope, accountId],
      )
    ).rows[0];
    const watermark =
      (
        await c.query(
          "SELECT *,EXISTS(SELECT 1 FROM outbox_events e WHERE e.product_scope=$1 AND e.type=ANY($2::text[]) AND e.created_at>=clock_timestamp()-interval '180 days' AND NOT EXISTS(SELECT 1 FROM collection_processed_events p WHERE p.product_scope=$1 AND p.event_id=e.event_id)) AS pending FROM collection_projection_state WHERE product_scope=$1",
          [this.scope, types],
        )
      ).rows[0] ?? null;
    const failedEvents =
      (
        await c.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM collection_processed_events WHERE product_scope=$1 AND failure_code IS NOT NULL",
          [this.scope],
        )
      ).rows[0]?.count ?? 0;
    const trophies = (
      await c.query<{ item_id: string }>(
        "SELECT item_id FROM cosmetic_entitlements WHERE product_scope=$1 AND account_id=$2 AND source_achievement_id LIKE 'collection:%' ORDER BY item_id",
        [this.scope, accountId],
      )
    ).rows.map((r) => r.item_id);
    return {
      catalogVersion: COLLECTION_CATALOG_VERSION,
      pieces: collectionPieces.map((p) => ({
        ...p,
        owned: owned.some((a) => a.achievement_id === p.id),
        earnedGameTimeMs: owned.find((a) => a.achievement_id === p.id)?.awarded_game_time_ms ?? null,
        source: source.find((a) => a.achievement_id === p.id) ?? null,
      })),
      sets: collectionSets.map((s) => ({
        ...s,
        ownedPieces: collectionPieces.filter((p) => p.set === s.id && owned.some((a) => a.achievement_id === p.id))
          .length,
        trophyOwned: trophies.includes(s.trophy),
      })),
      progress: keys,
      watermark,
      failedEvents,
      sourcePolicy:
        "Only retained authorized source facts; missing history is unavailable. No raw messages are copied.",
    };
  }
  readonly retention = {
    name: "collections",
    exportAccount: async (c: PoolClient, id: string) => ({ collection: await this.read(c, id) }),
    forgetAccount: async (c: PoolClient, id: string) => {
      await c.query(
        "DELETE FROM collection_partner_keys WHERE product_scope=$1 AND peer_kingdom_id IN(SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2)",
        [this.scope, id],
      );
      for (const table of [
        "collection_award_sources",
        "collection_partner_keys",
        "collection_resource_keys",
        "achievement_awards",
        "cosmetic_entitlements",
        "cosmetic_wallet_entries",
      ])
        await c.query(`DELETE FROM ${table} WHERE product_scope=$1 AND account_id=$2`, [this.scope, id]);
      await c.query(
        "UPDATE collection_award_sources SET peer_kingdom_id=NULL WHERE product_scope=$1 AND peer_kingdom_id IN(SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2)",
        [this.scope, id],
      );
    },
    prune: async (c: PoolClient, now: Date) => {
      const before = new Date(now.getTime() - 180 * 86400000);
      let deleted = 0;
      for (const table of ["collection_processed_events", "collection_award_sources", "collection_partner_keys"])
        deleted +=
          (
            await c.query(
              `DELETE FROM ${table} WHERE product_scope=$1 AND ${table === "collection_processed_events" ? "processed_at" : "created_at"}<$2`,
              [this.scope, before],
            )
          ).rowCount ?? 0;
      deleted +=
        (
          await c.query("DELETE FROM collection_court_intervals WHERE product_scope=$1 AND closed_at<$2", [
            this.scope,
            before,
          ])
        ).rowCount ?? 0;
      return deleted;
    },
  };
}
