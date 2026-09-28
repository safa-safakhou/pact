import { ExactHumanPermitService, ExposureService, readReserveFloor } from "@pact/authority";
import {
  AchievementService,
  ActionLimitService,
  BuildingEngine,
  ConstructionExposureAdapter,
  FortuneService,
  GarrisonService,
  GarrisonUpkeepExposureAdapter,
  ImmediateExposureAdapter,
  KingdomRetirementService,
  RaidRandomnessService,
  RaidService,
  ScoutService,
  SocialService,
  SupplyExposureAdapter,
  SupplyService,
  SupplySettlementService,
  TroopService,
  UpkeepService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { type TickHandlers, WorldClockService } from "@pact/world";
import type { Pool } from "pg";

/** One composition for the worker and transaction/recovery fixtures; no polling or I/O at import time. */
export function createRulesRuntime(
  pool: Pool,
  productScope: string,
  raidKey: Uint8Array,
  entropy?: (size: number) => Uint8Array,
) {
  const ledger = new ResourceLedger(productScope);
  const exposure = new ExposureService(productScope, new ExactHumanPermitService(productScope));
  const immediateAuthority = new ImmediateExposureAdapter(exposure);
  const supplyAuthority = new SupplyExposureAdapter(exposure);
  const buildings = new BuildingEngine(
    productScope,
    ledger,
    new ConstructionExposureAdapter(productScope, exposure, ledger),
  );
  const troops = new TroopService(productScope, ledger, immediateAuthority);
  const garrison = new GarrisonService(productScope, ledger, troops, exposure);
  const fortune = new FortuneService(productScope);
  const upkeep = new UpkeepService(productScope, ledger, new GarrisonUpkeepExposureAdapter(productScope, exposure));
  const limits = new ActionLimitService(productScope);
  const achievements = new AchievementService(productScope);
  const scouting = new ScoutService(productScope, ledger, troops, limits, exposure);
  const raids = new RaidService(
    productScope,
    ledger,
    troops,
    limits,
    exposure,
    new RaidRandomnessService(productScope, raidKey, entropy),
    garrison,
  );
  const social = new SocialService(productScope, ledger, limits, { now: () => new Date() }, immediateAuthority);
  const supply = new SupplyService(productScope, ledger, limits, social, supplyAuthority);
  const settlement = new SupplySettlementService(
    productScope,
    ledger,
    { read: (client, accountId, resource) => readReserveFloor(client, productScope, accountId, resource) },
    supplyAuthority,
  );
  let retirement: KingdomRetirementService;
  const handlers: TickHandlers = {
    // Season rollover is deliberately absent until PACT-069; this is the private week-one test world.
    boundaries_and_completions: async (client, context) => {
      await ledger.expireFoundingAllowances(client, context);
      await buildings.settleMinute(client, context);
      await troops.settleMinute(client, context);
      await limits.settleMinute(client, context);
      await social.expireRequests(client, context.gameTimeMs);
      await supply.expireOffers(client, context.gameTimeMs);
      await garrison.expireOffers(client, context.gameTimeMs);
      await settlement.settleBoundaries(client, context.gameTimeMs);
      await garrison.settleMinute(client, context.gameTimeMs);
      await raids.lockDue(client, context.gameTimeMs);
    },
    // PACT-069 replaces the test-world week-one default with the configured season clock.
    production: (client, context) => ledger.settleProductionMinute(client, context, 1),
    upkeep: (client, context) => upkeep.settleMinute(client, context),
    capture_obligations: (client, context) => settlement.capture(client, context.gameTimeMs),
    settle_deliveries: (client, context) => settlement.settleDeliveries(client, context.gameTimeMs),
    defaults_and_bonds: async (client, context) => {
      await settlement.settleDefaults(client, context.gameTimeMs);
      await garrison.settleMinute(client, context.gameTimeMs);
    },
    battle_and_scouts: async (client, context) => {
      await raids.resolveDue(client, context.gameTimeMs);
      await scouting.finishDue(client, context.gameTimeMs);
      await garrison.settleMinute(client, context.gameTimeMs);
      await retirement.retireDue(client, context.gameTimeMs);
    },
    views_and_achievements: async (client, context) => {
      if (context.gameTimeMs % 3_600_000 === 0)
        await fortune.snapshotHour(client, context.gameTimeMs, context.sequence);
      await achievements.processPending(client);
    },
  };
  const world = new WorldClockService(pool, productScope, handlers);
  retirement = new KingdomRetirementService(
    productScope,
    world,
    ledger,
    supply,
    settlement,
    garrison,
    buildings,
    troops,
  );
  return { world, handlers, ledger, buildings, troops, scouting, raids, fortune, achievements };
}
