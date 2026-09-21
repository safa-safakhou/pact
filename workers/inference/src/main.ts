import { randomUUID } from "node:crypto";
import { acquireJob, completeJob, createPool, failJob } from "@pact/db";
import { DeterministicFakeProvider, ProviderRouter } from "@pact/model-provider";
import { RunService } from "@pact/runs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exitCode = 1;
} else {
  const pool = createPool(databaseUrl);
  const clock = { now: () => new Date() };
  const workerId = `inference-${randomUUID()}`;
  const runs = new RunService(pool, {
    productScope: "pact",
    clock,
    providerRouter: new ProviderRouter([new DeterministicFakeProvider({ scenario: "success" })]),
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
