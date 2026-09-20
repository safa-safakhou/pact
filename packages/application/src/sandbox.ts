import { randomUUID } from "node:crypto";
import type { CommandEnvelope, EventEnvelope } from "@pact/contracts";
import type { PoolClient } from "pg";
import { type AuthenticatedPrincipal, DispatcherError } from "./types.js";

export interface SandboxMutationResult {
  readonly event: EventEnvelope;
  readonly recordVersions: Record<string, number>;
}

function eventBase(
  principal: AuthenticatedPrincipal,
  type: string,
  relatedRecordId: string,
  payload: Record<string, unknown>,
  occurredAt: Date,
): EventEnvelope {
  const subject = { type: "account" as const, id: principal.accountId };
  return {
    schemaVersion: "pact.event.v1",
    eventId: randomUUID(),
    productScope: principal.productScope,
    type,
    actor: subject,
    audience: [subject],
    gameTime: 0,
    occurredAt: occurredAt.toISOString(),
    relatedRecordId,
    payload,
  };
}

export async function executeSandboxAction(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  command: CommandEnvelope,
  occurredAt: Date,
): Promise<SandboxMutationResult> {
  const action = command.action;
  const scope = principal.productScope as string;
  if (action.kind === "sandbox.echo") {
    return {
      event: eventBase(
        principal,
        "sandbox.echoed.v1",
        `echo:${command.commandId}`,
        { length: action.message.length },
        occurredAt,
      ),
      recordVersions: {},
    };
  }
  if (action.kind === "sandbox.counter.increment") {
    await client.query("SELECT id FROM accounts WHERE id = $1 AND product_scope = $2 FOR UPDATE", [
      principal.accountId,
      scope,
    ]);
    const existing = await client.query<{ value: number; version: number }>(
      `SELECT value, version FROM sandbox_counters
       WHERE product_scope = $1 AND account_id = $2 AND counter_id = $3 FOR UPDATE`,
      [scope, principal.accountId, action.counterId],
    );
    const current = existing.rows[0];
    if (command.expectedVersion !== undefined && (current?.version ?? 0) !== command.expectedVersion) {
      throw new DispatcherError("STALE_VERSION");
    }
    const nextValue = (current?.value ?? 0) + action.amount;
    const nextVersion = (current?.version ?? 0) + 1;
    await client.query(
      `INSERT INTO sandbox_counters(product_scope, account_id, counter_id, value, version, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(product_scope, account_id, counter_id) DO UPDATE SET
         value = EXCLUDED.value, version = EXCLUDED.version, updated_at = EXCLUDED.updated_at`,
      [scope, principal.accountId, action.counterId, nextValue, nextVersion, occurredAt],
    );
    const recordKey = `sandbox.counter:${action.counterId}`;
    return {
      event: eventBase(
        principal,
        "sandbox.counter.incremented.v1",
        recordKey,
        { counterId: action.counterId, value: nextValue, version: nextVersion },
        occurredAt,
      ),
      recordVersions: { [recordKey]: nextVersion },
    };
  }
  if (action.kind === "sandbox.draft.read") {
    const draft = await client.query<{ note: string; version: number }>(
      `SELECT note, version FROM sandbox_drafts WHERE product_scope = $1 AND account_id = $2`,
      [scope, principal.accountId],
    );
    const row = draft.rows[0] ?? { note: "", version: 0 };
    return {
      event: eventBase(
        principal,
        "sandbox.draft.read.v1",
        `sandbox.draft:${principal.accountId}`,
        { noteLength: row.note.length, version: row.version },
        occurredAt,
      ),
      recordVersions: { [`sandbox.draft:${principal.accountId}`]: row.version },
    };
  }
  if (action.kind === "sandbox.draft.write") {
    await client.query("SELECT id FROM accounts WHERE id = $1 AND product_scope = $2 FOR UPDATE", [
      principal.accountId,
      scope,
    ]);
    const existing = await client.query<{ version: number }>(
      `SELECT version FROM sandbox_drafts WHERE product_scope = $1 AND account_id = $2 FOR UPDATE`,
      [scope, principal.accountId],
    );
    const currentVersion = existing.rows[0]?.version ?? 0;
    if (command.expectedVersion !== undefined && currentVersion !== command.expectedVersion) {
      throw new DispatcherError("STALE_VERSION");
    }
    const nextVersion = currentVersion + 1;
    await client.query(
      `INSERT INTO sandbox_drafts(product_scope, account_id, note, version, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(product_scope, account_id) DO UPDATE SET
         note = EXCLUDED.note, version = EXCLUDED.version, updated_at = EXCLUDED.updated_at`,
      [scope, principal.accountId, action.note, nextVersion, occurredAt],
    );
    const recordKey = `sandbox.draft:${principal.accountId}`;
    return {
      event: eventBase(
        principal,
        "sandbox.draft.written.v1",
        recordKey,
        { noteLength: action.note.length, version: nextVersion },
        occurredAt,
      ),
      recordVersions: { [recordKey]: nextVersion },
    };
  }
  const _exhaustive: never = action;
  void _exhaustive;
  throw new DispatcherError("INVALID_COMMAND");
}
