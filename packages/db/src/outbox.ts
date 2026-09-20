import type { CorrelationIds, TraceReporter } from "@pact/telemetry";
import type { PoolClient } from "pg";

export async function appendOutbox(
  client: PoolClient,
  input: {
    productScope: string;
    eventId: string;
    type: string;
    payload: unknown;
    correlation?: CorrelationIds;
    trace?: TraceReporter;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO outbox_events(
       product_scope, event_id, type, payload, request_id, command_id, run_id, job_id
     ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
    [
      input.productScope,
      input.eventId,
      input.type,
      JSON.stringify(input.payload),
      input.correlation?.requestId ?? null,
      input.correlation?.commandId ?? null,
      input.correlation?.runId ?? null,
      input.correlation?.jobId ?? null,
    ],
  );
  if (input.trace && input.correlation) {
    input.trace.recordStage(
      "outbox",
      "persisted",
      { ...input.correlation, outboxEventId: input.eventId },
      {
        eventType: input.type,
      },
    );
  }
}

export async function claimOutboxDelivery(
  client: PoolClient,
  input: { consumer: string; eventId: string; workerId: string; leaseMilliseconds: number },
): Promise<boolean> {
  const result = await client.query(
    `INSERT INTO outbox_deliveries(consumer, outbox_event_id, status, leased_by, lease_expires_at, attempts)
     SELECT $1, id, 'leased', $3, now() + ($4 * interval '1 millisecond'), 1 FROM outbox_events WHERE event_id = $2
     ON CONFLICT(consumer, outbox_event_id) DO UPDATE SET
       status = 'leased', leased_by = EXCLUDED.leased_by, lease_expires_at = EXCLUDED.lease_expires_at,
       attempts = outbox_deliveries.attempts + 1
     WHERE outbox_deliveries.status <> 'delivered' AND outbox_deliveries.lease_expires_at <= now()
     RETURNING outbox_event_id`,
    [input.consumer, input.eventId, input.workerId, input.leaseMilliseconds],
  );
  return result.rowCount === 1;
}

export async function markOutboxDelivered(
  client: PoolClient,
  consumer: string,
  eventId: string,
  workerId: string,
): Promise<boolean> {
  const result = await client.query(
    `UPDATE outbox_deliveries d SET status = 'delivered', delivered_at = now(), lease_expires_at = NULL
     FROM outbox_events e
     WHERE d.outbox_event_id = e.id AND d.consumer = $1 AND e.event_id = $2
       AND d.status = 'leased' AND d.leased_by = $3
     RETURNING d.outbox_event_id`,
    [consumer, eventId, workerId],
  );
  return result.rowCount === 1;
}
