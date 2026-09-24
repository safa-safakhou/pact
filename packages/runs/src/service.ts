import { randomUUID } from "node:crypto";
import { enqueueJob, withTransaction } from "@pact/db";
import type { InboxService } from "@pact/inbox";
import type {
  ModelProviderAdapter,
  ProviderMessage,
  ProviderRouter,
  ProviderToolCall,
  ProviderToolDefinition,
} from "@pact/model-provider";
import { ProviderError } from "@pact/model-provider";
import type { Pool, PoolClient } from "pg";

export class RunError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "RUN_ALREADY_ACTIVE"
      | "LEASE_HELD"
      | "ALLOWANCE_EXHAUSTED"
      | "DEADLINE_PASSED"
      | "INVALID_STATE"
      | "IN_FLIGHT"
      | "AMBIGUOUS_PROVIDER_CRASH",
  ) {
    super(code);
    this.name = "RunError";
  }
}

export type RunStatus = "running" | "waiting" | "finished" | "stopped" | "failed";

export interface RunView {
  readonly runId: string;
  readonly accountId: string;
  readonly subjectId: string;
  readonly status: RunStatus;
  readonly objective: string;
  readonly provider: string;
  readonly model: string;
  readonly deadlineAt: Date;
  readonly usedCalls: number;
  readonly usedTokens: number;
  readonly maxCalls: number;
  readonly maxTokens: number;
  readonly modelCalls: number;
  readonly reservedTokens: number;
  readonly lastErrorCode: string | null;
  readonly ambiguousCrash: boolean;
}

export interface RunLimits {
  readonly maxConversations?: number;
  readonly maxMessages?: number;
  readonly maxCalls?: number;
  readonly maxTokens?: number;
  readonly durationMs?: number;
}

/** A server-generated, bounded tool result; never raw model arguments or counterpart prose. */
export interface RunToolResult {
  readonly callId: string;
  readonly content: string;
}

interface RunRow {
  run_id: string;
  account_id: string;
  subject_id: string;
  status: RunStatus;
  objective: string;
  provider: string;
  model: string;
  credential_id: string | null;
  deadline_at: Date;
  max_conversations: number;
  max_messages: number;
  max_calls: number;
  max_tokens: number;
  used_conversations: number;
  used_messages: number;
  used_calls: number;
  used_tokens: number;
  reserved_tokens: number;
  in_flight_request_id: string | null;
  model_calls: number;
  last_error_code: string | null;
  ambiguous_crash: boolean;
}

const DEFAULT_DURATION_MS = 15 * 60_000;
const DEFAULT_MAX_CONVERSATIONS = 6;
const DEFAULT_MAX_MESSAGES = 12;
const DEFAULT_MAX_CALLS = 20;
const DEFAULT_MAX_TOKENS = 40_000;
const MAX_OUTPUT_RESERVATION = 2_000;
const MCP_LEASE_MS = 15 * 60_000;

/** Conservative for caller-controlled prose; tool schemas use a documented approximation. */
function estimateInputTokens(messages: readonly ProviderMessage[], tools: readonly ProviderToolDefinition[]): number {
  let estimate = 32;
  for (const message of messages) {
    estimate += 16 + Buffer.byteLength(message.content, "utf8");
    if (message.toolCallId) estimate += Buffer.byteLength(message.toolCallId, "utf8");
  }
  for (const tool of tools) {
    const schema = JSON.stringify({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema });
    estimate += 64 + Math.ceil(Buffer.byteLength(schema, "utf8") / 4);
  }
  return estimate;
}

export class RunService {
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      clock: { now(): Date };
      inbox?: InboxService;
      providerRouter?: ProviderRouter;
      credentialResolver?: (credentialId: string, accountId: string) => Promise<Uint8Array>;
      tools?: readonly ProviderToolDefinition[];
      messagesForRun?: (run: RunView) => readonly ProviderMessage[];
      executeToolCalls?: (input: {
        run: RunView;
        requestId: string;
        calls: readonly ProviderToolCall[];
      }) => Promise<readonly RunToolResult[]> | Promise<void>;
    },
  ) {}

  async start(input: {
    accountId: string;
    subjectId?: string;
    objective: string;
    provider: string;
    model: string;
    credentialId?: string;
    limits?: RunLimits;
    clientKind?: "pact" | "mcp";
  }): Promise<RunView> {
    const subjectId = input.subjectId ?? input.accountId;
    const now = this.options.clock.now();
    const limits = input.limits ?? {};
    const durationMs = limits.durationMs ?? DEFAULT_DURATION_MS;
    const deadlineAt = new Date(now.getTime() + durationMs);
    const runId = randomUUID();
    return withTransaction(this.pool, async (client) => {
      await this.acquireLease(client, {
        subjectId,
        holderKind: "pact_run",
        holderId: runId,
        runId,
        expiresAt: deadlineAt,
      });
      const inserted = await client.query<RunRow>(
        `INSERT INTO envoy_runs(
           run_id, product_scope, account_id, subject_id, status, objective, provider, model, credential_id,
           client_kind, deadline_at, max_conversations, max_messages, max_calls, max_tokens, started_at, updated_at
         ) VALUES ($1,$2,$3,$4,'running',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
         RETURNING *`,
        [
          runId,
          this.options.productScope,
          input.accountId,
          subjectId,
          input.objective,
          input.provider,
          input.model,
          input.credentialId ?? null,
          input.clientKind ?? "pact",
          deadlineAt,
          clamp(limits.maxConversations ?? DEFAULT_MAX_CONVERSATIONS, 1, 12),
          clamp(limits.maxMessages ?? DEFAULT_MAX_MESSAGES, 1, 24),
          limits.maxCalls ?? DEFAULT_MAX_CALLS,
          limits.maxTokens ?? DEFAULT_MAX_TOKENS,
          now,
        ],
      );
      const row = inserted.rows[0];
      if (!row) throw new Error("run insert failed");
      await enqueueJob(client, {
        productScope: this.options.productScope,
        uniqueKey: `envoy.run.tick:${runId}:0`,
        type: "envoy.run.tick",
        payload: { runId, sequence: 0 },
      });
      if (this.options.inbox) {
        await this.options.inbox.publishForAccount(client, {
          accountId: input.accountId,
          type: "run.started.v1",
          payload: { runId, status: "running" },
        });
      }
      return toView(row);
    });
  }

  /** MCP `run.open`: write lease only — never starts provider inference. */
  async openMcpLease(input: {
    accountId: string;
    subjectId?: string;
    holderId: string;
  }): Promise<{ leaseId: string; expiresAt: Date }> {
    const subjectId = input.subjectId ?? input.accountId;
    const expiresAt = new Date(this.options.clock.now().getTime() + MCP_LEASE_MS);
    return withTransaction(this.pool, async (client) => {
      const lease = await this.acquireLease(client, {
        subjectId,
        holderKind: "mcp",
        holderId: input.holderId,
        expiresAt,
      });
      return { leaseId: lease.leaseId, expiresAt };
    });
  }

  /** Check the exact external host lease inside the gameplay command transaction. */
  async assertMcpWriteLease(client: PoolClient, accountId: string, holderId: string): Promise<void> {
    const result = await client.query(
      `SELECT 1 FROM write_leases WHERE product_scope = $1 AND subject_id = $2
       AND holder_kind = 'mcp' AND holder_id = $3 AND released_at IS NULL AND expires_at > $4 FOR SHARE`,
      [this.options.productScope, accountId, holderId, this.options.clock.now()],
    );
    if (!result.rowCount) throw new RunError("FORBIDDEN");
  }

  /** An Envoy run may write only for its own account while its run lease is live. */
  async assertRunWriteLease(client: PoolClient, accountId: string, runId: string): Promise<void> {
    const result = await client.query(
      `SELECT 1 FROM write_leases l JOIN envoy_runs r ON r.run_id = l.run_id
       WHERE l.product_scope = $1 AND l.subject_id = r.subject_id AND l.holder_kind = 'pact_run'
         AND l.holder_id = $3 AND l.released_at IS NULL AND l.expires_at > $4
         AND r.account_id = $2 AND r.status = 'running' FOR SHARE OF l, r`,
      [this.options.productScope, accountId, runId, this.options.clock.now()],
    );
    if (!result.rowCount) throw new RunError("FORBIDDEN");
  }

  /** Shared agent admission accepts the exact MCP session or the owner's active PACT run. */
  async assertAgentWriteLease(client: PoolClient, accountId: string, holderId: string): Promise<void> {
    const result = await client.query(
      `SELECT 1 FROM write_leases l LEFT JOIN envoy_runs r ON r.run_id = l.run_id
       WHERE l.product_scope = $1 AND l.holder_id = $3
         AND l.released_at IS NULL AND l.expires_at > $4
         AND ((l.holder_kind = 'mcp' AND l.subject_id = $2)
           OR (l.holder_kind = 'pact_run' AND r.account_id = $2
             AND r.subject_id = l.subject_id AND r.status = 'running'))
       FOR SHARE OF l`,
      [this.options.productScope, accountId, holderId, this.options.clock.now()],
    );
    if (!result.rowCount) throw new RunError("FORBIDDEN");
  }

  async stop(accountId: string, runId: string): Promise<RunView> {
    return withTransaction(this.pool, async (client) => {
      const row = await this.lockRun(client, runId);
      if (row.account_id !== accountId) throw new RunError("FORBIDDEN");
      if (row.status === "stopped" || row.status === "finished" || row.status === "failed") {
        return toView(row);
      }
      const now = this.options.clock.now();
      const updated = await client.query<RunRow>(
        `UPDATE envoy_runs SET status = 'stopped', in_flight_request_id = NULL, reserved_tokens = 0,
           stopped_at = $2, updated_at = $2 WHERE run_id = $1 RETURNING *`,
        [runId, now],
      );
      await this.releaseLease(client, row.subject_id);
      const next = updated.rows[0];
      if (!next) throw new Error("stop failed");
      return toView(next);
    });
  }

  async wait(accountId: string, runId: string): Promise<RunView> {
    return withTransaction(this.pool, async (client) => {
      const row = await this.lockRun(client, runId);
      if (row.account_id !== accountId) throw new RunError("FORBIDDEN");
      if (row.status !== "running") throw new RunError("INVALID_STATE");
      if (row.in_flight_request_id) throw new RunError("IN_FLIGHT");
      const updated = await client.query<RunRow>(
        `UPDATE envoy_runs SET status = 'waiting', updated_at = $2 WHERE run_id = $1 RETURNING *`,
        [runId, this.options.clock.now()],
      );
      const next = updated.rows[0];
      if (!next) throw new Error("wait failed");
      return toView(next);
    });
  }

  async resume(accountId: string, runId: string): Promise<RunView> {
    return withTransaction(this.pool, async (client) => {
      const row = await this.lockRun(client, runId);
      if (row.account_id !== accountId) throw new RunError("FORBIDDEN");
      if (row.status !== "waiting") throw new RunError("INVALID_STATE");
      const now = this.options.clock.now();
      if (row.deadline_at <= now) throw new RunError("DEADLINE_PASSED");
      if (this.allowanceExhausted(row)) throw new RunError("ALLOWANCE_EXHAUSTED");
      await this.acquireLease(client, {
        subjectId: row.subject_id,
        holderKind: "pact_run",
        holderId: runId,
        runId,
        expiresAt: row.deadline_at,
        allowSameHolder: true,
      });
      const updated = await client.query<RunRow>(
        `UPDATE envoy_runs SET status = 'running', updated_at = $2 WHERE run_id = $1 RETURNING *`,
        [runId, now],
      );
      const next = updated.rows[0];
      if (!next) throw new Error("resume failed");
      await enqueueJob(client, {
        productScope: this.options.productScope,
        uniqueKey: `envoy.run.tick:${runId}:${next.used_calls}`,
        type: "envoy.run.tick",
        payload: { runId, sequence: next.used_calls },
      });
      return toView(next);
    });
  }

  async takeover(accountId: string, subjectId: string): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      const active = await client.query<RunRow>(
        `SELECT * FROM envoy_runs
         WHERE product_scope = $1 AND subject_id = $2 AND status IN ('running','waiting')
         FOR UPDATE`,
        [this.options.productScope, subjectId],
      );
      for (const row of active.rows) {
        if (row.account_id !== accountId) throw new RunError("FORBIDDEN");
        await client.query(
          `UPDATE envoy_runs SET status = 'stopped', in_flight_request_id = NULL, reserved_tokens = 0,
             stopped_at = $2, updated_at = $2 WHERE run_id = $1`,
          [row.run_id, this.options.clock.now()],
        );
      }
      await this.releaseLease(client, subjectId);
    });
  }

  async get(runId: string, accountId?: string): Promise<RunView> {
    const result = await this.pool.query<RunRow>(`SELECT * FROM envoy_runs WHERE run_id = $1 AND product_scope = $2`, [
      runId,
      this.options.productScope,
    ]);
    const row = result.rows[0];
    if (!row) throw new RunError("NOT_FOUND");
    if (accountId && row.account_id !== accountId) throw new RunError("FORBIDDEN");
    return toView(row);
  }

  /** One bounded provider step. Safe to retry; never extends the original deadline. */
  async executeModelCall(runId: string): Promise<RunView> {
    const router = this.options.providerRouter;
    if (!router) throw new Error("providerRouter is required for executeModelCall");

    const prepared = await withTransaction(this.pool, async (client) => {
      const row = await this.lockRun(client, runId);
      if (row.status !== "running") return { kind: "skip" as const, row };
      const now = this.options.clock.now();
      if (row.deadline_at <= now) {
        return { kind: "finish" as const, row: await this.finish(client, row, "finished") };
      }
      if (this.allowanceExhausted(row)) {
        return { kind: "finish" as const, row: await this.finish(client, row, "finished") };
      }
      if (row.in_flight_request_id) throw new RunError("IN_FLIGHT");
      const baseMessages =
        this.options.messagesForRun?.(toView(row)) ??
        ([
          { role: "system", content: "You are a PACT Envoy operating within fixed allowances." },
          { role: "user", content: row.objective },
        ] satisfies ProviderMessage[]);
      const recentResults = await client.query<{ call_id: string; summary: string }>(
        `SELECT call_id, summary FROM envoy_run_tool_results
         WHERE product_scope = $1 AND run_id = $2 ORDER BY id DESC LIMIT 16`,
        [this.options.productScope, runId],
      );
      const messages: readonly ProviderMessage[] = [
        ...baseMessages,
        ...recentResults.rows.reverse().map((result) => ({
          role: "user" as const,
          content: `Server-recorded result for tool call ${result.call_id}: ${result.summary}`,
        })),
      ];
      const tools = this.options.tools ?? [];
      const remainingTokens = row.max_tokens - row.used_tokens;
      const estimatedInput = estimateInputTokens(messages, tools);
      if (!Number.isSafeInteger(estimatedInput) || estimatedInput >= remainingTokens) {
        return { kind: "finish" as const, row: await this.finish(client, row, "finished") };
      }
      const outputCeiling = Math.min(MAX_OUTPUT_RESERVATION, remainingTokens - estimatedInput);
      const requestId = randomUUID();
      const updated = await client.query<RunRow>(
        `UPDATE envoy_runs SET in_flight_request_id = $2, reserved_tokens = $3, updated_at = $4
         WHERE run_id = $1 RETURNING *`,
        [runId, requestId, estimatedInput + outputCeiling, now],
      );
      const next = updated.rows[0];
      if (!next) throw new Error("reserve failed");
      return {
        kind: "call" as const,
        row: next,
        requestId,
        estimatedInput,
        outputCeiling,
        messages,
        tools,
      };
    });

    if (prepared.kind === "skip" || prepared.kind === "finish") return toView(prepared.row);

    let usageTokens = prepared.estimatedInput + prepared.outputCeiling;
    let errorCode: string | null = null;
    let ambiguous = false;
    let toolResults: readonly RunToolResult[] = [];
    try {
      const credential = prepared.row.credential_id
        ? await this.options.credentialResolver?.(prepared.row.credential_id, prepared.row.account_id)
        : new Uint8Array();
      const route = {
        provider: prepared.row.provider,
        model: prepared.row.model,
        credentialId: prepared.row.credential_id ?? "00000000-0000-4000-8000-000000000099",
      };
      const preparedRoute = await router.prepare(
        route,
        prepared.estimatedInput,
        prepared.outputCeiling,
        new AbortController().signal,
      );
      const result = await router.run(preparedRoute, {
        requestId: prepared.requestId,
        messages: prepared.messages,
        tools: prepared.tools,
        credential: credential ?? new Uint8Array(),
        signal: new AbortController().signal,
      });
      if ("inputTokens" in result.usage) {
        usageTokens = result.usage.inputTokens + result.usage.outputTokens;
      }
      if (result.response.toolCalls.length > 0) {
        if (!this.options.executeToolCalls) throw new ProviderError("MALFORMED_TOOL_CALL", false);
        const returned = await this.options.executeToolCalls({
          run: toView(prepared.row),
          requestId: prepared.requestId,
          calls: result.response.toolCalls,
        });
        if (returned) {
          const expected = new Set(result.response.toolCalls.map((call) => call.id));
          if (
            returned.length !== expected.size ||
            returned.some(
              (item) =>
                !expected.delete(item.callId) ||
                Buffer.byteLength(item.callId, "utf8") > 256 ||
                Buffer.byteLength(item.content, "utf8") === 0 ||
                Buffer.byteLength(item.content, "utf8") > 4096,
            )
          )
            throw new AmbiguousProviderCrash();
          toolResults = returned;
        }
      }
    } catch (error) {
      if (error instanceof AmbiguousProviderCrash) {
        ambiguous = true;
        errorCode = "AMBIGUOUS_PROVIDER_CRASH";
      } else if (error instanceof ProviderError) {
        // Sanitized unknown transport failures are treated as ambiguous: no auto-retry billing loop.
        if (error.code === "PROVIDER_UNAVAILABLE") {
          ambiguous = true;
          errorCode = "AMBIGUOUS_PROVIDER_CRASH";
        } else {
          errorCode = error.code;
        }
      } else {
        ambiguous = true;
        errorCode = "AMBIGUOUS_PROVIDER_CRASH";
      }
    }

    return withTransaction(this.pool, async (client) => {
      const row = await this.lockRun(client, runId);
      if (row.in_flight_request_id !== prepared.requestId) {
        // Another worker reconciled this request; do not double-charge.
        return toView(row);
      }
      const now = this.options.clock.now();
      if (ambiguous) {
        const failed = await client.query<RunRow>(
          `UPDATE envoy_runs SET status = 'failed', ambiguous_crash = TRUE, last_error_code = $2,
             in_flight_request_id = NULL, reserved_tokens = 0, stopped_at = $3, updated_at = $3
           WHERE run_id = $1 RETURNING *`,
          [runId, errorCode, now],
        );
        await this.releaseLease(client, row.subject_id);
        const next = failed.rows[0];
        if (!next) throw new Error("ambiguous fail update failed");
        return toView(next);
      }

      const usedCalls = row.used_calls + 1;
      const usedTokens = row.used_tokens + usageTokens;
      const modelCalls = row.model_calls + 1;
      const exhausted =
        usedCalls >= row.max_calls ||
        usedTokens >= row.max_tokens ||
        row.deadline_at <= now ||
        errorCode === "QUOTA_EXHAUSTED";
      const status: RunStatus =
        errorCode && errorCode !== "QUOTA_EXHAUSTED" ? "failed" : exhausted ? "finished" : "running";
      for (const result of toolResults) {
        await client.query(
          `INSERT INTO envoy_run_tool_results(product_scope, run_id, request_id, call_id, summary)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (run_id, request_id, call_id) DO NOTHING`,
          [this.options.productScope, runId, prepared.requestId, result.callId, result.content],
        );
      }
      const updated = await client.query<RunRow>(
        `UPDATE envoy_runs SET
           used_calls = $2, used_tokens = $3, model_calls = $4, reserved_tokens = 0,
           in_flight_request_id = NULL, last_error_code = $5, status = $6,
           stopped_at = CASE WHEN $6 IN ('finished','failed','stopped') THEN $7 ELSE stopped_at END,
           updated_at = $7
         WHERE run_id = $1 RETURNING *`,
        [runId, usedCalls, usedTokens, modelCalls, errorCode, status, now],
      );
      const next = updated.rows[0];
      if (!next) throw new Error("reconcile failed");
      if (status !== "running") {
        await this.releaseLease(client, row.subject_id);
      } else {
        await enqueueJob(client, {
          productScope: this.options.productScope,
          uniqueKey: `envoy.run.tick:${runId}:${usedCalls}`,
          type: "envoy.run.tick",
          payload: { runId, sequence: usedCalls },
        });
      }
      return toView(next);
    });
  }

  /** Idle path: inbox delivery must not invoke providers. */
  assertIdleInboxDoesNotInvokeProvider(_adapter?: ModelProviderAdapter): void {
    // Structural: notification/inbox workers never receive a provider adapter.
  }

  private allowanceExhausted(row: RunRow): boolean {
    return row.used_calls >= row.max_calls || row.used_tokens >= row.max_tokens;
  }

  private async finish(client: PoolClient, row: RunRow, status: "finished" | "stopped" | "failed"): Promise<RunRow> {
    const now = this.options.clock.now();
    const updated = await client.query<RunRow>(
      `UPDATE envoy_runs SET status = $2, in_flight_request_id = NULL, reserved_tokens = 0,
         stopped_at = $3, updated_at = $3 WHERE run_id = $1 RETURNING *`,
      [row.run_id, status, now],
    );
    await this.releaseLease(client, row.subject_id);
    const next = updated.rows[0];
    if (!next) throw new Error("finish failed");
    return next;
  }

  private async lockRun(client: PoolClient, runId: string): Promise<RunRow> {
    const result = await client.query<RunRow>(
      `SELECT * FROM envoy_runs WHERE run_id = $1 AND product_scope = $2 FOR UPDATE`,
      [runId, this.options.productScope],
    );
    const row = result.rows[0];
    if (!row) throw new RunError("NOT_FOUND");
    return row;
  }

  private async acquireLease(
    client: PoolClient,
    input: {
      subjectId: string;
      holderKind: "pact_run" | "mcp" | "script";
      holderId: string;
      runId?: string;
      expiresAt: Date;
      allowSameHolder?: boolean;
    },
  ): Promise<{ leaseId: string }> {
    const now = this.options.clock.now();
    const existing = await client.query<{
      lease_id: string;
      holder_id: string;
      expires_at: Date;
      released_at: Date | null;
    }>(
      `SELECT lease_id, holder_id, expires_at, released_at FROM write_leases
        WHERE product_scope = $1 AND subject_id = $2 FOR UPDATE`,
      [this.options.productScope, input.subjectId],
    );
    const current = existing.rows[0];
    if (current && !current.released_at && current.expires_at > now) {
      if (input.allowSameHolder && current.holder_id === input.holderId) {
        await client.query(`UPDATE write_leases SET expires_at = $3 WHERE product_scope = $1 AND subject_id = $2`, [
          this.options.productScope,
          input.subjectId,
          input.expiresAt,
        ]);
        return { leaseId: current.lease_id };
      }
      throw new RunError("RUN_ALREADY_ACTIVE");
    }
    const leaseId = randomUUID();
    await client.query(
      `INSERT INTO write_leases(product_scope, subject_id, lease_id, holder_kind, holder_id, run_id, acquired_at, expires_at, released_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL)
       ON CONFLICT (product_scope, subject_id) DO UPDATE SET
         lease_id = EXCLUDED.lease_id,
         holder_kind = EXCLUDED.holder_kind,
         holder_id = EXCLUDED.holder_id,
         run_id = EXCLUDED.run_id,
         acquired_at = EXCLUDED.acquired_at,
         expires_at = EXCLUDED.expires_at,
         released_at = NULL`,
      [
        this.options.productScope,
        input.subjectId,
        leaseId,
        input.holderKind,
        input.holderId,
        input.runId ?? null,
        now,
        input.expiresAt,
      ],
    );
    return { leaseId };
  }

  private async releaseLease(client: PoolClient, subjectId: string): Promise<void> {
    await client.query(
      `UPDATE write_leases SET released_at = $3 WHERE product_scope = $1 AND subject_id = $2 AND released_at IS NULL`,
      [this.options.productScope, subjectId, this.options.clock.now()],
    );
  }
}

/** Test helper: provider returned an inconclusive crash mid-call. */
export class AmbiguousProviderCrash extends Error {
  constructor() {
    super("AMBIGUOUS_PROVIDER_CRASH");
    this.name = "AmbiguousProviderCrash";
  }
}

function toView(row: RunRow): RunView {
  return {
    runId: row.run_id,
    accountId: row.account_id,
    subjectId: row.subject_id,
    status: row.status,
    objective: row.objective,
    provider: row.provider,
    model: row.model,
    deadlineAt: row.deadline_at,
    usedCalls: row.used_calls,
    usedTokens: row.used_tokens,
    maxCalls: row.max_calls,
    maxTokens: row.max_tokens,
    modelCalls: row.model_calls,
    reservedTokens: row.reserved_tokens,
    lastErrorCode: row.last_error_code,
    ambiguousCrash: row.ambiguous_crash,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
