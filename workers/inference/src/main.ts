import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { acquireJob, completeJob, createPool, failJob } from "@pact/db";
import { createInferenceCredentialResolver, createVaultBoundCredentialUse } from "./credential-access.js";
import { createInferenceGameRuntime } from "./game-runtime.js";
import { createInferenceProviderRouter } from "./provider-runtime.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exitCode = 1;
} else {
  const pool = createPool(databaseUrl);
  const clock = { now: () => new Date() };
  const workerId = `inference-${randomUUID()}`;
  // A mounted private key alone never enables network inference or paid provider use.
  const liveProvidersEnabled = process.env.PACT_ENABLE_LIVE_MODEL_CALLS === "1";
  const privateKey = liveProvidersEnabled
    ? await readFile(process.env.MODEL_CREDENTIAL_PRIVATE_KEY_FILE ?? "/run/secrets/model_credential_private_key")
    : undefined;
  const wrappingKeyId = process.env.MODEL_CREDENTIAL_WRAPPING_KEY_ID;
  if (privateKey && !wrappingKeyId) throw new Error("MODEL_CREDENTIAL_WRAPPING_KEY_ID is required");
  const resolver =
    privateKey && wrappingKeyId
      ? createInferenceCredentialResolver(pool, {
          productScope: "pact",
          privateKeyPem: privateKey,
          acceptedKeyIds: new Set([wrappingKeyId]),
          now: clock.now,
        })
      : undefined;
  privateKey?.fill(0);
  const { runs } = await createInferenceGameRuntime({
    pool,
    productScope: "pact",
    clock,
    providerRouter: createInferenceProviderRouter(liveProvidersEnabled, process.env.OPENROUTER_ROUTING_DISCLOSURE),
    ...(resolver ? { withCredential: createVaultBoundCredentialUse(resolver) } : {}),
    termsVersion: process.env.CURRENT_TERMS_VERSION ?? "connection-test-v1",
    ...(process.env.RAID_SEED_ENCRYPTION_KEY_BASE64
      ? { raidSeed: Buffer.from(process.env.RAID_SEED_ENCRYPTION_KEY_BASE64, "base64") }
      : {}),
  });

  console.log("PACT inference worker ready; processing bounded envoy.run.tick jobs.");

  const tick = async (): Promise<void> => {
    const job = await acquireJob(pool, workerId, 30_000);
    if (!job) return;
    try {
      if (job.type !== "envoy.run.tick") {
        await completeJob(pool, job.id, workerId);
        return;
      }
      const payload = job.payload as { runId?: string };
      if (!payload.runId) {
        await failJob(pool, job.id, workerId);
        return;
      }
      await runs.executeModelCall(payload.runId);
      await completeJob(pool, job.id, workerId);
    } catch (error) {
      console.error("inference job failed", error instanceof Error ? error.message : "unknown");
      // Ambiguous/provider failures are recorded on the run; do not unbounded-retry the job.
      await failJob(pool, job.id, workerId);
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, 1_000);
  void tick();

  const shutdown = async (): Promise<void> => {
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
