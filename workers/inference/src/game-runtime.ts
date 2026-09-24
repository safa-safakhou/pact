import { CommandDispatcher, dispatchRunCommandTools, GameCommandHandler, pactRunCommandTool } from "@pact/application";
import { ExactHumanPermitService, ExposureService, readReserveFloor } from "@pact/authority";
import { ProductScopeSchema } from "@pact/contracts";
import {
  ActionLimitService,
  BuildingEngine,
  ConstructionExposureAdapter,
  GarrisonService,
  ImmediateExposureAdapter,
  KingdomService,
  RaidRandomnessService,
  RaidService,
  ScoutService,
  SocialService,
  SupplyExposureAdapter,
  SupplyService,
  SupplySettlementService,
  TroopService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { ProviderRouter } from "@pact/model-provider";
import { OnboardingService } from "@pact/onboarding";
import { RunService } from "@pact/runs";
import { WorldClockService } from "@pact/world";
import type { Pool } from "pg";

export interface InferenceGameRuntimeOptions {
  readonly pool: Pool;
  readonly productScope: string;
  readonly clock: { now(): Date };
  readonly providerRouter: ProviderRouter;
  readonly withCredential?: <T>(
    accountId: string,
    credentialId: string,
    provider: string,
    operation: (credential: Uint8Array) => Promise<T>,
  ) => Promise<T>;
  readonly termsVersion: string;
  readonly raidSeed?: Uint8Array;
}

/** PACT composition only: provider adapters receive the shared command tool, never domain ports. */
export async function createInferenceGameRuntime(
  options: InferenceGameRuntimeOptions,
): Promise<{ runs: RunService; dispatcher: CommandDispatcher }> {
  const { pool, productScope, clock } = options;
  const scope = ProductScopeSchema.parse(productScope);
  const world = new WorldClockService(pool, productScope);
  await world.bootstrap();
  let dispatcher: CommandDispatcher;
  const runs = new RunService(pool, {
    productScope,
    clock,
    providerRouter: options.providerRouter,
    ...(options.withCredential ? { withCredential: options.withCredential } : {}),
    tools: [pactRunCommandTool],
    executeToolCalls: async (input) => {
      const receipts = await dispatchRunCommandTools(dispatcher, scope, input);
      return input.calls.map((call, index) => {
        const receipt = receipts[index];
        if (!receipt) throw new Error("Missing command receipt after tool dispatch");
        return {
          callId: call.id,
          content: JSON.stringify({
            commandId: receipt.commandId,
            code: receipt.code,
            charged: receipt.charged,
            ...(receipt.approvalId ? { approvalId: receipt.approvalId } : {}),
          }),
        };
      });
    },
  });
  const ledger = new ResourceLedger(productScope);
  const exposure = new ExposureService(productScope);
  const social = new SocialService(
    productScope,
    ledger,
    new ActionLimitService(productScope),
    clock,
    new ImmediateExposureAdapter(exposure),
  );
  const troops = new TroopService(productScope, ledger, new ImmediateExposureAdapter(exposure));
  const permits = new ExactHumanPermitService(productScope);
  const constructionLedger = new ResourceLedger(productScope);
  const buildings = new BuildingEngine(
    productScope,
    constructionLedger,
    new ConstructionExposureAdapter(productScope, new ExposureService(productScope, permits), constructionLedger),
  );
  const kingdom = new KingdomService(pool, {
    productScope,
    onboarding: new OnboardingService(pool, {
      productScope,
      currentTermsVersion: options.termsVersion,
      now: clock.now,
    }),
    world,
    ledger,
  });
  const supplyExposure = new SupplyExposureAdapter(new ExposureService(productScope, permits));
  const supply = new SupplyService(productScope, ledger, new ActionLimitService(productScope), social, supplyExposure);
  const supplySettlement = new SupplySettlementService(
    productScope,
    ledger,
    { read: (client, accountId, resource) => readReserveFloor(client, productScope, accountId, resource) },
    supplyExposure,
  );
  const scouts = new ScoutService(productScope, ledger, troops, new ActionLimitService(productScope), exposure);
  const garrison = new GarrisonService(productScope, ledger, troops, exposure, permits);
  const raids = options.raidSeed
    ? new RaidService(
        productScope,
        ledger,
        troops,
        new ActionLimitService(productScope),
        exposure,
        new RaidRandomnessService(productScope, options.raidSeed),
        garrison,
      )
    : undefined;
  const handler = new GameCommandHandler(
    social,
    (client, accountId, holderId) => runs.assertAgentWriteLease(client, accountId, holderId),
    kingdom,
    troops,
    buildings,
    permits,
    supply,
    supplySettlement,
    exposure,
    scouts,
    garrison,
    raids,
  );
  dispatcher = new CommandDispatcher({
    pool,
    clock,
    productScope: scope,
    game: {
      admit: async (operation) => world.admitCommand((client, snapshot) => operation(client, snapshot.gameTimeMs)),
      execute: (client, principal, command, gameTimeMs) => handler.execute(client, principal, command, gameTimeMs),
    },
  });
  return { runs, dispatcher };
}
