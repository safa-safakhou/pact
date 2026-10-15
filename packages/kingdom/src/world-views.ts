import type { ObservationSectionQuery } from "@pact/contracts";
import { type ObservedUnitReference, ownedWorldIntentVersion, referenceCatalogVersion } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import {
  type BuildingKind,
  type BuildingLevels,
  checkUpgrade,
  resourceRateFacts,
  rulesCatalog,
  wholeUnitText,
} from "@pact/domain";
import { WorldClockService } from "@pact/world";
import type { Pool, PoolClient } from "pg";
import { ActionLimitService, type ChargeView } from "./action-limits.js";
import { type GameConsequences, readGameConsequences } from "./consequences.js";
import { readObservationSection } from "./observation-sections.js";
import { OwnerRecordStates } from "./owner-record-states.js";
import { SeasonService, seasonPosition } from "./seasons.js";
import type { KingdomAmbition } from "./service.js";
import { type SupplyTerms, supplyPerspective } from "./supply-terms.js";

type Resource = "iron" | "silver" | "grain";
const resources: readonly Resource[] = ["iron", "silver", "grain"];
const minuteMs = 60_000;

interface KingdomRow {
  id: string;
  account_id: string;
  handle: string;
  display_name: string;
  portrait: string;
  ambition: KingdomAmbition | null;
  status: string;
}
interface BalanceRow {
  resource: Resource;
  ordinary_units: string;
  allowance_units: string;
  locked_units: string;
  storage_cap_units: string;
  production_per_minute_units: string;
  version: string;
  grant_expires_game_time_ms: string;
}
interface ContractRow {
  id: string;
  kingdom_a: string;
  kingdom_b: string;
  terms: SupplyTerms;
  end_game_time_ms: string;
  notice_end_game_time_ms: string | null;
}
interface ClockRow {
  committed_game_time_ms: string;
  tick_sequence: string;
  status: string;
}

export interface PublicKingdomView {
  politics?: unknown;
  audience: "public" | "contact" | "participant";
  profile: { kingdomId: string; handle: string; displayName: string; portrait: string };
  asOfGameTimeMs: number;
  committedTickSequence: string;
  worldStatus: string;
  sharedRecords?: { kind: "supply" | "garrison" | "raid"; id: string; status: string }[];
  publicEvents: {
    kind: "default" | "battle";
    id: string;
    gameTimeMs: number;
    parties: [string, string];
    outcome: string;
  }[];
}

export interface OwnerKingdomView {
  schemaVersion: typeof ownedWorldIntentVersion;
  consequences: GameConsequences;
  audience: "owner";
  ambition: KingdomAmbition;
  profile: PublicKingdomView["profile"];
  asOfGameTimeMs: number;
  committedTickSequence: string;
  lastCommittedEventId: string;
  worldStatus: string;
  charges: ChargeView[];
  balances: Record<
    Resource,
    {
      ordinaryUnits: string;
      foundingAllowanceUnits: string;
      lockedUnits: string;
      capacityUnits: string;
      productionPerMinuteUnits: string;
      facts: {
        ordinaryWhole: string;
        allowanceWhole: string;
        lockedWhole: string;
        capacityWhole: string;
        rates: ReturnType<typeof resourceRateFacts>;
      };
      version: string;
    }
  >;
  buildings: { kind: string; level: number }[];
  nextUpgradeChecks?: {
    kind: string;
    targetLevel: number;
    prerequisiteCheck: string;
    missingBuildings: { kind: string; level: number }[];
  }[];
  builders: {
    slot: number;
    instructionId: string | null;
    kind: string | null;
    targetLevel?: number | null;
    state: string | null;
    dueGameTimeMs: number | null;
    remainingGameMinutes?: number | null;
    prerequisiteCheck?: string | null;
    missingBuildings?: { kind: string; level: number }[];
  }[];
  kingdomReference: { type: "Kingdom"; id: string; role: "self"; asOfGameTimeMs: number };
  unitReferences: {
    schemaVersion: typeof referenceCatalogVersion;
    units: ObservedUnitReference[];
    hasMore: boolean;
    scoutTroopsRequired: number;
  };
  troops: {
    type: string;
    placement: string;
    ownerKingdomId: string;
    hostKingdomId: string;
    homeGuard: boolean;
    count: number;
  }[];
  training: {
    batchId: string;
    type: string;
    requestedCount: number;
    completedCount: number;
    nextUnitDueGameTimeMs: number;
    unitMinutes: number;
  }[];
  upkeep: { perMinuteUnits: string; hungry: boolean };
  contracts: {
    id: string;
    counterpartyKingdomId: string;
    endsGameTimeMs: number;
    noticeEndsGameTimeMs: number | null;
    terms: SupplyTerms;
    youSend?: SupplyTerms["aToB"];
    youReceive?: SupplyTerms["bToA"];
  }[];
  raids: {
    raidId: string;
    status: "declared" | "locked" | "resolved" | "canceled";
    side: "attacker" | "defender";
    role: "leader" | "contributor" | "defender";
    otherKingdomId: string;
    lockGameTimeMs: number;
    dueGameTimeMs: number;
  }[];
  scouts: {
    operationId: string;
    status: "active" | "completed";
    targetKingdomId: string;
    dueGameTimeMs: number;
  }[];
  threats: { kind: "raid" | "scout"; id: string; dueGameTimeMs: number }[];
  records: { kind: string; id: string; occurredAt: string }[];
  forecast: {
    throughGameTimeMs: number;
    assumption: string;
    harvestPercentByMinute: number[];
    expected: Record<Resource, { ordinaryUnits: string; foundingAllowanceUnits: string }>;
    assumedDeliveries: { contractId: string; direction: "incoming" | "outgoing"; resource: Resource; units: string }[];
  };
}

export type KingdomWorldView = PublicKingdomView | OwnerKingdomView;

function validId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** A conditional projection: the caller supplies only an authenticated account ID, never an audience. */
export class WorldViewService {
  constructor(
    private readonly pool: Pool,
    private readonly productScope: string,
    private readonly harvestPercentAt: (gameTimeMs: number) => number = () => 100,
    private readonly politics?: { publicFor(client: PoolClient, kingdomId: string): Promise<unknown> },
  ) {}

  async readSelf(accountId: string, forecastMinutes = 60): Promise<OwnerKingdomView | null> {
    if (!validId(accountId)) return null;
    if (!Number.isSafeInteger(forecastMinutes) || forecastMinutes < 1 || forecastMinutes > 60)
      throw new Error("INVALID_FORECAST_HORIZON");
    return withTransaction(
      this.pool,
      async (client) => {
        const owner = (
          await client.query<{ id: string }>(
            "SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2 AND status='ranked'",
            [this.productScope, accountId],
          )
        ).rows[0];
        if (!owner) return null;
        const view = await this.readSnapshot(client, accountId, owner.id, forecastMinutes);
        return view?.audience === "owner" ? view : null;
      },
      { isolation: "REPEATABLE READ" },
    );
  }

  readRecordStates(accountId: string, records: string[]) {
    return new OwnerRecordStates(
      this.pool,
      this.productScope,
      new WorldClockService(this.pool, this.productScope),
    ).read(accountId, records);
  }

  async readSection(accountId: string, query: ObservationSectionQuery) {
    return withTransaction(
      this.pool,
      (client) =>
        readObservationSection(client, this.productScope, accountId, query, async (id, minutes) => {
          const view = await this.readSnapshot(client, accountId, id, minutes);
          return view?.audience === "owner" ? view : null;
        }),
      { isolation: "REPEATABLE READ" },
    );
  }

  /** Always public, even when an authenticated caller searches their own handle. */
  async publicProfile(handle: string): Promise<PublicKingdomView | null> {
    if (!/^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(handle)) return null;
    return withTransaction(
      this.pool,
      async (client) => {
        const row = (
          await client.query<{ id: string }>(
            "SELECT id FROM kingdoms WHERE product_scope = $1 AND handle = $2 AND status = 'ranked'",
            [this.productScope, handle.toLowerCase()],
          )
        ).rows[0];
        if (!row) return null;
        const view = await this.readSnapshot(client, null, row.id, 1);
        return view?.audience === "owner" ? null : view;
      },
      { isolation: "REPEATABLE READ" },
    );
  }

  async read(
    accountId: string | null,
    targetKingdomId: string,
    forecastMinutes = 60,
  ): Promise<KingdomWorldView | null> {
    if (!validId(targetKingdomId) || (accountId !== null && !validId(accountId))) return null;
    if (!Number.isSafeInteger(forecastMinutes) || forecastMinutes < 1 || forecastMinutes > 60)
      throw new Error("INVALID_FORECAST_HORIZON");
    return withTransaction(
      this.pool,
      (client) => this.readSnapshot(client, accountId, targetKingdomId, forecastMinutes),
      {
        isolation: "REPEATABLE READ",
      },
    );
  }

  private async readSnapshot(
    client: PoolClient,
    accountId: string | null,
    targetId: string,
    minutes: number,
  ): Promise<KingdomWorldView | null> {
    const kingdom = (
      await client.query<KingdomRow>(
        "SELECT id, account_id, handle, display_name, portrait, status, ambition FROM kingdoms WHERE product_scope = $1 AND id = $2 AND status = 'ranked'",
        [this.productScope, targetId],
      )
    ).rows[0];
    if (!kingdom) return null;
    const clock = (
      await client.query<ClockRow>(
        "SELECT committed_game_time_ms, tick_sequence, status FROM world_clocks WHERE product_scope = $1",
        [this.productScope],
      )
    ).rows[0];
    if (!clock) throw new Error("WORLD_NOT_BOOTSTRAPPED");
    const gameTimeMs = Number(clock.committed_game_time_ms);
    const profile = {
      kingdomId: kingdom.id,
      handle: kingdom.handle,
      displayName: kingdom.display_name,
      portrait: kingdom.portrait,
    };
    const common = {
      profile,
      asOfGameTimeMs: gameTimeMs,
      committedTickSequence: clock.tick_sequence,
      worldStatus: clock.status,
    };
    const viewer =
      accountId === null
        ? null
        : ((
            await client.query<{ id: string }>(
              "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
              [this.productScope, accountId],
            )
          ).rows[0]?.id ?? null);
    if (accountId !== kingdom.account_id) {
      const related = viewer
        ? await client.query<{ kind: "supply" | "garrison" | "raid"; id: string; status: string }>(
            `SELECT 'supply' AS kind, id, status FROM supply_contracts WHERE product_scope = $1
           AND (kingdom_a = $2 AND kingdom_b = $3 OR kingdom_a = $3 AND kingdom_b = $2)
         UNION ALL SELECT 'garrison', id, status FROM garrison_contracts WHERE product_scope = $1
           AND (lender_kingdom_id = $2 AND host_kingdom_id = $3 OR lender_kingdom_id = $3 AND host_kingdom_id = $2)
         UNION ALL SELECT 'raid', r.id, r.status FROM raids r WHERE r.product_scope = $1
           AND (r.target_kingdom_id = $3 OR EXISTS (SELECT 1 FROM raid_contributions c
             WHERE c.product_scope = $1 AND c.raid_id = r.id AND c.kingdom_id = $3))
           AND (r.leader_kingdom_id = $2 OR r.target_kingdom_id = $2 OR EXISTS
             (SELECT 1 FROM raid_contributions c WHERE c.product_scope = $1 AND c.raid_id = r.id AND c.kingdom_id = $2))
         ORDER BY kind, id LIMIT 20`,
            [this.productScope, targetId, viewer],
          )
        : null;
      const contact = viewer
        ? (
            await client.query(
              "SELECT 1 FROM social_contacts WHERE product_scope = $1 AND kingdom_a = LEAST($2::uuid,$3::uuid) AND kingdom_b = GREATEST($2::uuid,$3::uuid)",
              [this.productScope, viewer, targetId],
            )
          ).rowCount !== 0
        : false;
      return {
        audience: related?.rows.length ? "participant" : contact ? "contact" : "public",
        ...common,
        ...(related?.rows.length ? { sharedRecords: related.rows } : {}),
        publicEvents: await this.publicEvents(client, targetId),
        ...(this.politics ? { politics: await this.politics.publicFor(client, targetId) } : {}),
      };
    }
    const balances = (
      await client.query<BalanceRow>(
        `SELECT b.resource, b.ordinary_units, b.allowance_units, b.locked_units,
         b.storage_cap_units, b.production_per_minute_units, b.version, l.grant_expires_game_time_ms
       FROM resource_balances b JOIN ledger_kingdoms l USING (product_scope, kingdom_id)
       WHERE b.product_scope = $1 AND b.kingdom_id = $2 ORDER BY b.resource`,
        [this.productScope, targetId],
      )
    ).rows;
    if (balances.length !== 3) throw new Error("KINGDOM_BALANCES_INCOMPLETE");
    const buildings = (
      await client.query<{ kind: BuildingKind; level: number }>(
        "SELECT kind, level FROM kingdom_buildings WHERE product_scope = $1 AND kingdom_id = $2 ORDER BY kind",
        [this.productScope, targetId],
      )
    ).rows;
    const levels = Object.fromEntries(buildings.map((b) => [b.kind, b.level])) as unknown as BuildingLevels;
    // Owned projection only: explain the existing pure rule check, without granting
    // authority or changing queue admission. An agent cannot cancel these queues.
    const missingBuildings = (kind: BuildingKind, target: number) => {
      const check = checkUpgrade(levels, kind, target);
      if (check === "hall_prerequisite")
        return [
          { kind: "farm", level: target },
          { kind: "barracks", level: target },
          { kind: "storehouse", level: target - 1 },
        ].filter((b) => levels[b.kind as BuildingKind] < b.level);
      return check === "hall_limit" ? [{ kind: "hall", level: target - 1 }] : [];
    };
    const nextUpgradeChecks = buildings.map(({ kind, level }) => ({
      kind,
      targetLevel: level + 1,
      prerequisiteCheck: checkUpgrade(levels, kind, level + 1),
      missingBuildings: missingBuildings(kind, level + 1),
    }));
    const builders = (
      await client.query<{
        slot: number;
        instruction_id: string | null;
        kind: string | null;
        target_level: number | null;
        state: string | null;
        due_game_time_ms: string | null;
      }>(
        `SELECT s.slot, i.id AS instruction_id, i.building_kind AS kind, i.target_level, i.state, i.due_game_time_ms
       FROM kingdom_builder_slots s LEFT JOIN building_instructions i ON i.product_scope = s.product_scope
         AND i.kingdom_id = s.kingdom_id AND i.builder_slot = s.slot AND i.state IN ('active','waiting')
       WHERE s.product_scope = $1 AND s.kingdom_id = $2 ORDER BY s.slot, i.state`,
        [this.productScope, targetId],
      )
    ).rows.map((row) => ({
      slot: row.slot,
      instructionId: row.instruction_id,
      kind: row.kind,
      targetLevel: row.target_level,
      state: row.state,
      prerequisiteCheck:
        row.kind && row.target_level && row.state === "waiting"
          ? checkUpgrade(levels, row.kind as BuildingKind, row.target_level)
          : null,
      missingBuildings:
        row.kind && row.target_level && row.state === "waiting"
          ? missingBuildings(row.kind as BuildingKind, row.target_level)
          : [],
      dueGameTimeMs: row.due_game_time_ms === null ? null : Number(row.due_game_time_ms),
      remainingGameMinutes:
        row.due_game_time_ms === null
          ? null
          : Math.max(0, Math.ceil((Number(row.due_game_time_ms) - gameTimeMs) / 60_000)),
    }));
    const troops = (
      await client.query<{
        type: string;
        placement: string;
        owner_kingdom_id: string;
        host_kingdom_id: string;
        home_guard: boolean;
        count: string;
      }>(
        `SELECT type, placement, owner_kingdom_id, host_kingdom_id, home_guard, count(*)::text FROM kingdom_troops
       WHERE product_scope = $1 AND (owner_kingdom_id = $2 OR host_kingdom_id = $2)
       GROUP BY type, placement, owner_kingdom_id, host_kingdom_id, home_guard
       ORDER BY type, placement, owner_kingdom_id, host_kingdom_id, home_guard`,
        [this.productScope, targetId],
      )
    ).rows.map((row) => ({
      type: row.type,
      placement: row.placement,
      ownerKingdomId: row.owner_kingdom_id,
      hostKingdomId: row.host_kingdom_id,
      homeGuard: row.home_guard,
      count: Number(row.count),
    }));
    // Individual identities are owner-only. Aggregate visiting troop facts
    // do not expose somebody else's private unit IDs.
    const unitRows = (
      await client.query<{
        id: string;
        type: string;
        host_kingdom_id: string;
        placement: string;
        home_guard: boolean;
        battle_locked: boolean;
      }>(
        `SELECT t.id,t.type,t.host_kingdom_id,t.placement,t.home_guard,
      EXISTS(SELECT 1 FROM battle_unit_eligibility e WHERE e.product_scope=t.product_scope
        AND e.troop_id=t.id AND e.locked_until_game_time_ms>$3) AS battle_locked
      FROM kingdom_troops t WHERE t.product_scope=$1 AND t.owner_kingdom_id=$2
      ORDER BY t.id LIMIT 33`,
        [this.productScope, targetId, gameTimeMs],
      )
    ).rows;
    const unitReferences: OwnerKingdomView["unitReferences"] = {
      schemaVersion: referenceCatalogVersion,
      units: unitRows.slice(0, 32).map((unit) => ({
        id: unit.id,
        type: "Unit",
        ownerKingdomId: targetId,
        asOfGameTimeMs: gameTimeMs,
        unitType: unit.type,
        hostKingdomId: unit.host_kingdom_id,
        placement: unit.placement,
        homeGuard: unit.home_guard,
        battleLocked: unit.battle_locked,
        scoutEligible:
          unit.type === "spearman" &&
          !unit.home_guard &&
          !unit.battle_locked &&
          unit.placement === "home" &&
          unit.host_kingdom_id === targetId,
      })),
      hasMore: unitRows.length > 32,
      scoutTroopsRequired: rulesCatalog.scouting.ordinarySpearmen,
    };
    const training = (
      await client.query<{
        id: string;
        troop_type: string;
        requested_count: number;
        completed_count: number;
        next_unit_due_game_time_ms: string;
        unit_minutes: number;
      }>(
        `SELECT id, troop_type, requested_count, completed_count, next_unit_due_game_time_ms, unit_minutes
         FROM training_batches WHERE product_scope = $1 AND kingdom_id = $2 AND status = 'active'
         ORDER BY next_unit_due_game_time_ms, id LIMIT 1`,
        [this.productScope, targetId],
      )
    ).rows.map((row) => ({
      batchId: row.id,
      type: row.troop_type,
      requestedCount: row.requested_count,
      completedCount: row.completed_count,
      nextUnitDueGameTimeMs: Number(row.next_unit_due_game_time_ms),
      unitMinutes: row.unit_minutes,
    }));
    const activeContracts = (
      await client.query<ContractRow>(
        `SELECT id, kingdom_a, kingdom_b, terms, end_game_time_ms, notice_end_game_time_ms
       FROM supply_contracts WHERE product_scope = $1 AND status = 'active'
         AND (kingdom_a = $2 OR kingdom_b = $2) ORDER BY id LIMIT 32`,
        [this.productScope, targetId],
      )
    ).rows;
    const upkeepState = (
      await client.query<{ hungry: boolean }>(
        "SELECT hungry FROM kingdom_upkeep_state WHERE product_scope = $1 AND payer_kingdom_id = $2",
        [this.productScope, targetId],
      )
    ).rows[0];
    const upkeep = troops.reduce((sum, troop) => {
      const pays =
        troop.placement === "visiting" ? troop.hostKingdomId === targetId : troop.ownerKingdomId === targetId;
      return (
        sum +
        (pays
          ? BigInt(
              troop.count * (rulesCatalog.units[troop.type as keyof typeof rulesCatalog.units]?.grainPerHour ?? 0),
            ) * 10n
          : 0n)
      );
    }, 0n);
    const visitingUpkeep = troops.reduce((sum, troop) => {
      if (troop.placement !== "visiting" || troop.hostKingdomId !== targetId) return sum;
      return (
        sum +
        BigInt(troop.count * (rulesCatalog.units[troop.type as keyof typeof rulesCatalog.units]?.grainPerHour ?? 0)) *
          10n
      );
    }, 0n);
    const threats = (
      await client.query<{ kind: "raid" | "scout"; id: string; due_game_time_ms: string }>(
        `SELECT 'raid' AS kind, id, resolution_game_time_ms AS due_game_time_ms FROM raids
         WHERE product_scope = $1 AND target_kingdom_id = $2 AND status IN ('declared','locked')
       UNION ALL SELECT 'scout', id, due_game_time_ms FROM scout_operations
         WHERE product_scope = $1 AND target_kingdom_id = $2 AND status = 'active'
       ORDER BY due_game_time_ms, id LIMIT 20`,
        [this.productScope, targetId],
      )
    ).rows.map((row) => ({ kind: row.kind, id: row.id, dueGameTimeMs: Number(row.due_game_time_ms) }));
    const raids = (
      await client.query<{
        id: string;
        status: "declared" | "locked" | "resolved" | "canceled";
        leader_kingdom_id: string;
        target_kingdom_id: string;
        lock_game_time_ms: string;
        resolution_game_time_ms: string;
      }>(
        `SELECT id, status, leader_kingdom_id, target_kingdom_id, lock_game_time_ms, resolution_game_time_ms
         FROM raids WHERE product_scope = $1 AND (
           leader_kingdom_id = $2 OR target_kingdom_id = $2 OR EXISTS (
             SELECT 1 FROM raid_contributions c WHERE c.product_scope = $1 AND c.raid_id = raids.id
               AND c.kingdom_id = $2 AND c.status = 'committed'
           )
         ) ORDER BY declared_game_time_ms DESC, id DESC LIMIT 20`,
        [this.productScope, targetId],
      )
    ).rows.map((row) => ({
      raidId: row.id,
      status: row.status,
      side: row.target_kingdom_id === targetId ? ("defender" as const) : ("attacker" as const),
      role:
        row.target_kingdom_id === targetId
          ? ("defender" as const)
          : row.leader_kingdom_id === targetId
            ? ("leader" as const)
            : ("contributor" as const),
      otherKingdomId: row.target_kingdom_id === targetId ? row.leader_kingdom_id : row.target_kingdom_id,
      lockGameTimeMs: Number(row.lock_game_time_ms),
      dueGameTimeMs: Number(row.resolution_game_time_ms),
    }));
    const scouts = (
      await client.query<{
        id: string;
        status: "active" | "completed";
        target_kingdom_id: string;
        due_game_time_ms: string;
      }>(
        `SELECT id, status, target_kingdom_id, due_game_time_ms FROM scout_operations
         WHERE product_scope = $1 AND scout_kingdom_id = $2
         ORDER BY started_game_time_ms DESC, id DESC LIMIT 20`,
        [this.productScope, targetId],
      )
    ).rows.map((row) => ({
      operationId: row.id,
      status: row.status,
      targetKingdomId: row.target_kingdom_id,
      dueGameTimeMs: Number(row.due_game_time_ms),
    }));
    const records = (
      await client.query<{ type: string; event_id: string; occurred_at: Date }>(
        `SELECT type, event_id, occurred_at FROM inbox_events WHERE product_scope = $1 AND account_id = $2
       ORDER BY sequence DESC LIMIT 20`,
        [this.productScope, accountId],
      )
    ).rows.map((row) => ({ kind: row.type, id: row.event_id, occurredAt: row.occurred_at.toISOString() }));
    const season = await new SeasonService(this.productScope).clock(client);
    const harvestPercentAt = season
      ? (at: number) => seasonPosition(Number(season.opening_game_time_ms), at).harvestPercent
      : this.harvestPercentAt;
    const forecast = forecastBalances({
      now: gameTimeMs,
      minutes,
      balances,
      contracts: activeContracts,
      kingdomId: targetId,
      upkeep,
      visitingUpkeep,
      harvestPercentAt,
    });
    const lastCommittedEventId =
      (
        await client.query<{ id: string }>(
          "SELECT COALESCE(max(id), 0)::text AS id FROM outbox_events WHERE product_scope = $1",
          [this.productScope],
        )
      ).rows[0]?.id ?? "0";
    return {
      schemaVersion: ownedWorldIntentVersion,
      audience: "owner",
      kingdomReference: { type: "Kingdom", id: targetId, role: "self", asOfGameTimeMs: gameTimeMs },
      ambition: kingdom.ambition ?? "",
      consequences: await readGameConsequences(client, this.productScope, targetId, gameTimeMs),
      ...common,
      lastCommittedEventId,
      charges: await new ActionLimitService(this.productScope).readCharges(client, targetId, gameTimeMs),
      balances: Object.fromEntries(
        balances.map((row) => [
          row.resource,
          {
            ordinaryUnits: row.ordinary_units,
            foundingAllowanceUnits: row.allowance_units,
            lockedUnits: row.locked_units,
            capacityUnits: row.storage_cap_units,
            productionPerMinuteUnits:
              row.resource === "grain"
                ? ((BigInt(row.production_per_minute_units) * BigInt(harvestPercentAt(gameTimeMs))) / 100n).toString()
                : row.production_per_minute_units,
            facts: {
              ordinaryWhole: wholeUnitText(row.ordinary_units),
              allowanceWhole: wholeUnitText(row.allowance_units),
              lockedWhole: wholeUnitText(row.locked_units),
              capacityWhole: wholeUnitText(row.storage_cap_units),
              rates: resourceRateFacts(
                row.resource === "grain"
                  ? (BigInt(row.production_per_minute_units) * BigInt(harvestPercentAt(gameTimeMs))) / 100n
                  : row.production_per_minute_units,
                row.resource === "grain" ? upkeep : 0n,
              ),
            },
            version: row.version,
          },
        ]),
      ) as OwnerKingdomView["balances"],
      buildings,
      nextUpgradeChecks,
      builders,
      troops,
      unitReferences,
      training,
      upkeep: { perMinuteUnits: upkeep.toString(), hungry: upkeepState?.hungry ?? false },
      contracts: activeContracts.map((row) => ({
        id: row.id,
        counterpartyKingdomId: row.kingdom_a === targetId ? row.kingdom_b : row.kingdom_a,
        endsGameTimeMs: Number(row.end_game_time_ms),
        noticeEndsGameTimeMs: row.notice_end_game_time_ms === null ? null : Number(row.notice_end_game_time_ms),
        terms: row.terms,
        ...supplyPerspective(row.terms, row.kingdom_a === targetId),
      })),
      raids,
      scouts,
      threats,
      records,
      forecast,
    };
  }

  private async publicEvents(client: PoolClient, targetId: string): Promise<PublicKingdomView["publicEvents"]> {
    const events = await client.query<{
      kind: "default" | "battle";
      id: string;
      game_time_ms: string;
      party_a: string;
      party_b: string;
      outcome: string;
    }>(
      `SELECT 'default' AS kind, id, closed_game_time_ms AS game_time_ms,
         kingdom_a AS party_a, kingdom_b AS party_b, 'defaulted' AS outcome FROM supply_contracts
         WHERE product_scope = $1 AND (kingdom_a = $2 OR kingdom_b = $2)
           AND status = 'defaulted' AND closed_game_time_ms IS NOT NULL
       UNION ALL SELECT 'battle', id, resolved_game_time_ms, leader_kingdom_id,
         target_kingdom_id, public_report->>'winner' FROM raids
         WHERE product_scope = $1 AND (leader_kingdom_id = $2 OR target_kingdom_id = $2)
           AND status = 'resolved' AND resolved_game_time_ms IS NOT NULL
       ORDER BY game_time_ms DESC, id DESC LIMIT 20`,
      [this.productScope, targetId],
    );
    return events.rows.map((row) => ({
      kind: row.kind,
      id: row.id,
      gameTimeMs: Number(row.game_time_ms),
      parties: [row.party_a, row.party_b],
      outcome: row.outcome,
    }));
  }
}

export function forecastBalances(input: {
  now: number;
  minutes: number;
  balances: readonly BalanceRow[];
  contracts: readonly ContractRow[];
  kingdomId: string;
  upkeep: bigint;
  visitingUpkeep?: bigint;
  harvestPercentAt: (gameTimeMs: number) => number;
}): OwnerKingdomView["forecast"] {
  const state = Object.fromEntries(
    input.balances.map((row) => [
      row.resource,
      {
        ordinary: BigInt(row.ordinary_units),
        allowance: BigInt(row.allowance_units),
        cap: BigInt(row.storage_cap_units),
        rate: BigInt(row.production_per_minute_units),
        expiry: Number(row.grant_expires_game_time_ms),
      },
    ]),
  ) as Record<Resource, { ordinary: bigint; allowance: bigint; cap: bigint; rate: bigint; expiry: number }>;
  const deliveries = new Map<string, OwnerKingdomView["forecast"]["assumedDeliveries"][number]>();
  const harvestPercentByMinute: number[] = [];
  for (let step = 1; step <= input.minutes; step += 1) {
    const at = input.now + step * minuteMs;
    const percent = input.harvestPercentAt(at);
    if (!Number.isSafeInteger(percent) || percent < 0 || percent > 100) throw new Error("INVALID_HARVEST_PERCENT");
    harvestPercentByMinute.push(percent);
    for (const resource of resources) {
      const item = state[resource];
      if (at >= item.expiry) item.allowance = 0n;
      const produced = resource === "grain" ? (item.rate * BigInt(percent)) / 100n : item.rate;
      item.ordinary = item.ordinary + produced > item.cap ? item.cap : item.ordinary + produced;
    }
    const grain = state.grain;
    const visiting = input.visitingUpkeep ?? 0n;
    if (visiting < 0n || input.upkeep < visiting) throw new Error("INVALID_UPKEEP_FORECAST");
    const owned = input.upkeep - visiting;
    const ordinaryOwned = grain.ordinary < owned ? grain.ordinary : owned;
    grain.ordinary -= ordinaryOwned;
    const allowanceNeeded = owned - ordinaryOwned;
    grain.allowance -= grain.allowance < allowanceNeeded ? grain.allowance : allowanceNeeded;
    grain.ordinary = grain.ordinary > visiting ? grain.ordinary - visiting : 0n;
    // These are conditional promises, not guaranteed transfers. No hidden future stock or combat is inferred.
    for (const contract of input.contracts) {
      if (
        at >= Number(contract.end_game_time_ms) ||
        (contract.notice_end_game_time_ms !== null && at >= Number(contract.notice_end_game_time_ms))
      )
        continue;
      for (const [flow, payer, recipient] of [
        [contract.terms.aToB, contract.kingdom_a, contract.kingdom_b],
        [contract.terms.bToA, contract.kingdom_b, contract.kingdom_a],
      ] as const) {
        if (!flow || (payer !== input.kingdomId && recipient !== input.kingdomId)) continue;
        const units = BigInt(flow.wholePerHour) * 10n;
        const direction = payer === input.kingdomId ? "outgoing" : "incoming";
        const item = state[flow.resource];
        if (direction === "outgoing") item.ordinary = item.ordinary > units ? item.ordinary - units : 0n;
        else item.ordinary = item.ordinary + units > item.cap ? item.cap : item.ordinary + units;
        const key = `${contract.id}:${direction}:${flow.resource}`;
        const prior = deliveries.get(key);
        deliveries.set(key, {
          contractId: contract.id,
          direction,
          resource: flow.resource,
          units: ((prior ? BigInt(prior.units) : 0n) + units).toString(),
        });
      }
    }
  }
  return {
    throughGameTimeMs: input.now + input.minutes * minuteMs,
    assumption:
      "Scenario only: current production, troop upkeep and active signed supply flows continue; each delivery is assumed funded and accepted. No new orders, defaults, combat, reserve-floor changes or building completions are predicted. Harvest percentages are supplied by the configured test/season clock.",
    harvestPercentByMinute,
    expected: Object.fromEntries(
      resources.map((resource) => [
        resource,
        {
          ordinaryUnits: state[resource].ordinary.toString(),
          foundingAllowanceUnits: state[resource].allowance.toString(),
        },
      ]),
    ) as OwnerKingdomView["forecast"]["expected"],
    assumedDeliveries: [...deliveries.values()],
  };
}
