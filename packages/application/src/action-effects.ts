import { isDeepStrictEqual } from "node:util";
import {
  type ActionEffects,
  type ActionEffectsGuard,
  ActionEffectsGuardSchema,
  ActionEffectsSchema,
  actionEffectsCoverage,
  type CommandEnvelope,
  type EffectClaim,
  parseAcceptedCommand,
} from "@pact/contracts";
import { withTransaction } from "@pact/db";
import {
  type BuildingLevels,
  checkUpgrade,
  communicationPolicy,
  rulesCatalog,
  trainingQuote,
  type UnitKind,
  wholeResources,
} from "@pact/domain";
import {
  type ActionEffectFacts,
  effectDigest,
  isClosedOwnedActionEffectOffer,
  readActionEffectFacts,
  readActionEffectPeer,
  type SupplyTerms,
  supplyExposure,
  upgradeQuote,
} from "@pact/kingdom";
import type { Pool, PoolClient } from "pg";
import { type AuthenticatedPrincipal, DispatcherError } from "./types.js";

/** Owner-local exact consequences; private counterpart predicates are bound by opaque source digests. */
export class ActionEffectsService {
  constructor(
    private pool: Pool,
    private scope: string,
    private now: () => Date = () => new Date(),
  ) {}
  private principal(p: AuthenticatedPrincipal) {
    if (
      p.productScope !== this.scope ||
      p.audience === "service" ||
      (p.audience === "agent" && !p.agentScopes?.includes("world:read"))
    )
      throw new DispatcherError("FORBIDDEN");
  }
  async quote(principal: AuthenticatedPrincipal, raw: unknown): Promise<ActionEffects> {
    this.principal(principal);
    const command = parseAcceptedCommand(raw),
      at = this.now();
    return withTransaction(this.pool, async (client) => {
      await client.query("SET TRANSACTION READ ONLY");
      return this.compute(client, principal, command, at);
    });
  }
  private async compute(
    client: PoolClient,
    principal: AuthenticatedPrincipal,
    command: CommandEnvelope,
    at: Date,
    lock = false,
  ) {
    try {
      return await this.within(client, principal, command, at, lock);
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN" && !(error instanceof DispatcherError))
        throw new DispatcherError("FORBIDDEN");
      if (error instanceof Error && error.message === "ACTION_EFFECTS_COVERAGE_LIMIT")
        throw new DispatcherError("INVALID_COMMAND");
      throw error;
    }
  }
  private async within(
    client: PoolClient,
    principal: AuthenticatedPrincipal,
    command: CommandEnvelope,
    at: Date,
    lock = false,
  ): Promise<ActionEffects> {
    const action = command.action;
    if (!(actionEffectsCoverage as readonly string[]).includes(action.kind))
      throw new DispatcherError("INVALID_COMMAND");
    const f = await readActionEffectFacts(client, this.scope, principal.accountId, at, lock),
      { data, owner } = f;
    const claims: EffectClaim[] = [],
      capacities: ActionEffects["capacities"] = [],
      sources = [`world:${owner.id}:${f.clock.tick_sequence}`, `effects-owner:${f.revision}`];
    const cap = (schemaId: string, key: string, remaining: bigint | number) => {
      if (!capacities.some((c) => c.schemaId === schemaId && c.key === key))
        capacities.push({ schemaId, key, remainingUnits: String(remaining < 0 ? 0 : remaining) });
    };
    const claim = (
      kind: "resource" | "authority",
      schemaId: string,
      key: string,
      units: bigint | number,
      remaining: bigint | number,
    ) => {
      claims.push({ kind, schemaId, key, units: String(units) });
      cap(schemaId, key, remaining);
    };
    const promise = (key: string, value: unknown) =>
      claims.push({ kind: "promise", schemaId: "pact.promise.v1", key, value: JSON.stringify(value) });
    const balance = (asset: string) => data.resource_balances.find((r) => r.resource === asset);
    const ordinary = (asset: string) => BigInt(balance(asset)?.ordinary_units ?? 0);
    const floor = (asset: string) => BigInt(f.authority.resources[asset]?.reserveFloorUnits ?? 0);
    const authority = (asset: string, units: bigint) => {
      if (principal.audience === "agent")
        claim("authority", "pact.authority.v1", asset, units, BigInt(f.authority.resources[asset]?.headroomUnits ?? 0));
    };
    const spend = (asset: string, units: bigint, construction = false) => {
      const row = balance(asset),
        grant =
          construction && f.time < Number(data.ledger_kingdoms[0]?.grant_expires_game_time_ms ?? 0)
            ? BigInt(row?.allowance_units ?? 0)
            : 0n;
      const allowance = units < grant ? units : grant,
        own = units - allowance;
      claim("resource", "pact.stock.v1", `${asset}:ordinary`, own, ordinary(asset) - floor(asset));
      if (construction) claim("resource", "pact.stock.v1", `${asset}:founding`, allowance, grant);
    };
    const quota = (kind: string, limit: number | null) => {
      if (limit !== null)
        claim(
          "resource",
          "pact.quota.v1",
          kind,
          1,
          limit -
            data.kingdom_action_events.filter((r) => r.kind === kind && Number(r.game_time_ms) > f.time - 86400000)
              .length,
        );
    };
    const envelope = () => {
      const bucket = data.communication_buckets[0],
        credits = bucket
          ? Math.min(
              30000,
              Number(bucket.credits_ms) + Math.max(0, at.getTime() - new Date(bucket.updated_at).getTime()),
            )
          : 30000;
      claim("resource", "pact.communication.v1", "sender-credits-ms", communicationPolicy.tokenIntervalMs, credits);
    };
    let peer: string | undefined;
    if ("recipientKingdomId" in action) peer = action.recipientKingdomId;
    if ("counterpartyKingdomId" in action) peer = action.counterpartyKingdomId;
    if (action.kind === "game.contact.answer") {
      const request = data.cold_contact_requests.find((r) => r.id === action.requestId);
      if (!request || request.recipient_kingdom_id !== owner.id) throw new DispatcherError("FORBIDDEN");
      if (Number(request.expires_game_time_ms) <= f.time) throw new DispatcherError("EXPIRED");
      peer = request.sender_kingdom_id;
      promise(`contact:${action.requestId}`, { accept: action.accept });
    }
    let offer: ActionEffectFacts["data"]["supply_offers"][number] | undefined;
    if (action.kind === "game.supply.counter" || action.kind === "game.supply.sign") {
      offer = data.supply_offers.find((r) => r.id === action.offerId);
      if (!offer && (await isClosedOwnedActionEffectOffer(client, this.scope, owner.id, action.offerId)))
        throw new DispatcherError("EXPIRED");
      if (!offer || (offer.kingdom_a !== owner.id && offer.kingdom_b !== owner.id))
        throw new DispatcherError("FORBIDDEN");
      if (Number(offer.expires_game_time_ms) <= f.time || offer.status !== "open") throw new DispatcherError("EXPIRED");
      if (offer.version !== (action.kind === "game.supply.sign" ? action.version : action.expectedVersion))
        throw new DispatcherError("STALE_VERSION");
      peer = offer.kingdom_a === owner.id ? offer.kingdom_b : offer.kingdom_a;
    }
    if (peer) {
      if (peer === owner.id) throw new DispatcherError("INVALID_COMMAND");
      const external = await readActionEffectPeer(client, this.scope, owner.id, peer);
      sources.push(`effects-peer:${external.revision}`);
      if (action.kind === "game.contact.request")
        claim(
          "resource",
          "pact.communication.v1",
          `introductions:${peer}`,
          Buffer.byteLength(action.note),
          communicationPolicy.recipientPendingIntroductionBytes - external.pendingIntroductionBytes,
        );
      if (action.kind === "game.message.send")
        claim(
          "resource",
          "pact.communication.v1",
          `unread:${peer}`,
          Buffer.byteLength(action.body),
          communicationPolicy.recipientPendingMessageBytes - external.unreadBytes,
        );
    }
    switch (action.kind) {
      case "game.message.send": {
        envelope();
        quota("outgoing_message", rulesCatalog.actionLimits.outgoingMessagesPerDay);
        const run = data.envoy_runs.find((r) => r.run_id === principal.sessionId);
        if (run)
          claim("resource", "pact.quota.v1", "run-messages", 1, Number(run.max_messages) - Number(run.used_messages));
        promise(`message:${command.commandId}`, { recipient: peer, bodyDigest: effectDigest(action.body) });
        break;
      }
      case "game.contact.request":
        envelope();
        quota("cold_contact", rulesCatalog.actionLimits.coldContactsPerDay);
        promise(`contact:${peer}`, "request");
        break;
      case "game.contact.answer":
        break;
      case "game.building.queue": {
        const q = upgradeQuote(action.building, action.targetLevel, f.time),
          levels = Object.fromEntries(data.kingdom_buildings.map((r) => [r.kind, r.level])) as BuildingLevels;
        const active = data.building_instructions.some((r) => r.builder_slot === action.slot && r.state === "active");
        const canStart =
          !active &&
          checkUpgrade(levels, action.building, action.targetLevel) === "ready" &&
          (["iron", "silver"] as const).every((asset) => {
            const grant =
              f.time < Number(data.ledger_kingdoms[0]?.grant_expires_game_time_ms ?? 0)
                ? BigInt(balance(asset)?.allowance_units ?? 0)
                : 0n;
            const debit = q[asset] > grant ? q[asset] - grant : 0n;
            return ordinary(asset) >= debit + floor(asset);
          });
        for (const asset of ["iron", "silver"] as const) {
          authority(asset, q[asset]);
          if (canStart) spend(asset, q[asset], true);
        }
        claim(
          "resource",
          "pact.capacity.v1",
          `builder-waiting:${action.slot}`,
          1,
          data.building_instructions.some((r) => r.builder_slot === action.slot && r.state === "waiting") ? 0 : 1,
        );
        promise(`building:${action.building}`, {
          slot: action.slot,
          targetLevel: action.targetLevel,
          immediateStart: canStart,
          futureCost: { iron: String(q.iron), silver: String(q.silver) },
        });
        break;
      }
      case "game.training.queue": {
        const q = trainingQuote(action.type as UnitKind, action.count);
        for (const asset of ["iron", "silver"] as const) {
          authority(asset, q[asset]);
          spend(asset, q[asset]);
        }
        claim("resource", "pact.capacity.v1", "training-lane", 1, data.training_batches.length ? 0 : 1);
        const barracks = Number(data.kingdom_buildings.find((r) => r.kind === "barracks")?.level ?? 1),
          capacity = rulesCatalog.levels[barracks - 1]?.ownedTroopSlots ?? 0;
        claim(
          "resource",
          "pact.capacity.v1",
          "owned-troops",
          action.count,
          capacity - data.kingdom_troops.filter((r) => r.owner_kingdom_id === owner.id).length,
        );
        promise(`training:${command.commandId}`, {
          type: action.type,
          count: action.count,
          grainPerMinute: String(q.additionalGrainPerMinute),
        });
        break;
      }
      case "game.supply.offer":
      case "game.supply.counter":
        envelope();
        quota("offer_action", rulesCatalog.actionLimits.offerActionsPerDay);
        promise(`offer:${action.kind === "game.supply.counter" ? action.offerId : command.commandId}`, {
          terms: action.terms,
          peer,
          unaccepted: true,
          releasePriorSignatures: action.kind === "game.supply.counter",
        });
        break;
      case "game.supply.sign": {
        if (!offer) throw new DispatcherError("INVALID_COMMAND");
        const signatures = data.supply_offer_signatures.filter(
            (r) => r.offer_id === offer.id && r.version === offer.version,
          ),
          existing = signatures.some((r) => r.kingdom_id === owner.id),
          t = offer.terms as SupplyTerms;
        const ownIsA = offer.kingdom_a === owner.id,
          flow = ownIsA ? t.aToB : t.bToA,
          incoming = ownIsA ? t.bToA : t.aToB,
          bond = ownIsA ? t.aBond : t.bBond;
        if (!existing) {
          quota("offer_action", rulesCatalog.actionLimits.offerActionsPerDay);
          for (const [asset, n] of Object.entries(supplyExposure(flow, bond, t.durationHours))) authority(asset, n);
          if (flow)
            claim(
              "resource",
              "pact.capacity.v1",
              "supply-outgoing",
              1,
              rulesCatalog.supply.maxOutgoing -
                data.supply_contracts.filter((r) => (r.kingdom_a === owner.id ? r.terms.aToB : r.terms.bToA)).length,
            );
          if (incoming)
            claim(
              "resource",
              "pact.capacity.v1",
              "supply-incoming",
              1,
              rulesCatalog.supply.maxIncoming -
                data.supply_contracts.filter((r) => (r.kingdom_a === owner.id ? r.terms.bToA : r.terms.aToB)).length,
            );
          if (signatures.length === 1 && bond) {
            spend(bond.resource, wholeResources(bond.wholeAmount));
            const locked = data.resource_balances.reduce((n, r) => n + BigInt(r.locked_units), 0n),
              capacity =
                (BigInt(data.resource_balances[0]?.storage_cap_units ?? 0) *
                  BigInt(rulesCatalog.supply.totalBondCapacityPercent)) /
                100n;
            claim(
              "resource",
              "pact.capacity.v1",
              "total-bond-units",
              wholeResources(bond.wholeAmount),
              capacity - locked,
            );
          }
        }
        promise(`supply:${offer.id}:${offer.version}`, {
          flow,
          bond,
          durationHours: t.durationHours,
          existingOwnSignature: existing,
          activatesNow: !existing && signatures.length === 1,
          deliveryUnproven: true,
        });
        break;
      }
    }
    return ActionEffectsSchema.parse({
      schemaVersion: "fleet.action-effects.v1",
      revision: f.revision,
      intentDigest: effectDigest({
        schemaVersion: command.schemaVersion,
        commandId: command.commandId,
        expectedVersion: command.expectedVersion ?? null,
        action: command.action,
      }),
      actionKey: action.kind,
      claims,
      capacities,
      sourceRefs: sources,
      validUntil: { clockId: "utc", value: new Date(at.getTime() + 30000).toISOString() },
      coverage: { complete: true, omitted: [] },
      supported: true,
    });
  }
  async validateWithin(
    client: PoolClient,
    principal: AuthenticatedPrincipal,
    command: CommandEnvelope,
    raw: ActionEffectsGuard,
    gameTimeMs: number,
  ) {
    const guard = ActionEffectsGuardSchema.parse(raw),
      until = Date.parse(guard.expectedEffects.validUntil.value),
      now = this.now();
    if (
      guard.expectedEffects.validUntil.clockId !== "utc" ||
      !Number.isFinite(until) ||
      until <= now.getTime() ||
      until > now.getTime() + 30000
    )
      throw new DispatcherError("EXPIRED");
    const current = await this.compute(client, principal, command, new Date(until - 30000), true);
    if (guard.expectedRevision !== current.revision || !isDeepStrictEqual(current, guard.expectedEffects))
      throw new DispatcherError("STALE_VERSION");
    // Validate current reserve constraints in the same snapshot as the real handler.
    if (guard.reserveConstraints) {
      const facts = await readActionEffectFacts(client, this.scope, principal.accountId, now);
      if (facts.time !== gameTimeMs) throw new DispatcherError("STALE_VERSION");
      for (const [asset, minimum] of Object.entries(guard.reserveConstraints)) {
        const debit = current.claims
          .filter((c) => c.kind === "resource" && c.schemaId === "pact.stock.v1" && c.key === `${asset}:ordinary`)
          .reduce((n, c) => n + (c.kind === "resource" ? BigInt(c.units) : 0n), 0n);
        if (
          BigInt(facts.data.resource_balances.find((r) => r.resource === asset)?.ordinary_units ?? 0) - debit <
          BigInt(minimum)
        )
          throw new DispatcherError("RESERVE_FLOOR");
      }
    }
  }
}
