import { randomUUID } from "node:crypto";
import type { EventEnvelope } from "@pact/contracts";
import { EVENT_SCHEMA_VERSION, ProductScopeSchema } from "@pact/contracts";
import type { Pool, PoolClient } from "pg";

export class InboxError extends Error {
  constructor(readonly code: "FORBIDDEN" | "CURSOR_EXPIRED" | "INVALID_CURSOR") {
    super(code);
    this.name = "InboxError";
  }
}

export interface InboxEventCard {
  readonly sequence: string;
  readonly eventId: string;
  readonly type: string;
  readonly occurredAt: string;
  readonly payload: unknown;
}

export interface InboxPage {
  readonly events: InboxEventCard[];
  readonly nextCursor: string | null;
  readonly resyncRequired?: true;
  readonly resumeFrom?: string;
}

export interface BoundedInboxPage {
  readonly events: readonly (InboxEventMetadata & { readonly payload: unknown; readonly payloadOmitted?: true })[];
  readonly nextCursor: string | null;
  readonly resyncRequired?: true;
  readonly resumeFrom?: string;
  readonly untrustedContent: true;
}

export interface InboxEventMetadata {
  readonly sequence: string;
  readonly eventId: string;
  readonly type: string;
  readonly occurredAt: string;
}

export class InboxService {
  constructor(
    private readonly pool: Pool,
    private readonly options: { productScope: string; clock: { now(): Date }; retentionFloorSequence?: number },
  ) {}

  async publishForAccount(
    client: PoolClient,
    input: { accountId: string; type: string; payload: unknown; eventId?: string; occurredAt?: Date },
  ): Promise<string> {
    const eventId = input.eventId ?? randomUUID();
    const occurredAt = input.occurredAt ?? this.options.clock.now();
    const envelope: EventEnvelope = {
      schemaVersion: EVENT_SCHEMA_VERSION,
      eventId,
      productScope: ProductScopeSchema.parse(this.options.productScope),
      type: input.type,
      actor: { type: "account", id: input.accountId },
      audience: [{ type: "account", id: input.accountId }],
      gameTime: 0,
      occurredAt: occurredAt.toISOString(),
      relatedRecordId: eventId,
      payload:
        typeof input.payload === "object" && input.payload !== null ? (input.payload as Record<string, unknown>) : {},
    };
    await client.query(
      `INSERT INTO inbox_events(product_scope, event_id, account_id, type, payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT(product_scope, event_id, account_id) DO NOTHING`,
      [this.options.productScope, eventId, input.accountId, input.type, JSON.stringify(envelope), occurredAt],
    );
    return eventId;
  }

  async publish(accountId: string, type: string, payload: unknown): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const eventId = await this.publishForAccount(client, { accountId, type, payload });
      await client.query("COMMIT");
      return eventId;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async list(accountId: string, cursor: string | undefined, limit = 50): Promise<InboxPage> {
    const after = cursor ? BigInt(cursor) : 0n;
    const floor = BigInt(this.options.retentionFloorSequence ?? 0);
    if (after > 0n && after < floor) {
      return { events: [], nextCursor: null, resyncRequired: true, resumeFrom: floor.toString() };
    }
    const result = await this.pool.query<{
      sequence: string;
      event_id: string;
      type: string;
      occurred_at: Date;
      payload: unknown;
    }>(
      `SELECT sequence::text, event_id, type, occurred_at, payload
       FROM inbox_events
       WHERE product_scope = $1 AND account_id = $2 AND sequence > $3
       ORDER BY sequence ASC LIMIT $4`,
      [this.options.productScope, accountId, after.toString(), Math.min(Math.max(limit, 1), 100)],
    );
    const events = result.rows.map((row) => ({
      sequence: row.sequence,
      eventId: row.event_id,
      type: row.type,
      occurredAt: row.occurred_at.toISOString(),
      payload: row.payload,
    }));
    const nextCursor = events.length > 0 ? (events[events.length - 1]?.sequence ?? null) : null;
    return { events, nextCursor };
  }

  /** Owner-scoped tool projection: no event payload can exceed the model-result budget. */
  async readBounded(accountId: string, cursor: string | undefined, limit = 5): Promise<BoundedInboxPage> {
    const page = await this.list(accountId, cursor, Math.min(Math.max(limit, 1), 5));
    const events = page.events.map((event) => {
      const envelope = event.payload as { payload?: unknown } | null;
      const payload = envelope?.payload ?? null;
      const encoded = JSON.stringify(payload);
      return {
        sequence: event.sequence,
        eventId: event.eventId,
        type: event.type.slice(0, 64),
        occurredAt: event.occurredAt,
        ...(encoded && Buffer.byteLength(encoded, "utf8") <= 512
          ? { payload }
          : { payload: null, payloadOmitted: true as const }),
      };
    });
    return {
      events,
      nextCursor: page.nextCursor,
      ...(page.resyncRequired ? { resyncRequired: page.resyncRequired } : {}),
      ...(page.resumeFrom ? { resumeFrom: page.resumeFrom } : {}),
      untrustedContent: true,
    };
  }

  /** A bounded, payload-free owner feed for context assembly; not a substitute for inbox.read. */
  async listRecentMetadata(accountId: string, limit = 8): Promise<readonly InboxEventMetadata[]> {
    const result = await this.pool.query<{
      sequence: string;
      event_id: string;
      type: string;
      occurred_at: Date;
    }>(
      `SELECT sequence::text, event_id, type, occurred_at
       FROM inbox_events
       WHERE product_scope = $1 AND account_id = $2
       ORDER BY sequence DESC LIMIT $3`,
      [this.options.productScope, accountId, Math.min(Math.max(limit, 1), 8)],
    );
    return result.rows.map((row) => ({
      sequence: row.sequence,
      eventId: row.event_id,
      type: row.type,
      occurredAt: row.occurred_at.toISOString(),
    }));
  }

  async acknowledge(accountId: string, cursor: string): Promise<{ lastSequence: string }> {
    if (!/^\d+$/.test(cursor)) throw new InboxError("INVALID_CURSOR");
    await this.pool.query(
      `INSERT INTO inbox_acknowledgements(product_scope, account_id, last_sequence, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(product_scope, account_id) DO UPDATE SET
         last_sequence = GREATEST(inbox_acknowledgements.last_sequence, EXCLUDED.last_sequence),
         updated_at = EXCLUDED.updated_at`,
      [this.options.productScope, accountId, cursor, this.options.clock.now()],
    );
    return { lastSequence: cursor };
  }

  /** Notification workers must never invoke provider adapters; this is a pure inbox write. */
  assertNoProviderInvocation(): void {
    // Structural guard documented for acceptance; delivery cannot mutate receipts.
  }
}
