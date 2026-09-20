import { describe, expect, it } from "vitest";
import { createCorrelationIds, MetricRegistry, redactTelemetry, retentionClasses, Telemetry } from "./index.js";

describe("telemetry privacy controls", () => {
  it("redacts credentials and private communication recursively", () => {
    const result = redactTelemetry({
      authorization: "Bearer secret",
      profile: { email: "player@example.test", safe: "kept", provider_request: "private prompt" },
      messages: [{ messageBody: "private negotiation" }],
      error: new Error("private error detail"),
    });
    const encoded = JSON.stringify(result);
    expect(encoded).not.toContain("secret");
    expect(encoded).not.toContain("player@example.test");
    expect(encoded).not.toContain("private prompt");
    expect(encoded).not.toContain("private negotiation");
    expect(encoded).not.toContain("private error detail");
    expect(result).toMatchObject({ profile: { safe: "kept" } });
  });

  it("exports content-free operational metrics and the policy retention classes", () => {
    const metrics = new MetricRegistry();
    metrics.setReady(true);
    metrics.setQueueLag("rules", 12.5);
    metrics.recordProviderError("fake-provider", "RATE_LIMITED");
    metrics.recordProviderError("private provider label@example.test", "private error detail");
    expect(metrics.renderPrometheus()).toContain('pact_queue_lag_seconds{queue="rules"} 12.5');
    expect(metrics.renderPrometheus()).toContain(
      'pact_provider_errors_total{provider="fake-provider",code="RATE_LIMITED"} 1',
    );
    expect(metrics.renderPrometheus()).not.toContain("example.test");
    expect(metrics.renderPrometheus()).not.toContain("private error detail");
    expect(retentionClasses.rawEdgeMetadata).toMatchObject({ retainDays: 7, ipRetainDays: 7 });
    expect(retentionClasses.securityAudit).toMatchObject({ retainDays: 90, ipRetainDays: 7 });
  });

  it("rejects caller-controlled correlation text and redacts trace attributes", () => {
    const entries: unknown[] = [];
    const telemetry = new Telemetry(
      (entry) => entries.push(entry),
      () => new Date("2026-09-20T00:00:00Z"),
    );
    const correlation = createCorrelationIds({ requestId: "not-a-safe-id" });
    telemetry.recordStage("worker", "failed", correlation, { prompt: "private", errorCode: "FAILED" });
    expect(correlation.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(entries)).not.toContain("private");
    expect(entries).toMatchObject([{ event: "command.worker.failed", attributes: { prompt: "[REDACTED]" } }]);

    telemetry.recordStage(
      "api",
      "failed",
      { requestId: "private-request@example.test" },
      { errorCode: "PRIVATE_TOKEN" },
    );
    telemetry.recordFailure(
      "private event@example.test",
      { requestId: "another private value" },
      {
        code: "PRIVATE_TOKEN",
      },
    );
    expect(JSON.stringify(entries)).not.toContain("example.test");
    expect(JSON.stringify(entries)).not.toContain("PRIVATE_TOKEN");
    expect(entries.at(-1)).toMatchObject({ event: "operation.failed", attributes: { errorCode: "UNEXPECTED_ERROR" } });
  });
});
