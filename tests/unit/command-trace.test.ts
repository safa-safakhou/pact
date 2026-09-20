import { randomUUID } from "node:crypto";
import { appendOutbox, withTransaction } from "@pact/db";
import { createCorrelationIds, executeTracedWorker, Telemetry, type TelemetryEntry } from "@pact/telemetry";
import type { Pool, PoolClient } from "pg";
import { describe, expect, it } from "vitest";

describe("command failure correlation", () => {
  it("links API, transaction, outbox, and worker stages without transcript content", async () => {
    const entries: TelemetryEntry[] = [];
    const telemetry = new Telemetry((entry) => entries.push(entry));
    const correlation = createCorrelationIds({
      requestId: randomUUID(),
      commandId: randomUUID(),
      runId: randomUUID(),
      jobId: randomUUID(),
    });
    const queries: Array<{ text: string; values?: readonly unknown[] }> = [];
    const client = {
      query: async (text: string, values?: readonly unknown[]) => {
        queries.push({ text, ...(values ? { values } : {}) });
        return { rowCount: 1, rows: [] };
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool = { connect: async () => client } as unknown as Pool;
    const eventId = randomUUID();

    telemetry.recordStage("api", "started", correlation);
    await withTransaction(
      pool,
      (transaction) =>
        appendOutbox(transaction, {
          productScope: "pact",
          eventId,
          type: "fixture.command.accepted.v1",
          payload: { messageBody: "private negotiation" },
          correlation,
          trace: telemetry,
        }),
      { correlation, trace: telemetry },
    );
    await expect(
      executeTracedWorker(telemetry, { ...correlation, outboxEventId: eventId }, async () => {
        throw Object.assign(new Error("private provider response"), { code: "PROVIDER_FAILED" });
      }),
    ).rejects.toThrow();

    expect(entries.map((entry) => entry.event)).toEqual([
      "command.api.started",
      "command.transaction.started",
      "command.outbox.persisted",
      "command.transaction.succeeded",
      "command.worker.started",
      "command.worker.failed",
    ]);
    expect(entries.every((entry) => entry.correlation.requestId === correlation.requestId)).toBe(true);
    expect(entries.every((entry) => entry.correlation.commandId === correlation.commandId)).toBe(true);
    expect(JSON.stringify(entries)).not.toContain("private negotiation");
    expect(JSON.stringify(entries)).not.toContain("private provider response");
    const outboxInsert = queries.find((query) => query.text.includes("INSERT INTO outbox_events"));
    expect(outboxInsert?.values).toEqual([
      "pact",
      eventId,
      "fixture.command.accepted.v1",
      JSON.stringify({ messageBody: "private negotiation" }),
      correlation.requestId,
      correlation.commandId,
      correlation.runId,
      correlation.jobId,
    ]);
  });
});
