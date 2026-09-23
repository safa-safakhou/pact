import { randomUUID } from "node:crypto";
import { createPool } from "@pact/db";
import { BuildingEngine, FailClosedConstructionAuthority, TroopService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { WorldClockService } from "@pact/world";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exitCode = 1;
} else {
  const pool = createPool(databaseUrl);
  const ledger = new ResourceLedger("pact");
  const buildings = new BuildingEngine("pact", ledger, new FailClosedConstructionAuthority());
  const troops = new TroopService("pact", ledger);
  const world = new WorldClockService(pool, "pact", {
    boundaries_and_completions: async (client, context) => {
      await ledger.expireFoundingAllowances(client, context);
      await buildings.settleMinute(client, context);
      await troops.settleMinute(client, context);
    },
    // PACT-069 replaces the test-world week-one default with the configured season clock.
    production: (client, context) => ledger.settleProductionMinute(client, context, 1),
  });
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
