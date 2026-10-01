import { randomUUID } from "node:crypto";
import { createPool } from "@pact/db";
import { createRulesRuntime } from "./runtime.js";

const databaseUrl = process.env.DATABASE_URL;
const raidKeyText = process.env.RAID_SEED_ENCRYPTION_KEY_BASE64;
const raidKey = raidKeyText ? Buffer.from(raidKeyText, "base64") : null;
if (!databaseUrl || !raidKey || raidKey.length !== 32 || raidKey.toString("base64") !== raidKeyText) {
  console.error("DATABASE_URL and a 32-byte RAID_SEED_ENCRYPTION_KEY_BASE64 are required");
  process.exitCode = 1;
} else {
  const pool = createPool(databaseUrl);
  const openingText = process.env.PACT_SEASON_OPENING_GAME_TIME_MS;
  const opening = openingText === undefined || openingText === "" ? undefined : Number(openingText);
  if (opening !== undefined && (!Number.isSafeInteger(opening) || opening < 0 || opening % 60000 !== 0))
    throw new Error("INVALID_SEASON_OPENING");
  const { world } = createRulesRuntime(pool, "pact", raidKey, undefined, opening);
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
