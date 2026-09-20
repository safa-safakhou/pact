import { type CorrelationIds, createCorrelationIds } from "./correlation.js";
import { MetricRegistry } from "./metrics.js";
import { isSensitiveKey, safeErrorCode } from "./redaction.js";
import type { RetentionClass } from "./retention.js";

export type TraceStage = "api" | "transaction" | "outbox" | "worker";
export type TraceOutcome = "started" | "succeeded" | "failed" | "persisted";

export interface TelemetryEntry {
  readonly timestamp: string;
  readonly level: "info" | "error";
  readonly event: string;
  readonly retentionClass: RetentionClass;
  readonly correlation: CorrelationIds;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export type TelemetrySink = (entry: TelemetryEntry) => void;

export interface TraceReporter {
  recordStage(
    stage: TraceStage,
    outcome: TraceOutcome,
    correlation: CorrelationIds,
    attributes?: Readonly<Record<string, unknown>>,
  ): void;
}

function safeTraceAttributes(attributes: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (isSensitiveKey(key)) {
      safe[key] = "[REDACTED]";
    } else if (key === "errorCode") {
      safe[key] = safeErrorCode({ code: value });
    } else if ((key === "attempt" || key === "statusCode") && typeof value === "number" && Number.isFinite(value)) {
      safe[key] = value;
    } else if (key === "method" && typeof value === "string" && /^[A-Z]{3,10}$/.test(value)) {
      safe[key] = value;
    } else if (key === "route" && typeof value === "string" && /^\/[a-z0-9_/:.-]{0,200}$/i.test(value)) {
      safe[key] = value;
    } else if (
      (key === "eventType" || key === "provider" || key === "queue") &&
      typeof value === "string" &&
      /^[a-z0-9_.-]{1,96}$/i.test(value)
    ) {
      safe[key] = value;
    }
  }
  return safe;
}

export class Telemetry implements TraceReporter {
  readonly metrics = new MetricRegistry();

  constructor(
    private readonly sink: TelemetrySink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  recordStage(
    stage: TraceStage,
    outcome: TraceOutcome,
    correlation: CorrelationIds,
    attributes: Readonly<Record<string, unknown>> = {},
  ): void {
    this.sink({
      timestamp: this.now().toISOString(),
      level: outcome === "failed" ? "error" : "info",
      event: `command.${stage}.${outcome}`,
      retentionClass: "operational",
      correlation: createCorrelationIds(correlation),
      attributes: safeTraceAttributes(attributes),
    });
  }

  recordFailure(event: string, correlation: CorrelationIds, error: unknown): void {
    this.sink({
      timestamp: this.now().toISOString(),
      level: "error",
      event: /^[a-z0-9_.-]{1,96}$/.test(event) ? event : "operation.failed",
      retentionClass: "operational",
      correlation: createCorrelationIds(correlation),
      attributes: { errorCode: safeErrorCode(error) },
    });
  }
}

export function stdoutTelemetry(): Telemetry {
  return new Telemetry((entry) => process.stdout.write(`${JSON.stringify(entry)}\n`));
}

export async function executeTracedWorker<T>(
  trace: TraceReporter,
  correlation: CorrelationIds,
  operation: () => Promise<T>,
): Promise<T> {
  trace.recordStage("worker", "started", correlation);
  try {
    const result = await operation();
    trace.recordStage("worker", "succeeded", correlation);
    return result;
  } catch (error) {
    trace.recordStage("worker", "failed", correlation, { errorCode: safeErrorCode(error) });
    throw error;
  }
}
