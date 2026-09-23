import { createPool } from "@pact/db";
import { WorldClockService } from "@pact/world";

const action = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["status", "pause", "resume"].includes(action ?? "")) {
  console.error("Usage: DATABASE_URL=... npm run clock --workspace @pact/rules-worker -- status|pause|resume");
  process.exitCode = 1;
} else {
  const pool = createPool(databaseUrl);
  const world = new WorldClockService(pool, "pact");
  try {
    if (action === "pause") await world.pause();
    const snapshot = action === "resume" ? await world.resume() : await world.read();
    console.log(
      JSON.stringify({
        status: snapshot.status,
        gameTimeMs: String(snapshot.gameTimeMs),
        sequence: snapshot.sequence.toString(),
        nextTickDueAt: snapshot.nextTickDueAt.toISOString(),
        suspensionReason: snapshot.suspensionReason,
      }),
    );
  } finally {
    await pool.end();
  }
}
