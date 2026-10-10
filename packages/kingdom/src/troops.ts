import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import { rulesCatalog, trainingQuote, trainingRequiredHall, wholeResources } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import { type TickContext, timedJobDeadline } from "@pact/world";
import type { PoolClient } from "pg";
import type { ImmediateAuthorityPort } from "./exposure-adapters.js";
import { uuidV7 } from "./uuid-v7.js";

export type TroopKind = keyof typeof rulesCatalog.units;
export type TroopPlacement = "home" | "visiting" | "scouting" | "attacking";

interface BatchRow {
  id: string;
  kingdom_id: string;
  account_id: string;
  troop_type: TroopKind;
  requested_count: number;
  completed_count: number;
  unit_minutes: number;
  status: "active" | "completed" | "canceled";
  queued_game_time_ms: string;
  next_unit_due_game_time_ms: string;
  settled_game_time_ms: string | null;
  iron_cost_id: string;
  silver_cost_id: string;
}

interface TroopRow {
  id: string;
  owner_kingdom_id: string;
  host_kingdom_id: string;
  type: TroopKind;
  home_guard: boolean;
  placement: TroopPlacement;
  placement_ref: string | null;
  created_game_time_ms: string;
}

export interface TrainingBatch {
  id: string;
  kingdomId: string;
  type: TroopKind;
  requested: number;
  completed: number;
  status: BatchRow["status"];
  nextUnitDueGameTimeMs: number;
}

export interface TroopIdentity {
  id: string;
  ownerKingdomId: string;
  hostKingdomId: string;
  type: TroopKind;
  homeGuard: boolean;
  placement: TroopPlacement;
  placementRef: string | null;
  createdGameTimeMs: number;
}

export interface BattleEligibility {
  battleId: string;
  attackerIds: string[];
  defenderIds: string[];
}

export class TroopError extends Error {
  constructor(
    readonly code:
      | "NOT_OWNER"
      | "INVALID_TROOP"
      | "UNIT_LOCKED"
      | "HOME_GUARD_RESTRICTED"
      | "HALL_LOCKED"
      | "QUEUE_BUSY"
      | "CAPACITY_EXCEEDED"
      | "UNITS_UNAVAILABLE"
      | "INVALID_ASSIGNMENT"
      | "BATCH_CONFLICT"
      | "BATCH_NOT_FOUND"
      | "ALREADY_COMPLETED",
  ) {
    super(code);
    this.name = "TroopError";
  }
}

function batchView(row: BatchRow): TrainingBatch {
  return {
    id: row.id,
    kingdomId: row.kingdom_id,
    type: row.troop_type,
    requested: row.requested_count,
    completed: row.completed_count,
    status: row.status,
    nextUnitDueGameTimeMs: Number(row.next_unit_due_game_time_ms),
  };
}

function troopView(row: TroopRow): TroopIdentity {
  return {
    id: row.id,
    ownerKingdomId: row.owner_kingdom_id,
    hostKingdomId: row.host_kingdom_id,
    type: row.type,
    homeGuard: row.home_guard,
    placement: row.placement,
    placementRef: row.placement_ref,
    createdGameTimeMs: Number(row.created_game_time_ms),
  };
}

function isTroopKind(kind: string): kind is TroopKind {
  return Object.hasOwn(rulesCatalog.units, kind);
}

export class TroopService {
  constructor(
    private readonly productScope: string,
    private readonly ledger: ResourceLedger,
    private readonly authority?: ImmediateAuthorityPort,
  ) {}

  async queueTraining(
    client: PoolClient,
    input: {
      accountId: string;
      kingdomId: string;
      batchId: string;
      type: string;
      count: number;
      gameTimeMs: number;
      actorKind?: "human" | "agent";
      mandateVersion?: number;
    },
  ): Promise<TrainingBatch> {
    if (!isTroopKind(input.type) || !Number.isInteger(input.count) || input.count < 1 || input.count > 40) {
      throw new TroopError("INVALID_TROOP");
    }
    await this.lockOwnedKingdom(client, input.accountId, input.kingdomId);
    const duplicate = await this.batch(client, input.batchId);
    if (duplicate) {
      if (
        duplicate.account_id !== input.accountId ||
        duplicate.kingdom_id !== input.kingdomId ||
        duplicate.troop_type !== input.type ||
        duplicate.requested_count !== input.count
      )
        throw new TroopError("BATCH_CONFLICT");
      return batchView(duplicate);
    }
    const existing = await client.query(
      "SELECT 1 FROM training_batches WHERE product_scope = $1 AND kingdom_id = $2 AND status = 'active'",
      [this.productScope, input.kingdomId],
    );
    if (existing.rowCount) throw new TroopError("QUEUE_BUSY");
    const hall = await this.buildingLevel(client, input.kingdomId, "hall");
    if (hall < trainingRequiredHall(input.type)) throw new TroopError("HALL_LOCKED");
    const capacity = await this.capacity(client, input.kingdomId, "owned");
    const owned = await client.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM kingdom_troops WHERE product_scope = $1 AND owner_kingdom_id = $2",
      [this.productScope, input.kingdomId],
    );
    if ((owned.rows[0]?.count ?? 0) + input.count > capacity) throw new TroopError("CAPACITY_EXCEEDED");
    const definition = rulesCatalog.units[input.type];
    const quote = trainingQuote(input.type, input.count);
    if (input.actorKind === "agent") {
      if (!this.authority) throw new Error("IMMEDIATE_AUTHORITY_NOT_CONFIGURED");
      for (const [asset, units] of [
        ["iron", quote.iron],
        ["silver", quote.silver],
      ] as const) {
        if (units > 0n)
          await this.authority.spend(client, {
            accountId: input.accountId,
            asset,
            units,
            action: "training.queue",
            operationKey: `training:${input.batchId}:${asset}`,
            ...(input.mandateVersion === undefined ? {} : { mandateVersion: input.mandateVersion }),
            gameTimeMs: input.gameTimeMs,
          });
      }
    }
    const iron = await this.ledger.payCost(client, {
      kingdomId: input.kingdomId,
      resource: "iron",
      kind: "training",
      amount: quote.iron,
      operationKey: input.batchId,
      gameTimeMs: input.gameTimeMs,
    });
    const silver = await this.ledger.payCost(client, {
      kingdomId: input.kingdomId,
      resource: "silver",
      kind: "training",
      amount: quote.silver,
      operationKey: input.batchId,
      gameTimeMs: input.gameTimeMs,
    });
    const due = timedJobDeadline(input.gameTimeMs, definition.trainingMinutes);
    const inserted = await client.query<BatchRow>(
      `INSERT INTO training_batches(id, product_scope, kingdom_id, account_id, troop_type,
         requested_count, unit_minutes, status, queued_game_time_ms, next_unit_due_game_time_ms,
         iron_cost_id, silver_cost_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11) RETURNING *`,
      [
        input.batchId,
        this.productScope,
        input.kingdomId,
        input.accountId,
        input.type,
        input.count,
        definition.trainingMinutes,
        input.gameTimeMs,
        due,
        iron.id,
        silver.id,
      ],
    );
    await this.emit(client, "training.queued.v1", {
      batchId: input.batchId,
      kingdomId: input.kingdomId,
      gameTimeMs: String(input.gameTimeMs),
    });
    const row = inserted.rows[0];
    if (!row) throw new Error("TRAINING_BATCH_MISSING");
    return batchView(row);
  }

  async settleMinute(client: PoolClient, context: TickContext): Promise<void> {
    const due = await client.query<BatchRow>(
      `SELECT * FROM training_batches WHERE product_scope = $1 AND status = 'active'
       AND next_unit_due_game_time_ms <= $2 ORDER BY kingdom_id FOR UPDATE`,
      [this.productScope, context.gameTimeMs],
    );
    for (const batch of due.rows) {
      let next = Number(batch.next_unit_due_game_time_ms);
      let completed = batch.completed_count;
      const definition = rulesCatalog.units[batch.troop_type];
      while (completed < batch.requested_count && next <= context.gameTimeMs) {
        const unitIndex = completed + 1;
        const operationKey = `training-unit:${batch.id}:${unitIndex}`;
        await this.ledger.consumeTrainingCost(client, {
          kingdomId: batch.kingdom_id,
          costId: batch.iron_cost_id,
          ordinaryUnits: wholeResources(definition.iron),
          operationKey,
          gameTimeMs: next,
        });
        await this.ledger.consumeTrainingCost(client, {
          kingdomId: batch.kingdom_id,
          costId: batch.silver_cost_id,
          ordinaryUnits: wholeResources(definition.silver),
          operationKey,
          gameTimeMs: next,
        });
        const troopId = uuidV7(new Date(next));
        await client.query(
          `INSERT INTO kingdom_troops(id, product_scope, owner_kingdom_id, host_kingdom_id,
             type, home_guard, placement, created_game_time_ms, created_at)
           VALUES ($1, $2, $3, $3, $4, false, 'home', $5, clock_timestamp())`,
          [troopId, this.productScope, batch.kingdom_id, batch.troop_type, next],
        );
        await this.emit(client, "training.unit.completed.v1", {
          batchId: batch.id,
          troopId,
          kingdomId: batch.kingdom_id,
          gameTimeMs: String(next),
        });
        completed += 1;
        next += batch.unit_minutes * 60_000;
      }
      await client.query(
        `UPDATE training_batches SET completed_count = $2, next_unit_due_game_time_ms = $3,
           status = CASE WHEN $2 = requested_count THEN 'completed' ELSE 'active' END,
           settled_game_time_ms = CASE WHEN $2 = requested_count THEN $4::bigint ELSE NULL END
         WHERE id = $1`,
        [batch.id, completed, next, context.gameTimeMs],
      );
    }
  }

  async cancelTraining(
    client: PoolClient,
    input: { accountId: string; kingdomId: string; batchId: string; gameTimeMs: number },
  ): Promise<TrainingBatch> {
    await this.lockOwnedKingdom(client, input.accountId, input.kingdomId);
    const row = await this.batch(client, input.batchId, true);
    if (!row || row.kingdom_id !== input.kingdomId) throw new TroopError("BATCH_NOT_FOUND");
    if (row.status === "canceled") return batchView(row);
    if (row.status === "completed") throw new TroopError("ALREADY_COMPLETED");
    await this.ledger.cancelCost(client, row.kingdom_id, row.iron_cost_id, input.gameTimeMs);
    await this.ledger.cancelCost(client, row.kingdom_id, row.silver_cost_id, input.gameTimeMs);
    const result = await client.query<BatchRow>(
      "UPDATE training_batches SET status = 'canceled', settled_game_time_ms = $2 WHERE id = $1 RETURNING *",
      [row.id, input.gameTimeMs],
    );
    await this.emit(client, "training.canceled.v1", {
      batchId: row.id,
      kingdomId: row.kingdom_id,
      gameTimeMs: String(input.gameTimeMs),
    });
    const final = result.rows[0];
    if (!final) throw new Error("TRAINING_BATCH_MISSING");
    return batchView(final);
  }

  async disband(
    client: PoolClient,
    input: { accountId: string; kingdomId: string; troopId: string; gameTimeMs: number },
  ): Promise<boolean> {
    await this.lockOwnedKingdom(client, input.accountId, input.kingdomId);
    const row = await this.troop(client, input.troopId, true);
    if (!row) return false;
    if (row.owner_kingdom_id !== input.kingdomId) throw new TroopError("NOT_OWNER");
    if (row.placement !== "home" || (await this.hasBattleLock(client, row.id, input.gameTimeMs))) {
      throw new TroopError("UNIT_LOCKED");
    }
    await client.query("DELETE FROM kingdom_troops WHERE id = $1", [row.id]);
    await this.emit(client, "troop.disbanded.v1", {
      troopId: row.id,
      kingdomId: input.kingdomId,
      gameTimeMs: String(input.gameTimeMs),
    });
    return true;
  }

  async assign(
    client: PoolClient,
    input: {
      accountId: string;
      ownerKingdomId: string;
      hostKingdomId: string;
      placement: Exclude<TroopPlacement, "home">;
      referenceId: string;
      type: TroopKind;
      count: number;
      explicitIds?: string[];
      gameTimeMs: number;
    },
  ): Promise<TroopIdentity[]> {
    if (
      !Number.isInteger(input.count) ||
      input.count < 1 ||
      (input.explicitIds?.length !== undefined && input.explicitIds.length !== input.count)
    )
      throw new TroopError("INVALID_ASSIGNMENT");
    const idsToLock = [...new Set([input.ownerKingdomId, input.hostKingdomId])].sort();
    for (const kingdomId of idsToLock) {
      const owner = await client.query<{ account_id: string }>(
        "SELECT account_id FROM kingdoms WHERE product_scope = $1 AND id = $2 AND status = 'ranked' FOR UPDATE",
        [this.productScope, kingdomId],
      );
      if (!owner.rows[0]) throw new TroopError("INVALID_ASSIGNMENT");
      if (kingdomId === input.ownerKingdomId && owner.rows[0].account_id !== input.accountId) {
        throw new TroopError("NOT_OWNER");
      }
    }
    if (input.placement === "visiting") {
      if (input.ownerKingdomId === input.hostKingdomId) throw new TroopError("INVALID_ASSIGNMENT");
      if ((await this.buildingLevel(client, input.ownerKingdomId, "hall")) < rulesCatalog.hallUnlocks.lending) {
        throw new TroopError("HALL_LOCKED");
      }
      const capacity = await this.capacity(client, input.hostKingdomId, "visiting");
      const occupied = await client.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM kingdom_troops WHERE product_scope = $1
         AND host_kingdom_id = $2 AND owner_kingdom_id <> $2 AND placement = 'visiting'`,
        [this.productScope, input.hostKingdomId],
      );
      if ((occupied.rows[0]?.count ?? 0) + input.count > capacity) throw new TroopError("CAPACITY_EXCEEDED");
    } else if (input.ownerKingdomId !== input.hostKingdomId) {
      throw new TroopError("INVALID_ASSIGNMENT");
    }
    const selected = await client.query<TroopRow>(
      `SELECT * FROM kingdom_troops WHERE product_scope = $1 AND owner_kingdom_id = $2
       AND host_kingdom_id = $2 AND placement = 'home' AND home_guard = false AND type = $3
       ${input.explicitIds ? "AND id = ANY($4::uuid[])" : ""}
       ORDER BY id LIMIT ${input.count} FOR UPDATE`,
      input.explicitIds
        ? [this.productScope, input.ownerKingdomId, input.type, input.explicitIds]
        : [this.productScope, input.ownerKingdomId, input.type],
    );
    if (selected.rows.length !== input.count) throw new TroopError("UNITS_UNAVAILABLE");
    for (const row of selected.rows) {
      if (await this.hasBattleLock(client, row.id, input.gameTimeMs)) throw new TroopError("UNIT_LOCKED");
      await client.query(
        `UPDATE kingdom_troops SET host_kingdom_id = $2, placement = $3, placement_ref = $4
         WHERE id = $1 AND placement = 'home'`,
        [row.id, input.hostKingdomId, input.placement, input.referenceId],
      );
    }
    const result = await client.query<TroopRow>("SELECT * FROM kingdom_troops WHERE id = ANY($1::uuid[]) ORDER BY id", [
      selected.rows.map((row) => row.id),
    ]);
    return result.rows.map(troopView);
  }

  async returnPlacement(
    client: PoolClient,
    input: {
      ownerKingdomId: string;
      placement: Exclude<TroopPlacement, "home">;
      referenceId: string;
      gameTimeMs: number;
    },
  ): Promise<string[]> {
    const result = await client.query<TroopRow>(
      `SELECT * FROM kingdom_troops WHERE product_scope = $1 AND owner_kingdom_id = $2
       AND placement = $3 AND placement_ref = $4 ORDER BY id FOR UPDATE`,
      [this.productScope, input.ownerKingdomId, input.placement, input.referenceId],
    );
    for (const row of result.rows) {
      if (await this.hasBattleLock(client, row.id, input.gameTimeMs)) throw new TroopError("UNIT_LOCKED");
    }
    await client.query(
      `UPDATE kingdom_troops SET host_kingdom_id = owner_kingdom_id,
       placement = 'home', placement_ref = NULL
       WHERE product_scope = $1 AND owner_kingdom_id = $2 AND placement = $3 AND placement_ref = $4`,
      [this.productScope, input.ownerKingdomId, input.placement, input.referenceId],
    );
    return result.rows.map((row) => row.id);
  }

  /** Host seizure transfers ownership of the existing UUIDs; it cannot create capacity or bypass a battle lock. */
  async seizeVisiting(
    client: PoolClient,
    input: { hostKingdomId: string; referenceId: string; gameTimeMs: number },
  ): Promise<string[]> {
    const units = await client.query<TroopRow>(
      `SELECT * FROM kingdom_troops WHERE product_scope = $1 AND host_kingdom_id = $2
       AND placement = 'visiting' AND placement_ref = $3 ORDER BY id FOR UPDATE`,
      [this.productScope, input.hostKingdomId, input.referenceId],
    );
    if (units.rows.length === 0) throw new TroopError("UNITS_UNAVAILABLE");
    for (const unit of units.rows) {
      if (await this.hasBattleLock(client, unit.id, input.gameTimeMs)) throw new TroopError("UNIT_LOCKED");
    }
    const capacity = await this.capacity(client, input.hostKingdomId, "owned");
    const owned = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM kingdom_troops WHERE product_scope = $1 AND owner_kingdom_id = $2",
      [this.productScope, input.hostKingdomId],
    );
    const training = await client.query<{ count: string }>(
      `SELECT COALESCE(sum(requested_count - completed_count), 0)::text AS count
       FROM training_batches WHERE product_scope = $1 AND kingdom_id = $2 AND status = 'active'`,
      [this.productScope, input.hostKingdomId],
    );
    if ((owned.rows[0]?.count ?? 0) + Number(training.rows[0]?.count ?? 0) + units.rows.length > capacity)
      throw new TroopError("CAPACITY_EXCEEDED");
    await client.query(
      `UPDATE kingdom_troops SET owner_kingdom_id = $2, placement = 'home', placement_ref = NULL
       WHERE product_scope = $1 AND id = ANY($3::uuid[])`,
      [this.productScope, input.hostKingdomId, units.rows.map((unit) => unit.id)],
    );
    return units.rows.map((unit) => unit.id);
  }

  async captureBattleEligibility(
    client: PoolClient,
    input: { battleId: string; hostKingdomId: string; raidId: string; lockUntilGameTimeMs: number },
  ): Promise<BattleEligibility> {
    const created = await client.query(
      `INSERT INTO battle_eligibility_snapshots(product_scope, battle_id, host_kingdom_id,
         raid_id, locked_until_game_time_ms) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [this.productScope, input.battleId, input.hostKingdomId, input.raidId, input.lockUntilGameTimeMs],
    );
    if (created.rowCount === 1) {
      const eligible = await client.query<{ id: string; side: "attacker" | "defender" }>(
        `SELECT id, CASE WHEN placement = 'attacking' THEN 'attacker' ELSE 'defender' END AS side
         FROM kingdom_troops WHERE product_scope = $1 AND
           ((placement = 'attacking' AND placement_ref = $2)
             OR (host_kingdom_id = $3 AND placement = 'home')
             OR (host_kingdom_id = $3 AND placement = 'visiting'
               AND NOT EXISTS (
                 SELECT 1 FROM garrison_contracts g WHERE g.product_scope = kingdom_troops.product_scope
                   AND g.id = kingdom_troops.placement_ref AND g.status = 'exit_pending'
               )))
         ORDER BY id FOR UPDATE`,
        [this.productScope, input.raidId, input.hostKingdomId],
      );
      for (const row of eligible.rows) {
        await client.query(
          `INSERT INTO battle_unit_eligibility(product_scope, battle_id, troop_id, side,
             host_kingdom_id, locked_until_game_time_ms) VALUES ($1, $2, $3, $4, $5, $6)`,
          [this.productScope, input.battleId, row.id, row.side, input.hostKingdomId, input.lockUntilGameTimeMs],
        );
      }
    }
    const snapshot = await client.query<{
      host_kingdom_id: string;
      raid_id: string;
      locked_until_game_time_ms: string;
    }>(
      "SELECT host_kingdom_id, raid_id, locked_until_game_time_ms FROM battle_eligibility_snapshots WHERE product_scope = $1 AND battle_id = $2",
      [this.productScope, input.battleId],
    );
    const saved = snapshot.rows[0];
    if (
      !saved ||
      saved.host_kingdom_id !== input.hostKingdomId ||
      saved.raid_id !== input.raidId ||
      Number(saved.locked_until_game_time_ms) !== input.lockUntilGameTimeMs
    ) {
      throw new TroopError("BATCH_CONFLICT");
    }
    const ids = await client.query<{ troop_id: string; side: "attacker" | "defender" }>(
      "SELECT troop_id, side FROM battle_unit_eligibility WHERE product_scope = $1 AND battle_id = $2 ORDER BY troop_id",
      [this.productScope, input.battleId],
    );
    return {
      battleId: input.battleId,
      attackerIds: ids.rows.filter((row) => row.side === "attacker").map((row) => row.troop_id),
      defenderIds: ids.rows.filter((row) => row.side === "defender").map((row) => row.troop_id),
    };
  }

  private async lockOwnedKingdom(client: PoolClient, accountId: string, kingdomId: string): Promise<void> {
    const owner = await client.query(
      "SELECT 1 FROM kingdoms WHERE product_scope = $1 AND id = $2 AND account_id = $3 AND status = 'ranked' FOR UPDATE",
      [this.productScope, kingdomId, accountId],
    );
    if (!owner.rowCount) throw new TroopError("NOT_OWNER");
  }

  private async buildingLevel(client: PoolClient, kingdomId: string, kind: string): Promise<number> {
    const result = await client.query<{ level: number }>(
      "SELECT level FROM kingdom_buildings WHERE product_scope = $1 AND kingdom_id = $2 AND kind = $3",
      [this.productScope, kingdomId, kind],
    );
    const level = result.rows[0]?.level;
    if (!level) throw new Error("BUILDING_STATE_INCOMPLETE");
    return level;
  }

  private async capacity(client: PoolClient, kingdomId: string, pool: "owned" | "visiting"): Promise<number> {
    const level = await this.buildingLevel(client, kingdomId, "barracks");
    const rule = rulesCatalog.levels[level - 1];
    if (!rule) throw new Error("INVALID_BARRACKS_LEVEL");
    return pool === "owned" ? rule.ownedTroopSlots : rule.visitingTroopSlots;
  }

  private async batch(client: PoolClient, id: string, lock = false): Promise<BatchRow | null> {
    const result = await client.query<BatchRow>(
      `SELECT * FROM training_batches WHERE product_scope = $1 AND id = $2${lock ? " FOR UPDATE" : ""}`,
      [this.productScope, id],
    );
    return result.rows[0] ?? null;
  }

  private async troop(client: PoolClient, id: string, lock = false): Promise<TroopRow | null> {
    const result = await client.query<TroopRow>(
      `SELECT * FROM kingdom_troops WHERE product_scope = $1 AND id = $2${lock ? " FOR UPDATE" : ""}`,
      [this.productScope, id],
    );
    return result.rows[0] ?? null;
  }

  private async hasBattleLock(client: PoolClient, troopId: string, gameTimeMs: number): Promise<boolean> {
    const lock = await client.query(
      `SELECT 1 FROM battle_unit_eligibility WHERE product_scope = $1 AND troop_id = $2
       AND locked_until_game_time_ms > $3 LIMIT 1`,
      [this.productScope, troopId, gameTimeMs],
    );
    return Boolean(lock.rowCount);
  }

  private async emit(client: PoolClient, type: string, payload: unknown): Promise<void> {
    await appendOutbox(client, { productScope: this.productScope, eventId: randomUUID(), type, payload });
  }
}
