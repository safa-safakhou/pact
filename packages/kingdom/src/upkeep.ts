import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import { desertingTroopIds, foodPayer, rulesCatalog, type UpkeepTroop, upkeepPerMinute } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import type { TickContext } from "@pact/world";
import type { PoolClient } from "pg";

interface TroopRow {
  id: string;
  owner_kingdom_id: string;
  host_kingdom_id: string;
  placement: UpkeepTroop["placement"];
  placement_ref: string | null;
  type: UpkeepTroop["type"];
}

interface StateRow {
  hungry: boolean;
  underfunded_minutes: number;
  funded_recovery_minutes: number;
  last_game_time_ms: string;
}

export interface UpkeepState {
  hungry: boolean;
  underfundedMinutes: number;
  fundedRecoveryMinutes: number;
  lastGameTimeMs: number;
}

export interface VisitingUpkeepAuthorityPort {
  consume(client: PoolClient, detachmentRef: string, units: bigint, gameTimeMs: number): Promise<void>;
}

function asTroop(row: TroopRow): UpkeepTroop {
  return {
    id: row.id,
    ownerKingdomId: row.owner_kingdom_id,
    hostKingdomId: row.host_kingdom_id,
    placement: row.placement,
    type: row.type,
  };
}

/** Transaction-bound upkeep; called only after production and before combat. */
export class UpkeepService {
  constructor(
    private readonly productScope: string,
    private readonly ledger: ResourceLedger,
    private readonly visitingAuthority?: VisitingUpkeepAuthorityPort,
  ) {}

  async state(client: PoolClient, payerKingdomId: string): Promise<UpkeepState | null> {
    const result = await client.query<StateRow>(
      "SELECT * FROM kingdom_upkeep_state WHERE product_scope = $1 AND payer_kingdom_id = $2",
      [this.productScope, payerKingdomId],
    );
    const row = result.rows[0];
    return row
      ? {
          hungry: row.hungry,
          underfundedMinutes: row.underfunded_minutes,
          fundedRecoveryMinutes: row.funded_recovery_minutes,
          lastGameTimeMs: Number(row.last_game_time_ms),
        }
      : null;
  }

  async settleMinute(client: PoolClient, context: TickContext): Promise<void> {
    if (context.productScope !== this.productScope) throw new Error("UPKEEP_SCOPE_MISMATCH");
    const payers = await client.query<{ id: string }>(
      `SELECT id FROM kingdoms WHERE product_scope = $1 AND status = 'ranked'
       AND first_tick_game_time_ms <= $2 ORDER BY id FOR UPDATE`,
      [this.productScope, context.gameTimeMs],
    );
    const living = await client.query<TroopRow>(
      `SELECT id, owner_kingdom_id, host_kingdom_id, placement, placement_ref, type
       FROM kingdom_troops WHERE product_scope = $1 ORDER BY id FOR UPDATE`,
      [this.productScope],
    );
    const fedByPayer = new Map<string, TroopRow[]>();
    for (const row of living.rows) {
      const payer = foodPayer(asTroop(row));
      const fed = fedByPayer.get(payer) ?? [];
      fed.push(row);
      fedByPayer.set(payer, fed);
    }
    for (const payer of payers.rows) {
      await this.settlePayer(client, context, payer.id, fedByPayer.get(payer.id) ?? []);
    }
  }

  private async settlePayer(
    client: PoolClient,
    context: TickContext,
    payerKingdomId: string,
    rows: TroopRow[],
  ): Promise<void> {
    await client.query(
      `INSERT INTO kingdom_upkeep_state(product_scope, payer_kingdom_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [this.productScope, payerKingdomId],
    );
    const locked = await client.query<StateRow>(
      `SELECT * FROM kingdom_upkeep_state WHERE product_scope = $1 AND payer_kingdom_id = $2 FOR UPDATE`,
      [this.productScope, payerKingdomId],
    );
    const previous = locked.rows[0];
    if (!previous) throw new Error("UPKEEP_STATE_MISSING");
    const last = Number(previous.last_game_time_ms);
    if (last >= context.gameTimeMs) return; // Transactional replay cannot spend twice.
    const owned = rows.filter((row) => row.placement !== "visiting");
    const visitors = rows.filter((row) => row.placement === "visiting" && row.placement_ref !== null);
    const ownedRequired = upkeepPerMinute(owned.map(asTroop));
    let fullyFunded =
      ownedRequired === 0n ||
      (
        await this.ledger.debit(client, {
          kingdomId: payerKingdomId,
          resource: "grain",
          amount: ownedRequired,
          purpose: "upkeep",
          operationKey: `upkeep:${payerKingdomId}:${context.gameTimeMs}`,
          gameTimeMs: context.gameTimeMs,
        })
      ).fullyFunded;
    const byDetachment = new Map<string, TroopRow[]>();
    const underfundedDetachments = new Set<string>();
    for (const visitor of visitors) {
      const key = visitor.placement_ref as string;
      const group = byDetachment.get(key) ?? [];
      group.push(visitor);
      byDetachment.set(key, group);
    }
    for (const [detachmentRef, group] of [...byDetachment].sort(([left], [right]) => left.localeCompare(right))) {
      const required = upkeepPerMinute(group.map(asTroop));
      if (required === 0n) continue;
      const debit = await this.ledger.debit(client, {
        kingdomId: payerKingdomId,
        resource: "grain",
        amount: required,
        purpose: "visiting_upkeep",
        operationKey: `visiting-upkeep:${payerKingdomId}:${detachmentRef}:${context.gameTimeMs}`,
        gameTimeMs: context.gameTimeMs,
      });
      if (debit.movement.ordinaryDelta < 0n) {
        await this.visitingAuthority?.consume(client, detachmentRef, -debit.movement.ordinaryDelta, context.gameTimeMs);
      }
      fullyFunded = fullyFunded && debit.fullyFunded;
      if (!debit.fullyFunded) underfundedDetachments.add(detachmentRef);
    }
    await client.query(
      `INSERT INTO achievement_upkeep_checks(product_scope, kingdom_id, game_time_ms, fully_funded)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [this.productScope, payerKingdomId, context.gameTimeMs, fullyFunded],
    );
    let hungry = previous.hungry;
    let underfunded = previous.underfunded_minutes;
    let recovery = previous.funded_recovery_minutes;
    if (fullyFunded) {
      underfunded = 0;
      if (hungry && ++recovery >= rulesCatalog.upkeep.recoveryFundedMinutes) {
        hungry = false;
        recovery = 0;
        await this.emit(client, "upkeep.recovered.v1", { payerKingdomId, gameTimeMs: context.gameTimeMs });
      }
    } else {
      hungry = true;
      recovery = 0;
      underfunded += 1;
      if (!previous.hungry) {
        await this.emit(client, "upkeep.hungry.v1", { payerKingdomId, gameTimeMs: context.gameTimeMs });
      }
      const newDefaults: string[] = [];
      for (const visitor of visitors) {
        if (!underfundedDetachments.has(visitor.placement_ref as string)) continue;
        const inserted = await client.query(
          `INSERT INTO garrison_upkeep_defaults(product_scope, detachment_ref, host_kingdom_id,
             owner_kingdom_id, first_underfunded_game_time_ms)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING detachment_ref`,
          [this.productScope, visitor.placement_ref, payerKingdomId, visitor.owner_kingdom_id, context.gameTimeMs],
        );
        if (inserted.rowCount) newDefaults.push(visitor.placement_ref as string);
      }
      if (newDefaults.length > 0) {
        await this.emit(client, "garrison.host_underfunded.v1", {
          hostKingdomId: payerKingdomId,
          gameTimeMs: context.gameTimeMs,
          detachments: newDefaults.sort(),
        });
      }
      if (underfunded === rulesCatalog.upkeep.warningUnderfundedMinutes) {
        await this.emit(client, "upkeep.warning.v1", { payerKingdomId, gameTimeMs: context.gameTimeMs });
      }
      if (
        underfunded >= rulesCatalog.upkeep.firstDesertionUnderfundedMinutes &&
        (underfunded - rulesCatalog.upkeep.firstDesertionUnderfundedMinutes) %
          rulesCatalog.upkeep.desertionIntervalMinutes ===
          0
      ) {
        const byOwner = new Map<string, TroopRow[]>();
        for (const row of rows) {
          const ownerRows = byOwner.get(row.owner_kingdom_id) ?? [];
          ownerRows.push(row);
          byOwner.set(row.owner_kingdom_id, ownerRows);
        }
        for (const [ownerKingdomId, ownerRows] of [...byOwner].sort(([left], [right]) => left.localeCompare(right))) {
          const ids = desertingTroopIds(ownerRows.map(asTroop));
          if (ids.length === 0) continue;
          // Starvation is not a player disband: active battle locks provide no immunity.
          await client.query("DELETE FROM kingdom_troops WHERE product_scope = $1 AND id = ANY($2::uuid[])", [
            this.productScope,
            ids,
          ]);
          await this.emit(client, "upkeep.desertion.v1", {
            payerKingdomId,
            ownerKingdomId,
            troopIds: ids,
            gameTimeMs: context.gameTimeMs,
          });
        }
      }
    }
    await client.query(
      `UPDATE kingdom_upkeep_state SET hungry = $3, underfunded_minutes = $4,
         funded_recovery_minutes = $5, last_game_time_ms = $6
       WHERE product_scope = $1 AND payer_kingdom_id = $2`,
      [this.productScope, payerKingdomId, hungry, underfunded, recovery, context.gameTimeMs],
    );
  }

  private async emit(client: PoolClient, type: string, payload: Record<string, unknown>): Promise<void> {
    await appendOutbox(client, { productScope: this.productScope, eventId: randomUUID(), type, payload });
  }
}
