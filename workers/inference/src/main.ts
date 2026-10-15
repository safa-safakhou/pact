import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { storedCredentialRouteAvailable } from "@pact/credential-vault";
import { acquireJob, completeJob, createPool, failJob, renewJob } from "@pact/db";
import { PersistentPlayService } from "@pact/runs";
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
    webBasePath: new URL(process.env.PACT_PUBLIC_BASE_URL ?? process.env.PACT_ORIGIN ?? "http://localhost:3000")
      .pathname,
    ...(process.env.RAID_SEED_ENCRYPTION_KEY_BASE64
      ? { raidSeed: Buffer.from(process.env.RAID_SEED_ENCRYPTION_KEY_BASE64, "base64") }
      : {}),
  });

  console.log("PACT inference worker ready; processing bounded envoy.run.tick jobs.");

  const persistentPlay = new PersistentPlayService(pool, "pact", {
    clock,
    runs,
    routeAvailable: (client, accountId, id, provider) =>
      storedCredentialRouteAvailable(client, "pact", accountId, id, provider),
  });
  let lastEnrollmentCheck = 0;
  const tick = async (): Promise<void> => {
    if (clock.now().getTime() - lastEnrollmentCheck >= 30000) {
      lastEnrollmentCheck = clock.now().getTime();
      try {
        await persistentPlay.dispatch(liveProvidersEnabled);
      } catch (error) {
        console.error("enrollment maintenance failed", error instanceof Error ? error.name : "unknown");
      }
    }
    const owner = `${workerId}:${randomUUID()}`;
    const job = await acquireJob(pool, owner, 30_000);
    if (!job) return;
    const controller = new AbortController();
    let renewing = false;
    const assertCurrent = async () => {
      if (controller.signal.aborted || !(await renewJob(pool, job.id, owner, 30_000))) {
        controller.abort();
        throw new Error("EXECUTION_FENCED");
      }
    };
    const renewal = setInterval(() => {
      if (renewing) return;
      renewing = true;
      void assertCurrent()
        .catch(() => controller.abort())
        .finally(() => {
          renewing = false;
        });
    }, 5000);
    try {
      if (job.type !== "envoy.run.tick") {
        await completeJob(pool, job.id, owner);
        return;
      }
      const payload = job.payload as { runId?: string };
      if (!payload.runId) {
        await failJob(pool, job.id, owner);
        return;
      }
      if (job.attempts > 1) {
        const recovered = await runs.failInterruptedModelCall(payload.runId);
        if (recovered.lastErrorCode === "RECOVERED_NO_GAME_EFFECTS") {
          await completeJob(pool, job.id, owner);
          return;
        }
      }
      await runs.executeModelCall(payload.runId, { signal: controller.signal, assertCurrent });
      await completeJob(pool, job.id, owner);
    } catch (error) {
      console.error("inference job deferred", error instanceof Error ? error.name : "unknown");
      // Re-entry is guarded by the durable in-flight request and its original deadline.
      await failJob(pool, job.id, owner, { retryAfterMs: 5000 });
    } finally {
      clearInterval(renewal);
    }
  };

  let busy = false,
    stopping = false;
  const poll = async () => {
    if (busy || stopping) return;
    busy = true;
    try {
      await tick();
    } catch (error) {
      console.error("inference supervision deferred", error instanceof Error ? error.name : "unknown");
    } finally {
      busy = false;
    }
  };
  pool.on("error", () => console.error("inference database connection unavailable"));
  const timer = setInterval(() => {
    void poll();
  }, 1000);
  void poll();

  const shutdown = async (): Promise<void> => {
    stopping = true;
    clearInterval(timer);
    while (busy) await new Promise((resolve) => setTimeout(resolve, 100));
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
