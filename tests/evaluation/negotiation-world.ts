import { randomBytes, randomUUID } from "node:crypto";
import {
  ActionEffectsService,
  AgentGuideReader,
  AgentOperationError,
  AgentOperationService,
  type AuthenticatedPrincipal,
  CommandDispatcher,
  DispatcherError,
  GameCommandHandler,
  outlookFeasibility,
} from "@pact/application";
import { AuthorityService, ExactHumanPermitService, ExposureService } from "@pact/authority";
import {
  type ActionEffectsGuard,
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
  AgentOutlookService,
  CouncilReader,
  GarrisonService,
  ImmediateExposureAdapter,
  KingdomDiscoveryReader,
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
import { councilThreadTool } from "../../packages/mcp/src/chatgpt.js";
import { createRulesRuntime } from "../../workers/rules/src/runtime.js";
import { NegotiationTermsSchema } from "./negotiation-contracts.js";
import design from "./negotiation-design.json" with { type: "json" };
import { negotiationGoalText } from "./negotiation-goal.js";
import type { OwnedNegotiationWorld, OwnedWorldCheckpoint, WorldSecrets } from "./negotiation-owned-run.js";
import { designDigest, type NegotiationCell, negotiationPlan } from "./negotiation-plan.js";
import { type PostE3Cell, type PostE3Protocol, validatePostE3Cell } from "./post-e3-rc2-plan.js";

export type NegotiationFixtureCell = NegotiationCell | PostE3Cell;

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
  tools(includeEffects?: boolean): Promise<
    {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean };
    }[]
  >;
  readTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
  dispatch(action: GameAction, commandId?: string): Promise<CommandReceipt>;
  effects(command: Parameters<ActionEffectsService["quote"]>[1]): ReturnType<ActionEffectsService["quote"]>;
  submitGuarded(command: unknown, guard: ActionEffectsGuard): Promise<CommandReceipt>;
  receipt(commandId: string): Promise<CommandReceipt | null>;
  readSelf(): Promise<Snapshot | null>;
  readPeer(kingdomId: string): ReturnType<WorldViewService["read"]>;
  readSection(query: ObservationSectionQuery): ReturnType<WorldViewService["readSection"]>;
  guide(topic?: "start" | "development" | "diplomacy" | "authority"): Promise<Record<string, unknown>>;
  discover(query: unknown): ReturnType<KingdomDiscoveryReader["read"]>;
  thread(peer: string): ReturnType<CouncilReader["thread"]>;
  outlook(): ReturnType<AgentOutlookService["readOwner"]>;
  history(): Promise<{ gameTimeMs: string; observation: Snapshot }[]>;
}
export interface NegotiationWorld<C extends NegotiationFixtureCell = NegotiationCell> {
  worldId: string;
  pool: Pool;
  cell: C;
  control: boolean;
  players: readonly [NegotiationPlayer, NegotiationPlayer];
  openingOfferId: string | null;
  decisionStartGameTimeMs: number;
  actor(kingdomId: string): NegotiationActor;
  advanceTo(gameMinute: number): Promise<void>;
  ownerSetSupplyPermission(index: number, allowed: boolean): Promise<void>;
  ownerSetGoal(index: number, goal: string): Promise<void>;
  close(): Promise<void>;
}
export async function createNegotiationWorld(
  target: OwnedTarget,
  cell: NegotiationCell,
  options: { control?: boolean } = {},
): Promise<NegotiationWorld> {
  return constructNegotiationWorld(target, cell, options);
}
export async function constructNegotiationWorld<C extends NegotiationFixtureCell>(
  target: OwnedTarget,
  cell: C,
  options: {
    control?: boolean;
    retention?: "preserve";
    secrets?: WorldSecrets;
    checkpoint?: OwnedWorldCheckpoint<C>;
    onCreated?: (schema: string, worldId: string) => Promise<void>;
    onPrepared?: (world: NegotiationWorld<C>) => Promise<void>;
    rc1Protocol?: PostE3Protocol;
  } = {},
): Promise<NegotiationWorld<C> & Omit<OwnedNegotiationWorld<C>, keyof NegotiationWorld<C>>> {
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
    if ("study" in cell) {
      if (!options.rc1Protocol) throw Error("RC1_PROTOCOL_REQUIRED");
      validatePostE3Cell(options.rc1Protocol, cell);
    } else {
      const planned = negotiationPlan(cell.stage, {
        sources: cell.sources,
        modelDigest: cell.modelDigest,
        policyDigest: cell.policyDigest,
        selectedProfile: cell.profile,
        ...(cell.baselineAmendment ? { baselineAmendment: cell.baselineAmendment } : {}),
      }).find((c) => c.id === cell.id);
      if (!planned || designDigest(planned) !== designDigest(cell)) throw Error("NEGOTIATION_DESIGN_MISMATCH");
    }
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
    const resumed = options.checkpoint;
    schema = resumed?.schema ?? (await createTestSchema(admin, "negotiation"));
    pool = createSchemaPool(target.pactUrl, schema);
    const db = pool,
      worldId = resumed?.worldId ?? randomUUID(),
      clock = { now: () => new Date() };
    if (!resumed) {
      await options.onCreated?.(schema, worldId);
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
    } else {
      const saved = (
        await db.query(
          "SELECT nonce,cell_id,owned_checkpoint_digest FROM negotiation_fixture_identity WHERE world_id=$1",
          [worldId],
        )
      ).rows[0];
      if (
        saved?.nonce !== target.nonce ||
        saved.cell_id !== cell.id ||
        saved.owned_checkpoint_digest !== designDigest(resumed)
      )
        throw Error("OWNED_CHECKPOINT_MISMATCH");
    }
    const secret = (name: keyof WorldSecrets) =>
      options.secrets ? Buffer.from(options.secrets[name], "base64") : randomBytes(32);
    const runtime = createRulesRuntime(db, "pact", secret("rulesKey"), undefined, 0);
    if (!resumed) {
      await runtime.world.bootstrap();
      await db.query(
        "UPDATE world_clocks SET committed_game_time_ms=0,tick_sequence=0,next_tick_due_at=clock_timestamp()+interval '10 minutes',last_heartbeat_at=clock_timestamp() WHERE product_scope='pact'",
      );
    }
    const identity = new IdentityService(db, {
      guestPlayEnabled: true,
      productScope: "pact",
      currentTermsVersion: "terms-v1",
      allowedOrigins: new Set(["https://negotiation.example.test"]),
      clock,
      digester: new TokenDigester(secret("tokenKey")),
      secretBox: new AesGcmSecretBox(secret("encryptionKey")),
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
    const discovery = new KingdomDiscoveryReader(db, "pact", clock.now);
    const council = new CouncilReader(db, "pact", new SocialOverviewReader(db, "pact"), async () => ({}));
    const outlook = new AgentOutlookService(db, "pact", views, outlookFeasibility);
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
    if (resumed) {
      people.push(...structuredClone(resumed.players));
      for (const c of resumed.credentials) {
        const authenticated = await identity.authenticate(c.token);
        if (
          authenticated.accountId !== c.accountId ||
          !people.some((p) => p.accountId === c.accountId && p.kingdomId === c.kingdomId)
        )
          throw Error("OWNED_CHECKPOINT_MISMATCH");
        const k = (await db.query("SELECT account_id FROM kingdoms WHERE id=$1", [c.kingdomId])).rows[0];
        if (k?.account_id !== c.accountId) throw Error("OWNED_CHECKPOINT_MISMATCH");
        credentials.set(c.kingdomId, {
          token: c.token,
          holderId: c.holderId,
          principal: {
            accountId: c.accountId,
            productScope: ProductScopeSchema.parse("pact"),
            audience: "agent",
            sessionId: c.holderId,
            agentOrigin: "external",
            agentScopes: ["world:read", "game:act"],
          },
        });
      }
    }
    if (!resumed)
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
        await kingdoms.setAmbition(
          session.accountId,
          negotiationGoalText(
            goal,
            "study" in cell &&
              "intentAuthorityContract" in cell.configuration &&
              (cell.configuration.intentAuthorityContract === "separate.v3"
                ? "external.v2"
                : cell.configuration.intentAuthorityContract === "separate.v2"
                  ? "external.v1"
                  : cell.configuration.intentAuthorityContract === "separate.v1"),
          ),
        );
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
    let prefix = !resumed,
      closed = false,
      inFlight = 0;
    const effects = new ActionEffectsService(db, "pact", clock.now);
    const dispatcher = new CommandDispatcher({
      pool: db,
      clock,
      productScope: "pact",
      actionEffects: effects,
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
    const operations = new AgentOperationService({
      productScope: "pact",
      dispatcher,
      origin: "http://127.0.0.1",
      clock,
      actionEffects: effects,
      worldViews: views,
      kingdomDiscovery: discovery,
      agentOutlook: outlook,
      agentGuide: {
        read: (id, topic) => guide.read(id, topic),
        readSection: (id, query) => views.readSection(id, query),
      },
      councilThreads: { read: (id, peer, before) => council.thread(id, peer, before) },
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
    let workerToken: string | null = null,
      nativeStarted = false,
      nativeLost = false;
    const world: NegotiationWorld<C> & Omit<OwnedNegotiationWorld<C>, keyof NegotiationWorld<C>> = {
      worldId,
      pool: db,
      cell,
      players,
      control: options.control === true,
      openingOfferId: resumed?.openingOfferId ?? null,
      decisionStartGameTimeMs: resumed?.decisionStartGameTimeMs ?? 0,
      actor(kingdomId) {
        const p = players.find((a) => a.kingdomId === kingdomId),
          credential = credentials.get(kingdomId);
        if (!p || !credential) throw Error("NEGOTIATION_ACTOR_SCOPE_MISMATCH");
        const requests = new Map<string, CommandEnvelope>();
        const assertWrite = async () => {
          await active();
          if (options.control) throw Error("SOLO_CONTROL_NO_INTERACTION");
          if (options.retention && !prefix) {
            const owned = (
              await db.query(
                "SELECT o.lease_id,l.released_at,l.expires_at,l.holder_id,i.owned_activation_complete FROM negotiation_owned_leases o CROSS JOIN negotiation_fixture_identity i LEFT JOIN write_leases l ON l.product_scope='pact' AND l.holder_kind='mcp' AND l.subject_id=o.account_id AND l.lease_id=o.lease_id WHERE o.kingdom_id=$1",
                [p.kingdomId],
              )
            ).rows[0];
            if (!owned?.lease_id || !owned.owned_activation_complete) throw Error("OWNED_WORLD_FENCED");
            if (
              owned.released_at ||
              !owned.expires_at ||
              new Date(owned.expires_at) <= clock.now() ||
              owned.holder_id !== credential.holderId
            )
              throw Error("FORBIDDEN");
          }
          await identity.authenticate(credential.token);
        };
        return {
          async tools(includeEffects = false) {
            await active();
            const names = new Set([
              "pact_agent_guide_v1",
              "pact_world_read_v1",
              "pact_kingdom_discover_v2",
              "pact_observation_read_v2",
              "pact_agent_outlook_v1",
              "pact_game_action_v2",
              ...(includeEffects ? ["pact_action_effects_quote_v1", "pact_action_effects_execute_v1"] : []),
            ]);
            return [
              ...operations.listOperations(credential.principal).filter((t) => names.has(t.name)),
              councilThreadTool,
            ].map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema as Record<string, unknown>,
              annotations: {
                readOnlyHint: !["pact_game_action_v2", "pact_action_effects_execute_v1"].includes(t.name),
              },
            }));
          },
          async readTool(name, args) {
            await active();
            const allowed = new Set([
              "pact_agent_guide_v1",
              "pact_world_read_v1",
              "pact_kingdom_discover_v2",
              "pact_observation_read_v2",
              "pact_agent_outlook_v1",
              "pact_council_thread_v1",
              "pact_action_effects_quote_v1",
            ]);
            if (!allowed.has(name)) throw new AgentOperationError("FORBIDDEN", 403);
            const result = await operations.execute(credential.principal, { name, arguments: args });
            return result.structuredContent as Record<string, unknown>;
          },
          async effects(command) {
            await assertWrite();
            inFlight++;
            try {
              return await effects.quote(credential.principal, command);
            } finally {
              inFlight--;
            }
          },
          async submitGuarded(command, guard) {
            await assertWrite();
            inFlight++;
            try {
              return await dispatcher.dispatchGuarded(credential.principal, { command, guard });
            } finally {
              inFlight--;
            }
          },
          async dispatch(action, commandId = randomUUID()) {
            await assertWrite();
            inFlight++;
            try {
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
          async discover(query) {
            await active();
            return discovery.read(p.accountId, query);
          },
          async thread(peer) {
            await active();
            return council.thread(p.accountId, peer);
          },
          async outlook() {
            await active();
            return outlook.readOwner(credential.principal);
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
        if (options.retention) await world.refreshControlledSchedule();
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
      async ownerSetGoal(index, goal) {
        await active();
        const player = players[index];
        if (!player || typeof goal !== "string" || !goal.trim() || goal.length > 8000)
          throw Error("INVALID_OWNED_GOAL");
        await kingdoms.setAmbition(player.accountId, goal);
        player.goalDigest = designDigest(goal);
      },
      async close() {
        if (closed) return;
        await active();
        await db.end();
        if (!options.retention) await dropTestSchema(admin, schema as string);
        await admin.end();
        closed = true;
      },
      async disconnect() {
        if (closed) return;
        await db.end();
        await admin.end();
        closed = true;
      },
      async refreshControlledSchedule() {
        await active();
        if (!options.retention || cell.clockMode !== "controlled") throw Error("OWNED_CONTROLLED_CLOCK_REQUIRED");
        if (inFlight) throw Error("NEGOTIATION_OPERATION_IN_FLIGHT");
        // Controlled-clock studies freeze GAME time between scheduled ticks.
        // Wall time still bounds every native call/turn/cell. Refresh only the
        // synthetic scheduler's wall cadence; never clear a pause or move GAME.
        const refreshed = await db.query(
          "UPDATE world_clocks SET next_tick_due_at=clock_timestamp()+interval '10 minutes',last_heartbeat_at=clock_timestamp() WHERE product_scope='pact' AND status='active' RETURNING product_scope",
        );
        if (refreshed.rowCount !== 1) throw Error("CONTROLLED_CLOCK_NOT_ACTIVE");
      },
      async startNativeClock() {
        await active();
        if (!options.retention || cell.clockMode !== "native") throw Error("OWNED_NATIVE_CLOCK_REQUIRED");
        const claimed = await db.query(
          "UPDATE negotiation_fixture_identity SET owned_native_clock_started=true WHERE world_id=$1 AND owned_native_clock_started=false RETURNING world_id",
          [worldId],
        );
        if (claimed.rowCount !== 1) throw Error("NATIVE_CLOCK_ALREADY_STARTED");
        const resumedClock = await runtime.world.resumeIfPaused("NEGOTIATION_PREPARED");
        if (!resumedClock) throw Error("NATIVE_PREPARATION_PAUSE_REQUIRED");
        workerToken = await runtime.world.acquireLease(`negotiation:${worldId}`);
        if (!workerToken) {
          nativeLost = true;
          throw Error("NATIVE_CLOCK_LEASE_LOST");
        }
        nativeStarted = true;
      },
      async tickNativeClock() {
        await active();
        if (!options.retention || cell.clockMode !== "native") throw Error("OWNED_NATIVE_CLOCK_REQUIRED");
        if (nativeLost) throw Error("NATIVE_CLOCK_LEASE_LOST");
        if (!nativeStarted || !workerToken) throw Error("NATIVE_CLOCK_NOT_STARTED");
        if (!(await runtime.world.heartbeat(`negotiation:${worldId}`, workerToken))) {
          nativeLost = true;
          throw Error("NATIVE_CLOCK_LEASE_LOST");
        }
        const tick = await runtime.world.advance(`negotiation:${worldId}`, workerToken);
        if (tick.kind !== "committed" && tick.kind !== "not_due") {
          nativeLost = true;
          throw Error("NATIVE_CLOCK_LEASE_LOST");
        }
        const current = await runtime.world.read();
        if (tick.kind === "committed")
          await db.query("INSERT INTO negotiation_fixture_ticks VALUES($1,$2,clock_timestamp())", [
            current.sequence,
            current.gameTimeMs,
          ]);
        return {
          committed: tick.kind === "committed",
          gameTimeMs: current.gameTimeMs,
          sequence: String(current.sequence),
          nextTickDueAt: current.nextTickDueAt.toISOString(),
        };
      },
      async pauseClock(reason = "NEGOTIATION_BATCH_STOPPED") {
        await active();
        if (!options.retention) throw Error("OWNED_CLOCK_REQUIRED");
        if ((await runtime.world.read()).status !== "paused") await runtime.world.pause(reason);
      },
      checkpoint() {
        if (!options.secrets || !options.retention) throw Error("OWNED_CHECKPOINT_REQUIRED");
        return structuredClone({
          schemaVersion:
            "study" in cell
              ? cell.study === "negotiation-r25"
                ? "pact.rc25-owned-world.v1"
                : cell.study === "negotiation-r24"
                  ? "pact.rc24-owned-world.v1"
                  : cell.study === "negotiation-r23"
                    ? "pact.rc23-owned-world.v1"
                    : cell.study === "negotiation-r22"
                      ? "pact.rc22-owned-world.v1"
                      : cell.study === "negotiation-r21"
                        ? "pact.rc21-owned-world.v1"
                        : cell.study === "negotiation-r20"
                          ? "pact.rc20-owned-world.v1"
                          : cell.study === "negotiation-r19"
                            ? "pact.rc19-owned-world.v1"
                            : cell.study === "negotiation-r18"
                              ? "pact.rc18-owned-world.v1"
                              : cell.study === "negotiation-r17"
                                ? "pact.rc17-owned-world.v1"
                                : cell.study === "negotiation-r16"
                                  ? "pact.rc16-owned-world.v1"
                                  : cell.study === "negotiation-r15"
                                    ? "pact.rc15-owned-world.v1"
                                    : cell.study === "negotiation-r14"
                                      ? "pact.rc14-owned-world.v1"
                                      : cell.study === "negotiation-r13"
                                        ? "pact.rc13-owned-world.v1"
                                        : cell.study === "negotiation-r12"
                                          ? "pact.rc12-owned-world.v1"
                                          : cell.study === "negotiation-r11"
                                            ? "pact.rc11-owned-world.v1"
                                            : cell.study === "negotiation-r10"
                                              ? "pact.rc10-owned-world.v1"
                                              : cell.study === "negotiation-r9"
                                                ? "pact.rc9-owned-world.v1"
                                                : cell.study === "negotiation-r8"
                                                  ? "pact.rc8-owned-world.v1"
                                                  : cell.study === "negotiation-r7"
                                                    ? "pact.rc7-owned-world.v1"
                                                    : cell.study === "negotiation-r6"
                                                      ? "pact.rc6-owned-world.v1"
                                                      : cell.study === "negotiation-r5"
                                                        ? "pact.rc5-owned-world.v1"
                                                        : cell.study === "negotiation-r4"
                                                          ? "pact.rc4-owned-world.v1"
                                                          : cell.study === "negotiation-r3"
                                                            ? "pact.rc3-owned-world.v1"
                                                            : cell.study === "negotiation-r2"
                                                              ? "pact.rc2-owned-world.v1"
                                                              : "pact.rc1-owned-world.v1"
              : "pact.negotiation-owned-world.v1",
          schema: schema as string,
          nonce: target.nonce,
          worldId,
          cell,
          control: options.control === true,
          players,
          credentials: [...credentials.entries()].map(([kingdomId, c]) => ({
            kingdomId,
            accountId: c.principal.accountId,
            token: c.token,
            holderId: c.holderId,
          })),
          secrets: options.secrets,
          openingOfferId: world.openingOfferId,
          decisionStartGameTimeMs: world.decisionStartGameTimeMs,
        });
      },
      async activateLeases() {
        await active();
        if (!options.retention || options.control) throw Error("OWNED_TREATMENT_REQUIRED");
        // Consume first-acquisition authority before opening either lease. A partial
        // activation is retained and cannot be retried as a replacement acquisition.
        const claimed = await db.query(
          "UPDATE negotiation_fixture_identity SET owned_activation_started=true WHERE world_id=$1 AND owned_activation_started=false RETURNING world_id",
          [worldId],
        );
        if (!claimed.rowCount) throw Error("OWNED_LEASES_ALREADY_ACTIVATED");
        for (const p of players) {
          const c = credentials.get(p.kingdomId)!;
          const opened = await runs.openMcpLease({ accountId: p.accountId, holderId: c.holderId });
          await db.query("UPDATE negotiation_owned_leases SET lease_id=$2 WHERE kingdom_id=$1 AND lease_id IS NULL", [
            p.kingdomId,
            opened.leaseId,
          ]);
        }
        await db.query("UPDATE negotiation_fixture_identity SET owned_activation_complete=true WHERE world_id=$1", [
          worldId,
        ]);
      },
      async renewLeases() {
        await active();
        if (
          !(
            await db.query("SELECT owned_activation_complete FROM negotiation_fixture_identity WHERE world_id=$1", [
              worldId,
            ])
          ).rows[0]?.owned_activation_complete
        )
          throw Error("OWNED_WORLD_FENCED");
        for (const p of players) {
          const c = credentials.get(p.kingdomId)!;
          const row = (
            await db.query("SELECT lease_id FROM negotiation_owned_leases WHERE kingdom_id=$1", [p.kingdomId])
          ).rows[0];
          if (!row?.lease_id) throw Error("OWNED_WORLD_FENCED");
          await runs.renewMcpLease({ accountId: p.accountId, holderId: c.holderId, expectedLeaseId: row.lease_id });
        }
      },
      async leaseFacts() {
        await active();
        return (
          await db.query(
            `SELECT o.account_id AS "accountId",o.kingdom_id AS "kingdomId",o.holder_id AS "holderId",o.lease_id AS "leaseId",(l.lease_id IS NOT NULL AND l.released_at IS NULL AND l.expires_at>$1 AND l.holder_id=o.holder_id::text) AS live FROM negotiation_owned_leases o LEFT JOIN write_leases l ON l.product_scope='pact' AND l.holder_kind='mcp' AND l.subject_id=o.account_id AND l.lease_id=o.lease_id ORDER BY o.ordinal`,
            [clock.now()],
          )
        ).rows;
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
    if (!resumed && !options.control) {
      if (state.contacts) await intro();
      if ("openingOffer" in state && state.openingOffer) {
        if (cell.family === "C02") {
          await kingdoms.setAmbition(
            roleA.accountId,
            negotiationGoalText(
              { ...state.goals.A, maximumSendPerHour: 4 },
              "study" in cell &&
                "intentAuthorityContract" in cell.configuration &&
                (cell.configuration.intentAuthorityContract === "separate.v3"
                  ? "external.v2"
                  : cell.configuration.intentAuthorityContract === "separate.v2"
                    ? "external.v1"
                    : cell.configuration.intentAuthorityContract === "separate.v1"),
            ),
          );
        }
        const offer = await a.dispatch({
          kind: "game.supply.offer",
          counterpartyKingdomId: roleB.kingdomId,
          terms: NegotiationTermsSchema.parse(state.openingOffer),
          expiryMinutes: cell.family === "C04" ? 5 : 60,
        });
        world.openingOfferId = offer.commandId;
        if (cell.family === "C02")
          await kingdoms.setAmbition(
            roleA.accountId,
            negotiationGoalText(
              state.goals.A,
              "study" in cell &&
                "intentAuthorityContract" in cell.configuration &&
                (cell.configuration.intentAuthorityContract === "separate.v3"
                  ? "external.v2"
                  : cell.configuration.intentAuthorityContract === "separate.v2"
                    ? "external.v1"
                    : cell.configuration.intentAuthorityContract === "separate.v1"),
            ),
          );
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
    if (!resumed) {
      if (options.onPrepared) {
        if (options.retention !== "preserve") throw Error("RETAINED_SETUP_REQUIRED");
        await options.onPrepared(world);
      }
      world.decisionStartGameTimeMs = (await runtime.world.read()).gameTimeMs;
      await db.query("UPDATE negotiation_fixture_identity SET decision_start_game_time_ms=$1", [
        world.decisionStartGameTimeMs,
      ]);
      if (options.retention) {
        await db.query(
          "CREATE TABLE negotiation_owned_leases(account_id uuid PRIMARY KEY,kingdom_id uuid UNIQUE NOT NULL,holder_id uuid UNIQUE NOT NULL,ordinal int UNIQUE NOT NULL,lease_id uuid)",
        );
        for (const [ordinal, p] of players.entries()) {
          const c = credentials.get(p.kingdomId)!;
          await runs.releaseMcpLease({ accountId: p.accountId, holderId: c.holderId });
          c.holderId = randomUUID();
          c.principal = { ...c.principal, sessionId: c.holderId };
          await db.query("INSERT INTO negotiation_owned_leases VALUES($1,$2,$3,$4,NULL)", [
            p.accountId,
            p.kingdomId,
            c.holderId,
            ordinal,
          ]);
        }
        await db.query(
          "ALTER TABLE negotiation_fixture_identity ADD COLUMN owned_activation_started boolean NOT NULL DEFAULT false, ADD COLUMN owned_activation_complete boolean NOT NULL DEFAULT false, ADD COLUMN owned_checkpoint_digest text",
        );
        await db.query("UPDATE negotiation_fixture_identity SET owned_checkpoint_digest=$1", [
          designDigest(world.checkpoint()),
        ]);
        if (cell.clockMode === "native") {
          await db.query(
            "ALTER TABLE negotiation_fixture_identity ADD COLUMN owned_native_clock_started boolean NOT NULL DEFAULT false",
          );
          await runtime.world.pause("NEGOTIATION_PREPARED");
        }
      }
    }
    prefix = false;
    return world;
  } catch (error) {
    if (pool) await pool.end();
    if (schema && !options.retention) await dropTestSchema(admin, schema);
    await admin.end();
    throw error;
  }
}

/** Test-only transport parity: only native typed failures are authoritative denials. */
export function nativeEvaluationRejection(
  error: unknown,
): { code: string; status: number; detail?: Record<string, unknown> } | undefined {
  if (error instanceof AgentOperationError)
    return { code: error.code, status: error.httpStatus, ...(error.detail ? { detail: error.detail } : {}) };
  if (error instanceof DispatcherError)
    return { code: error.code, status: error.code === "FORBIDDEN" ? 403 : error.code === "STALE_VERSION" ? 409 : 400 };
  return undefined;
}
