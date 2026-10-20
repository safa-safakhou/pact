import { randomBytes, randomUUID } from "node:crypto";
import {
  AgentGuideReader,
  type AuthenticatedPrincipal,
  CommandDispatcher,
  GameCommandHandler,
} from "@pact/application";
import { AuthorityService, ExactHumanPermitService, ExposureService } from "@pact/authority";
import {
  type CommandEnvelope,
  type CommandReceipt,
  type GameAction,
  type ObservationSectionQuery,
  ProductScopeSchema,
} from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import {
  ActionLimitService,
  GarrisonService,
  ImmediateExposureAdapter,
  KingdomService,
  SocialOverviewReader,
  SocialService,
  SupplyExposureAdapter,
  SupplyService,
  WorldViewService,
} from "@pact/kingdom";
import { OnboardingService } from "@pact/onboarding";
import { RunService } from "@pact/runs";
import type { Pool } from "pg";
import { createRulesRuntime } from "../../workers/rules/src/runtime.js";
import { NegotiationTermsSchema } from "./negotiation-contracts.js";
import design from "./negotiation-design.json" with { type: "json" };
import { designDigest, type NegotiationCell, negotiationPlan } from "./negotiation-plan.js";

type OwnedTarget = { pactUrl: string; nonce: string };
type Resource = "iron" | "silver" | "grain";
export type NegotiationPlayer = {
  accountId: string;
  kingdomId: string;
  role: "A" | "B";
  goalDigest: string;
  ordinaryStart: Record<Resource, string>;
};
type Snapshot = NonNullable<Awaited<ReturnType<WorldViewService["readSelf"]>>>;
export interface NegotiationActor {
  dispatch(action: GameAction, commandId?: string): Promise<CommandReceipt>;
  receipt(commandId: string): Promise<CommandReceipt | null>;
  readSelf(): Promise<Snapshot | null>;
  readPeer(kingdomId: string): ReturnType<WorldViewService["read"]>;
  readSection(query: ObservationSectionQuery): ReturnType<WorldViewService["readSection"]>;
  guide(topic?: "start" | "diplomacy" | "authority"): Promise<Record<string, unknown>>;
  history(): Promise<{ gameTimeMs: string; observation: Snapshot }[]>;
}
export interface NegotiationWorld {
  worldId: string;
  pool: Pool;
  cell: NegotiationCell;
  control: boolean;
  players: readonly [NegotiationPlayer, NegotiationPlayer];
  openingOfferId: string | null;
  decisionStartGameTimeMs: number;
  actor(kingdomId: string): NegotiationActor;
  advanceTo(gameMinute: number): Promise<void>;
  ownerSetSupplyPermission(index: number, allowed: boolean): Promise<void>;
  close(): Promise<void>;
}
export async function createNegotiationWorld(
  target: OwnedTarget,
  cell: NegotiationCell,
  options: { control?: boolean } = {},
): Promise<NegotiationWorld> {
  let parsed: URL;
  try {
    parsed = new URL(target.pactUrl);
  } catch {
    throw Error("NEGOTIATION_OWNED_FIXTURE_REQUIRED");
  }
  if (
    parsed.hostname !== "127.0.0.1" ||
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.pathname !== "/pact_test" ||
    !parsed.port ||
    [5432, 5436, 5437, 5438, 5439, 5451, 5452].includes(Number(parsed.port)) ||
    parsed.search ||
    parsed.hash ||
    !/^[a-f0-9]{64}$/.test(target.nonce)
  )
    throw Error("NEGOTIATION_OWNED_FIXTURE_REQUIRED");
  const admin = createPool(target.pactUrl);
  let schema: string | undefined, pool: Pool | undefined;
  try {
    const marker = (await admin.query("SELECT nonce FROM public.architecture_fixture_owner")).rows;
    if (marker.length !== 1 || marker[0]?.nonce !== target.nonce) throw Error("NEGOTIATION_OWNED_FIXTURE_REQUIRED");
    const planned = negotiationPlan(cell.stage, {
      sources: cell.sources,
      modelDigest: cell.modelDigest,
      policyDigest: cell.policyDigest,
      selectedProfile: cell.profile,
    }).find((c) => c.id === cell.id);
    if (!planned || designDigest(planned) !== designDigest(cell)) throw Error("NEGOTIATION_DESIGN_MISMATCH");
    const family = design.families.find((f) => f.id === cell.family);
    if (!family?.variants.includes(cell.variant) || cell.realProviderAuthorized !== false)
      throw Error("UNPLANNED_NEGOTIATION_CELL");
    const expected = designDigest({
      state: family.initialState,
      variant: cell.variant,
      rolesReversed: cell.rolesReversed,
      rulesId: design.rulesId,
    });
    if (expected !== cell.initialStateDigest) throw Error("NEGOTIATION_DESIGN_MISMATCH");
    schema = await createTestSchema(admin, "negotiation");
    pool = createSchemaPool(target.pactUrl, schema);
    const db = pool,
      worldId = randomUUID(),
      clock = { now: () => new Date() };
    await db.query(
      "CREATE TABLE negotiation_fixture_identity(world_id uuid PRIMARY KEY,nonce text,cell_id text,initial_state_digest text,decision_start_game_time_ms bigint DEFAULT 0)",
    );
    await db.query(
      "INSERT INTO negotiation_fixture_identity(world_id,nonce,cell_id,initial_state_digest) VALUES($1,$2,$3,$4)",
      [worldId, target.nonce, cell.id, cell.initialStateDigest],
    );
    await db.query(
      "CREATE TABLE negotiation_fixture_commands(command_id uuid PRIMARY KEY,actor_id uuid,kind text,scripted_prefix boolean,game_time_ms bigint,wall_time timestamptz,receipt jsonb)",
    );
    await db.query(
      "CREATE TABLE negotiation_fixture_observations(sequence bigserial PRIMARY KEY,actor_id uuid,game_time_ms bigint,observation jsonb)",
    );
    await db.query(
      "CREATE TABLE negotiation_fixture_ticks(sequence bigint PRIMARY KEY,game_time_ms bigint,wall_time timestamptz)",
    );
    const runtime = createRulesRuntime(db, "pact", randomBytes(32), undefined, 0);
    await runtime.world.bootstrap();
    await db.query(
      "UPDATE world_clocks SET committed_game_time_ms=0,tick_sequence=0,next_tick_due_at=clock_timestamp()+interval '10 minutes',last_heartbeat_at=clock_timestamp() WHERE product_scope='pact'",
    );
    const identity = new IdentityService(db, {
      guestPlayEnabled: true,
      productScope: "pact",
      currentTermsVersion: "terms-v1",
      allowedOrigins: new Set(["https://negotiation.example.test"]),
      clock,
      digester: new TokenDigester(randomBytes(32)),
      secretBox: new AesGcmSecretBox(randomBytes(32)),
      compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
    });
    const authority = new AuthorityService(db, { productScope: "pact", identity, now: clock.now });
    const onboarding = new OnboardingService(db, {
      productScope: "pact",
      currentTermsVersion: "terms-v1",
      now: clock.now,
    });
    const kingdoms = new KingdomService(db, {
      productScope: "pact",
      world: runtime.world,
      ledger: runtime.ledger,
      onboarding,
    });
    const runs = new RunService(db, { productScope: "pact", clock });
    const permits = new ExactHumanPermitService("pact"),
      exposure = new ExposureService("pact", permits),
      limits = new ActionLimitService("pact");
    const social = new SocialService("pact", runtime.ledger, limits, clock, new ImmediateExposureAdapter(exposure));
    const supply = new SupplyService("pact", runtime.ledger, limits, social, new SupplyExposureAdapter(exposure));
    const views = new WorldViewService(db, "pact");
    const guide = new AgentGuideReader(views, new SocialOverviewReader(db, "pact"), authority);
    const handler = new GameCommandHandler(
      social,
      (c, a, h) => runs.assertAgentWriteLease(c, a, h),
      kingdoms,
      runtime.troops,
      runtime.buildings,
      permits,
      supply,
      undefined,
      exposure,
      runtime.scouting,
      new GarrisonService("pact", runtime.ledger, runtime.troops, exposure, permits),
      runtime.raids,
      (c, accountId, holderId) => runs.consumeOutgoingMessageAllowance(c, accountId, holderId),
    );
    const people: NegotiationPlayer[] = [],
      credentials = new Map<string, { token: string; holderId: string; principal: AuthenticatedPrincipal }>();
    const state = family.initialState;
    for (let index = 0; index < 2; index++) {
      const role = (cell.rolesReversed ? (index === 0 ? "B" : "A") : index === 0 ? "A" : "B") as "A" | "B";
      const session = await identity.joinGuest(randomUUID());
      const human = await identity.authenticate(session.sessionToken);
      const draft = await onboarding.ensureDraft(session.accountId);
      const suffix = designDigest({ seed: cell.worldSeed, index }).slice(0, 12);
      await onboarding.updateDraft(session.accountId, {
        displayName: `Negotiator ${suffix}`,
        proposedHandle: `neg_${suffix}`,
        portrait: "portrait.wolf",
        expectedVersion: draft.version,
      });
      await onboarding.recordConnectionCheck(session.accountId);
      const activated = await kingdoms.activate(session.accountId);
      const mandate = await authority.ensureMandate(session.accountId);
      await authority.raiseMandate(session.sessionToken, {
        allowedActions: ["world.read", "inbox.read", "message.send.contact", "contact.request", "supply.sign"],
        resourceLimits: { iron: "600000", silver: "600000", grain: "600000" },
        reserveFloors: {},
        expectedVersion: mandate.version,
      });
      await withTransaction(db, (c) =>
        social.configureDelegation(
          c,
          session.accountId,
          { mode: "agent_decides", allowedKingdomIds: [], expectedVersion: 0 },
          0,
        ),
      );
      const goal = state.goals[role];
      await kingdoms.setAmbition(session.accountId, JSON.stringify(goal));
      const holderId = randomUUID();
      await runs.openMcpLease({ accountId: session.accountId, holderId });
      credentials.set(activated.kingdomId, {
        token: session.sessionToken,
        holderId,
        principal: {
          accountId: session.accountId,
          productScope: ProductScopeSchema.parse("pact"),
          audience: "agent",
          sessionId: holderId,
          agentOrigin: "external",
          agentScopes: ["world:read", "game:act"],
        },
      });
      await withTransaction(db, async (c) => {
        for (const resource of ["iron", "silver", "grain"] as const) {
          const value = state.ordinaryStocks[role][resource];
          if (value)
            await runtime.ledger.creditOrdinary(c, {
              kingdomId: activated.kingdomId,
              resource,
              amount: wholeResources(value),
              operationKey: `fixture-initial:${resource}`,
              reason: "fixture",
              gameTimeMs: 0,
            });
        }
      });
      const initial = await views.readSelf(session.accountId);
      if (!initial) throw Error("MISSING_FOUNDER");
      people.push({
        accountId: session.accountId,
        kingdomId: activated.kingdomId,
        role,
        goalDigest: designDigest(goal),
        ordinaryStart: {
          iron: initial.balances.iron.ordinaryUnits,
          silver: initial.balances.silver.ordinaryUnits,
          grain: initial.balances.grain.ordinaryUnits,
        },
      });
      if (human.accountId !== session.accountId) throw Error("IDENTITY_MISMATCH");
    }
    const first = people[0],
      second = people[1];
    if (!first || !second) throw Error("MISSING_NEGOTIATION_PLAYERS");
    const players: readonly [NegotiationPlayer, NegotiationPlayer] = [first, second];
    let prefix = true,
      closed = false,
      inFlight = 0;
    const dispatcher = new CommandDispatcher({
      pool: db,
      clock,
      productScope: "pact",
      game: {
        admit: (op) => runtime.world.admitCommand((c, s) => op(c, s.gameTimeMs)),
        execute: (c, p, v, t) => handler.execute(c, p, v, t),
      },
      onCommittedReceipt: async (c, p, command, receipt) => {
        const time = (await runtime.world.read(c)).gameTimeMs;
        const player = players.find((a) => a.accountId === p.accountId);
        if (!player) throw Error("NEGOTIATION_ACTOR_SCOPE_MISMATCH");
        await c.query("INSERT INTO negotiation_fixture_commands VALUES($1,$2,$3,$4,$5,$6,$7)", [
          command.commandId,
          player.kingdomId,
          command.action.kind,
          prefix,
          time,
          clock.now(),
          receipt,
        ]);
      },
    });
    const active = async () => {
      if (closed) throw Error("NEGOTIATION_WORLD_CLOSED");
      const row = (
        await db.query("SELECT nonce,cell_id FROM negotiation_fixture_identity WHERE world_id=$1", [worldId])
      ).rows[0];
      if (row?.nonce !== target.nonce || row.cell_id !== cell.id) throw Error("NEGOTIATION_WORLD_SCOPE_MISMATCH");
    };
    const mutateOwner = async (
      index: number,
      change: (current: NonNullable<Awaited<ReturnType<AuthorityService["getMandate"]>>>) => {
        allowedActions?: readonly string[];
        reserveFloors?: Record<string, string>;
      },
    ) => {
      const p = players[index];
      if (!p) throw Error("NEGOTIATION_ACTOR_SCOPE_MISMATCH");
      const credential = credentials.get(p.kingdomId);
      if (!credential) throw Error("MISSING_FIXTURE_CREDENTIAL");
      await identity.requireRecentHumanSession(credential.token, "authority.raise");
      const current = await authority.getMandate(p.accountId);
      if (!current) throw Error("MISSING_MANDATE");
      const next = change(current);
      await authority.raiseMandate(credential.token, {
        allowedActions: next.allowedActions ?? current.allowedActions,
        resourceLimits: current.resourceLimits,
        reserveFloors: next.reserveFloors ?? { ...current.reserveFloors },
        expectedVersion: current.version,
      });
    };
    let workerToken: string | null = null;
    const world: NegotiationWorld = {
      worldId,
      pool: db,
      cell,
      players,
      control: options.control === true,
      openingOfferId: null,
      decisionStartGameTimeMs: 0,
      actor(kingdomId) {
        const p = players.find((a) => a.kingdomId === kingdomId),
          credential = credentials.get(kingdomId);
        if (!p || !credential) throw Error("NEGOTIATION_ACTOR_SCOPE_MISMATCH");
        const requests = new Map<string, CommandEnvelope>();
        return {
          async dispatch(action, commandId = randomUUID()) {
            await active();
            if (options.control) throw Error("SOLO_CONTROL_NO_INTERACTION");
            inFlight++;
            try {
              await identity.authenticate(credential.token);
              const old = requests.get(commandId);
              const envelope =
                old && JSON.stringify(old.action) === JSON.stringify(action)
                  ? old
                  : {
                      schemaVersion: "pact.command.v2" as const,
                      commandId,
                      action,
                      actor: {
                        principalId: p.accountId,
                        productScope: ProductScopeSchema.parse("pact"),
                        audience: "agent" as const,
                        subject: { type: "account" as const, id: p.accountId },
                      },
                      submittedAt: clock.now().toISOString(),
                    };
              if (!old) requests.set(commandId, structuredClone(envelope));
              return await dispatcher.dispatch(credential.principal, envelope);
            } finally {
              inFlight--;
            }
          },
          async receipt(id) {
            await active();
            return dispatcher.lookupReceipt(credential.principal, id);
          },
          async readSelf() {
            await active();
            return views.readSelf(p.accountId);
          },
          async readPeer(id) {
            await active();
            return views.read(p.accountId, id);
          },
          async readSection(query) {
            await active();
            return views.readSection(p.accountId, query);
          },
          async guide(topic = "start") {
            await active();
            return guide.read(p.accountId, topic);
          },
          async history() {
            await active();
            return (
              await db.query(
                'SELECT game_time_ms::text AS "gameTimeMs",observation FROM negotiation_fixture_observations WHERE actor_id=$1 ORDER BY sequence',
                [p.kingdomId],
              )
            ).rows;
          },
        };
      },
      async advanceTo(gameMinute) {
        await active();
        if (cell.clockMode !== "controlled") throw Error("NATIVE_CLOCK_REQUIRES_ELAPSED_TIME");
        if (inFlight) throw Error("NEGOTIATION_OPERATION_IN_FLIGHT");
        if (!Number.isSafeInteger(gameMinute) || gameMinute < 0) throw Error("INVALID_FIXTURE_TIME");
        if (!workerToken) workerToken = await runtime.world.acquireLease(`negotiation:${worldId}`);
        if (!workerToken) throw Error("FIXTURE_WORLD_LEASE_REQUIRED");
        while ((await runtime.world.read()).gameTimeMs < gameMinute * 60000) {
          await db.query(
            "UPDATE world_clocks SET next_tick_due_at=clock_timestamp()-interval '1 second',last_heartbeat_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval '30 seconds' WHERE product_scope='pact'",
          );
          const tick = await runtime.world.advance(`negotiation:${worldId}`, workerToken);
          if (tick.kind !== "committed") throw Error(`NEGOTIATION_TICK_${tick.kind}`);
          const current = await runtime.world.read();
          await db.query("INSERT INTO negotiation_fixture_ticks VALUES($1,$2,clock_timestamp())", [
            current.sequence,
            current.gameTimeMs,
          ]);
        }
      },
      async ownerSetSupplyPermission(index, allowed) {
        await active();
        await mutateOwner(index, (current) => ({
          allowedActions: allowed
            ? [...new Set([...current.allowedActions, "supply.sign"])]
            : current.allowedActions.filter((a) => a !== "supply.sign"),
        }));
      },
      async close() {
        if (closed) return;
        await active();
        await db.end();
        await dropTestSchema(admin, schema as string);
        await admin.end();
        closed = true;
      },
    };
    const roleA = players.find((p) => p.role === "A"),
      roleB = players.find((p) => p.role === "B");
    if (!roleA || !roleB) throw Error("MISSING_ROLE");
    const a = world.actor(roleA.kingdomId),
      b = world.actor(roleB.kingdomId);
    const intro = async () => {
      const asked = await a.dispatch({
        kind: "game.contact.request",
        recipientKingdomId: roleB.kingdomId,
        note: "Synthetic fixture contact",
      });
      const key = Object.keys(asked.recordVersions).find((k) => k.startsWith("contact-request:"));
      if (!key) throw Error("MISSING_CONTACT_RECEIPT");
      await b.dispatch({ kind: "game.contact.answer", requestId: key.slice("contact-request:".length), accept: true });
    };
    if (!options.control) {
      if (state.contacts) await intro();
      if ("openingOffer" in state && state.openingOffer) {
        if (cell.family === "C02") {
          await kingdoms.setAmbition(roleA.accountId, JSON.stringify({ ...state.goals.A, maximumSendPerHour: 4 }));
        }
        const offer = await a.dispatch({
          kind: "game.supply.offer",
          counterpartyKingdomId: roleB.kingdomId,
          terms: NegotiationTermsSchema.parse(state.openingOffer),
          expiryMinutes: cell.family === "C04" ? 5 : 60,
        });
        world.openingOfferId = offer.commandId;
        if (cell.family === "C02") await kingdoms.setAmbition(roleA.accountId, JSON.stringify(state.goals.A));
        if (cell.family === "C04") await world.advanceTo(6);
      }
      if (cell.family === "C05") {
        const historical = await a.dispatch({
          kind: "game.supply.offer",
          counterpartyKingdomId: roleB.kingdomId,
          terms: NegotiationTermsSchema.parse(design.referenceTerms),
          expiryMinutes: 60,
        });
        await a.dispatch({ kind: "game.supply.sign", offerId: historical.commandId, version: 1 });
        await b.dispatch({ kind: "game.supply.sign", offerId: historical.commandId, version: 1 });
        if (cell.variant === "default") {
          await world.advanceTo(5);
          const index = players.indexOf(roleA);
          await mutateOwner(index, () => ({ reserveFloors: { iron: wholeResources(600).toString() } }));
          await world.advanceTo(62);
          await mutateOwner(index, () => ({ reserveFloors: {} }));
        } else await world.advanceTo(62);
        for (let i = 1; i <= 10; i++) {
          await world.advanceTo(62 + i);
          for (const p of players) {
            const observation = await world.actor(p.kingdomId).readSelf();
            await db.query(
              "INSERT INTO negotiation_fixture_observations(actor_id,game_time_ms,observation) VALUES($1,$2,$3)",
              [p.kingdomId, (62 + i) * 60000, observation],
            );
          }
        }
        const next = await b.dispatch({
          kind: "game.supply.offer",
          counterpartyKingdomId: roleA.kingdomId,
          terms: NegotiationTermsSchema.parse({
            ...design.referenceTerms,
            aToB: design.referenceTerms.bToA,
            bToA: design.referenceTerms.aToB,
          }),
          expiryMinutes: 60,
        });
        world.openingOfferId = next.commandId;
      }
    }
    world.decisionStartGameTimeMs = (await runtime.world.read()).gameTimeMs;
    await db.query("UPDATE negotiation_fixture_identity SET decision_start_game_time_ms=$1", [
      world.decisionStartGameTimeMs,
    ]);
    prefix = false;
    return world;
  } catch (error) {
    if (pool) await pool.end();
    if (schema) await dropTestSchema(admin, schema);
    await admin.end();
    throw error;
  }
}
