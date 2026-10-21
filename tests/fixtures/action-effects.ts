import { randomUUID } from "node:crypto";
import {
  ActionEffectsService,
  AgentGuideReader,
  type AuthenticatedPrincipal,
  CommandDispatcher,
  GameCommandHandler,
} from "@pact/application";
import { ExactHumanPermitService, ExposureService, readMandateContext } from "@pact/authority";
import { type CommandEnvelope, ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import {
  ActionLimitService,
  BuildingEngine,
  ConstructionExposureAdapter,
  ImmediateExposureAdapter,
  KingdomService,
  SocialOverviewReader,
  SocialService,
  SupplyExposureAdapter,
  SupplyService,
  TroopService,
  WorldViewService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { OnboardingService } from "@pact/onboarding";
import { RunService } from "@pact/runs";
import { WorldClockService } from "@pact/world";
import { createRulesRuntime } from "../../workers/rules/src/runtime.js";

export async function actionEffectsFixture() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test",
    parsed = new URL(url);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) || parsed.pathname !== "/pact_test")
    throw Error("ISOLATED_TEST_DATABASE_REQUIRED");
  const admin = createPool(url),
    schema = await createTestSchema(admin, "effects"),
    pool = createSchemaPool(url, schema),
    world = new WorldClockService(pool, "pact");
  let now = new Date();
  const clock = { now: () => new Date(now) };
  await world.bootstrap();
  await pool.query(
    "UPDATE world_clocks SET committed_game_time_ms=0,tick_sequence=0,next_tick_due_at=clock_timestamp()+interval '10 minutes',last_heartbeat_at=clock_timestamp() WHERE product_scope='pact'",
  );
  const rules = createRulesRuntime(pool, "pact", Buffer.alloc(32, 7), undefined, 0);
  let workerToken: string | null = null;
  const ledger = new ResourceLedger("pact"),
    permits = new ExactHumanPermitService("pact"),
    exposure = new ExposureService("pact", permits),
    limits = new ActionLimitService("pact"),
    runs = new RunService(pool, { productScope: "pact", clock });
  const social = new SocialService("pact", ledger, limits, clock, new ImmediateExposureAdapter(exposure)),
    kingdom = new KingdomService(pool, {
      productScope: "pact",
      onboarding: new OnboardingService(pool, { productScope: "pact", currentTermsVersion: "fixture", now: clock.now }),
      world,
      ledger,
    });
  const troops = new TroopService("pact", ledger, new ImmediateExposureAdapter(exposure)),
    buildings = new BuildingEngine("pact", ledger, new ConstructionExposureAdapter("pact", exposure, ledger));
  const supply = new SupplyService("pact", ledger, limits, social, new SupplyExposureAdapter(exposure));
  const handler = new GameCommandHandler(
    social,
    (c, a, h) => runs.assertAgentWriteLease(c, a, h),
    kingdom,
    troops,
    buildings,
    permits,
    supply,
    undefined,
    exposure,
    undefined,
    undefined,
    undefined,
    (c, a, h) => runs.consumeOutgoingMessageAllowance(c, a, h),
  );
  const effects = new ActionEffectsService(pool, "pact", clock.now),
    dispatcher = new CommandDispatcher({
      pool,
      clock,
      productScope: "pact",
      actionEffects: effects,
      game: {
        admit: (op) => world.admitCommand((c, s) => op(c, s.gameTimeMs)),
        execute: (c, p, cmd, t) => handler.execute(c, p, cmd, t),
      },
    });
  async function owner() {
    const accountId = randomUUID(),
      kingdomId = randomUUID(),
      sessionId = randomUUID();
    await withTransaction(pool, async (c) => {
      await c.query(
        "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture',now(),'fixture')",
        [accountId, accountId + "@example.test"],
      );
      await c.query(
        "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Fixture','portrait.wolf',now(),0,0,60000,$4)",
        [kingdomId, accountId, "fx_" + randomUUID().slice(0, 8), randomUUID()],
      );
      await ledger.initializeKingdom(c, kingdomId, 0);
      await c.query("INSERT INTO kingdom_score_baselines(product_scope,kingdom_id,game_time_ms) VALUES('pact',$1,0)", [
        kingdomId,
      ]);
      for (const [kind, capacity] of [
        ["raid", 3],
        ["scout", 4],
      ] as const)
        await c.query(
          "INSERT INTO kingdom_charges(product_scope,kingdom_id,kind,available,capacity,last_regenerated_game_time_ms) VALUES('pact',$1,$2,$3,$3,0)",
          [kingdomId, kind, capacity],
        );
      for (const kind of ["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"])
        await c.query("INSERT INTO kingdom_buildings(product_scope,kingdom_id,kind,level) VALUES('pact',$1,$2,1)", [
          kingdomId,
          kind,
        ]);
      for (const resource of ["iron", "silver", "grain"] as const)
        await ledger.creditOrdinary(c, {
          kingdomId,
          resource,
          amount: 60000n,
          operationKey: "fixture:" + resource,
          reason: "synthetic",
          gameTimeMs: 0,
        });
      await c.query(
        "INSERT INTO kingdom_mandates(product_scope,account_id,allowed_actions,resource_limits,reserve_floors) VALUES('pact',$1,$2,$3,'{}')",
        [
          accountId,
          ["building.queue", "training.queue", "contact.request", "supply.sign"],
          { iron: "10000000", silver: "10000000", grain: "10000000" },
        ],
      );
      await c.query(
        "INSERT INTO write_leases(product_scope,subject_id,holder_kind,holder_id,expires_at) VALUES('pact',$1,'mcp',$2,$3)",
        [accountId, sessionId, new Date(now.getTime() + 3600000)],
      );
      await c.query("INSERT INTO social_delegations VALUES('pact',$1,'agent_decides','{}',1,0)", [kingdomId]);
    });
    const principal: AuthenticatedPrincipal = {
      accountId,
      productScope: ProductScopeSchema.parse("pact"),
      audience: "agent",
      sessionId,
      agentScopes: ["world:read", "game:act"],
    };
    return { accountId, kingdomId, principal };
  }
  const command = (
    p: AuthenticatedPrincipal,
    action: CommandEnvelope["action"],
    commandId = randomUUID(),
  ): CommandEnvelope => ({
    schemaVersion: "pact.command.v1",
    commandId,
    actor: {
      principalId: p.accountId,
      productScope: p.productScope,
      audience: p.audience,
      subject: { type: "account", id: p.accountId },
    },
    action,
    submittedAt: clock.now().toISOString(),
  });
  const guarded = async (p: AuthenticatedPrincipal, cmd: CommandEnvelope) => {
    const q = await effects.quote(p, cmd);
    return {
      command: cmd,
      guard: {
        schemaVersion: "fleet.action-effects-guard.v1" as const,
        expectedRevision: q.revision,
        expectedEffects: q,
      },
    };
  };
  const views = new WorldViewService(pool, "pact"),
    guide = new AgentGuideReader(views, new SocialOverviewReader(pool, "pact"), {
      getMandate: async (accountId) => {
        const value = await withTransaction(pool, (c) => readMandateContext(c, "pact", accountId));
        return value.version === null
          ? null
          : { ...value, version: value.version, sessionLimit: value.sessionLimit ?? 0 };
      },
    });
  return {
    views,
    guide,
    settleSupply: async (gameTimeMs: number) => {
      if (!Number.isSafeInteger(gameTimeMs) || gameTimeMs < 0 || gameTimeMs > 24 * 3600000 || gameTimeMs % 60000 !== 0)
        throw Error("INVALID_FIXTURE_TIME");
      workerToken ??= await rules.world.acquireLease("specialist-effects-fixture");
      if (!workerToken) throw Error("FIXTURE_WORLD_LEASE_REQUIRED");
      while ((await rules.world.read()).gameTimeMs < gameTimeMs) {
        await pool.query(
          "UPDATE world_clocks SET next_tick_due_at=clock_timestamp()-interval '1 second',last_heartbeat_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval '30 seconds' WHERE product_scope='pact'",
        );
        const result = await rules.world.advance("specialist-effects-fixture", workerToken);
        if (result.kind !== "committed") throw Error(`FIXTURE_TICK_${result.kind}`);
      }
    },
    pool,
    world,
    ledger,
    social,
    supply,
    dispatcher,
    effects,
    owner,
    command,
    guarded,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    close: async () => {
      await pool.end();
      await dropTestSchema(admin, schema);
      await admin.end();
    },
  };
}
