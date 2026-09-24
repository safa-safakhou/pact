import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import { rulesCatalog } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import type { OnboardingService } from "@pact/onboarding";
import { GAME_MINUTE_MS, type WorldClockService, type WorldSnapshot } from "@pact/world";
import type { Pool, PoolClient } from "pg";
import { uuidV7 } from "./uuid-v7.js";

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
