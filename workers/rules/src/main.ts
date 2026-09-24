import { randomUUID } from "node:crypto";
import { ExactHumanPermitService, ExposureService, readReserveFloor } from "@pact/authority";
import { createPool } from "@pact/db";
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
import { WorldClockService } from "@pact/world";

const databaseUrl = process.env.DATABASE_URL;
const raidKeyText = process.env.RAID_SEED_ENCRYPTION_KEY_BASE64;
const raidKey = raidKeyText ? Buffer.from(raidKeyText, "base64") : null;
if (!databaseUrl || !raidKey || raidKey.length !== 32 || raidKey.toString("base64") !== raidKeyText) {
  console.error("DATABASE_URL and a 32-byte RAID_SEED_ENCRYPTION_KEY_BASE64 are required");
  process.exitCode = 1;
} else {
  const pool = createPool(databaseUrl);
  const ledger = new ResourceLedger("pact");
  const exposure = new ExposureService("pact", new ExactHumanPermitService("pact"));
  const immediateAuthority = new ImmediateExposureAdapter(exposure);
  const supplyAuthority = new SupplyExposureAdapter(exposure);
  const buildings = new BuildingEngine("pact", ledger, new ConstructionExposureAdapter("pact", exposure, ledger));
  const troops = new TroopService("pact", ledger, immediateAuthority);
  const garrison = new GarrisonService("pact", ledger, troops, exposure);
  const fortune = new FortuneService("pact");
  const upkeep = new UpkeepService("pact", ledger, new GarrisonUpkeepExposureAdapter("pact", exposure));
  const limits = new ActionLimitService("pact");
  const achievements = new AchievementService("pact");
  const scouting = new ScoutService("pact", ledger, troops, limits, exposure);
  const raids = new RaidService(
    "pact",
    ledger,
    troops,
    limits,
    exposure,
    new RaidRandomnessService("pact", raidKey),
    garrison,
  );
  const social = new SocialService("pact", ledger, limits, { now: () => new Date() }, immediateAuthority);
  const supply = new SupplyService("pact", ledger, limits, social, supplyAuthority);
  const settlement = new SupplySettlementService(
    "pact",
    ledger,
    {
      read: (client, accountId, resource) => readReserveFloor(client, "pact", accountId, resource),
    },
    supplyAuthority,
  );
  let retirement: KingdomRetirementService;
  const world = new WorldClockService(pool, "pact", {
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
  });
  retirement = new KingdomRetirementService("pact", world, ledger, supply, settlement, garrison, buildings, troops);
  const workerId = `rules-${randomUUID()}`;
  let leaseToken: string | null = null;
  let busy = false;
  let stopped = false;

  const poll = async (): Promise<void> => {
    if (busy || stopped) return;
    busy = true;
    try {
      if (!leaseToken) leaseToken = await world.acquireLease(workerId);
      if (!leaseToken) return;
      if (!(await world.heartbeat(workerId, leaseToken))) {
        leaseToken = null;
        return;
      }
      const result = await world.advance(workerId, leaseToken);
      if (result.kind === "lease_lost" || result.kind === "paused") leaseToken = null;
    } catch (error) {
      leaseToken = null;
      console.error("rules clock poll failed", error instanceof Error ? error.message : "unknown");
    } finally {
      busy = false;
    }
  };

  void world.bootstrap().then(
    (state) => {
      console.log(`PACT rules worker ready; world ${state.status} at game minute ${state.gameTimeMs}.`);
      void poll();
    },
    (error: unknown) => {
      console.error("rules clock bootstrap failed", error instanceof Error ? error.message : "unknown");
      process.exitCode = 1;
    },
  );

  const timer = setInterval(() => {
    void poll();
  }, 1_000);
  const shutdown = async (): Promise<void> => {
    stopped = true;
    clearInterval(timer);
    await pool.end();
  };
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown().then(() => {
        process.exitCode = 0;
      });
    });
  }
}
