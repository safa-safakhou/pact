import { createPool } from "@pact/db";
import { FileDeletionRegistry } from "./file-registry.js";
import { PrivacyService } from "./service.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = createPool(connectionString);
try {
  const registryPath = process.env.PACT_DELETION_REGISTRY_FILE;
  if (!registryPath) throw new Error("PACT_DELETION_REGISTRY_FILE is required");
  const privacy = new PrivacyService(pool, {
    productScope: "pact",
    clock: { now: () => new Date() },
    deletionRegistry: new FileDeletionRegistry(registryPath),
  });
  const result = await privacy.replayDeletionRegistry();
  console.log(`Deletion registry replayed: ${result.closed} closed, ${result.purged} purged.`);
} finally {
  await pool.end();
}
