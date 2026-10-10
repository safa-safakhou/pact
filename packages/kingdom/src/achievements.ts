import { randomUUID } from "node:crypto";
import type { CollectionAchievementId } from "@pact/contracts";
import { appendOutbox } from "@pact/db";
import { verifyPayload } from "@pact/evidence";
import type { PoolClient } from "pg";
import { SEAL_DOMAIN } from "./seals.js";

type LegacyAchievementId =
  | "first_stone"
  | "first_pact"
  | "kept_the_table"
  | "answered_the_call"
  | "breach"
  | "came_back"
  | "own_your_words"
  | "winter_stores";

export type AchievementId = CollectionAchievementId;
const ornament: Record<LegacyAchievementId, string> = {
  first_stone: "ornament.stone_marker",
  first_pact: "ornament.crossed_ribbon",
  kept_the_table: "ornament.table",
  answered_the_call: "ornament.barracks_shield",
  breach: "ornament.dented_gate",
  came_back: "ornament.repaired_banner",
  own_your_words: "ornament.wax_stamp",
  winter_stores: "ornament.winter_lantern",
};

interface EventRow {
  event_id: string;
  type: string;
  payload: Record<string, unknown>;
}
interface RaidReport {
  gameTimeMs: number;
  targetKingdomId: string;
  leaderKingdomId: string;
  eligibleUnits: { id: string; ownerId: string; side: string }[];
  eligibleOrdinaryUnitIds: string[];
  trace: { winner: string; casualtyGroups: { ownerId: string; lostUnitIds: string[] }[] };
}

const consumedTypes = [
  "building.completed.v1",
  "supply.full_both_delivered.v1",
  "supply.contract.closed.v1",
  "raid.resolved.v1",
  "training.unit.completed.v1",
  "seal.published.v1",
  "season.low_harvest_week.completed.v1",
];

function stringField(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== "string" || value.length === 0) throw new Error("INVALID_ACHIEVEMENT_EVENT");
  return value;
}
function timeField(payload: Record<string, unknown>, field: string): number {
  const value = Number(payload[field]);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("INVALID_ACHIEVEMENT_EVENT");
  return value;
}

/** Private, transaction-bound projection of trusted committed rule events. No public event-injection route. */
export class AchievementService {
  constructor(private readonly productScope: string) {}

  async processPending(client: PoolClient, limit = 500): Promise<number> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error("INVALID_ACHIEVEMENT_BATCH");
    const result = await client.query<EventRow>(
      `SELECT e.event_id, e.type, e.payload FROM outbox_events e
       WHERE e.product_scope = $1 AND e.type = ANY($2::text[])
         AND NOT EXISTS (SELECT 1 FROM achievement_processed_events p
           WHERE p.product_scope = e.product_scope AND p.event_id = e.event_id)
       ORDER BY e.id LIMIT $3`,
      [this.productScope, consumedTypes, limit],
    );
    for (const event of result.rows) {
      await this.handle(client, event);
      await client.query(
        "INSERT INTO achievement_processed_events(product_scope, event_id, event_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [this.productScope, event.event_id, event.type],
      );
    }
    return result.rows.length;
  }

  async read(
    client: PoolClient,
    accountId: string,
  ): Promise<{ earnedGems: number; achievements: AchievementId[]; ornaments: string[] }> {
    const awards = await client.query<{ achievement_id: AchievementId }>(
      "SELECT achievement_id FROM achievement_awards WHERE product_scope = $1 AND account_id = $2 ORDER BY achievement_id",
      [this.productScope, accountId],
    );
    const items = await client.query<{ item_id: string }>(
      "SELECT item_id FROM cosmetic_entitlements WHERE product_scope = $1 AND account_id = $2 ORDER BY item_id",
      [this.productScope, accountId],
    );
    const gems = await client.query<{ amount: string }>(
      "SELECT COALESCE(sum(earned_gems_delta),0)::text AS amount FROM cosmetic_wallet_entries WHERE product_scope = $1 AND account_id = $2",
      [this.productScope, accountId],
    );
    return {
      earnedGems: Number(gems.rows[0]?.amount ?? "0"),
      achievements: awards.rows.map((row) => row.achievement_id),
      ornaments: items.rows.map((row) => row.item_id),
    };
  }

  private async handle(client: PoolClient, event: EventRow): Promise<void> {
    const data = event.payload;
    switch (event.type) {
      case "building.completed.v1": {
        const instructionId = stringField(data, "instructionId");
        const row = (
          await client.query<{ account_id: string; settled_game_time_ms: string }>(
            "SELECT account_id, settled_game_time_ms FROM building_instructions WHERE product_scope = $1 AND id = $2 AND state = 'completed'",
            [this.productScope, instructionId],
          )
        ).rows[0];
        if (row)
          await this.award(client, row.account_id, "first_stone", event.event_id, Number(row.settled_game_time_ms));
        break;
      }
      case "supply.full_both_delivered.v1": {
        const contractId = stringField(data, "contractId");
        const at = timeField(data, "gameTimeMs");
        const proof = await client.query<{ kingdom_a: string; kingdom_b: string }>(
          `SELECT c.kingdom_a, c.kingdom_b FROM supply_contracts c WHERE c.product_scope = $1 AND c.id = $2
           AND (SELECT count(*) FROM supply_installments i WHERE i.product_scope = $1 AND i.contract_id = c.id
             AND i.game_time_ms = $3 AND i.due_units > 0 AND i.delivered_units = i.due_units) = 2`,
          [this.productScope, contractId, at],
        );
        const row = proof.rows[0];
        if (row)
          for (const id of [row.kingdom_a, row.kingdom_b])
            await this.awardKingdom(client, id, "first_pact", event.event_id, at);
        break;
      }
      case "supply.contract.closed.v1": {
        const row = (
          await client.query<{
            kingdom_a: string;
            kingdom_b: string;
            closed_game_time_ms: string;
            terms: { durationHours?: number };
          }>(
            `SELECT kingdom_a, kingdom_b, closed_game_time_ms, terms FROM supply_contracts
           WHERE product_scope = $1 AND id = $2 AND status = 'expired' AND close_reason = 'natural_expiry'`,
            [this.productScope, stringField(data, "contractId")],
          )
        ).rows[0];
        if (row && (row.terms.durationHours ?? 0) >= 6)
          for (const id of [row.kingdom_a, row.kingdom_b])
            await this.awardKingdom(client, id, "kept_the_table", event.event_id, Number(row.closed_game_time_ms));
        break;
      }
      case "raid.resolved.v1":
        await this.raid(client, event);
        break;
      case "training.unit.completed.v1": {
        const row = (
          await client.query<{ account_id: string; kingdom_id: string }>(
            `SELECT account_id, kingdom_id FROM training_batches WHERE product_scope = $1 AND id = $2`,
            [this.productScope, stringField(data, "batchId")],
          )
        ).rows[0];
        const at = timeField(data, "gameTimeMs");
        if (
          row &&
          (
            await client.query(
              `SELECT 1 FROM achievement_battle_losses WHERE product_scope = $1 AND account_id = $2
           AND loss_game_time_ms < $3 LIMIT 1`,
              [this.productScope, row.account_id, at],
            )
          ).rowCount
        )
          await this.award(client, row.account_id, "came_back", event.event_id, at);
        break;
      }
      case "seal.published.v1": {
        // Match the actual signing-worker event; a claimed `valid` flag is not publication evidence.
        if (typeof data.sealId !== "string") break;
        const seal = (
          await client.query<{
            creator_kingdom_id: string;
            signed_payload: Record<string, unknown>;
            signature: string;
            public_jwk: import("node:crypto").JsonWebKey;
            at: string;
          }>(
            `SELECT s.creator_kingdom_id,s.signed_payload,s.signature,k.public_jwk,COALESCE(w.committed_game_time_ms,0)::text AS at FROM evidence_seals s JOIN seal_signing_keys k ON k.kid=s.kid AND k.product_scope=s.product_scope LEFT JOIN world_clocks w ON w.product_scope=s.product_scope WHERE s.product_scope=$1 AND s.id=$2 AND s.status='published' AND NOT k.compromised`,
            [this.productScope, data.sealId],
          )
        ).rows[0];
        if (
          seal &&
          seal.creator_kingdom_id &&
          verifyPayload(SEAL_DOMAIN, seal.signed_payload, seal.signature, seal.public_jwk)
        )
          await this.awardKingdom(client, seal.creator_kingdom_id, "own_your_words", event.event_id, Number(seal.at));
        break;
      }
      case "season.low_harvest_week.completed.v1": {
        const week = Number(data.week);
        if (![3, 4, 5].includes(week)) break;
        const kingdomId = stringField(data, "kingdomId");
        const start = timeField(data, "startGameTimeMs");
        const end = timeField(data, "endGameTimeMs");
        if (end - start !== 7 * 24 * 3_600_000) throw new Error("INVALID_ACHIEVEMENT_WEEK");
        const eligible = await client.query(
          "SELECT 1 FROM kingdoms WHERE product_scope = $1 AND id = $2 AND activated_game_time_ms <= $3 AND status = 'ranked'",
          [this.productScope, kingdomId, start],
        );
        if (!eligible.rowCount) break;
        const coverage = await client.query<{ observed: string; failures: string }>(
          `SELECT count(*)::text AS observed,
             count(*) FILTER (WHERE NOT fully_funded)::text AS failures
           FROM achievement_upkeep_checks WHERE product_scope = $1 AND kingdom_id = $2
             AND game_time_ms >= $3 AND game_time_ms < $4`,
          [this.productScope, kingdomId, start, end],
        );
        if (Number(coverage.rows[0]?.observed) === 10_080 && Number(coverage.rows[0]?.failures) === 0)
          await this.awardKingdom(client, kingdomId, "winter_stores", event.event_id, end);
        break;
      }
    }
  }

  private async raid(client: PoolClient, event: EventRow): Promise<void> {
    const raidId = stringField(event.payload, "raidId");
    const row = (
      await client.query<{ participant_report: RaidReport | null }>(
        "SELECT participant_report FROM raids WHERE product_scope = $1 AND id = $2 AND status = 'resolved'",
        [this.productScope, raidId],
      )
    ).rows[0];
    const report = row?.participant_report;
    if (!report) return;
    const at = report.gameTimeMs;
    const ordinaryIds = new Set(report.eligibleOrdinaryUnitIds ?? []);
    if (report.trace.winner === "attacker") {
      const owners = new Set(
        report.eligibleUnits.filter((unit) => unit.side === "attacker").map((unit) => unit.ownerId),
      );
      for (const id of owners) await this.awardKingdom(client, id, "breach", event.event_id, at);
    } else if (report.trace.winner === "defender") {
      const visitors = new Set(
        report.eligibleUnits
          .filter(
            (unit) => unit.side === "defender" && unit.ownerId !== report.targetKingdomId && ordinaryIds.has(unit.id),
          )
          .map((unit) => unit.ownerId),
      );
      for (const id of visitors) await this.awardKingdom(client, id, "answered_the_call", event.event_id, at);
    }
    for (const group of report.trace.casualtyGroups) {
      const lost = group.lostUnitIds.filter((id) => ordinaryIds.has(id)).length;
      if (lost === 0) continue;
      const account = await this.accountForKingdom(client, group.ownerId);
      if (!account) continue;
      await client.query(
        `INSERT INTO achievement_battle_losses(product_scope, account_id, raid_id, loss_game_time_ms, lost_ordinary_count)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [this.productScope, account, raidId, at, lost],
      );
    }
  }

  private async awardKingdom(
    client: PoolClient,
    kingdomId: string,
    id: LegacyAchievementId,
    eventId: string,
    at: number,
  ): Promise<void> {
    const account = await this.accountForKingdom(client, kingdomId);
    if (account) await this.award(client, account, id, eventId, at);
  }

  private async accountForKingdom(client: PoolClient, kingdomId: string): Promise<string | null> {
    return (
      (
        await client.query<{ account_id: string }>(
          "SELECT account_id FROM kingdoms WHERE product_scope = $1 AND id = $2 AND status = 'ranked'",
          [this.productScope, kingdomId],
        )
      ).rows[0]?.account_id ?? null
    );
  }

  private async award(
    client: PoolClient,
    accountId: string,
    id: LegacyAchievementId,
    eventId: string,
    at: number,
  ): Promise<void> {
    const inserted = await client.query(
      `INSERT INTO achievement_awards(product_scope, account_id, achievement_id, source_event_id, awarded_game_time_ms)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING achievement_id`,
      [this.productScope, accountId, id, eventId, at],
    );
    if (!inserted.rowCount) return;
    await client.query(
      `INSERT INTO cosmetic_entitlements(product_scope, account_id, item_id, source_achievement_id)
       VALUES ($1,$2,$3,$4)`,
      [this.productScope, accountId, ornament[id], id],
    );
    await client.query(
      `INSERT INTO cosmetic_wallet_entries(product_scope, account_id, source_kind, source_ref, earned_gems_delta)
       VALUES ($1,$2,'achievement',$3,25)`,
      [this.productScope, accountId, id],
    );
    await appendOutbox(client, {
      productScope: this.productScope,
      eventId: randomUUID(),
      type: "achievement.awarded.v1",
      payload: { accountId, achievementId: id, ornamentId: ornament[id], earnedGems: 25, gameTimeMs: at },
    });
  }
}
