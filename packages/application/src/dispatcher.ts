import { type CommandEnvelope, CommandEnvelopeSchema, type CommandReceipt, SCHEMA_VERSION } from "@pact/contracts";
import { appendOutbox, withTransaction } from "@pact/db";
import type { Clock } from "@pact/platform";
import { type CorrelationIds, createCorrelationIds, type TraceReporter } from "@pact/telemetry";
import type { Pool, PoolClient } from "pg";
import { canonicalPayloadHash } from "./canonical.js";
import { executeSandboxAction } from "./sandbox.js";
import { type AuthenticatedPrincipal, DispatcherError } from "./types.js";

export interface CommandDispatcherOptions {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly productScope: string;
  readonly trace?: TraceReporter;
}

interface ReceiptRow {
  canonical_payload_hash: string;
  receipt: CommandReceipt;
  account_id: string | null;
}

function receiptSkeleton(commandId: string, code: CommandReceipt["code"], committedAt?: Date): CommandReceipt {
  return {
    schemaVersion: SCHEMA_VERSION,
    commandId,
    code,
    committedEventIds: [],
    recordVersions: {},
    charged: [],
    ...(committedAt ? { committedAt: committedAt.toISOString() } : {}),
  };
}

function deriveEnvelope(principal: AuthenticatedPrincipal, parsed: CommandEnvelope): CommandEnvelope {
  return {
    ...parsed,
    actor: {
      principalId: principal.accountId,
      productScope: principal.productScope,
      audience: principal.audience,
      subject: { type: "account", id: principal.accountId },
      ...(principal.sessionId ? { sessionId: principal.sessionId } : {}),
    },
  };
}

export class CommandDispatcher {
  constructor(private readonly options: CommandDispatcherOptions) {}

  async dispatch(
    principal: AuthenticatedPrincipal,
    rawCommand: unknown,
    correlation?: CorrelationIds,
  ): Promise<CommandReceipt> {
    this.assertPrincipal(principal);
    const parsed = this.parseCommand(rawCommand);
    const command = deriveEnvelope(principal, parsed);
    const payloadHash = canonicalPayloadHash(command);
    const correlationIds = createCorrelationIds({
      requestId: correlation?.requestId ?? command.commandId,
      commandId: command.commandId,
      ...(correlation?.runId ? { runId: correlation.runId } : {}),
      ...(correlation?.jobId ? { jobId: correlation.jobId } : {}),
    });

    return withTransaction(
      this.options.pool,
      async (client) => {
        const existing = await this.loadReceipt(client, command.commandId);
        if (existing) {
          if (existing.account_id !== principal.accountId) {
            throw new DispatcherError("FORBIDDEN");
          }
          if (existing.canonical_payload_hash === payloadHash) {
            return existing.receipt;
          }
          return receiptSkeleton(command.commandId, "IDEMPOTENCY_CONFLICT");
        }

        const now = this.options.clock.now();
        let mutation: Awaited<ReturnType<typeof executeSandboxAction>>;
        try {
          mutation = await executeSandboxAction(client, principal, command, now);
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error.code === "STALE_VERSION" || error.code === "INVALID_COMMAND")
          ) {
            throw new DispatcherError(error.code);
          }
          throw error;
        }

        const receipt: CommandReceipt = {
          schemaVersion: SCHEMA_VERSION,
          commandId: command.commandId,
          code: "COMMITTED",
          committedEventIds: [mutation.event.eventId],
          recordVersions: mutation.recordVersions,
          charged: [],
          committedAt: now.toISOString(),
        };

        await client.query(
          `INSERT INTO command_receipts(
             product_scope, command_id, account_id, canonical_payload_hash, code, receipt
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            this.options.productScope,
            command.commandId,
            principal.accountId,
            payloadHash,
            receipt.code,
            JSON.stringify(receipt),
          ],
        );
        await appendOutbox(client, {
          productScope: this.options.productScope,
          eventId: mutation.event.eventId,
          type: mutation.event.type,
          payload: mutation.event,
          correlation: correlationIds,
          ...(this.options.trace ? { trace: this.options.trace } : {}),
        });
        return receipt;
      },
      {
        isolation: "SERIALIZABLE",
        ...(this.options.trace ? { trace: this.options.trace, correlation: correlationIds } : {}),
      },
    );
  }

  async lookupReceipt(principal: AuthenticatedPrincipal, commandId: string): Promise<CommandReceipt | null> {
    this.assertPrincipal(principal);
    const result = await this.options.pool.query<ReceiptRow>(
      `SELECT canonical_payload_hash, receipt, account_id
       FROM command_receipts
       WHERE product_scope = $1 AND command_id = $2 AND account_id = $3`,
      [this.options.productScope, commandId, principal.accountId],
    );
    return result.rows[0]?.receipt ?? null;
  }

  private assertPrincipal(principal: AuthenticatedPrincipal): void {
    if (principal.productScope !== this.options.productScope) {
      throw new DispatcherError("FORBIDDEN");
    }
  }

  private parseCommand(rawCommand: unknown): CommandEnvelope {
    const parsed = CommandEnvelopeSchema.safeParse(rawCommand);
    if (!parsed.success) {
      throw new DispatcherError("INVALID_COMMAND");
    }
    return parsed.data;
  }

  private async loadReceipt(client: PoolClient, commandId: string): Promise<ReceiptRow | undefined> {
    const result = await client.query<ReceiptRow>(
      `SELECT canonical_payload_hash, receipt, account_id
       FROM command_receipts WHERE product_scope = $1 AND command_id = $2 FOR UPDATE`,
      [this.options.productScope, commandId],
    );
    return result.rows[0];
  }
}
