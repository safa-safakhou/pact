import { createHash, randomUUID } from "node:crypto";
import {
  AcceptedCommandEnvelopeSchema,
  AcceptedSocialCommandSchema,
  type ChronicleCommand,
  ChronicleCommandSchema,
  type CommandEnvelope,
  type CommandReceipt,
  type CourtCommand,
  CourtCommandSchema,
  type GameAction,
  type PoliticsCommand,
  PoliticsCommandSchema,
  type SandboxAction,
  SCHEMA_VERSION,
  type SealCommand,
  SealCommandSchema,
  type SocialCommand,
} from "@pact/contracts";
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
  readonly game?: GameCommandPort;
  readonly social?: SocialCommandPort;
  readonly assertPlayAllowed?: (client: PoolClient, accountId: string) => Promise<void>;
  /** Transaction-bound metadata observer; failure rolls back the command and its receipt together. */
  readonly onCommittedReceipt?: (
    client: PoolClient,
    principal: AuthenticatedPrincipal,
    command: CommandEnvelope,
    receipt: CommandReceipt,
  ) => Promise<void>;
}

export interface SocialCommandPort {
  execute(
    client: PoolClient,
    principal: AuthenticatedPrincipal,
    command: SocialCommand | CourtCommand | PoliticsCommand | SealCommand | ChronicleCommand,
    gameTimeMs: number,
  ): Promise<{ recordVersions: Record<string, number>; result: unknown }>;
}

export interface GameCommandMutation {
  readonly recordVersions: Record<string, number>;
  readonly charged: CommandReceipt["charged"];
  readonly committedEventIds?: string[];
}

/** One transaction-bound path for human and agent gameplay writes. */
export interface GameCommandPort {
  admit<T>(
    operation: (client: PoolClient, gameTimeMs: number) => Promise<T>,
  ): Promise<{ kind: "admitted"; value: T } | { kind: "paused" | "tick_pending" }>;
  execute(
    client: PoolClient,
    principal: AuthenticatedPrincipal,
    command: CommandEnvelope & { action: GameAction },
    gameTimeMs: number,
  ): Promise<GameCommandMutation>;
}

function isGameAction(action: CommandEnvelope["action"]): action is GameAction {
  return action.kind.startsWith("game.");
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

  /** Human-only social choices use the same transaction, receipt journal and world admission as game commands. */
  async dispatchSocial(
    principal: AuthenticatedPrincipal,
    raw: unknown,
  ): Promise<{ receipt: CommandReceipt; result: unknown }> {
    this.assertPrincipal(principal);
    if (principal.audience !== "human" || !this.options.social || !this.options.game)
      throw new DispatcherError("FORBIDDEN");
    const parsed = AcceptedSocialCommandSchema.or(CourtCommandSchema)
      .or(PoliticsCommandSchema)
      .or(SealCommandSchema)
      .or(ChronicleCommandSchema)
      .safeParse(raw);
    if (!parsed.success) throw new DispatcherError("INVALID_COMMAND");
    const command = parsed.data;
    const payloadHash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
    const previous = await this.options.pool.query<ReceiptRow>(
      "SELECT canonical_payload_hash, receipt, account_id FROM command_receipts WHERE product_scope = $1 AND command_id = $2",
      [this.options.productScope, command.commandId],
    );
    if (previous.rows[0])
      return { receipt: this.replayed(principal, command.commandId, payloadHash, previous.rows[0]), result: null };
    const admitted = await this.options.game.admit(async (client, gameTimeMs) => {
      const previous = await this.loadReceipt(client, command.commandId);
      if (previous)
        return { receipt: this.replayed(principal, command.commandId, payloadHash, previous), result: null };
      const account = await client.query(
        "SELECT id FROM accounts WHERE product_scope = $1 AND id = $2 AND status = 'active' AND (email_verified_at IS NOT NULL OR is_guest) FOR UPDATE",
        [this.options.productScope, principal.accountId],
      );
      if (!account.rowCount) throw new DispatcherError("FORBIDDEN");
      await this.options.assertPlayAllowed?.(client, principal.accountId);
      const mutation = await this.options.social?.execute(client, principal, command, gameTimeMs);
      if (!mutation) throw new DispatcherError("INVALID_COMMAND");
      const eventId = randomUUID();
      const receipt: CommandReceipt = {
        ...receiptSkeleton(command.commandId, "COMMITTED", this.options.clock.now()),
        recordVersions: mutation.recordVersions,
        committedEventIds: [eventId],
      };
      await client.query(
        "INSERT INTO command_receipts(product_scope, command_id, account_id, canonical_payload_hash, code, receipt) VALUES ($1,$2,$3,$4,$5,$6::jsonb)",
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
        eventId,
        type: "social.command.committed.v1",
        payload: {
          commandId: command.commandId,
          accountId: principal.accountId,
          kind: command.action.kind,
          recordVersions: mutation.recordVersions,
        },
      });
      // The opaque link token is returned once, not stored in receipts, events or logs.
      return { receipt, result: mutation.result };
    });
    if (admitted.kind === "tick_pending") throw new DispatcherError("TICK_PENDING");
    return admitted.kind === "admitted"
      ? admitted.value
      : { receipt: receiptSkeleton(command.commandId, "WORLD_PAUSED"), result: null };
  }

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

    if (isGameAction(command.action)) {
      return this.dispatchGame(principal, { ...command, action: command.action }, payloadHash);
    }

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
          mutation = await executeSandboxAction(
            client,
            principal,
            { ...command, action: command.action as SandboxAction },
            now,
          );
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
        await this.options.onCommittedReceipt?.(client, principal, command, receipt);
        return receipt;
      },
      {
        isolation: "SERIALIZABLE",
        ...(this.options.trace ? { trace: this.options.trace, correlation: correlationIds } : {}),
      },
    );
  }

  private async dispatchGame(
    principal: AuthenticatedPrincipal,
    command: CommandEnvelope & { action: GameAction },
    payloadHash: string,
  ): Promise<CommandReceipt> {
    const game = this.options.game;
    if (!game) throw new DispatcherError("INVALID_COMMAND");
    // A retry can still retrieve a committed receipt during a world suspension.
    const prior = await this.options.pool.query<ReceiptRow>(
      "SELECT canonical_payload_hash, receipt, account_id FROM command_receipts WHERE product_scope = $1 AND command_id = $2",
      [this.options.productScope, command.commandId],
    );
    if (prior.rows[0]) return this.replayed(principal, command.commandId, payloadHash, prior.rows[0]);
    let admitted: Awaited<ReturnType<typeof game.admit<CommandReceipt>>>;
    try {
      admitted = await game.admit(async (client, gameTimeMs) => {
        const existing = await this.loadReceipt(client, command.commandId);
        if (existing) return this.replayed(principal, command.commandId, payloadHash, existing);
        await this.options.assertPlayAllowed?.(client, principal.accountId);
        const mutation = await game.execute(client, principal, command, gameTimeMs);
        const receipt: CommandReceipt = {
          schemaVersion: SCHEMA_VERSION,
          commandId: command.commandId,
          code: "COMMITTED",
          committedEventIds: mutation.committedEventIds ?? [],
          recordVersions: mutation.recordVersions,
          charged: mutation.charged,
          committedAt: this.options.clock.now().toISOString(),
        };
        await client.query(
          `INSERT INTO command_receipts(product_scope, command_id, account_id, canonical_payload_hash, code, receipt)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            this.options.productScope,
            command.commandId,
            principal.accountId,
            payloadHash,
            receipt.code,
            JSON.stringify(receipt),
          ],
        );
        await this.options.onCommittedReceipt?.(client, principal, command, receipt);
        return receipt;
      });
    } catch (error) {
      // A concurrent retry can race the first commit under SERIALIZABLE and surface a unique
      // action-event/receipt key before this transaction's snapshot can see that receipt.
      // Only recover if the exact command is now durably committed; never mask another error.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        ["23505", "40001", "40P01"].includes(String(error.code))
      ) {
        const committed = await this.options.pool.query<ReceiptRow>(
          "SELECT canonical_payload_hash, receipt, account_id FROM command_receipts WHERE product_scope = $1 AND command_id = $2",
          [this.options.productScope, command.commandId],
        );
        if (committed.rows[0]) return this.replayed(principal, command.commandId, payloadHash, committed.rows[0]);
        if (error.code !== "23505") throw new DispatcherError("RATE_LIMITED", undefined, "TRANSACTION_BUSY", 100);
      }
      throw error;
    }
    if (admitted.kind === "tick_pending") throw new DispatcherError("TICK_PENDING");
    return admitted.kind === "admitted" ? admitted.value : receiptSkeleton(command.commandId, "WORLD_PAUSED");
  }

  private replayed(
    principal: AuthenticatedPrincipal,
    commandId: string,
    payloadHash: string,
    existing: ReceiptRow,
  ): CommandReceipt {
    if (existing.account_id !== principal.accountId) throw new DispatcherError("FORBIDDEN");
    return existing.canonical_payload_hash === payloadHash
      ? existing.receipt
      : receiptSkeleton(commandId, "IDEMPOTENCY_CONFLICT");
  }

  async lookupReceipt(principal: AuthenticatedPrincipal, commandId: string): Promise<CommandReceipt | null> {
    if (
      principal.productScope !== this.options.productScope ||
      (principal.audience === "agent" &&
        !principal.agentScopes?.includes("world:read") &&
        !principal.agentScopes?.includes("game:act"))
    )
      throw new DispatcherError("FORBIDDEN");
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
    if (principal.audience === "agent" && !principal.agentScopes?.includes("game:act")) {
      throw new DispatcherError("FORBIDDEN");
    }
  }

  private parseCommand(rawCommand: unknown): CommandEnvelope {
    const parsed = AcceptedCommandEnvelopeSchema.safeParse(rawCommand);
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
