import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import { rulesCatalog } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import type { OnboardingService } from "@pact/onboarding";
import { GAME_MINUTE_MS, type WorldClockService, type WorldSnapshot } from "@pact/world";
import type { Pool, PoolClient } from "pg";
import { uuidV7 } from "./uuid-v7.js";

export type KingdomAmbition = string;
const startingBuildings = ["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"] as const;

interface KingdomRow {
  id: string;
  handle: string;
  activated_at: Date;
  activated_game_time_ms: string;
  activated_tick_sequence: string;
  first_tick_game_time_ms: string;
  activation_event_id: string;
}

export interface KingdomActivation {
  kingdomId: string;
  handle: string;
  activatedAt: Date;
  gameTimeMs: number;
  tickSequence: string;
  firstTickGameTimeMs: number;
  activationEventId: string;
}

function fromRow(row: KingdomRow): KingdomActivation {
  return {
    kingdomId: row.id,
    handle: row.handle,
    activatedAt: row.activated_at,
    gameTimeMs: Number(row.activated_game_time_ms),
    tickSequence: row.activated_tick_sequence,
    firstTickGameTimeMs: Number(row.first_tick_game_time_ms),
    activationEventId: row.activation_event_id,
  };
}

export class KingdomError extends Error {
  constructor(
    readonly code: "WORLD_PAUSED" | "TICK_PENDING" | "HANDLE_TAKEN",
    readonly suggestions: string[] = [],
  ) {
    super(code);
    this.name = "KingdomError";
  }
}

export class KingdomService {
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      onboarding: OnboardingService;
      world: WorldClockService;
      ledger: ResourceLedger;
    },
  ) {}

  /** Human-owned presentation setting. The authenticated HTTP boundary supplies the account. */
  async setAmbition(accountId: string, ambition: KingdomAmbition): Promise<{ ambition: KingdomAmbition }> {
    if (ambition.length > 8000) throw new Error("INVALID_AMBITION");
    const result = await this.pool.query<{ ambition: KingdomAmbition }>(
      "UPDATE kingdoms SET ambition=$3, ambition_version=ambition_version+1 WHERE product_scope=$1 AND account_id=$2 AND status='ranked' RETURNING ambition",
      [this.options.productScope, accountId, ambition],
    );
    if (!result.rows[0]) throw new Error("KINGDOM_NOT_FOUND");
    return result.rows[0];
  }
  async readNotes(accountId: string) {
    const result = await this.pool.query<{ text: string; version: number }>(
      "SELECT COALESCE(ambition,'') AS text, ambition_version AS version FROM kingdoms WHERE product_scope=$1 AND account_id=$2 AND status='ranked'",
      [this.options.productScope, accountId],
    );
    return result.rows[0] ?? null;
  }
  async writeNotes(accountId: string, text: string, expectedVersion: number) {
    const result = await this.pool.query<{ text: string; version: number }>(
      "UPDATE kingdoms SET ambition=$3, ambition_version=ambition_version+1 WHERE product_scope=$1 AND account_id=$2 AND status='ranked' AND ambition_version=$4 RETURNING ambition AS text, ambition_version AS version",
      [this.options.productScope, accountId, text, expectedVersion],
    );
    if (result.rows[0]) return { ...result.rows[0], saved: true };
    return { saved: false, code: "STALE_VERSION", current: await this.readNotes(accountId) };
  }
  async exportExperience(client: PoolClient, accountId: string) {
    return (
      await client.query(
        "SELECT COALESCE(ambition,'') AS ambition, ambition_version AS version FROM kingdoms WHERE product_scope=$1 AND account_id=$2 AND status='ranked'",
        [this.options.productScope, accountId],
      )
    ).rows;
  }
  async forgetExperience(client: PoolClient, accountId: string): Promise<void> {
    await client.query("UPDATE kingdoms SET ambition=NULL WHERE product_scope=$1 AND account_id=$2", [
      this.options.productScope,
      accountId,
    ]);
  }
  async guestNeighbors(accountId: string, offset = 0) {
    const rows = (
      await this.pool.query<{ kingdomId: string; handle: string; displayName: string }>(
        `SELECT k.id AS "kingdomId",k.handle,k.display_name AS "displayName" FROM kingdoms k
       JOIN accounts a ON a.id=k.account_id AND a.product_scope=k.product_scope
       WHERE k.product_scope=$1 AND k.account_id<>$2 AND k.status='ranked' AND a.status='active'
       AND a.is_guest AND k.moderation_case_id IS NULL
       ORDER BY k.activated_at DESC,k.id LIMIT 21 OFFSET $3`,
        [this.options.productScope, accountId, offset],
      )
    ).rows;
    return { players: rows.slice(0, 20), hasMore: rows.length > 20, offset };
  }

  /** Chat discovery exposes only identity and the founder-approved public Hall level. */
  async discoverKingdoms(accountId: string, query = "", offset = 0) {
    if (query.length > 80 || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000)
      throw new Error("INVALID_DISCOVERY_QUERY");
    const rows = (
      await this.pool.query<{ kingdomId: string; handle: string; displayName: string; hallLevel: number | null }>(
        `SELECT k.id AS "kingdomId", k.handle, k.display_name AS "displayName", b.level AS "hallLevel"
         FROM kingdoms k JOIN accounts a ON a.id=k.account_id AND a.product_scope=k.product_scope
         LEFT JOIN kingdom_buildings b ON b.product_scope=k.product_scope AND b.kingdom_id=k.id AND b.kind='hall'
         WHERE k.product_scope=$1 AND k.account_id<>$2 AND k.status='ranked' AND a.status='active'
           AND k.moderation_case_id IS NULL
           AND ($3='' OR strpos(lower(k.handle),lower($3))>0 OR strpos(lower(k.display_name),lower($3))>0)
         ORDER BY lower(k.display_name),k.id LIMIT 9 OFFSET $4`,
        [this.options.productScope, accountId, query.trim().replace(/^@/, ""), offset],
      )
    ).rows;
    return { players: rows.slice(0, 8), hasMore: rows.length > 8, offset, pageSize: 8, query };
  }

  async getByAccount(accountId: string): Promise<KingdomActivation | null> {
    const result = await this.pool.query<KingdomRow>(
      "SELECT * FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.options.productScope, accountId],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async getByAccountInTransaction(client: PoolClient, accountId: string): Promise<KingdomActivation | null> {
    const result = await client.query<KingdomRow>(
      "SELECT * FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.options.productScope, accountId],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async accountDisplay(accountId: string): Promise<{ displayName: string; handle: string } | null> {
    return (
      (
        await this.pool.query<{ displayName: string; handle: string }>(
          `SELECT display_name AS "displayName",handle FROM kingdoms WHERE product_scope=$1 AND account_id=$2 AND status='ranked'`,
          [this.options.productScope, accountId],
        )
      ).rows[0] ?? null
    );
  }

  async activate(accountId: string): Promise<KingdomActivation> {
    const already = await this.getByAccount(accountId);
    if (already) return already;
    const admitted = await this.options.world.admitCommand(async (client, committed) => {
      const existing = await client.query<KingdomRow>(
        "SELECT * FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
        [this.options.productScope, accountId],
      );
      if (existing.rows[0]) return fromRow(existing.rows[0]);
      const draft = await this.options.onboarding.validatedActivationDraft(client, accountId);
      const kingdomId = randomUUID();
      const activationEventId = randomUUID();
      const firstTickGameTimeMs = committed.gameTimeMs + GAME_MINUTE_MS;
      if (!Number.isSafeInteger(firstTickGameTimeMs)) throw new Error("UNSAFE_GAME_TIME");
      const inserted = await client.query<KingdomRow>(
        `INSERT INTO kingdoms(id, product_scope, account_id, draft_id, handle, display_name, portrait,
           activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms,
           activation_event_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT DO NOTHING RETURNING *`,
        [
          kingdomId,
          this.options.productScope,
          accountId,
          draft.id,
          draft.handle,
          draft.displayName,
          draft.portrait,
          draft.validatedAt,
          committed.gameTimeMs,
          committed.sequence.toString(),
          firstTickGameTimeMs,
          activationEventId,
        ],
      );
      const row = inserted.rows[0];
      if (!row) {
        const raced = await client.query<KingdomRow>(
          "SELECT * FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
          [this.options.productScope, accountId],
        );
        if (raced.rows[0]) return fromRow(raced.rows[0]);
        throw new KingdomError("HANDLE_TAKEN", await this.availableHandles(client, draft.handle));
      }
      await this.createFoundingState(client, kingdomId, committed, draft.validatedAt);
      await this.options.onboarding.markDraftActivated(client, draft.id, draft.validatedAt);
      await appendOutbox(client, {
        productScope: this.options.productScope,
        eventId: activationEventId,
        type: "kingdom.activated.v1",
        payload: { kingdomId, handle: draft.handle, gameTimeMs: String(committed.gameTimeMs) },
      });
      return fromRow(row);
    });
    if (admitted.kind !== "admitted") {
      throw new KingdomError(admitted.kind === "paused" ? "WORLD_PAUSED" : "TICK_PENDING");
    }
    return admitted.value;
  }

  private async createFoundingState(
    client: PoolClient,
    kingdomId: string,
    committed: WorldSnapshot,
    realNow: Date,
  ): Promise<void> {
    await this.options.ledger.initializeKingdom(client, kingdomId, committed.gameTimeMs);
    for (const kind of startingBuildings) {
      await client.query(
        "INSERT INTO kingdom_buildings(product_scope, kingdom_id, kind, level) VALUES ($1, $2, $3, 1)",
        [this.options.productScope, kingdomId, kind],
      );
    }
    for (let slot = 1; slot <= rulesCatalog.construction.builderSlots; slot += 1) {
      await client.query("INSERT INTO kingdom_builder_slots(product_scope, kingdom_id, slot) VALUES ($1, $2, $3)", [
        this.options.productScope,
        kingdomId,
        slot,
      ]);
    }
    await client.query("INSERT INTO kingdom_training_queue(product_scope, kingdom_id, slot) VALUES ($1, $2, 1)", [
      this.options.productScope,
      kingdomId,
    ]);
    for (let index = 0; index < rulesCatalog.founding.homeGuardSpearmen; index += 1) {
      await client.query(
        `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
           type, home_guard, placement, created_game_time_ms, created_at)
         VALUES ($1, $2, $3, $3, 'spearman', true, 'home', $4, $5)`,
        [uuidV7(realNow), this.options.productScope, kingdomId, committed.gameTimeMs, realNow],
      );
    }
    for (const [kind, capacity] of [
      ["raid", rulesCatalog.actionLimits.raidCharges],
      ["scout", rulesCatalog.actionLimits.scoutCharges],
    ] as const) {
      await client.query(
        `INSERT INTO kingdom_charges(product_scope, kingdom_id, kind, available, capacity,
           last_regenerated_game_time_ms) VALUES ($1, $2, $3, $4, $4, $5)`,
        [this.options.productScope, kingdomId, kind, capacity, committed.gameTimeMs],
      );
    }
    await client.query(
      `INSERT INTO kingdom_score_baselines(product_scope, kingdom_id, game_time_ms,
         marked_value_numerator, marked_value_denominator) VALUES ($1, $2, $3, 0, 1)`,
      [this.options.productScope, kingdomId, committed.gameTimeMs],
    );
  }

  private async availableHandles(client: PoolClient, requested: string): Promise<string[]> {
    const suggestions: string[] = [];
    for (let suffix = 1; suggestions.length < 3 && suffix <= 20; suffix += 1) {
      const candidate = `${requested.slice(0, 20)}_${suffix}`;
      const exists = await client.query("SELECT 1 FROM kingdoms WHERE product_scope = $1 AND handle = $2", [
        this.options.productScope,
        candidate,
      ]);
      if (!exists.rowCount) suggestions.push(candidate);
    }
    return suggestions;
  }
}
