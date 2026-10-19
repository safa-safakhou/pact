import { createHash } from "node:crypto";
import { CommandDispatcher, GameCommandHandler } from "@pact/application";
import { ExposureService } from "@pact/authority";
import { type CommandEnvelope, ProductScopeSchema } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import { ActionLimitService, GarrisonService, SocialService } from "@pact/kingdom";
import type { Pool } from "pg";
import { AgentEventService } from "../../packages/inbox/src/agent-events.js";
import { AgentEventProjector } from "../../packages/kingdom/src/agent-events.js";
import { createRulesRuntime } from "../../workers/rules/src/runtime.js";
import { design } from "./plan.js";

type Actor = { accountId: string; kingdomId: string };
type World = {
  pool: Pool;
  players: Actor[];
  replica: { scenario: string; seed: number; split: string; replicaId: string };
};
function fixture(w: World) {
  const s = design.scenarios.find((s) => s.id === w.replica.scenario);
  if (!s?.fixture) throw Error("NOT_SURVIVAL_SCENARIO");
  return { scenario: s, input: s.fixture };
}
function stable(w: World, key: string) {
  const h = createHash("sha256").update(`${w.replica.scenario}:${w.replica.seed}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function actors(w: World) {
  const [host, lender, enemy] = w.players;
  if (!host || !lender || !enemy) throw Error("MISSING_SCENARIO_ACTORS");
  return { host, lender, enemy };
}
function services(w: World) {
  const { input } = fixture(w),
    key = createHash("sha256").update(`fixture:${w.replica.seed}`).digest();
  const r = createRulesRuntime(w.pool, "pact", key, (size) => Buffer.alloc(size, input.entropyByte), 0);
  const exposure = new ExposureService("pact"),
    garrison = new GarrisonService("pact", r.ledger, r.troops, exposure);
  const social = new SocialService("pact", r.ledger, new ActionLimitService("pact"), {
    now: () => new Date("2026-10-17T00:00:00Z"),
  });
  const handler = new GameCommandHandler(
    social,
    undefined,
    undefined,
    r.troops,
    r.buildings,
    undefined,
    undefined,
    undefined,
    exposure,
    r.scouting,
    garrison,
    r.raids,
  );
  const dispatcher = new CommandDispatcher({
    pool: w.pool,
    clock: { now: () => new Date("2026-10-17T00:00:00Z") },
    productScope: ProductScopeSchema.parse("pact"),
    game: {
      admit: (op) => r.world.admitCommand((c, s) => op(c, s.gameTimeMs)),
      execute: (c, p, v, t) => handler.execute(c, p, v, t),
    },
  });
  return { ...r, garrison, dispatcher };
}
export async function initializeScenario(w: World) {
  const definition = design.scenarios.find((s) => s.id === w.replica.scenario);
  if (!definition?.fixture) return;
  const { input } = fixture(w),
    { host, lender, enemy } = actors(w),
    r = services(w);
  await withTransaction(w.pool, async (c) => {
    for (const [i, a] of w.players.entries()) {
      await c.query("UPDATE kingdoms SET display_name=$2 WHERE id=$1", [a.kingdomId, ["Cedar", "Birch", "Ash"][i]]);
      await c.query(
        "UPDATE kingdom_mandates SET allowed_actions=$2,resource_limits=$3,troop_limit=100 WHERE account_id=$1",
        [a.accountId, input.permissions, { iron: "600000", silver: "600000", grain: "600000" }],
      );
      for (const resource of ["iron", "silver", "grain"] as const) {
        const amount =
          resource === "iron"
            ? input.ordinaryIron
            : resource === "silver"
              ? input.ordinarySilver
              : a === host
                ? input.hostOrdinaryGrain
                : 200;
        if (amount)
          await r.ledger.creditOrdinary(c, {
            kingdomId: a.kingdomId,
            resource,
            amount: wholeResources(amount),
            operationKey: `scenario:stock:${resource}:${a.kingdomId}`,
            reason: "frozen_synthetic_fixture",
            gameTimeMs: 0,
          });
      }
    }
    await c.query("UPDATE kingdom_buildings SET level=$2 WHERE kingdom_id=$1 AND kind='hall'", [
      lender.kingdomId,
      input.lenderHall,
    ]);
    for (const [a, level] of [
      [host, input.hostBarracks],
      [lender, input.lenderBarracks],
      [enemy, input.enemyBarracks],
    ] as const)
      await c.query("UPDATE kingdom_buildings SET level=$2 WHERE kingdom_id=$1 AND kind='barracks'", [
        a.kingdomId,
        level,
      ]);
    for (const [a, n, type] of [
      [lender, input.helpSpearmen, "spearman"],
      [enemy, input.attackerSpearmen, "spearman"],
      [enemy, input.attackerArchers, "archer"],
    ] as const) {
      for (let i = 0; i < n; i++)
        await c.query(
          "INSERT INTO kingdom_troops(id,product_scope,owner_kingdom_id,host_kingdom_id,type,home_guard,placement,created_game_time_ms,created_at) VALUES($1,'pact',$2,$2,$3,false,'home',0,clock_timestamp())",
          [stable(w, `troop:${a.kingdomId}:${type}:${i}`), a.kingdomId, type],
        );
    }
  });
}
async function command(w: World, actor: Actor, key: string, action: CommandEnvelope["action"]) {
  const scope = ProductScopeSchema.parse("pact"),
    commandId = stable(w, key),
    principal = { accountId: actor.accountId, productScope: scope, audience: "human" as const };
  const receipt = await services(w).dispatcher.dispatch(principal, {
    schemaVersion: "pact.command.v1",
    commandId,
    actor: {
      principalId: actor.accountId,
      productScope: scope,
      audience: "human",
      subject: { type: "account", id: actor.accountId },
    },
    action,
    submittedAt: "2026-10-17T00:00:00.000Z",
  });
  if (!["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.code)) throw Error(`SCENARIO_COMMAND_${receipt.code}`);
  return receipt;
}
/** Scripted deterministic mechanics qualification. Choices are explicit fixture inputs, never model output. */
export async function playScenario(w: World, choice: "accept" | "wait") {
  const { input, scenario } = fixture(w),
    { host, lender, enemy } = actors(w),
    r = services(w),
    offerId = stable(w, "offer"),
    raidId = stable(w, "raid");
  if ((await w.pool.query("SELECT 1 FROM command_receipts LIMIT 1")).rowCount)
    throw Error("PLAYBACK_ONLY_WORLD_ALREADY_PLAYED");
  const buildingsBefore = (
    await w.pool.query("SELECT kingdom_id,kind,level FROM kingdom_buildings ORDER BY kingdom_id,kind")
  ).rows;
  await command(w, lender, "offer", {
    kind: "game.garrison.offer",
    hostKingdomId: host.kingdomId,
    terms: {
      units: [{ type: "spearman", count: input.helpSpearmen }],
      durationHours: 1,
      lenderBond: null,
      hostBond: input.hostSilverBond ? { resource: "silver", wholeAmount: input.hostSilverBond } : null,
    },
    expiryMinutes: 15,
  });
  await command(w, lender, "lender-sign", { kind: "game.garrison.sign", offerId, version: 1 });
  if (input.attackerSpearmen)
    await command(w, enemy, "raid", {
      kind: "game.raid.declare",
      targetKingdomId: host.kingdomId,
      units: [
        { type: "spearman", count: input.attackerSpearmen },
        { type: "archer", count: input.attackerArchers },
      ],
      lootPriority: ["silver", "iron", "grain"],
    });
  const lease = await r.world.acquireLease("isolated-scenario");
  if (!lease) throw Error("SCENARIO_LEASE");
  let contractId: string | null = null,
    visitorsBeforeLock = 0,
    bondReserved = "0";
  for (let minute = 1; minute <= input.endMinute; minute++) {
    await w.pool.query(
      "UPDATE world_clocks SET next_tick_due_at=clock_timestamp()-interval '1 second',last_heartbeat_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval '30 seconds' WHERE product_scope='pact'",
    );
    const tick = await r.world.advance("isolated-scenario", lease);
    if (tick.kind !== "committed") throw Error(`SCENARIO_TICK_${tick.kind}`);
    if (minute === input.acceptAtMinute && choice === "accept") {
      await command(w, host, "host-sign", { kind: "game.garrison.sign", offerId, version: 1 });
      contractId =
        (await w.pool.query("SELECT id FROM garrison_contracts WHERE offer_id=$1", [offerId])).rows[0]?.id ?? null;
      visitorsBeforeLock = (
        await w.pool.query(
          "SELECT count(*)::int n FROM kingdom_troops WHERE placement_ref=$1 AND placement='visiting'",
          [contractId],
        )
      ).rows[0].n;
      bondReserved =
        (
          await w.pool.query(
            "SELECT coalesce(sum(locked_units),0)::text n FROM resource_balances WHERE kingdom_id=$1 AND resource='silver'",
            [host.kingdomId],
          )
        ).rows[0]?.n ?? "0";
    }
    if (contractId && input.earlyRecallAtMinute === minute)
      await command(w, lender, "early-recall", { kind: "game.garrison.exit", contractId });
  }
  const raid = (
    await w.pool.query(
      "SELECT declared_game_time_ms,lock_game_time_ms,resolution_game_time_ms FROM raids WHERE id=$1",
      [raidId],
    )
  ).rows[0];
  return {
    requiresMessage: scenario.requiresMessage ?? false,
    contractId,
    visitorsBeforeLock,
    bondReserved,
    resolutionMinutes: raid
      ? (Number(raid.resolution_game_time_ms) - (Math.floor(Number(raid.declared_game_time_ms) / 60000) + 1) * 60000) /
        60000
      : null,
    declarationToResolutionMinutes: raid
      ? (Number(raid.resolution_game_time_ms) - Number(raid.declared_game_time_ms)) / 60000
      : null,
    lockMinutesBeforeResolution: raid
      ? (Number(raid.resolution_game_time_ms) - Number(raid.lock_game_time_ms)) / 60000
      : null,
    buildingsIntact:
      JSON.stringify(
        (await w.pool.query("SELECT kingdom_id,kind,level FROM kingdom_buildings ORDER BY kingdom_id,kind")).rows,
      ) === JSON.stringify(buildingsBefore),
  };
}
export interface OutcomeEvidence {
  schemaVersion: "pact.scenario-outcome.v1";
  evidence: "deterministic_fake";
  scenario: string;
  replicaId: string;
  split: string;
  seed: number;
  rulesId: string;
  environmentTimeMs: string;
  garrisonFulfilment: "fulfilled" | "defaulted" | "pending" | "not_applicable";
  defenseResult: "won" | "lost" | "pending" | "not_applicable";
  motiveProven: false;
  obligations: { due: number; fulfilled: number; defaulted: number; pending: number };
  losses: { ownTroops: number; hostedTroops: number; lootedUnits: Record<string, string> };
  upkeep: { shortageMinutes: number; coveredMinutes: number };
  sourceRefs: string[];
  coverage: {
    opponentPrivateState: false;
    privatePeerText: false;
    validWait: boolean;
    obligations: string;
    losses: string;
    upkeep: string;
  };
}
/** Owner-accessible authoritative readback only. No counterfactual claims, grading or private messages. */
export async function readScenarioOutcome(w: World, actor: Actor): Promise<OutcomeEvidence> {
  if (!w.players.some((p) => p.accountId === actor.accountId && p.kingdomId === actor.kingdomId))
    throw Error("ACTOR_NOT_IN_WORLD");
  return withTransaction(w.pool, async (c) => {
    await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const contracts = (
      await c.query(
        "SELECT id,status,host_default,lender_default,close_reason FROM garrison_contracts WHERE product_scope='pact' AND $1 IN(host_kingdom_id,lender_kingdom_id) ORDER BY id",
        [actor.kingdomId],
      )
    ).rows;
    const battles = (
      await c.query(
        "SELECT id,status,public_report,participant_report FROM raids WHERE product_scope='pact' AND target_kingdom_id=$1 ORDER BY id",
        [actor.kingdomId],
      )
    ).rows;
    const upkeep = (
      await c.query(
        "SELECT count(*)::int n,count(*) FILTER(WHERE NOT fully_funded)::int shortage FROM achievement_upkeep_checks WHERE kingdom_id=$1",
        [actor.kingdomId],
      )
    ).rows[0];
    const fulfilled = contracts.filter(
        (x) => x.status === "closed" && !x.host_default && !x.lender_default && x.close_reason === "expiry",
      ).length,
      defaulted = contracts.filter((x) => x.host_default || x.lender_default).length,
      pending = contracts.length - fulfilled - defaulted;
    let ownTroops = 0,
      hostedTroops = 0;
    const lootedUnits: Record<string, string> = { iron: "0", silver: "0", grain: "0" };
    for (const b of battles) {
      const trace = b.participant_report?.trace;
      for (const g of trace?.casualtyGroups ?? []) {
        if (g.ownerId === actor.kingdomId) ownTroops += g.lostUnitIds.length;
        if (g.side === "defender") hostedTroops += g.lostUnitIds.length;
      }
      for (const k of Object.keys(lootedUnits))
        lootedUnits[k] = String(BigInt(lootedUnits[k] ?? "0") + BigInt(trace?.lootTaken?.[k] ?? 0));
    }
    const last = battles.at(-1),
      noThreat = !fixture(w).input.attackerSpearmen;
    return {
      schemaVersion: "pact.scenario-outcome.v1",
      evidence: "deterministic_fake",
      scenario: w.replica.scenario,
      replicaId: w.replica.replicaId,
      split: w.replica.split,
      seed: w.replica.seed,
      rulesId: design.rulesId,
      environmentTimeMs: (await c.query("SELECT committed_game_time_ms FROM world_clocks WHERE product_scope='pact'"))
        .rows[0].committed_game_time_ms,
      garrisonFulfilment: defaulted ? "defaulted" : fulfilled ? "fulfilled" : pending ? "pending" : "not_applicable",
      defenseResult: last
        ? last.status === "resolved"
          ? last.public_report.winner === "defender"
            ? "won"
            : "lost"
          : "pending"
        : "not_applicable",
      motiveProven: false,
      obligations: { due: fulfilled + defaulted, fulfilled, defaulted, pending },
      losses: { ownTroops, hostedTroops, lootedUnits },
      upkeep: { shortageMinutes: upkeep.shortage, coveredMinutes: upkeep.n },
      sourceRefs: [...contracts.map((x) => `garrison-contract:${x.id}`), ...battles.map((x) => `raid:${x.id}`)],
      coverage: {
        opponentPrivateState: false,
        privatePeerText: false,
        validWait: noThreat && contracts.length === 0,
        obligations:
          "Garrison obligations only; closed expiry without default is fulfilled. Admission alone is pending. No supply contract invented.",
        losses:
          "Authorized defender battle readbacks only; military casualties and ordinary loot, not all-cause losses or hidden opponent state.",
        upkeep: "Count of actual recorded minute checks, not elapsed wall time or current consecutive hunger counter.",
      },
    };
  });
}
/** Playback is read-only reconstruction from retained authoritative rows, never another inference/command run. */
export const playbackScenario = readScenarioOutcome;

export async function scenarioEvents(w: World, actor: Actor) {
  if (!w.players.some((p) => p.accountId === actor.accountId && p.kingdomId === actor.kingdomId))
    throw Error("ACTOR_NOT_IN_WORLD");
  const clock = { now: () => new Date("2026-10-17T00:00:00Z") };
  let projector: AgentEventProjector;
  const feed = new AgentEventService(w.pool, {
    productScope: "pact",
    worldScope: w.replica.replicaId,
    clock,
    cursorKey: Buffer.alloc(32, 3),
    authorizeOwner: (c, id) => projector.authorizeOwner(c, id),
    authorize: (c, a, e) => projector.authorized(c, a, e),
  });
  projector = new AgentEventProjector(w.pool, {
    productScope: "pact",
    clock,
    publish: (c, p) => feed.publishForAccount(c, p),
  });
  while ((await projector.processBatch(100)).delivered > 0) {}
  return feed.read({ ...actor, productScope: "pact", audience: "human" }, undefined, 50);
}
