import { randomUUID } from "node:crypto";

export interface CorrelationIds {
  readonly requestId: string;
  readonly commandId?: string;
  readonly runId?: string;
  readonly jobId?: string;
  readonly outboxEventId?: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function trustedCorrelationId(value: unknown): string | undefined {
  return typeof value === "string" && uuidPattern.test(value) ? value.toLowerCase() : undefined;
}

export function createCorrelationIds(input: Partial<CorrelationIds> = {}): CorrelationIds {
  const commandId = trustedCorrelationId(input.commandId);
  const runId = trustedCorrelationId(input.runId);
  const jobId = trustedCorrelationId(input.jobId);
  const outboxEventId = trustedCorrelationId(input.outboxEventId);
  return {
    requestId: trustedCorrelationId(input.requestId) ?? randomUUID(),
    ...(commandId ? { commandId } : {}),
    ...(runId ? { runId } : {}),
    ...(jobId ? { jobId } : {}),
    ...(outboxEventId ? { outboxEventId } : {}),
  };
}
