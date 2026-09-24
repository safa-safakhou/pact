import { randomUUID } from "node:crypto";
import type { ExposureService } from "@pact/authority";
import { appendOutbox } from "@pact/db";
import { rulesCatalog, wholeResources } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import { timedJobDeadline } from "@pact/world";
import type { PoolClient } from "pg";
import type { ActionLimitService } from "./action-limits.js";
import type { TroopService } from "./troops.js";

export type ScoutTroopBand = "0" | "1-10" | "11-25" | "26-50" | "51-100" | "101-200" | "201-400" | "over 400";
export type ScoutResourceBand = "0" | "less than 1" | "1-100" | "101-500" | "501-1500" | "1501-5000" | "over 5000";

export interface ScoutReport {
  readonly kind: "engine_report";
  readonly operationId: string;
  readonly scoutKingdomId: string;
  readonly targetKingdomId: string;
  readonly observedGameTimeMs: number;
  readonly staleAfterObservation: true;
  readonly wallLevel: number;
  readonly homeTroops: Readonly<Record<string, ScoutTroopBand>>;
  readonly ordinaryStock: Readonly<Record<"iron" | "silver" | "grain", ScoutResourceBand>>;
}

interface ScoutRow {
  id: string;
  scout_kingdom_id: string;
  target_kingdom_id: string;
  operation_key: string;
  status: "active" | "completed";
  due_game_time_ms: string;
  authority_ref: string | null;
  report: ScoutReport | null;
}

export class ScoutError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ScoutError";
  }
}

export function troopBand(count: number): ScoutTroopBand {
  if (!Number.isSafeInteger(count) || count < 0) throw new ScoutError("INVALID_COUNT");
  if (count === 0) return "0";
  const bounds = rulesCatalog.scouting.troopBandUpperBounds;
  const names = ["1-10", "11-25", "26-50", "51-100", "101-200", "201-400"] as const;
  for (const [index, upper] of bounds.entries()) {
    const name = names[index - 1];
    if (name && count <= upper) return name;
  }
  return "over 400";
}

export function resourceBand(units: bigint): ScoutResourceBand {
  if (units < 0n) throw new ScoutError("INVALID_STOCK");
  if (units === 0n) return "0";
  if (units < wholeResources(1)) return "less than 1";
  const bounds = rulesCatalog.scouting.resourceBandUpperBounds;
  const names = ["1-100", "101-500", "501-1500", "1501-5000"] as const;
  for (const [index, upper] of bounds.entries()) {
    const name = names[index - 1];
    if (name && units <= wholeResources(upper)) return name;
  }
  return "over 5000";
}

/** Private timed observation; all methods use the caller's game transaction. */
export class ScoutService {
  constructor(
    private readonly productScope: string,
    private readonly ledger: ResourceLedger,
    private readonly troops: TroopService,
    private readonly limits: ActionLimitService,
    private readonly exposure: ExposureService,
  ) {}

  async start(
    client: PoolClient,
    input: {
      accountId: string;
      operationId: string;
      operationKey: string;
      targetKingdomId: string;
      actorKind: "human" | "agent";
      gameTimeMs: number;
      explicitUnitIds?: string[];
    },
  ): Promise<{ operationId: string; dueGameTimeMs: number }> {
    const owner = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked' FOR UPDATE",
      [this.productScope, input.accountId],
    );
    const scoutKingdomId = owner.rows[0]?.id;
    if (!scoutKingdomId) throw new ScoutError("NOT_OWNER");
    const existing = await client.query<ScoutRow>(
      "SELECT * FROM scout_operations WHERE product_scope = $1 AND scout_kingdom_id = $2 AND operation_key = $3",
      [this.productScope, scoutKingdomId, input.operationKey],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (row.id !== input.operationId || row.target_kingdom_id !== input.targetKingdomId)
        throw new ScoutError("OPERATION_CONFLICT");
      return { operationId: row.id, dueGameTimeMs: Number(row.due_game_time_ms) };
    }
    if (scoutKingdomId === input.targetKingdomId) throw new ScoutError("SELF_TARGET");
    const target = await client.query(
      "SELECT 1 FROM kingdoms WHERE product_scope = $1 AND id = $2 AND status = 'ranked'",
      [this.productScope, input.targetKingdomId],
    );
    if (!target.rowCount) throw new ScoutError("TARGET_NOT_FOUND");
    const silver = wholeResources(rulesCatalog.scouting.silverCost);
    const grain = wholeResources(rulesCatalog.scouting.grainCost);
    const authorityRef =
      input.actorKind === "agent"
        ? await this.exposure.reserve(client, {
            accountId: input.accountId,
            operationKey: `scout:${input.operationId}`,
            action: "scout.start",
            actor: "agent",
            assets: { silver, grain },
            troopCount: rulesCatalog.scouting.ordinarySpearmen,
            gameTimeMs: input.gameTimeMs,
          })
        : null;
    await this.troops.assign(client, {
      accountId: input.accountId,
      ownerKingdomId: scoutKingdomId,
      hostKingdomId: scoutKingdomId,
      placement: "scouting",
      referenceId: input.operationId,
      type: "spearman",
      count: rulesCatalog.scouting.ordinarySpearmen,
      gameTimeMs: input.gameTimeMs,
      ...(input.explicitUnitIds ? { explicitIds: input.explicitUnitIds } : {}),
    });
    await this.limits.spendCharge(client, {
      kingdomId: scoutKingdomId,
      kind: "scout",
      operationKey: input.operationKey,
      gameTimeMs: input.gameTimeMs,
    });
    await this.ledger.debit(client, {
      kingdomId: scoutKingdomId,
      resource: "silver",
      amount: silver,
      purpose: "scout",
      operationKey: `scout:${input.operationId}:silver`,
      gameTimeMs: input.gameTimeMs,
    });
    await this.ledger.debit(client, {
      kingdomId: scoutKingdomId,
      resource: "grain",
      amount: grain,
      purpose: "scout",
      operationKey: `scout:${input.operationId}:grain`,
      gameTimeMs: input.gameTimeMs,
    });
    if (authorityRef) {
      await this.exposure.activate(client, authorityRef, input.operationId);
      for (const [asset, units] of [
        ["silver", silver],
        ["grain", grain],
      ] as const)
        await this.exposure.consume(client, {
          ref: authorityRef,
          asset,
          units,
          operationKey: `scout:${input.operationId}:${asset}:authority`,
          gameTimeMs: input.gameTimeMs,
        });
    }
    const dueGameTimeMs = timedJobDeadline(input.gameTimeMs, rulesCatalog.scouting.durationMinutes);
    await client.query(
      `INSERT INTO scout_operations(id, product_scope, scout_kingdom_id, target_kingdom_id,
         operation_key, status, started_game_time_ms, due_game_time_ms, authority_ref)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8)`,
      [
        input.operationId,
        this.productScope,
        scoutKingdomId,
        input.targetKingdomId,
        input.operationKey,
        input.gameTimeMs,
        dueGameTimeMs,
        authorityRef,
      ],
    );
    await this.emit(client, "scout.started.v1", {
      operationId: input.operationId,
      scoutKingdomId,
      targetKingdomId: input.targetKingdomId,
      gameTimeMs: input.gameTimeMs,
    });
    await this.emit(client, "scout.target.noticed.v1", {
      operationId: input.operationId,
      scoutKingdomId,
      targetKingdomId: input.targetKingdomId,
      gameTimeMs: input.gameTimeMs,
    });
    return { operationId: input.operationId, dueGameTimeMs };
  }

  /** Call after battle resolution in the battle_and_scouts phase. */
  async finishDue(client: PoolClient, gameTimeMs: number): Promise<number> {
    const due = await client.query<ScoutRow>(
      `SELECT * FROM scout_operations WHERE product_scope = $1 AND status = 'active'
       AND due_game_time_ms <= $2 ORDER BY due_game_time_ms, id FOR UPDATE`,
      [this.productScope, gameTimeMs],
    );
    for (const row of due.rows) {
      const report = await this.sample(client, row, gameTimeMs);
      await this.troops.returnPlacement(client, {
        ownerKingdomId: row.scout_kingdom_id,
        placement: "scouting",
        referenceId: row.id,
        gameTimeMs,
      });
      if (row.authority_ref) await this.exposure.release(client, row.authority_ref, gameTimeMs);
      await client.query(
        `UPDATE scout_operations SET status = 'completed', report = $3::jsonb,
         completed_game_time_ms = $4, completed_at = clock_timestamp()
         WHERE product_scope = $1 AND id = $2`,
        [this.productScope, row.id, JSON.stringify(report), gameTimeMs],
      );
      await this.emit(client, "scout.completed.v1", {
        operationId: row.id,
        scoutKingdomId: row.scout_kingdom_id,
        targetKingdomId: row.target_kingdom_id,
        gameTimeMs,
      });
    }
    return due.rows.length;
  }

  async readReport(client: PoolClient, accountId: string, operationId: string): Promise<ScoutReport> {
    const found = await client.query<{ report: ScoutReport | null }>(
      `SELECT o.report FROM scout_operations o JOIN kingdoms k ON k.product_scope = o.product_scope
       WHERE o.product_scope = $1 AND o.id = $2 AND o.status = 'completed'
         AND k.account_id = $3 AND (k.id = o.scout_kingdom_id OR EXISTS (
           SELECT 1 FROM scout_report_shares s WHERE s.product_scope = o.product_scope
             AND s.operation_id = o.id AND s.recipient_kingdom_id = k.id))`,
      [this.productScope, operationId, accountId],
    );
    if (!found.rows[0]?.report) throw new ScoutError("REPORT_NOT_FOUND");
    return found.rows[0].report;
  }

  async shareReport(
    client: PoolClient,
    input: { accountId: string; operationId: string; recipientKingdomId: string; gameTimeMs: number },
  ): Promise<void> {
    const owner = await client.query<{ id: string }>(
      `SELECT o.id FROM scout_operations o JOIN kingdoms k ON k.product_scope = o.product_scope
       AND k.id = o.scout_kingdom_id WHERE o.product_scope = $1 AND o.id = $2
       AND o.status = 'completed' AND k.account_id = $3`,
      [this.productScope, input.operationId, input.accountId],
    );
    if (!owner.rowCount) throw new ScoutError("REPORT_NOT_FOUND");
    const recipient = await client.query(
      "SELECT 1 FROM kingdoms WHERE product_scope = $1 AND id = $2 AND status = 'ranked'",
      [this.productScope, input.recipientKingdomId],
    );
    if (!recipient.rowCount) throw new ScoutError("TARGET_NOT_FOUND");
    const shared = await client.query(
      `INSERT INTO scout_report_shares(product_scope, operation_id, recipient_kingdom_id, shared_game_time_ms)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [this.productScope, input.operationId, input.recipientKingdomId, input.gameTimeMs],
    );
    if (shared.rowCount)
      await this.emit(client, "scout.report.shared.v1", {
        operationId: input.operationId,
        recipientKingdomId: input.recipientKingdomId,
        gameTimeMs: input.gameTimeMs,
      });
  }

  private async sample(client: PoolClient, row: ScoutRow, gameTimeMs: number): Promise<ScoutReport> {
    const troops = await client.query<{ type: string; count: number }>(
      `SELECT type, count(*)::int AS count FROM kingdom_troops
       WHERE product_scope = $1 AND host_kingdom_id = $2 AND placement IN ('home', 'visiting')
       GROUP BY type`,
      [this.productScope, row.target_kingdom_id],
    );
    const homeTroops = Object.fromEntries(Object.keys(rulesCatalog.units).map((type) => [type, troopBand(0)]));
    for (const item of troops.rows) homeTroops[item.type] = troopBand(item.count);
    const wall = await client.query<{ level: number }>(
      "SELECT level FROM kingdom_buildings WHERE product_scope = $1 AND kingdom_id = $2 AND kind = 'wall'",
      [this.productScope, row.target_kingdom_id],
    );
    const balances = await client.query<{ resource: "iron" | "silver" | "grain"; ordinary_units: string }>(
      "SELECT resource, ordinary_units FROM resource_balances WHERE product_scope = $1 AND kingdom_id = $2",
      [this.productScope, row.target_kingdom_id],
    );
    const ordinaryStock = { iron: resourceBand(0n), silver: resourceBand(0n), grain: resourceBand(0n) };
    for (const balance of balances.rows) ordinaryStock[balance.resource] = resourceBand(BigInt(balance.ordinary_units));
    return {
      kind: "engine_report",
      operationId: row.id,
      scoutKingdomId: row.scout_kingdom_id,
      targetKingdomId: row.target_kingdom_id,
      observedGameTimeMs: gameTimeMs,
      staleAfterObservation: true,
      wallLevel: wall.rows[0]?.level ?? 0,
      homeTroops,
      ordinaryStock,
    };
  }

  private async emit(client: PoolClient, type: string, payload: Record<string, unknown>): Promise<void> {
    await appendOutbox(client, { productScope: this.productScope, eventId: randomUUID(), type, payload });
  }
}
