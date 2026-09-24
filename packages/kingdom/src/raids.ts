import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { ExposureService } from "@pact/authority";
import { appendOutbox } from "@pact/db";
import { type CombatUnit, calculateCombat, type LootResource, rulesCatalog, wholeResources } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import { timedJobDeadline } from "@pact/world";
import type { PoolClient } from "pg";
import type { ActionLimitService } from "./action-limits.js";
import type { GarrisonService } from "./garrison.js";
import type { RaidRandomnessService } from "./raid-randomness.js";
import type { TroopKind, TroopService } from "./troops.js";

export interface RaidSelection {
  type: TroopKind;
  count: number;
  explicitIds?: string[];
}

interface RaidRow {
  id: string;
  leader_kingdom_id: string;
  target_kingdom_id: string;
  rules_version: string;
  declaration_sequence: string;
  declared_game_time_ms: string;
  lock_game_time_ms: string;
  resolution_game_time_ms: string;
  status: "declared" | "locked" | "resolved" | "canceled";
  loot_priority: LootResource[];
  declaration_terms: { selection: RaidSelection[]; nominees: string[] };
  locked_wall_level: number | null;
  participant_report: Record<string, unknown> | null;
  public_report: Record<string, unknown> | null;
}

interface ContributionRow {
  kingdom_id: string;
  role: "leader" | "contributor";
  status: "committed" | "withdrawn";
  authority_ref: string | null;
  selection: RaidSelection[];
}

interface UnitRow {
  id: string;
  owner_kingdom_id: string;
  host_kingdom_id: string;
  home_guard: boolean;
  type: TroopKind;
  side: "attacker" | "defender";
}

export class RaidError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "RaidError";
  }
}

function selection(input: readonly RaidSelection[]): RaidSelection[] {
  if (input.length < 1 || input.length > 4) throw new RaidError("INVALID_SELECTION");
  const seen = new Set<string>();
  let total = 0;
  const result = input
    .map((item) => {
      if (
        !Object.hasOwn(rulesCatalog.units, item.type) ||
        !Number.isSafeInteger(item.count) ||
        item.count < 1 ||
        seen.has(item.type)
      )
        throw new RaidError("INVALID_SELECTION");
      if (item.explicitIds && (item.explicitIds.length !== item.count || new Set(item.explicitIds).size !== item.count))
        throw new RaidError("INVALID_SELECTION");
      seen.add(item.type);
      total += item.count;
      return {
        type: item.type,
        count: item.count,
        ...(item.explicitIds ? { explicitIds: [...item.explicitIds].sort() } : {}),
      };
    })
    .sort((left, right) => left.type.localeCompare(right.type));
  if (total < rulesCatalog.raid.minimumOrdinaryUnits) throw new RaidError("TOO_FEW_TROOPS");
  return result;
}

function provisionCost(units: readonly RaidSelection[]): bigint {
  const hourly = units.reduce((sum, item) => sum + item.count * rulesCatalog.units[item.type].grainPerHour, 0);
  if (!Number.isSafeInteger(hourly)) throw new RaidError("INVALID_SELECTION");
  return wholeResources(rulesCatalog.raid.baseGrainProvisions + rulesCatalog.raid.upkeepProvisionHours * hourly);
}

function priority(input: readonly LootResource[]): [LootResource, LootResource, LootResource] {
  if (
    input.length !== 3 ||
    new Set(input).size !== 3 ||
    ["silver", "iron", "grain"].some((item) => !input.includes(item as LootResource))
  )
    throw new RaidError("INVALID_LOOT_PRIORITY");
  return [input[0] as LootResource, input[1] as LootResource, input[2] as LootResource];
}

function safeReport(value: unknown): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(value, (_key, child: unknown) => (typeof child === "bigint" ? child.toString() : child)),
  ) as Record<string, unknown>;
}

/** Transaction-bound raid state machine. The worker owns lock/resolution calls, not player clients. */
export class RaidService {
  constructor(
    private readonly productScope: string,
    private readonly ledger: ResourceLedger,
    private readonly troops: TroopService,
    private readonly limits: ActionLimitService,
    private readonly exposure: ExposureService,
    private readonly randomness: RaidRandomnessService,
    private readonly garrison: GarrisonService,
  ) {}

  async declare(
    client: PoolClient,
    input: {
      accountId: string;
      raidId: string;
      targetKingdomId: string;
      units: readonly RaidSelection[];
      lootPriority?: readonly LootResource[];
      nominees?: readonly string[];
      actorKind: "human" | "agent";
      gameTimeMs: number;
    },
  ): Promise<{ raidId: string; commitment: string; lockGameTimeMs: number; resolutionGameTimeMs: number }> {
    if (input.actorKind !== "human" && input.actorKind !== "agent") throw new RaidError("INVALID_ACTOR");
    const selected = selection(input.units);
    const nominated = [...(input.nominees ?? [])];
    if (nominated.length > 2 || new Set(nominated).size !== nominated.length) throw new RaidError("INVALID_NOMINEES");
    const lootPriority = priority(input.lootPriority ?? rulesCatalog.raid.defaultLootPriority);
    const leader = await this.owned(client, input.accountId);
    const existing = await client.query<RaidRow>("SELECT * FROM raids WHERE product_scope = $1 AND id = $2", [
      this.productScope,
      input.raidId,
    ]);
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (
        row.leader_kingdom_id !== leader ||
        row.target_kingdom_id !== input.targetKingdomId ||
        !isDeepStrictEqual(row.loot_priority, lootPriority) ||
        !isDeepStrictEqual(row.declaration_terms, { selection: selected, nominees: nominated })
      )
        throw new RaidError("DECLARATION_CONFLICT");
      const evidence = await this.randomness.publicEvidence(client, row.id);
      return {
        raidId: row.id,
        commitment: evidence.commitment,
        lockGameTimeMs: Number(row.lock_game_time_ms),
        resolutionGameTimeMs: Number(row.resolution_game_time_ms),
      };
    }
    if (leader === input.targetKingdomId || nominated.includes(leader) || nominated.includes(input.targetKingdomId))
      throw new RaidError("INVALID_TARGET");
    const others = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND id = ANY($2::uuid[]) AND status = 'ranked'",
      [this.productScope, [input.targetKingdomId, ...nominated]],
    );
    if (others.rows.length !== 1 + nominated.length) throw new RaidError("INVALID_TARGET");
    await this.assertNoAttack(client, leader);
    const resolutionGameTimeMs = timedJobDeadline(input.gameTimeMs, rulesCatalog.raid.durationMinutes);
    const lockGameTimeMs = resolutionGameTimeMs - rulesCatalog.raid.lockBeforeDeadlineMinutes * 60_000;
    const seed = await this.randomness.declare(client, input.raidId, rulesCatalog.rulesId);
    await client.query(
      `INSERT INTO raids(id, product_scope, leader_kingdom_id, target_kingdom_id, rules_version,
         declared_game_time_ms, lock_game_time_ms, resolution_game_time_ms, status,
         loot_priority, declaration_terms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'declared',$9,$10::jsonb)`,
      [
        input.raidId,
        this.productScope,
        leader,
        input.targetKingdomId,
        rulesCatalog.rulesId,
        input.gameTimeMs,
        lockGameTimeMs,
        resolutionGameTimeMs,
        lootPriority,
        JSON.stringify({ selection: selected, nominees: nominated }),
      ],
    );
    await this.commitContribution(client, {
      accountId: input.accountId,
      kingdomId: leader,
      raidId: input.raidId,
      role: "leader",
      units: selected,
      actorKind: input.actorKind,
      gameTimeMs: input.gameTimeMs,
    });
    for (const [index, kingdomId] of nominated.entries())
      await client.query(
        `INSERT INTO raid_nominations(product_scope, raid_id, slot, kingdom_id, nominated_game_time_ms)
       VALUES ($1,$2,$3,$4,$5)`,
        [this.productScope, input.raidId, index + 1, kingdomId, input.gameTimeMs],
      );
    await this.emit(client, "raid.declared.v1", {
      raidId: input.raidId,
      leaderKingdomId: leader,
      targetKingdomId: input.targetKingdomId,
      commitment: seed.commitment,
      lockGameTimeMs,
      resolutionGameTimeMs,
    });
    await this.emit(client, "raid.target.noticed.v1", {
      raidId: input.raidId,
      leaderKingdomId: leader,
      targetKingdomId: input.targetKingdomId,
      gameTimeMs: input.gameTimeMs,
    });
    for (const kingdomId of nominated)
      await this.emit(client, "raid.contributor.nominated.v1", {
        raidId: input.raidId,
        kingdomId,
        gameTimeMs: input.gameTimeMs,
      });
    return { raidId: input.raidId, commitment: seed.commitment, lockGameTimeMs, resolutionGameTimeMs };
  }

  async nominate(
    client: PoolClient,
    input: { accountId: string; raidId: string; slot: 1 | 2; kingdomId: string; gameTimeMs: number },
  ): Promise<void> {
    const leader = await this.owned(client, input.accountId);
    const raid = await this.raid(client, input.raidId, true);
    if (raid.leader_kingdom_id !== leader) throw new RaidError("NOT_LEADER");
    this.beforeLock(raid, input.gameTimeMs);
    if (![1, 2].includes(input.slot) || [leader, raid.target_kingdom_id].includes(input.kingdomId))
      throw new RaidError("INVALID_NOMINEES");
    const other = await client.query(
      "SELECT 1 FROM kingdoms WHERE product_scope = $1 AND id = $2 AND status = 'ranked'",
      [this.productScope, input.kingdomId],
    );
    if (!other.rowCount) throw new RaidError("INVALID_NOMINEES");
    const current = await client.query<{ kingdom_id: string }>(
      "SELECT kingdom_id FROM raid_nominations WHERE product_scope = $1 AND raid_id = $2 AND slot = $3",
      [this.productScope, raid.id, input.slot],
    );
    if (current.rows[0]?.kingdom_id === input.kingdomId) return;
    if (current.rows[0]) {
      const committed = await this.contribution(client, raid.id, current.rows[0].kingdom_id);
      if (committed?.status === "committed") throw new RaidError("CONTRIBUTOR_COMMITTED");
    }
    await client.query("DELETE FROM raid_nominations WHERE product_scope = $1 AND raid_id = $2 AND slot = $3", [
      this.productScope,
      raid.id,
      input.slot,
    ]);
    await client.query(
      `INSERT INTO raid_nominations(product_scope, raid_id, slot, kingdom_id, nominated_game_time_ms)
       VALUES ($1,$2,$3,$4,$5)`,
      [this.productScope, raid.id, input.slot, input.kingdomId, input.gameTimeMs],
    );
    await this.emit(client, "raid.contributor.nominated.v1", {
      raidId: raid.id,
      kingdomId: input.kingdomId,
      slot: input.slot,
    });
  }

  async accept(
    client: PoolClient,
    input: {
      accountId: string;
      raidId: string;
      units: readonly RaidSelection[];
      actorKind: "human" | "agent";
      gameTimeMs: number;
    },
  ): Promise<void> {
    if (input.actorKind !== "human" && input.actorKind !== "agent") throw new RaidError("INVALID_ACTOR");
    const kingdomId = await this.owned(client, input.accountId);
    const raid = await this.raid(client, input.raidId, true);
    this.beforeLock(raid, input.gameTimeMs);
    if (kingdomId === raid.target_kingdom_id || kingdomId === raid.leader_kingdom_id)
      throw new RaidError("NOT_NOMINATED");
    const nomination = await client.query(
      "SELECT 1 FROM raid_nominations WHERE product_scope = $1 AND raid_id = $2 AND kingdom_id = $3",
      [this.productScope, raid.id, kingdomId],
    );
    if (!nomination.rowCount) throw new RaidError("NOT_NOMINATED");
    const selected = selection(input.units);
    const prior = await this.contribution(client, raid.id, kingdomId);
    if (prior) {
      if (prior.status !== "committed" || !isDeepStrictEqual(prior.selection, selected))
        throw new RaidError("CONTRIBUTION_CONFLICT");
      return;
    }
    await this.assertNoAttack(client, kingdomId);
    await this.commitContribution(client, {
      accountId: input.accountId,
      kingdomId,
      raidId: raid.id,
      role: "contributor",
      units: selected,
      actorKind: input.actorKind,
      gameTimeMs: input.gameTimeMs,
    });
    await this.emit(client, "raid.contributor.accepted.v1", { raidId: raid.id, kingdomId });
  }

  async withdraw(client: PoolClient, input: { accountId: string; raidId: string; gameTimeMs: number }): Promise<void> {
    const kingdomId = await this.owned(client, input.accountId);
    const raid = await this.raid(client, input.raidId, true);
    if (raid.status === "canceled" && raid.leader_kingdom_id === kingdomId) return;
    this.beforeLock(raid, input.gameTimeMs);
    const own = await this.contribution(client, raid.id, kingdomId);
    if (own?.status === "withdrawn") return;
    if (own?.status !== "committed") throw new RaidError("NOT_PARTICIPANT");
    if (own.role === "leader") {
      const all = await client.query<ContributionRow>(
        "SELECT * FROM raid_contributions WHERE product_scope = $1 AND raid_id = $2 AND status = 'committed' ORDER BY kingdom_id",
        [this.productScope, raid.id],
      );
      for (const item of all.rows) await this.releaseContribution(client, raid.id, item, input.gameTimeMs, true);
      const reveal = await this.randomness.reveal(client, {
        raidId: raid.id,
        purpose: "cancel",
        actorRef: "raid-worker",
      });
      await client.query(
        `UPDATE raids SET status = 'canceled', resolved_game_time_ms = $3, closed_at = clock_timestamp(),
         public_report = $4::jsonb WHERE product_scope = $1 AND id = $2`,
        [
          this.productScope,
          raid.id,
          input.gameTimeMs,
          JSON.stringify({
            raidId: raid.id,
            status: "canceled",
            leaderKingdomId: raid.leader_kingdom_id,
            targetKingdomId: raid.target_kingdom_id,
            gameTimeMs: input.gameTimeMs,
            commitment: reveal.commitment,
            seed: reveal.seed,
          }),
        ],
      );
      await this.emit(client, "raid.canceled.v1", { raidId: raid.id, gameTimeMs: input.gameTimeMs });
    } else {
      await this.releaseContribution(client, raid.id, own, input.gameTimeMs, true);
      await this.emit(client, "raid.contributor.withdrawn.v1", {
        raidId: raid.id,
        kingdomId,
        gameTimeMs: input.gameTimeMs,
      });
    }
  }

  async lockDue(client: PoolClient, gameTimeMs: number): Promise<number> {
    const due = await client.query<{ id: string }>(
      `SELECT id FROM raids WHERE product_scope = $1 AND status = 'declared' AND lock_game_time_ms <= $2
       ORDER BY lock_game_time_ms, declaration_sequence FOR UPDATE`,
      [this.productScope, gameTimeMs],
    );
    for (const item of due.rows) {
      const raid = await this.raid(client, item.id, true);
      const wall = await client.query<{ level: number }>(
        "SELECT level FROM kingdom_buildings WHERE product_scope = $1 AND kingdom_id = $2 AND kind = 'wall'",
        [this.productScope, raid.target_kingdom_id],
      );
      await this.troops.captureBattleEligibility(client, {
        battleId: raid.id,
        hostKingdomId: raid.target_kingdom_id,
        raidId: raid.id,
        lockUntilGameTimeMs: Number(raid.resolution_game_time_ms),
      });
      await client.query(
        "UPDATE raids SET status = 'locked', locked_wall_level = $3 WHERE product_scope = $1 AND id = $2",
        [this.productScope, raid.id, wall.rows[0]?.level ?? 0],
      );
      await this.emit(client, "raid.locked.v1", { raidId: raid.id, gameTimeMs });
    }
    return due.rows.length;
  }

  async resolveDue(client: PoolClient, gameTimeMs: number): Promise<number> {
    const due = await client.query<{ id: string }>(
      `SELECT id FROM raids WHERE product_scope = $1 AND status = 'locked' AND resolution_game_time_ms <= $2
       ORDER BY resolution_game_time_ms, declaration_sequence FOR UPDATE`,
      [this.productScope, gameTimeMs],
    );
    for (const item of due.rows) await this.resolveOne(client, await this.raid(client, item.id, true), gameTimeMs);
    if (due.rows.length) await this.garrison.settleMinute(client, gameTimeMs);
    return due.rows.length;
  }

  async readParticipantReport(client: PoolClient, accountId: string, raidId: string): Promise<Record<string, unknown>> {
    const found = await client.query<{ participant_report: Record<string, unknown> | null }>(
      `SELECT r.participant_report FROM raids r JOIN kingdoms k ON k.product_scope = r.product_scope
       WHERE r.product_scope = $1 AND r.id = $2 AND r.status = 'resolved' AND k.account_id = $3
         AND (k.id = r.target_kingdom_id OR EXISTS (
           SELECT 1 FROM raid_contributions c WHERE c.product_scope = r.product_scope
             AND c.raid_id = r.id AND c.kingdom_id = k.id AND c.status = 'committed'))`,
      [this.productScope, raidId, accountId],
    );
    if (!found.rows[0]?.participant_report) throw new RaidError("REPORT_NOT_FOUND");
    return found.rows[0].participant_report;
  }

  async readPublicReport(client: PoolClient, raidId: string): Promise<Record<string, unknown>> {
    const found = await client.query<{ public_report: Record<string, unknown> | null }>(
      "SELECT public_report FROM raids WHERE product_scope = $1 AND id = $2 AND status IN ('resolved', 'canceled')",
      [this.productScope, raidId],
    );
    if (!found.rows[0]?.public_report) throw new RaidError("REPORT_NOT_FOUND");
    return found.rows[0].public_report;
  }

  private async resolveOne(client: PoolClient, raid: RaidRow, gameTimeMs: number): Promise<void> {
    const living = await client.query<UnitRow>(
      `SELECT t.id, t.owner_kingdom_id, t.host_kingdom_id, t.home_guard, t.type, e.side
       FROM battle_unit_eligibility e JOIN kingdom_troops t ON t.id = e.troop_id AND t.product_scope = e.product_scope
       WHERE e.product_scope = $1 AND e.battle_id = $2 ORDER BY t.id FOR UPDATE OF t`,
      [this.productScope, raid.id],
    );
    const payers = [
      ...new Set(living.rows.map((unit) => (unit.side === "attacker" ? unit.owner_kingdom_id : unit.host_kingdom_id))),
    ];
    const hungryRows = await client.query<{ payer_kingdom_id: string }>(
      "SELECT payer_kingdom_id FROM kingdom_upkeep_state WHERE product_scope = $1 AND payer_kingdom_id = ANY($2::uuid[]) AND hungry = true",
      [this.productScope, payers],
    );
    const hungry = new Set(hungryRows.rows.map((row) => row.payer_kingdom_id));
    const units: CombatUnit[] = living.rows.map((unit) => ({
      id: unit.id,
      ownerId: unit.owner_kingdom_id,
      side: unit.side,
      type: unit.type,
      hungry: hungry.has(unit.side === "attacker" ? unit.owner_kingdom_id : unit.host_kingdom_id),
    }));
    const stock = { iron: 0n, silver: 0n, grain: 0n };
    const free = { iron: 0n, silver: 0n, grain: 0n };
    for (const resource of ["iron", "silver", "grain"] as const) {
      const target = await this.ledger.readBalance(client, raid.target_kingdom_id, resource);
      const leader = await this.ledger.readBalance(client, raid.leader_kingdom_id, resource);
      stock[resource] = target.ordinary;
      free[resource] = leader.storageCap - leader.ordinary;
    }
    const reveal = await this.randomness.reveal(client, {
      raidId: raid.id,
      purpose: "resolve",
      actorRef: "raid-worker",
    });
    const wallLevel = raid.locked_wall_level ?? 0;
    const wallPower = wallLevel > 0 ? (rulesCatalog.levels[wallLevel - 1]?.wallPower ?? 0) : 0;
    const result = calculateCombat({
      rulesVersion: rulesCatalog.rulesId,
      units,
      wallPower,
      attackerDie: reveal.attackerDie,
      defenderDie: reveal.defenderDie,
      ordinaryStock: stock,
      lootPriority: priority(raid.loot_priority),
      leaderFreeCapacity: free,
    });
    const casualties = result.casualtyGroups.flatMap((group) => group.lostUnitIds);
    if (casualties.length)
      await client.query("DELETE FROM kingdom_troops WHERE product_scope = $1 AND id = ANY($2::uuid[])", [
        this.productScope,
        casualties,
      ]);
    for (const resource of ["iron", "silver", "grain"] as const) {
      if (result.lootTaken[resource] === 0n) continue;
      await this.ledger.debit(client, {
        kingdomId: raid.target_kingdom_id,
        resource,
        amount: result.lootTaken[resource],
        purpose: "loot",
        operationKey: `raid:${raid.id}:loot:${resource}`,
        gameTimeMs,
      });
      await this.ledger.creditOrdinary(client, {
        kingdomId: raid.leader_kingdom_id,
        resource,
        amount: result.lootTaken[resource],
        operationKey: `raid:${raid.id}:credit:${resource}`,
        reason: "raid_loot",
        gameTimeMs,
      });
    }
    const all = await client.query<ContributionRow>(
      "SELECT * FROM raid_contributions WHERE product_scope = $1 AND raid_id = $2 AND status = 'committed' ORDER BY kingdom_id",
      [this.productScope, raid.id],
    );
    for (const item of all.rows) await this.releaseContribution(client, raid.id, item, gameTimeMs, false);
    const participantReport = safeReport({
      raidId: raid.id,
      status: "resolved",
      leaderKingdomId: raid.leader_kingdom_id,
      targetKingdomId: raid.target_kingdom_id,
      gameTimeMs,
      lockedWallLevel: wallLevel,
      eligibleUnitIds: living.rows.map((unit) => unit.id),
      eligibleOrdinaryUnitIds: living.rows.filter((unit) => !unit.home_guard).map((unit) => unit.id),
      eligibleUnits: units,
      hungryPayerKingdomIds: [...hungry].sort(),
      trace: result,
      commitment: reveal.commitment,
      seed: reveal.seed,
    });
    const publicReport = {
      raidId: raid.id,
      status: "resolved",
      leaderKingdomId: raid.leader_kingdom_id,
      targetKingdomId: raid.target_kingdom_id,
      participantKingdomIds: all.rows.map((item) => item.kingdom_id),
      gameTimeMs,
      winner: result.winner,
      commitment: reveal.commitment,
      seed: reveal.seed,
    };
    await client.query(
      `UPDATE raids SET status = 'resolved', resolved_game_time_ms = $3, closed_at = clock_timestamp(),
         participant_report = $4::jsonb, public_report = $5::jsonb WHERE product_scope = $1 AND id = $2`,
      [this.productScope, raid.id, gameTimeMs, JSON.stringify(participantReport), JSON.stringify(publicReport)],
    );
    await this.emit(client, "raid.resolved.v1", publicReport);
  }

  private async commitContribution(
    client: PoolClient,
    input: {
      accountId: string;
      kingdomId: string;
      raidId: string;
      role: "leader" | "contributor";
      units: RaidSelection[];
      actorKind: "human" | "agent";
      gameTimeMs: number;
    },
  ): Promise<void> {
    const grain = provisionCost(input.units);
    const count = input.units.reduce((sum, item) => sum + item.count, 0);
    const ref =
      input.actorKind === "agent"
        ? await this.exposure.reserve(client, {
            accountId: input.accountId,
            operationKey: `raid:${input.raidId}:${input.kingdomId}`,
            action: "raid.commit",
            actor: "agent",
            assets: { grain },
            troopCount: count,
            gameTimeMs: input.gameTimeMs,
          })
        : null;
    for (const unit of input.units)
      await this.troops.assign(client, {
        accountId: input.accountId,
        ownerKingdomId: input.kingdomId,
        hostKingdomId: input.kingdomId,
        placement: "attacking",
        referenceId: input.raidId,
        type: unit.type,
        count: unit.count,
        gameTimeMs: input.gameTimeMs,
        ...(unit.explicitIds ? { explicitIds: unit.explicitIds } : {}),
      });
    await this.limits.spendCharge(client, {
      kingdomId: input.kingdomId,
      kind: "raid",
      operationKey: `raid:${input.raidId}:${input.kingdomId}`,
      gameTimeMs: input.gameTimeMs,
    });
    await this.ledger.debit(client, {
      kingdomId: input.kingdomId,
      resource: "grain",
      amount: grain,
      purpose: "raid_provisions",
      operationKey: `raid:${input.raidId}:${input.kingdomId}:provisions`,
      gameTimeMs: input.gameTimeMs,
    });
    if (ref) {
      await this.exposure.activate(client, ref, input.raidId);
      await this.exposure.consume(client, {
        ref,
        asset: "grain",
        units: grain,
        operationKey: `raid:${input.raidId}:${input.kingdomId}:authority`,
        gameTimeMs: input.gameTimeMs,
      });
    }
    await client.query(
      `INSERT INTO raid_contributions(product_scope, raid_id, kingdom_id, role, status,
         committed_game_time_ms, authority_ref, provision_units, selection)
       VALUES ($1,$2,$3,$4,'committed',$5,$6,$7,$8::jsonb)`,
      [
        this.productScope,
        input.raidId,
        input.kingdomId,
        input.role,
        input.gameTimeMs,
        ref,
        grain.toString(),
        JSON.stringify(input.units),
      ],
    );
  }

  private async releaseContribution(
    client: PoolClient,
    raidId: string,
    item: ContributionRow,
    gameTimeMs: number,
    withdrawn: boolean,
  ): Promise<void> {
    await this.troops.returnPlacement(client, {
      ownerKingdomId: item.kingdom_id,
      placement: "attacking",
      referenceId: raidId,
      gameTimeMs,
    });
    if (item.authority_ref) await this.exposure.release(client, item.authority_ref, gameTimeMs);
    if (withdrawn)
      await client.query(
        `UPDATE raid_contributions SET status = 'withdrawn', withdrawn_game_time_ms = $4
       WHERE product_scope = $1 AND raid_id = $2 AND kingdom_id = $3`,
        [this.productScope, raidId, item.kingdom_id, gameTimeMs],
      );
  }

  private async assertNoAttack(client: PoolClient, kingdomId: string): Promise<void> {
    const active = await client.query(
      `SELECT 1 FROM raid_contributions c JOIN raids r ON r.product_scope = c.product_scope AND r.id = c.raid_id
       WHERE c.product_scope = $1 AND c.kingdom_id = $2 AND c.status = 'committed'
         AND r.status IN ('declared','locked') LIMIT 1`,
      [this.productScope, kingdomId],
    );
    if (active.rowCount) throw new RaidError("ATTACK_ALREADY_ACTIVE");
  }

  private async owned(client: PoolClient, accountId: string): Promise<string> {
    const found = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked' FOR UPDATE",
      [this.productScope, accountId],
    );
    if (!found.rows[0]) throw new RaidError("NOT_OWNER");
    return found.rows[0].id;
  }

  private async raid(client: PoolClient, id: string, lock: boolean): Promise<RaidRow> {
    const found = await client.query<RaidRow>(
      `SELECT * FROM raids WHERE product_scope = $1 AND id = $2 ${lock ? "FOR UPDATE" : ""}`,
      [this.productScope, id],
    );
    if (!found.rows[0]) throw new RaidError("RAID_NOT_FOUND");
    return found.rows[0];
  }

  private async contribution(client: PoolClient, raidId: string, kingdomId: string): Promise<ContributionRow | null> {
    const found = await client.query<ContributionRow>(
      "SELECT * FROM raid_contributions WHERE product_scope = $1 AND raid_id = $2 AND kingdom_id = $3",
      [this.productScope, raidId, kingdomId],
    );
    return found.rows[0] ?? null;
  }

  private beforeLock(raid: RaidRow, gameTimeMs: number): void {
    if (raid.status !== "declared" || gameTimeMs >= Number(raid.lock_game_time_ms)) throw new RaidError("RAID_LOCKED");
  }

  private async emit(client: PoolClient, type: string, payload: Record<string, unknown>): Promise<void> {
    await appendOutbox(client, { productScope: this.productScope, eventId: randomUUID(), type, payload });
  }
}
