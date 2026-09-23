import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import { type BuildingKind, hourlyRatePerMinute, rulesCatalog, wholeResources } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import type { TickContext } from "@pact/world";
import type { PoolClient } from "pg";
import { type BuildingLevels, checkUpgrade, upgradeQuote } from "./building-rules.js";

type ActorKind = "human" | "agent";
type InstructionState = "waiting" | "active" | "completed" | "canceled";

interface InstructionRow {
  id: string;
  product_scope: string;
  kingdom_id: string;
  account_id: string;
  builder_slot: number;
  building_kind: BuildingKind;
  target_level: number;
  actor_kind: ActorKind;
  authority_ref: string;
  mandate_version: number | null;
  state: InstructionState;
  queued_game_time_ms: string;
  started_game_time_ms: string | null;
  due_game_time_ms: string | null;
  settled_game_time_ms: string | null;
  iron_cost_id: string | null;
  silver_cost_id: string | null;
}

export interface BuildingInstruction {
  id: string;
  kingdomId: string;
  slot: number;
  kind: BuildingKind;
  targetLevel: number;
  state: InstructionState;
  queuedGameTimeMs: number;
  startedGameTimeMs: number | null;
  dueGameTimeMs: number | null;
  settledGameTimeMs: number | null;
}

export interface ConstructionAuthorityPort {
  reserve(
    client: PoolClient,
    input: {
      accountId: string;
      kingdomId: string;
      instructionId: string;
      actor: ActorKind;
      permitId?: string;
      mandateVersion?: number;
      iron: bigint;
      silver: bigint;
    },
  ): Promise<string>;
  recheckAndStart(
    client: PoolClient,
    input: {
      accountId: string;
      kingdomId: string;
      instructionId: string;
      actor: ActorKind;
      authorityRef: string;
      mandateVersion: number | null;
      ordinaryIron: bigint;
      ordinarySilver: bigint;
    },
  ): Promise<boolean>;
  releaseWaiting(client: PoolClient, authorityRef: string, instructionId: string): Promise<void>;
  recordActiveCancellation(client: PoolClient, authorityRef: string, instructionId: string): Promise<void>;
}

/** Safe worker wiring until the transaction-bound authority adapter is composed in PACT-039. */
export class FailClosedConstructionAuthority implements ConstructionAuthorityPort {
  async reserve(): Promise<string> {
    throw new Error("CONSTRUCTION_AUTHORITY_NOT_CONFIGURED");
  }

  async recheckAndStart(): Promise<boolean> {
    return false;
  }

  async releaseWaiting(): Promise<void> {
    throw new Error("CONSTRUCTION_AUTHORITY_NOT_CONFIGURED");
  }

  async recordActiveCancellation(): Promise<void> {
    // An active construction debit is already spent authority; its refund never replenishes allowance.
  }
}

export class BuildingError extends Error {
  constructor(
    readonly code:
      | "NOT_OWNER"
      | "INVALID_SLOT"
      | "INVALID_LEVEL"
      | "BUILDING_BUSY"
      | "SLOT_BUSY"
      | "INSTRUCTION_CONFLICT"
      | "INSTRUCTION_NOT_FOUND"
      | "ALREADY_COMPLETED",
  ) {
    super(code);
    this.name = "BuildingError";
  }
}

function view(row: InstructionRow): BuildingInstruction {
  return {
    id: row.id,
    kingdomId: row.kingdom_id,
    slot: row.builder_slot,
    kind: row.building_kind,
    targetLevel: row.target_level,
    state: row.state,
    queuedGameTimeMs: Number(row.queued_game_time_ms),
    startedGameTimeMs: row.started_game_time_ms === null ? null : Number(row.started_game_time_ms),
    dueGameTimeMs: row.due_game_time_ms === null ? null : Number(row.due_game_time_ms),
    settledGameTimeMs: row.settled_game_time_ms === null ? null : Number(row.settled_game_time_ms),
  };
}

function knownKind(kind: string): kind is BuildingKind {
  return Object.hasOwn(rulesCatalog.buildingBaseCosts, kind);
}

export class BuildingEngine {
  constructor(
    private readonly productScope: string,
    private readonly ledger: ResourceLedger,
    private readonly authority: ConstructionAuthorityPort,
  ) {}

  async queue(
    client: PoolClient,
    input: {
      accountId: string;
      kingdomId: string;
      instructionId: string;
      slot: number;
      kind: string;
      targetLevel: number;
      actor: ActorKind;
      permitId?: string;
      mandateVersion?: number;
      gameTimeMs: number;
    },
  ): Promise<BuildingInstruction> {
    if (!Number.isSafeInteger(input.gameTimeMs) || input.gameTimeMs < 0) throw new Error("INVALID_GAME_TIME");
    if (input.slot !== 1 && input.slot !== 2) throw new BuildingError("INVALID_SLOT");
    if (!knownKind(input.kind)) throw new BuildingError("INVALID_LEVEL");
    await this.assertOwner(client, input.accountId, input.kingdomId);
    const duplicate = await this.instruction(client, input.instructionId);
    if (duplicate) {
      if (
        duplicate.account_id !== input.accountId ||
        duplicate.kingdom_id !== input.kingdomId ||
        duplicate.builder_slot !== input.slot ||
        duplicate.building_kind !== input.kind ||
        duplicate.target_level !== input.targetLevel ||
        duplicate.actor_kind !== input.actor
      ) {
        throw new BuildingError("INSTRUCTION_CONFLICT");
      }
      return view(duplicate);
    }
    const levels = await this.levels(client, input.kingdomId);
    const check = checkUpgrade(levels, input.kind, input.targetLevel);
    if (check === "invalid_level" || check === "not_next_level") throw new BuildingError("INVALID_LEVEL");
    const live = await client.query<InstructionRow>(
      `SELECT * FROM building_instructions WHERE product_scope = $1 AND kingdom_id = $2
       AND state IN ('waiting', 'active') FOR UPDATE`,
      [this.productScope, input.kingdomId],
    );
    if (live.rows.some((row) => row.building_kind === input.kind)) throw new BuildingError("BUILDING_BUSY");
    if (live.rows.some((row) => row.builder_slot === input.slot && row.state === "waiting")) {
      throw new BuildingError("SLOT_BUSY");
    }
    const quote = upgradeQuote(input.kind, input.targetLevel, input.gameTimeMs);
    const authorityRef = await this.authority.reserve(client, {
      accountId: input.accountId,
      kingdomId: input.kingdomId,
      instructionId: input.instructionId,
      actor: input.actor,
      ...(input.permitId ? { permitId: input.permitId } : {}),
      ...(input.mandateVersion === undefined ? {} : { mandateVersion: input.mandateVersion }),
      iron: quote.iron,
      silver: quote.silver,
    });
    if (!authorityRef) throw new BuildingError("INSTRUCTION_CONFLICT");
    await client.query(
      `INSERT INTO building_instructions(id, product_scope, kingdom_id, account_id, builder_slot,
         building_kind, target_level, actor_kind, authority_ref, mandate_version, state, queued_game_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'waiting', $11)`,
      [
        input.instructionId,
        this.productScope,
        input.kingdomId,
        input.accountId,
        input.slot,
        input.kind,
        input.targetLevel,
        input.actor,
        authorityRef,
        input.mandateVersion ?? null,
        input.gameTimeMs,
      ],
    );
    await this.emit(client, "building.queued.v1", input.instructionId, input.kingdomId, input.gameTimeMs);
    if (!live.rows.some((row) => row.builder_slot === input.slot && row.state === "active")) {
      await this.tryStart(client, input.instructionId, input.gameTimeMs);
    }
    const created = await this.instruction(client, input.instructionId);
    if (!created) throw new Error("BUILDING_INSTRUCTION_MISSING");
    return view(created);
  }

  async cancel(
    client: PoolClient,
    input: { accountId: string; kingdomId: string; instructionId: string; gameTimeMs: number },
  ): Promise<BuildingInstruction> {
    await this.assertOwner(client, input.accountId, input.kingdomId);
    const row = await this.instruction(client, input.instructionId, true);
    if (!row || row.kingdom_id !== input.kingdomId) throw new BuildingError("INSTRUCTION_NOT_FOUND");
    if (row.state === "canceled") return view(row);
    if (row.state === "completed") throw new BuildingError("ALREADY_COMPLETED");
    if (row.state === "waiting") {
      await this.authority.releaseWaiting(client, row.authority_ref, row.id);
    } else {
      if (!row.iron_cost_id || !row.silver_cost_id) throw new Error("BUILDING_COST_MISSING");
      await this.ledger.cancelCost(client, row.kingdom_id, row.iron_cost_id, input.gameTimeMs);
      await this.ledger.cancelCost(client, row.kingdom_id, row.silver_cost_id, input.gameTimeMs);
      await this.authority.recordActiveCancellation(client, row.authority_ref, row.id);
    }
    const canceled = await client.query<InstructionRow>(
      `UPDATE building_instructions SET state = 'canceled', settled_game_time_ms = $2
       WHERE id = $1 RETURNING *`,
      [row.id, input.gameTimeMs],
    );
    await this.emit(client, "building.canceled.v1", row.id, row.kingdom_id, input.gameTimeMs);
    const final = canceled.rows[0];
    if (!final) throw new Error("BUILDING_INSTRUCTION_MISSING");
    return view(final);
  }

  async settleMinute(client: PoolClient, context: TickContext): Promise<void> {
    const due = await client.query<InstructionRow>(
      `SELECT * FROM building_instructions WHERE product_scope = $1 AND state = 'active'
       AND due_game_time_ms <= $2 ORDER BY kingdom_id, builder_slot FOR UPDATE`,
      [this.productScope, context.gameTimeMs],
    );
    for (const row of due.rows) await this.complete(client, row, context.gameTimeMs);
    const waiting = await client.query<InstructionRow>(
      `SELECT * FROM building_instructions WHERE product_scope = $1 AND state = 'waiting'
       ORDER BY kingdom_id, builder_slot FOR UPDATE`,
      [this.productScope],
    );
    for (const row of waiting.rows) await this.tryStart(client, row.id, context.gameTimeMs);
  }

  private async complete(client: PoolClient, row: InstructionRow, gameTimeMs: number): Promise<void> {
    if (!row.iron_cost_id || !row.silver_cost_id) throw new Error("BUILDING_COST_MISSING");
    const level = await client.query(
      `UPDATE kingdom_buildings SET level = $4 WHERE product_scope = $1 AND kingdom_id = $2
       AND kind = $3 AND level = $5`,
      [this.productScope, row.kingdom_id, row.building_kind, row.target_level, row.target_level - 1],
    );
    if (level.rowCount !== 1) throw new Error("BUILDING_LEVEL_CONFLICT");
    await this.ledger.completeCost(client, row.kingdom_id, row.iron_cost_id, gameTimeMs);
    await this.ledger.completeCost(client, row.kingdom_id, row.silver_cost_id, gameTimeMs);
    await this.reconfigureEconomy(client, row, gameTimeMs);
    await client.query(
      "UPDATE building_instructions SET state = 'completed', settled_game_time_ms = $2 WHERE id = $1",
      [row.id, gameTimeMs],
    );
    await this.emit(client, "building.completed.v1", row.id, row.kingdom_id, gameTimeMs);
  }

  private async tryStart(client: PoolClient, instructionId: string, gameTimeMs: number): Promise<boolean> {
    const row = await this.instruction(client, instructionId, true);
    if (row?.state !== "waiting") return false;
    const active = await client.query(
      `SELECT 1 FROM building_instructions WHERE product_scope = $1 AND kingdom_id = $2
       AND builder_slot = $3 AND state = 'active'`,
      [this.productScope, row.kingdom_id, row.builder_slot],
    );
    if (active.rowCount) return false;
    const levels = await this.levels(client, row.kingdom_id);
    if (checkUpgrade(levels, row.building_kind, row.target_level) !== "ready") return false;
    const quote = upgradeQuote(row.building_kind, row.target_level, gameTimeMs);
    const iron = await this.ledger.readBalance(client, row.kingdom_id, "iron");
    const silver = await this.ledger.readBalance(client, row.kingdom_id, "silver");
    if (iron.ordinary + iron.allowance < quote.iron || silver.ordinary + silver.allowance < quote.silver) {
      return false;
    }
    const ordinaryIron = quote.iron > iron.allowance ? quote.iron - iron.allowance : 0n;
    const ordinarySilver = quote.silver > silver.allowance ? quote.silver - silver.allowance : 0n;
    if (
      !(await this.authority.recheckAndStart(client, {
        accountId: row.account_id,
        kingdomId: row.kingdom_id,
        instructionId: row.id,
        actor: row.actor_kind,
        authorityRef: row.authority_ref,
        mandateVersion: row.mandate_version,
        ordinaryIron,
        ordinarySilver,
      }))
    )
      return false;
    const ironCost = await this.ledger.payCost(client, {
      kingdomId: row.kingdom_id,
      resource: "iron",
      kind: "construction",
      amount: quote.iron,
      operationKey: row.id,
      gameTimeMs,
    });
    const silverCost = await this.ledger.payCost(client, {
      kingdomId: row.kingdom_id,
      resource: "silver",
      kind: "construction",
      amount: quote.silver,
      operationKey: row.id,
      gameTimeMs,
    });
    await client.query(
      `UPDATE building_instructions SET state = 'active', started_game_time_ms = $2,
       due_game_time_ms = $3, iron_cost_id = $4, silver_cost_id = $5 WHERE id = $1`,
      [row.id, gameTimeMs, quote.dueGameTimeMs, ironCost.id, silverCost.id],
    );
    await this.emit(client, "building.started.v1", row.id, row.kingdom_id, gameTimeMs);
    return true;
  }

  private async reconfigureEconomy(client: PoolClient, row: InstructionRow, gameTimeMs: number): Promise<void> {
    if (!["farm", "mine", "market", "storehouse"].includes(row.building_kind)) return;
    const levels = await this.levels(client, row.kingdom_id);
    const storehouse = rulesCatalog.levels[levels.storehouse - 1];
    if (!storehouse) throw new Error("INVALID_STOREHOUSE_LEVEL");
    for (const resource of ["iron", "silver", "grain"] as const) {
      const source = resource === "iron" ? "mine" : resource === "silver" ? "market" : "farm";
      const sourceLevel = rulesCatalog.levels[levels[source] - 1];
      if (!sourceLevel) throw new Error("INVALID_PRODUCTION_LEVEL");
      const hourly =
        resource === "iron"
          ? sourceLevel.ironPerHour
          : resource === "silver"
            ? sourceLevel.silverPerHour
            : sourceLevel.grainPerHour;
      await this.ledger.configureEconomy(client, {
        kingdomId: row.kingdom_id,
        resource,
        storageCapUnits: wholeResources(storehouse.storagePerResource),
        productionPerMinuteUnits: hourlyRatePerMinute(hourly),
        operationKey: `building:${row.id}:${resource}`,
        gameTimeMs,
      });
      // The production phase follows this completion in the same world tick.
    }
  }

  private async assertOwner(client: PoolClient, accountId: string, kingdomId: string): Promise<void> {
    const result = await client.query(
      `SELECT 1 FROM kingdoms WHERE product_scope = $1 AND id = $2 AND account_id = $3
       AND status = 'ranked' FOR UPDATE`,
      [this.productScope, kingdomId, accountId],
    );
    if (!result.rowCount) throw new BuildingError("NOT_OWNER");
  }

  private async levels(client: PoolClient, kingdomId: string): Promise<BuildingLevels> {
    const result = await client.query<{ kind: BuildingKind; level: number }>(
      "SELECT kind, level FROM kingdom_buildings WHERE product_scope = $1 AND kingdom_id = $2",
      [this.productScope, kingdomId],
    );
    if (result.rows.length !== 7) throw new Error("BUILDING_STATE_INCOMPLETE");
    return Object.fromEntries(result.rows.map((row) => [row.kind, row.level])) as unknown as BuildingLevels;
  }

  private async instruction(client: PoolClient, id: string, lock = false): Promise<InstructionRow | null> {
    const result = await client.query<InstructionRow>(
      `SELECT * FROM building_instructions WHERE product_scope = $1 AND id = $2${lock ? " FOR UPDATE" : ""}`,
      [this.productScope, id],
    );
    return result.rows[0] ?? null;
  }

  private async emit(client: PoolClient, type: string, instructionId: string, kingdomId: string, gameTimeMs: number) {
    await appendOutbox(client, {
      productScope: this.productScope,
      eventId: randomUUID(),
      type,
      payload: { instructionId, kingdomId, gameTimeMs: String(gameTimeMs) },
    });
  }
}
