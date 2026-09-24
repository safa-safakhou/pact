import { hourlyRatePerMinute, rulesCatalog, wholeResources } from "@pact/domain";
import type { TickContext } from "@pact/world";
import type { PoolClient } from "pg";
import { allocateSpend, assertAmount, creditToCap, type Resource, type SpendPurpose } from "./policy.js";

interface BalanceRow {
  resource: Resource;
  ordinary_units: string;
  allowance_units: string;
  locked_units: string;
  storage_cap_units: string;
  allowance_cap_units: string;
  production_per_minute_units: string;
  version: string;
}

interface MovementRow {
  operation_key: string;
  reason: string;
  requested_units: string;
  ordinary_delta: string;
  allowance_delta: string;
  locked_delta: string;
  overflow_units: string;
  cancellation_loss_units: string;
  ordinary_after: string;
  allowance_after: string;
  locked_after: string;
  storage_cap_after: string | null;
  production_per_minute_after: string | null;
}

interface CostRow {
  id: string;
  resource: Resource;
  kind: "construction" | "training";
  operation_key: string;
  ordinary_paid_units: string;
  allowance_paid_units: string;
  ordinary_remaining_units: string;
  status: "active" | "installed" | "completed" | "canceled";
}

export interface Balance {
  resource: Resource;
  ordinary: bigint;
  allowance: bigint;
  locked: bigint;
  storageCap: bigint;
  allowanceCap: bigint;
  productionPerMinute: bigint;
  version: bigint;
}

export interface Movement {
  operationKey: string;
  reason: string;
  requested: bigint;
  ordinaryDelta: bigint;
  allowanceDelta: bigint;
  lockedDelta: bigint;
  overflow: bigint;
  cancellationLoss: bigint;
  ordinaryAfter: bigint;
  allowanceAfter: bigint;
  lockedAfter: bigint;
}

export interface CostProvenance {
  id: string;
  resource: Resource;
  kind: "construction" | "training";
  operationKey: string;
  ordinaryPaid: bigint;
  allowancePaid: bigint;
  ordinaryRemaining: bigint;
  status: CostRow["status"];
}

function parseBalance(row: BalanceRow): Balance {
  return {
    resource: row.resource,
    ordinary: BigInt(row.ordinary_units),
    allowance: BigInt(row.allowance_units),
    locked: BigInt(row.locked_units),
    storageCap: BigInt(row.storage_cap_units),
    allowanceCap: BigInt(row.allowance_cap_units),
    productionPerMinute: BigInt(row.production_per_minute_units),
    version: BigInt(row.version),
  };
}

function parseMovement(row: MovementRow): Movement {
  return {
    operationKey: row.operation_key,
    reason: row.reason,
    requested: BigInt(row.requested_units),
    ordinaryDelta: BigInt(row.ordinary_delta),
    allowanceDelta: BigInt(row.allowance_delta),
    lockedDelta: BigInt(row.locked_delta),
    overflow: BigInt(row.overflow_units),
    cancellationLoss: BigInt(row.cancellation_loss_units),
    ordinaryAfter: BigInt(row.ordinary_after),
    allowanceAfter: BigInt(row.allowance_after),
    lockedAfter: BigInt(row.locked_after),
  };
}

function parseCost(row: CostRow): CostProvenance {
  return {
    id: row.id,
    resource: row.resource,
    kind: row.kind,
    operationKey: row.operation_key,
    ordinaryPaid: BigInt(row.ordinary_paid_units),
    allowancePaid: BigInt(row.allowance_paid_units),
    ordinaryRemaining: BigInt(row.ordinary_remaining_units),
    status: row.status,
  };
}

function assertGameTime(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("INVALID_GAME_TIME");
}

function assertOperationKey(value: string): void {
  if (!value || value.length > 200) throw new Error("INVALID_OPERATION_KEY");
}

interface Mutation {
  kingdomId: string;
  resource: Resource;
  operationKey: string;
  reason: string;
  requested: bigint;
  gameTimeMs: number;
  calculate: (balance: Balance) => {
    ordinaryDelta?: bigint;
    allowanceDelta?: bigint;
    lockedDelta?: bigint;
    overflow?: bigint;
    cancellationLoss?: bigint;
  };
}

export class ResourceLedger {
  constructor(private readonly productScope: string) {}

  private async lockedBalance(client: PoolClient, kingdomId: string, resource: Resource): Promise<Balance> {
    const result = await client.query<BalanceRow>(
      `SELECT * FROM resource_balances
       WHERE product_scope = $1 AND kingdom_id = $2 AND resource = $3 FOR UPDATE`,
      [this.productScope, kingdomId, resource],
    );
    const row = result.rows[0];
    if (!row) throw new Error("RESOURCE_BALANCE_NOT_FOUND");
    return parseBalance(row);
  }

  async readBalance(client: PoolClient, kingdomId: string, resource: Resource): Promise<Balance> {
    const result = await client.query<BalanceRow>(
      "SELECT * FROM resource_balances WHERE product_scope = $1 AND kingdom_id = $2 AND resource = $3",
      [this.productScope, kingdomId, resource],
    );
    const row = result.rows[0];
    if (!row) throw new Error("RESOURCE_BALANCE_NOT_FOUND");
    return parseBalance(row);
  }

  /** Final asset disposal after every accepted engagement and bond has settled. */
  async discardRetired(
    client: PoolClient,
    kingdomId: string,
    resource: Resource,
    gameTimeMs: number,
  ): Promise<Movement> {
    const movement = await this.mutate(client, {
      kingdomId,
      resource,
      operationKey: `retirement:${kingdomId}:${resource}`,
      reason: "retirement_discard",
      requested: 0n,
      gameTimeMs,
      calculate: (balance) => {
        if (balance.locked !== 0n) throw new Error("RETIREMENT_BOND_OUTSTANDING");
        return { ordinaryDelta: -balance.ordinary, allowanceDelta: -balance.allowance };
      },
    });
    await client.query(
      `UPDATE resource_balances SET production_per_minute_units = 0
       WHERE product_scope = $1 AND kingdom_id = $2 AND resource = $3`,
      [this.productScope, kingdomId, resource],
    );
    return movement;
  }

  /** Retired kingdoms retain the balance checkpoint, not unlimited movement history. */
  async pruneMovementHistory(client: PoolClient, kingdomId: string, before: Date): Promise<number> {
    const result = await client.query(
      `DELETE FROM resource_movements WHERE product_scope = $1 AND kingdom_id = $2
       AND created_at <= $3`,
      [this.productScope, kingdomId, before],
    );
    return result.rowCount ?? 0;
  }

  private async mutate(client: PoolClient, input: Mutation): Promise<Movement> {
    assertOperationKey(input.operationKey);
    assertGameTime(input.gameTimeMs);
    assertAmount(input.requested);
    const balance = await this.lockedBalance(client, input.kingdomId, input.resource);
    const previous = await client.query<MovementRow>(
      `SELECT * FROM resource_movements
       WHERE product_scope = $1 AND kingdom_id = $2 AND resource = $3 AND operation_key = $4`,
      [this.productScope, input.kingdomId, input.resource, input.operationKey],
    );
    if (previous.rows[0]) {
      const movement = parseMovement(previous.rows[0]);
      if (movement.reason !== input.reason || movement.requested !== input.requested) {
        throw new Error("LEDGER_IDEMPOTENCY_CONFLICT");
      }
      return movement;
    }
    const delta = input.calculate(balance);
    const ordinaryDelta = delta.ordinaryDelta ?? 0n;
    const allowanceDelta = delta.allowanceDelta ?? 0n;
    const lockedDelta = delta.lockedDelta ?? 0n;
    const overflow = delta.overflow ?? 0n;
    const cancellationLoss = delta.cancellationLoss ?? 0n;
    assertAmount(overflow);
    assertAmount(cancellationLoss);
    const ordinaryAfter = balance.ordinary + ordinaryDelta;
    const allowanceAfter = balance.allowance + allowanceDelta;
    const lockedAfter = balance.locked + lockedDelta;
    if (ordinaryAfter < 0n || allowanceAfter < 0n || lockedAfter < 0n) throw new Error("INSUFFICIENT_STOCK");
    if (ordinaryAfter > balance.storageCap || allowanceAfter > balance.allowanceCap)
      throw new Error("STORAGE_CAP_EXCEEDED");
    await client.query(
      `UPDATE resource_balances SET ordinary_units = $4, allowance_units = $5,
         locked_units = $6, version = version + 1
       WHERE product_scope = $1 AND kingdom_id = $2 AND resource = $3`,
      [
        this.productScope,
        input.kingdomId,
        input.resource,
        ordinaryAfter.toString(),
        allowanceAfter.toString(),
        lockedAfter.toString(),
      ],
    );
    const result = await client.query<MovementRow>(
      `INSERT INTO resource_movements(product_scope, kingdom_id, resource, operation_key, reason,
         requested_units, ordinary_delta, allowance_delta, locked_delta, overflow_units,
         cancellation_loss_units, ordinary_after, allowance_after, locked_after, game_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        this.productScope,
        input.kingdomId,
        input.resource,
        input.operationKey,
        input.reason,
        input.requested.toString(),
        ordinaryDelta.toString(),
        allowanceDelta.toString(),
        lockedDelta.toString(),
        overflow.toString(),
        cancellationLoss.toString(),
        ordinaryAfter.toString(),
        allowanceAfter.toString(),
        lockedAfter.toString(),
        input.gameTimeMs,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("LEDGER_MOVEMENT_MISSING");
    return parseMovement(row);
  }

  async initializeKingdom(client: PoolClient, kingdomId: string, activationGameTimeMs: number): Promise<void> {
    assertGameTime(activationGameTimeMs);
    const expiry = activationGameTimeMs + rulesCatalog.founding.allowanceExpiryGameDays * 24 * 60 * 60 * 1000;
    assertGameTime(expiry);
    const created = await client.query(
      `INSERT INTO ledger_kingdoms(product_scope, kingdom_id, grant_expires_game_time_ms)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [this.productScope, kingdomId, expiry],
    );
    if (created.rowCount !== 1) throw new Error("LEDGER_KINGDOM_ALREADY_EXISTS");
    const level = rulesCatalog.levels[0];
    if (!level) throw new Error("RULES_CATALOG_EMPTY");
    const resources: Array<{ resource: Resource; grant: number; perHour: number }> = [
      { resource: "iron", grant: rulesCatalog.founding.constructionIron, perHour: level.ironPerHour },
      { resource: "silver", grant: rulesCatalog.founding.constructionSilver, perHour: level.silverPerHour },
      { resource: "grain", grant: rulesCatalog.founding.upkeepGrain, perHour: level.grainPerHour },
    ];
    for (const item of resources) {
      const grant = wholeResources(item.grant);
      await client.query(
        `INSERT INTO resource_balances(product_scope, kingdom_id, resource, ordinary_units,
           allowance_units, locked_units, storage_cap_units, allowance_cap_units, production_per_minute_units)
         VALUES ($1, $2, $3, 0, $4, 0, $5, $4, $6)`,
        [
          this.productScope,
          kingdomId,
          item.resource,
          grant.toString(),
          wholeResources(level.storagePerResource).toString(),
          hourlyRatePerMinute(item.perHour).toString(),
        ],
      );
      await client.query(
        `INSERT INTO resource_movements(product_scope, kingdom_id, resource, operation_key, reason,
           requested_units, allowance_delta, ordinary_after, allowance_after, locked_after, game_time_ms)
         VALUES ($1, $2, $3, 'founding', 'founding_grant', $4, $4, 0, $4, 0, $5)`,
        [this.productScope, kingdomId, item.resource, grant.toString(), activationGameTimeMs],
      );
    }
  }

  async creditOrdinary(
    client: PoolClient,
    input: {
      kingdomId: string;
      resource: Resource;
      amount: bigint;
      operationKey: string;
      reason: string;
      gameTimeMs: number;
    },
  ): Promise<Movement> {
    return this.mutate(client, {
      ...input,
      requested: input.amount,
      calculate: (balance) => {
        const { credited, overflow } = creditToCap(balance.ordinary, balance.storageCap, input.amount);
        return { ordinaryDelta: credited, overflow };
      },
    });
  }

  async debit(
    client: PoolClient,
    input: {
      kingdomId: string;
      resource: Resource;
      amount: bigint;
      purpose: SpendPurpose;
      operationKey: string;
      gameTimeMs: number;
    },
  ): Promise<{ movement: Movement; fullyFunded: boolean }> {
    let funded = true;
    const movement = await this.mutate(client, {
      kingdomId: input.kingdomId,
      resource: input.resource,
      operationKey: input.operationKey,
      reason: `spend:${input.purpose}`,
      requested: input.amount,
      gameTimeMs: input.gameTimeMs,
      calculate: (balance) => {
        const allocation = allocateSpend({
          resource: input.resource,
          purpose: input.purpose,
          ordinary: balance.ordinary,
          allowance: balance.allowance,
          requested: input.amount,
        });
        funded = allocation.fullyFunded;
        return { ordinaryDelta: -allocation.ordinarySpent, allowanceDelta: -allocation.allowanceSpent };
      },
    });
    if (movement.requested !== -(movement.ordinaryDelta + movement.allowanceDelta)) funded = false;
    return { movement, fullyFunded: funded };
  }

  async lockBond(
    client: PoolClient,
    input: {
      kingdomId: string;
      resource: Resource;
      amount: bigint;
      operationKey: string;
      gameTimeMs: number;
    },
  ): Promise<Movement> {
    return this.mutate(client, {
      ...input,
      reason: "bond_lock",
      requested: input.amount,
      calculate: (balance) => {
        if (balance.ordinary < input.amount) throw new Error("INSUFFICIENT_STOCK");
        return { ordinaryDelta: -input.amount, lockedDelta: input.amount };
      },
    });
  }

  async releaseBond(
    client: PoolClient,
    input: {
      kingdomId: string;
      resource: Resource;
      amount: bigint;
      operationKey: string;
      gameTimeMs: number;
    },
  ): Promise<Movement> {
    return this.mutate(client, {
      ...input,
      reason: "bond_return",
      requested: input.amount,
      calculate: (balance) => {
        if (balance.locked < input.amount) throw new Error("INSUFFICIENT_LOCKED_FUNDS");
        const { credited, overflow } = creditToCap(balance.ordinary, balance.storageCap, input.amount);
        return { ordinaryDelta: credited, lockedDelta: -input.amount, overflow };
      },
    });
  }

  /** Remove a forfeited bond from its owner's protected balance. Credit the recipient separately in the same transaction. */
  async forfeitBond(
    client: PoolClient,
    input: { kingdomId: string; resource: Resource; amount: bigint; operationKey: string; gameTimeMs: number },
  ): Promise<Movement> {
    return this.mutate(client, {
      ...input,
      reason: "bond_forfeit",
      requested: input.amount,
      calculate: (balance) => {
        if (balance.locked < input.amount) throw new Error("INSUFFICIENT_LOCKED_FUNDS");
        return { lockedDelta: -input.amount };
      },
    });
  }

  async payCost(
    client: PoolClient,
    input: {
      kingdomId: string;
      resource: Resource;
      kind: "construction" | "training";
      amount: bigint;
      operationKey: string;
      gameTimeMs: number;
    },
  ): Promise<CostProvenance> {
    if (input.resource === "grain") throw new Error("INVALID_COST_RESOURCE");
    if (input.amount <= 0n) throw new Error("INVALID_COST_AMOUNT");
    assertOperationKey(input.operationKey);
    const { movement } = await this.debit(client, {
      kingdomId: input.kingdomId,
      resource: input.resource,
      amount: input.amount,
      purpose: input.kind,
      operationKey: `cost:${input.kind}:${input.operationKey}`,
      gameTimeMs: input.gameTimeMs,
    });
    const ordinaryPaid = -movement.ordinaryDelta;
    const allowancePaid = -movement.allowanceDelta;
    await client.query(
      `INSERT INTO resource_cost_provenance(product_scope, kingdom_id, resource, kind, operation_key,
         ordinary_paid_units, allowance_paid_units, ordinary_remaining_units, status, created_game_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $6, 'active', $8)
       ON CONFLICT(product_scope, kingdom_id, resource, kind, operation_key) DO NOTHING`,
      [
        this.productScope,
        input.kingdomId,
        input.resource,
        input.kind,
        input.operationKey,
        ordinaryPaid.toString(),
        allowancePaid.toString(),
        input.gameTimeMs,
      ],
    );
    const result = await client.query<CostRow>(
      `SELECT * FROM resource_cost_provenance WHERE product_scope = $1 AND kingdom_id = $2
       AND resource = $3 AND kind = $4 AND operation_key = $5`,
      [this.productScope, input.kingdomId, input.resource, input.kind, input.operationKey],
    );
    const row = result.rows[0];
    if (!row) throw new Error("COST_PROVENANCE_MISSING");
    const cost = parseCost(row);
    if (cost.ordinaryPaid !== ordinaryPaid || cost.allowancePaid !== allowancePaid) {
      throw new Error("LEDGER_IDEMPOTENCY_CONFLICT");
    }
    return cost;
  }

  async completeCost(
    client: PoolClient,
    kingdomId: string,
    costId: string,
    gameTimeMs: number,
  ): Promise<CostProvenance> {
    assertGameTime(gameTimeMs);
    const result = await client.query<CostRow>(
      `SELECT * FROM resource_cost_provenance WHERE product_scope = $1 AND kingdom_id = $2 AND id = $3 FOR UPDATE`,
      [this.productScope, kingdomId, costId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("COST_PROVENANCE_MISSING");
    if (row.kind !== "construction") throw new Error("USE_TRAINING_CONSUMPTION");
    if (row.status === "installed") return parseCost(row);
    if (row.status !== "active") throw new Error("COST_ALREADY_SETTLED");
    const updated = await client.query<CostRow>(
      `UPDATE resource_cost_provenance SET status = $4, ordinary_remaining_units = 0,
         settled_game_time_ms = $5 WHERE product_scope = $1 AND kingdom_id = $2 AND id = $3 RETURNING *`,
      [this.productScope, kingdomId, costId, "installed", gameTimeMs],
    );
    const completed = updated.rows[0];
    if (!completed) throw new Error("COST_PROVENANCE_MISSING");
    return parseCost(completed);
  }

  async consumeTrainingCost(
    client: PoolClient,
    input: {
      kingdomId: string;
      costId: string;
      ordinaryUnits: bigint;
      operationKey: string;
      gameTimeMs: number;
    },
  ): Promise<CostProvenance> {
    if (input.ordinaryUnits <= 0n) throw new Error("INVALID_COST_AMOUNT");
    assertOperationKey(input.operationKey);
    assertGameTime(input.gameTimeMs);
    const result = await client.query<CostRow>(
      `SELECT * FROM resource_cost_provenance WHERE product_scope = $1 AND kingdom_id = $2 AND id = $3 FOR UPDATE`,
      [this.productScope, input.kingdomId, input.costId],
    );
    const row = result.rows[0];
    if (row?.kind !== "training") throw new Error("TRAINING_COST_NOT_FOUND");
    const previous = await client.query<{ ordinary_units: string }>(
      "SELECT ordinary_units FROM resource_training_consumptions WHERE cost_id = $1 AND operation_key = $2",
      [input.costId, input.operationKey],
    );
    if (previous.rows[0]) {
      if (BigInt(previous.rows[0].ordinary_units) !== input.ordinaryUnits)
        throw new Error("LEDGER_IDEMPOTENCY_CONFLICT");
      return parseCost(row);
    }
    if (row.status !== "active" || BigInt(row.ordinary_remaining_units) < input.ordinaryUnits) {
      throw new Error("TRAINING_COST_EXHAUSTED");
    }
    const remaining = BigInt(row.ordinary_remaining_units) - input.ordinaryUnits;
    await client.query(
      `INSERT INTO resource_training_consumptions(cost_id, operation_key, ordinary_units, game_time_ms)
       VALUES ($1, $2, $3, $4)`,
      [input.costId, input.operationKey, input.ordinaryUnits.toString(), input.gameTimeMs],
    );
    const updated = await client.query<CostRow>(
      `UPDATE resource_cost_provenance SET ordinary_remaining_units = $4,
         status = CASE WHEN $4::bigint = 0 THEN 'completed' ELSE 'active' END,
         settled_game_time_ms = CASE WHEN $4::bigint = 0 THEN $5::bigint ELSE NULL END
       WHERE product_scope = $1 AND kingdom_id = $2 AND id = $3 RETURNING *`,
      [this.productScope, input.kingdomId, input.costId, remaining.toString(), input.gameTimeMs],
    );
    const consumed = updated.rows[0];
    if (!consumed) throw new Error("TRAINING_COST_NOT_FOUND");
    return parseCost(consumed);
  }

  async cancelCost(client: PoolClient, kingdomId: string, costId: string, gameTimeMs: number): Promise<Movement> {
    assertGameTime(gameTimeMs);
    const result = await client.query<CostRow>(
      `SELECT * FROM resource_cost_provenance WHERE product_scope = $1 AND kingdom_id = $2 AND id = $3 FOR UPDATE`,
      [this.productScope, kingdomId, costId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("COST_PROVENANCE_MISSING");
    const cost = parseCost(row);
    const operationKey = `cancel-cost:${cost.id}`;
    if (cost.status === "canceled") {
      const previous = await client.query<MovementRow>(
        `SELECT * FROM resource_movements WHERE product_scope = $1 AND kingdom_id = $2
         AND resource = $3 AND operation_key = $4`,
        [this.productScope, kingdomId, cost.resource, operationKey],
      );
      if (previous.rows[0]) return parseMovement(previous.rows[0]);
      throw new Error("COST_ALREADY_SETTLED");
    }
    if (cost.status !== "active") throw new Error("COST_ALREADY_SETTLED");
    const eligibleOrdinary = cost.kind === "training" ? cost.ordinaryRemaining : cost.ordinaryPaid;
    const eligibleAllowance = cost.allowancePaid;
    const requested = eligibleOrdinary + eligibleAllowance;
    const percent =
      cost.kind === "training"
        ? rulesCatalog.training.remainingCancelRefundPercent
        : rulesCatalog.construction.activeCancelRefundPercent;
    const ordinaryRefund = (eligibleOrdinary * BigInt(percent)) / 100n;
    const allowanceRefund = (eligibleAllowance * BigInt(percent)) / 100n;
    const expiry = await client.query<{ grant_expires_game_time_ms: string }>(
      `SELECT grant_expires_game_time_ms FROM ledger_kingdoms WHERE product_scope = $1 AND kingdom_id = $2`,
      [this.productScope, kingdomId],
    );
    const grantStillValid = gameTimeMs < Number(expiry.rows[0]?.grant_expires_game_time_ms);
    const movement = await this.mutate(client, {
      kingdomId,
      resource: cost.resource,
      operationKey,
      reason: "cancellation_refund",
      requested,
      gameTimeMs,
      calculate: (balance) => {
        const ordinary = creditToCap(balance.ordinary, balance.storageCap, ordinaryRefund);
        const allowance = grantStillValid
          ? creditToCap(balance.allowance, balance.allowanceCap, allowanceRefund)
          : { credited: 0n, overflow: 0n };
        return {
          ordinaryDelta: ordinary.credited,
          allowanceDelta: allowance.credited,
          overflow: ordinary.overflow + allowance.overflow,
          cancellationLoss: requested - ordinaryRefund - allowanceRefund + (grantStillValid ? 0n : allowanceRefund),
        };
      },
    });
    await client.query(
      `UPDATE resource_cost_provenance SET status = 'canceled', settled_game_time_ms = $4
       WHERE product_scope = $1 AND kingdom_id = $2 AND id = $3`,
      [this.productScope, kingdomId, costId, gameTimeMs],
    );
    return movement;
  }

  async configureEconomy(
    client: PoolClient,
    input: {
      kingdomId: string;
      resource: Resource;
      storageCapUnits: bigint;
      productionPerMinuteUnits: bigint;
      operationKey: string;
      gameTimeMs: number;
    },
  ): Promise<bigint> {
    assertAmount(input.storageCapUnits);
    assertAmount(input.productionPerMinuteUnits);
    assertOperationKey(input.operationKey);
    assertGameTime(input.gameTimeMs);
    const balance = await this.lockedBalance(client, input.kingdomId, input.resource);
    const previous = await client.query<MovementRow>(
      `SELECT * FROM resource_movements WHERE product_scope = $1 AND kingdom_id = $2
       AND resource = $3 AND operation_key = $4`,
      [this.productScope, input.kingdomId, input.resource, input.operationKey],
    );
    if (previous.rows[0]) {
      const movement = parseMovement(previous.rows[0]);
      if (
        movement.reason !== "economy_reconfigured" ||
        previous.rows[0].storage_cap_after !== input.storageCapUnits.toString() ||
        previous.rows[0].production_per_minute_after !== input.productionPerMinuteUnits.toString()
      )
        throw new Error("LEDGER_IDEMPOTENCY_CONFLICT");
      return movement.overflow;
    }
    const overflow = balance.ordinary > input.storageCapUnits ? balance.ordinary - input.storageCapUnits : 0n;
    const newOrdinary = balance.ordinary - overflow;
    await client.query(
      `UPDATE resource_balances SET ordinary_units = $4, storage_cap_units = $5,
         production_per_minute_units = $6, version = version + 1
       WHERE product_scope = $1 AND kingdom_id = $2 AND resource = $3`,
      [
        this.productScope,
        input.kingdomId,
        input.resource,
        newOrdinary.toString(),
        input.storageCapUnits.toString(),
        input.productionPerMinuteUnits.toString(),
      ],
    );
    await client.query(
      `INSERT INTO resource_movements(product_scope, kingdom_id, resource, operation_key, reason,
         requested_units, ordinary_delta, overflow_units, ordinary_after, allowance_after, locked_after,
         storage_cap_after, production_per_minute_after, game_time_ms)
       VALUES ($1, $2, $3, $4, 'economy_reconfigured', $5, $6, $5, $7, $8, $9, $10, $11, $12)`,
      [
        this.productScope,
        input.kingdomId,
        input.resource,
        input.operationKey,
        overflow.toString(),
        (-overflow).toString(),
        newOrdinary.toString(),
        balance.allowance.toString(),
        balance.locked.toString(),
        input.storageCapUnits.toString(),
        input.productionPerMinuteUnits.toString(),
        input.gameTimeMs,
      ],
    );
    return overflow;
  }

  async deleteKingdomLedger(client: PoolClient, kingdomId: string): Promise<void> {
    await client.query("DELETE FROM ledger_kingdoms WHERE product_scope = $1 AND kingdom_id = $2", [
      this.productScope,
      kingdomId,
    ]);
  }

  async expireFoundingAllowances(client: PoolClient, context: TickContext): Promise<void> {
    const due = await client.query<{ kingdom_id: string; resource: Resource; grant_expires_game_time_ms: string }>(
      `SELECT b.kingdom_id, b.resource, k.grant_expires_game_time_ms
       FROM resource_balances b JOIN ledger_kingdoms k USING(product_scope, kingdom_id)
       WHERE b.product_scope = $1 AND k.grant_expires_game_time_ms <= $2 AND b.allowance_units > 0
       ORDER BY b.kingdom_id, b.resource`,
      [this.productScope, context.gameTimeMs],
    );
    for (const row of due.rows) {
      const balance = await this.lockedBalance(client, row.kingdom_id, row.resource);
      if (balance.allowance === 0n) continue;
      await this.mutate(client, {
        kingdomId: row.kingdom_id,
        resource: row.resource,
        operationKey: `grant-expiry:${row.grant_expires_game_time_ms}`,
        reason: "grant_expiry",
        requested: balance.allowance,
        gameTimeMs: context.gameTimeMs,
        calculate: () => ({ allowanceDelta: -balance.allowance }),
      });
    }
  }

  async settleProductionMinute(client: PoolClient, context: TickContext, harvestWeek: number): Promise<void> {
    const harvestPercent = rulesCatalog.harvestPercentByWeek[harvestWeek - 1];
    if (harvestPercent === undefined) throw new Error("INVALID_HARVEST_WEEK");
    const rows = await client.query<{ kingdom_id: string; resource: Resource; production_per_minute_units: string }>(
      `SELECT kingdom_id, resource, production_per_minute_units FROM resource_balances
       WHERE product_scope = $1 AND production_per_minute_units > 0 ORDER BY kingdom_id, resource`,
      [this.productScope],
    );
    for (const row of rows.rows) {
      const base = BigInt(row.production_per_minute_units);
      const amount = row.resource === "grain" ? (base * BigInt(harvestPercent)) / 100n : base;
      await this.creditOrdinary(client, {
        kingdomId: row.kingdom_id,
        resource: row.resource,
        amount,
        operationKey: `production:${context.gameTimeMs}`,
        reason: "production",
        gameTimeMs: context.gameTimeMs,
      });
    }
  }
}
