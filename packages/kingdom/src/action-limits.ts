import { rulesCatalog } from "@pact/domain";
import type { TickContext } from "@pact/world";
import type { PoolClient } from "pg";

export type ChargeKind = "raid" | "scout";
export type RollingActionKind =
  | "outgoing_message"
  | "offer_action"
  | "cold_contact"
  | "transfer"
  | "public_post"
  | "state_read";

interface ChargeRow {
  available: number;
  capacity: number;
  last_regenerated_game_time_ms: string;
}

export interface ChargeStatus {
  available: number;
  capacity: number;
  nextRegenerationGameTimeMs: number | null;
  retryAtGameTimeMs: number | null;
  alreadyCommitted?: boolean;
}

export interface RollingStatus {
  used: number;
  limit: number;
  retryAtGameTimeMs: number | null;
  alreadyCommitted?: boolean;
}

export class ActionLimitError extends Error {
  constructor(
    readonly code: "CHARGE_EMPTY" | "RATE_LIMITED" | "INVALID_GAME_TIME" | "KINGDOM_NOT_FOUND",
    readonly retryAtGameTimeMs: number | null = null,
  ) {
    super(code);
    this.name = "ActionLimitError";
  }
}

const chargeIntervalMs: Record<ChargeKind, number> = {
  raid: rulesCatalog.actionLimits.raidRegenerationHours * 3_600_000,
  scout: rulesCatalog.actionLimits.scoutRegenerationHours * 3_600_000,
};

const rollingPolicies: Record<RollingActionKind, { limit: number; windowMs: number }> = {
  outgoing_message: { limit: rulesCatalog.actionLimits.outgoingMessagesPerDay, windowMs: 86_400_000 },
  offer_action: { limit: rulesCatalog.actionLimits.offerActionsPerDay, windowMs: 86_400_000 },
  cold_contact: { limit: rulesCatalog.actionLimits.coldContactsPerDay, windowMs: 86_400_000 },
  transfer: { limit: rulesCatalog.actionLimits.transfersPerDay, windowMs: 86_400_000 },
  public_post: { limit: rulesCatalog.actionLimits.publicPostsPerDay, windowMs: 86_400_000 },
  state_read: { limit: rulesCatalog.actionLimits.stateReadsPerHour, windowMs: 3_600_000 },
};

function validTime(gameTimeMs: number): void {
  if (!Number.isSafeInteger(gameTimeMs) || gameTimeMs < 0) throw new ActionLimitError("INVALID_GAME_TIME");
}

function projectCharge(row: ChargeRow, kind: ChargeKind, gameTimeMs: number): ChargeStatus & { anchor: number } {
  validTime(gameTimeMs);
  let available = row.available;
  let anchor = Number(row.last_regenerated_game_time_ms);
  if (gameTimeMs < anchor) throw new ActionLimitError("INVALID_GAME_TIME");
  if (available < row.capacity) {
    const elapsed = Math.floor((gameTimeMs - anchor) / chargeIntervalMs[kind]);
    if (elapsed > 0) {
      available = Math.min(row.capacity, available + elapsed);
      anchor = available === row.capacity ? gameTimeMs : anchor + elapsed * chargeIntervalMs[kind];
    }
  }
  const next = available === row.capacity ? null : anchor + chargeIntervalMs[kind];
  return {
    available,
    capacity: row.capacity,
    nextRegenerationGameTimeMs: next,
    retryAtGameTimeMs: available === 0 ? next : null,
    anchor,
  };
}

export type ChargeView = ChargeStatus & { kind: ChargeKind; regenerationHours: number };

/** All methods run in the caller's gameplay transaction after action validation. */
export class ActionLimitService {
  constructor(private readonly productScope: string) {}

  /** Read-only projection; the caller must authorize the owner and provide its snapshot's game time. */
  async readCharges(client: PoolClient, kingdomId: string, gameTimeMs: number): Promise<ChargeView[]> {
    validTime(gameTimeMs);
    const rows = await client.query<ChargeRow & { kind: ChargeKind }>(
      `SELECT kind, available, capacity, last_regenerated_game_time_ms FROM kingdom_charges
       WHERE product_scope = $1 AND kingdom_id = $2 ORDER BY kind`,
      [this.productScope, kingdomId],
    );
    return rows.rows.map((row) => {
      const { anchor: _anchor, ...status } = projectCharge(row, row.kind, gameTimeMs);
      return { ...status, kind: row.kind, regenerationHours: chargeIntervalMs[row.kind] / 3_600_000 };
    });
  }

  private async lockKingdom(client: PoolClient, kingdomId: string): Promise<void> {
    const found = await client.query(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND id = $2 AND status = 'ranked' FOR UPDATE",
      [this.productScope, kingdomId],
    );
    if (!found.rowCount) throw new ActionLimitError("KINGDOM_NOT_FOUND");
  }

  private async materializeCharge(
    client: PoolClient,
    kingdomId: string,
    kind: ChargeKind,
    gameTimeMs: number,
  ): Promise<ChargeStatus> {
    const found = await client.query<ChargeRow>(
      `SELECT available, capacity, last_regenerated_game_time_ms FROM kingdom_charges
       WHERE product_scope = $1 AND kingdom_id = $2 AND kind = $3 FOR UPDATE`,
      [this.productScope, kingdomId, kind],
    );
    const row = found.rows[0];
    if (!row) throw new ActionLimitError("KINGDOM_NOT_FOUND");
    const { anchor, ...status } = projectCharge(row, kind, gameTimeMs);
    if (status.available !== row.available || anchor !== Number(row.last_regenerated_game_time_ms)) {
      await client.query(
        `UPDATE kingdom_charges SET available = $4, last_regenerated_game_time_ms = $5
           WHERE product_scope = $1 AND kingdom_id = $2 AND kind = $3`,
        [this.productScope, kingdomId, kind, status.available, anchor],
      );
    }
    return status;
  }

  async chargeStatus(
    client: PoolClient,
    kingdomId: string,
    kind: ChargeKind,
    gameTimeMs: number,
  ): Promise<ChargeStatus> {
    validTime(gameTimeMs);
    await this.lockKingdom(client, kingdomId);
    return this.materializeCharge(client, kingdomId, kind, gameTimeMs);
  }

  async settleMinute(client: PoolClient, context: TickContext): Promise<void> {
    if (context.productScope !== this.productScope) throw new Error("ACTION_LIMIT_SCOPE_MISMATCH");
    const kingdoms = await client.query<{ id: string }>(
      `SELECT id FROM kingdoms WHERE product_scope = $1 AND status = 'ranked'
       AND first_tick_game_time_ms <= $2 ORDER BY id`,
      [this.productScope, context.gameTimeMs],
    );
    for (const row of kingdoms.rows) {
      await this.lockKingdom(client, row.id);
      await this.materializeCharge(client, row.id, "raid", context.gameTimeMs);
      await this.materializeCharge(client, row.id, "scout", context.gameTimeMs);
    }
  }

  async spendCharge(
    client: PoolClient,
    input: { kingdomId: string; kind: ChargeKind; operationKey: string; gameTimeMs: number },
  ): Promise<ChargeStatus> {
    validTime(input.gameTimeMs);
    if (!input.operationKey) throw new Error("ACTION_OPERATION_KEY_REQUIRED");
    await this.lockKingdom(client, input.kingdomId);
    const existing = await client.query<{
      available_after: number;
      capacity: number;
      next_regeneration_game_time_ms: string | null;
    }>(
      `SELECT available_after, capacity, next_regeneration_game_time_ms
       FROM kingdom_charge_spends WHERE product_scope = $1 AND kingdom_id = $2
       AND kind = $3 AND operation_key = $4`,
      [this.productScope, input.kingdomId, input.kind, input.operationKey],
    );
    if (existing.rows[0]) {
      const saved = existing.rows[0];
      const next = saved.next_regeneration_game_time_ms === null ? null : Number(saved.next_regeneration_game_time_ms);
      return {
        available: saved.available_after,
        capacity: saved.capacity,
        nextRegenerationGameTimeMs: next,
        retryAtGameTimeMs: saved.available_after === 0 ? next : null,
        alreadyCommitted: true,
      };
    }
    const current = await this.materializeCharge(client, input.kingdomId, input.kind, input.gameTimeMs);
    if (current.available === 0) throw new ActionLimitError("CHARGE_EMPTY", current.retryAtGameTimeMs);
    const anchor = current.available === current.capacity ? input.gameTimeMs : null;
    await client.query(
      `UPDATE kingdom_charges SET available = available - 1,
         last_regenerated_game_time_ms = COALESCE($4, last_regenerated_game_time_ms)
       WHERE product_scope = $1 AND kingdom_id = $2 AND kind = $3`,
      [this.productScope, input.kingdomId, input.kind, anchor],
    );
    const next = anchor === null ? current.nextRegenerationGameTimeMs : anchor + chargeIntervalMs[input.kind];
    await client.query(
      `INSERT INTO kingdom_charge_spends(product_scope, kingdom_id, kind, operation_key, game_time_ms,
         available_after, capacity, next_regeneration_game_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        this.productScope,
        input.kingdomId,
        input.kind,
        input.operationKey,
        input.gameTimeMs,
        current.available - 1,
        current.capacity,
        next,
      ],
    );
    return {
      available: current.available - 1,
      capacity: current.capacity,
      nextRegenerationGameTimeMs: next,
      retryAtGameTimeMs: current.available === 1 ? next : null,
    };
  }

  private async rollingWindow(
    client: PoolClient,
    kingdomId: string,
    kind: RollingActionKind,
    gameTimeMs: number,
  ): Promise<{ used: number; oldest: number | null }> {
    const policy = rollingPolicies[kind];
    const result = await client.query<{ used: number; oldest: string | null }>(
      `SELECT count(*)::integer AS used, min(game_time_ms)::text AS oldest
       FROM kingdom_action_events WHERE product_scope = $1 AND kingdom_id = $2 AND kind = $3
       AND game_time_ms > $4 AND game_time_ms <= $5`,
      [this.productScope, kingdomId, kind, gameTimeMs - policy.windowMs, gameTimeMs],
    );
    return { used: result.rows[0]?.used ?? 0, oldest: result.rows[0]?.oldest ? Number(result.rows[0].oldest) : null };
  }

  async rollingStatus(
    client: PoolClient,
    kingdomId: string,
    kind: RollingActionKind,
    gameTimeMs: number,
  ): Promise<RollingStatus> {
    validTime(gameTimeMs);
    await this.lockKingdom(client, kingdomId);
    const { used, oldest } = await this.rollingWindow(client, kingdomId, kind, gameTimeMs);
    const policy = rollingPolicies[kind];
    return {
      used,
      limit: policy.limit,
      retryAtGameTimeMs: used >= policy.limit && oldest !== null ? oldest + policy.windowMs : null,
    };
  }

  async recordSuccessfulAction(
    client: PoolClient,
    input: { kingdomId: string; kind: RollingActionKind; operationKey: string; gameTimeMs: number },
  ): Promise<RollingStatus> {
    validTime(input.gameTimeMs);
    if (!input.operationKey) throw new Error("ACTION_OPERATION_KEY_REQUIRED");
    await this.lockKingdom(client, input.kingdomId);
    const existing = await client.query(
      `SELECT 1 FROM kingdom_action_events WHERE product_scope = $1 AND kingdom_id = $2
       AND kind = $3 AND operation_key = $4`,
      [this.productScope, input.kingdomId, input.kind, input.operationKey],
    );
    const { used, oldest } = await this.rollingWindow(client, input.kingdomId, input.kind, input.gameTimeMs);
    const policy = rollingPolicies[input.kind];
    if (existing.rowCount) {
      return { used, limit: policy.limit, retryAtGameTimeMs: null, alreadyCommitted: true };
    }
    if (used >= policy.limit)
      throw new ActionLimitError("RATE_LIMITED", oldest === null ? null : oldest + policy.windowMs);
    await client.query(
      `INSERT INTO kingdom_action_events(product_scope, kingdom_id, kind, operation_key, game_time_ms)
       VALUES ($1, $2, $3, $4, $5)`,
      [this.productScope, input.kingdomId, input.kind, input.operationKey, input.gameTimeMs],
    );
    return {
      used: used + 1,
      limit: policy.limit,
      retryAtGameTimeMs: used + 1 === policy.limit ? (oldest ?? input.gameTimeMs) + policy.windowMs : null,
    };
  }
}
