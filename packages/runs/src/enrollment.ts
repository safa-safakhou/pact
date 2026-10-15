import { createHash } from "node:crypto";
import {
  type EnrollmentCommand,
  EnrollmentCommandSchema,
  type EnrollmentQuery,
  EnrollmentQuerySchema,
} from "@pact/contracts";
import { withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
import { RunError, type RunService, type RunView } from "./service.js";

type Settings = Extract<EnrollmentCommand, { kind: "enroll" }>;
type Row = {
  id: string;
  account_id: string;
  version: number;
  status: string;
  settings: Settings;
  deadline_at: Date;
  next_eligible_at: Date;
  work_cursor: string;
  pending_sequence: string;
  pending_work: boolean;
  allocated_calls: number;
  allocated_tokens: string;
  slice_sequence: number;
  active_run_id: string | null;
  last_success_at: Date | null;
  created_at: Date;
  objective_pruned: boolean;
};
const HOST = "api-inference",
  COOLING_MS = 60000,
  HEARTBEAT_FRESH_MS = 90000;
export class EnrollmentError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "STALE_VERSION"
      | "OPERATION_CONFLICT"
      | "ALREADY_ENROLLED"
      | "INVALID_DEADLINE"
      | "ROUTE_UNAVAILABLE",
  ) {
    super(code);
  }
}
/** Owner consent admits bounded runs. Notifications supply metadata only; no model/network call occurs here. */
export class PersistentPlayService {
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly options: {
      clock: { now(): Date };
      runs: RunService;
      routeAvailable(client: PoolClient, accountId: string, credentialId: string, provider: string): Promise<boolean>;
    },
  ) {}
  readonly retention = {
    name: "persistentPlay",
    forgetAccount: async (client: PoolClient, id: string) => {
      await client.query("DELETE FROM persistent_enrollments WHERE product_scope=$1 AND account_id=$2", [
        this.scope,
        id,
      ]);
      await client.query("DELETE FROM persistent_enrollment_receipts WHERE product_scope=$1 AND account_id=$2", [
        this.scope,
        id,
      ]);
    },
    exportAccount: async (client: PoolClient, id: string) => ({
      enrollments: (
        await client.query(
          "SELECT * FROM persistent_enrollments WHERE product_scope=$1 AND account_id=$2 ORDER BY created_at",
          [this.scope, id],
        )
      ).rows,
      slices: (
        await client.query(
          "SELECT * FROM persistent_work_slices WHERE product_scope=$1 AND account_id=$2 ORDER BY enrollment_id,sequence",
          [this.scope, id],
        )
      ).rows,
      receipts: (
        await client.query(
          "SELECT command_id,result,created_at FROM persistent_enrollment_receipts WHERE product_scope=$1 AND account_id=$2 ORDER BY created_at",
          [this.scope, id],
        )
      ).rows,
    }),
    prune: async (client: PoolClient, now: Date) => {
      const content = await client.query(
        "UPDATE persistent_enrollments SET settings=jsonb_set(settings,'{objective}',to_jsonb('[Private objective removed after retention]'::text)),objective_pruned=true WHERE product_scope=$1 AND status IN ('revoked','expired','exhausted') AND updated_at<$2 AND NOT objective_pruned",
        [this.scope, new Date(now.getTime() - 30 * 86400000)],
      );
      const history = await client.query(
        "DELETE FROM persistent_enrollments WHERE product_scope=$1 AND status IN ('revoked','expired','exhausted') AND updated_at<$2",
        [this.scope, new Date(now.getTime() - 180 * 86400000)],
      );
      const receipts = await client.query(
        "DELETE FROM persistent_enrollment_receipts WHERE product_scope=$1 AND created_at<$2",
        [this.scope, new Date(now.getTime() - 180 * 86400000)],
      );
      return (content.rowCount ?? 0) + (history.rowCount ?? 0) + (receipts.rowCount ?? 0);
    },
  };
  async command(accountId: string, raw: unknown) {
    const command = EnrollmentCommandSchema.parse(raw),
      hash = createHash("sha256").update(JSON.stringify(command)).digest("hex"),
      now = this.options.clock.now();
    return withTransaction(this.pool, async (client) => {
      await this.owner(client, accountId);
      const previous = (
        await client.query(
          "SELECT request_hash,result FROM persistent_enrollment_receipts WHERE product_scope=$1 AND account_id=$2 AND command_id=$3",
          [this.scope, accountId, command.commandId],
        )
      ).rows[0];
      if (previous) {
        if (previous.request_hash !== hash) throw new EnrollmentError("OPERATION_CONFLICT");
        return { ...previous.result, code: "ALREADY_COMMITTED" };
      }
      const row = (
        await client.query<Row>(
          "SELECT * FROM persistent_enrollments WHERE product_scope=$1 AND account_id=$2 AND id=$3 FOR UPDATE",
          [this.scope, accountId, command.enrollmentId],
        )
      ).rows[0];
      if ((row?.version ?? 0) !== command.expectedVersion) throw new EnrollmentError("STALE_VERSION");
      if (command.kind === "enroll") {
        const deadline = new Date(command.deadlineAt);
        if (deadline.getTime() <= now.getTime() || deadline.getTime() > now.getTime() + 30 * 86400000)
          throw new EnrollmentError("INVALID_DEADLINE");
        if (!(await this.options.routeAvailable(client, accountId, command.credentialId, command.provider)))
          throw new EnrollmentError("ROUTE_UNAVAILABLE");
        if (
          (
            await client.query(
              "SELECT 1 FROM persistent_enrollments WHERE product_scope=$1 AND account_id=$2 AND status IN('active','needs_owner')",
              [this.scope, accountId],
            )
          ).rowCount
        )
          throw new EnrollmentError("ALREADY_ENROLLED");
        const cursor = (
          await client.query(
            "SELECT COALESCE(max(sequence),0)::text AS n FROM inbox_events WHERE product_scope=$1 AND account_id=$2",
            [this.scope, accountId],
          )
        ).rows[0].n;
        await client.query(
          "INSERT INTO persistent_enrollments(product_scope,account_id,id,version,status,settings,deadline_at,next_eligible_at,work_cursor,pending_sequence,created_at,updated_at) VALUES($1,$2,$3,1,'active',$4,$5,$6,$7,$7,$6,$6)",
          [this.scope, accountId, command.enrollmentId, command, deadline, now, cursor],
        );
      } else {
        if (row?.active_run_id) await this.options.runs.stop(accountId, row.active_run_id, client);
        await client.query(
          "UPDATE persistent_enrollments SET status='revoked',version=version+1,updated_at=$4 WHERE product_scope=$1 AND account_id=$2 AND id=$3",
          [this.scope, accountId, command.enrollmentId, now],
        );
      }
      const result = {
        code: "COMMITTED",
        enrollmentId: command.enrollmentId,
        version: command.expectedVersion + 1,
        status: command.kind === "enroll" ? "active" : "revoked",
      };
      await client.query(
        "INSERT INTO persistent_enrollment_receipts(product_scope,account_id,command_id,request_hash,result,created_at) VALUES($1,$2,$3,$4,$5,$6)",
        [this.scope, accountId, command.commandId, hash, result, now],
      );
      return result;
    });
  }
  private async owner(client: PoolClient, id: string) {
    if (
      !(
        await client.query(
          "SELECT id FROM accounts WHERE product_scope=$1 AND id=$2 AND status='active' AND (email_verified_at IS NOT NULL OR is_guest) FOR UPDATE",
          [this.scope, id],
        )
      ).rowCount
    )
      throw new EnrollmentError("FORBIDDEN");
  }
  async read(accountId: string, input: EnrollmentQuery = {}) {
    const query = EnrollmentQuerySchema.parse(input);
    const now = this.options.clock.now();
    return withTransaction(
      this.pool,
      async (client) => {
        const rows = (
          await client.query<Row>(
            "SELECT * FROM persistent_enrollments WHERE product_scope=$1 AND account_id=$2 AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::uuid)) ORDER BY created_at DESC,id DESC LIMIT 4",
            [this.scope, accountId, query.beforeAt ?? null, query.beforeId ?? null],
          )
        ).rows;
        const host = (
          await client.query("SELECT * FROM persistent_execution_hosts WHERE product_scope=$1 AND host_id=$2", [
            this.scope,
            HOST,
          ])
        ).rows[0];
        const heartbeatFresh = Boolean(host && now.getTime() - host.last_heartbeat_at.getTime() <= HEARTBEAT_FRESH_MS);
        const fresh = Boolean(host?.available && heartbeatFresh);
        const latest = (
          await client.query(
            "SELECT COALESCE(max(sequence),0)::text AS n FROM inbox_events WHERE product_scope=$1 AND account_id=$2 AND type NOT LIKE 'run.%'",
            [this.scope, accountId],
          )
        ).rows[0].n as string;
        const enrollments = [];
        for (const row of rows.slice(0, 3)) {
          const run = row.active_run_id ? await this.options.runs.get(row.active_run_id, accountId, client) : null;
          const pendingWork =
            row.pending_work || BigInt(latest) > BigInt(row.active_run_id ? row.pending_sequence : row.work_cursor);
          const remainingCalls = row.settings.totalCallBudget - row.allocated_calls,
            remainingTokenCapacity = row.settings.totalTokenBudget - Number(row.allocated_tokens);
          const state =
            row.status === "revoked"
              ? "stopped"
              : row.deadline_at <= now
                ? "deadline_passed"
                : row.status === "needs_owner" ||
                    run?.status === "waiting" ||
                    run?.status === "failed" ||
                    run?.status === "stopped" ||
                    run?.lastErrorCode ||
                    (run?.status === "running" && (run.deadlineAt <= now || run.execution?.state === "lease_missing"))
                  ? "needs_owner"
                  : run?.status === "running"
                    ? fresh
                      ? "running_now"
                      : "host_unavailable"
                    : row.status === "exhausted" ||
                        remainingCalls < row.settings.sliceCalls ||
                        remainingTokenCapacity < row.settings.sliceTokens
                      ? "budget_exhausted"
                      : !fresh
                        ? "host_unavailable"
                        : row.settings.mode === "events" && !pendingWork
                          ? "waiting_for_event"
                          : row.next_eligible_at > now || host.next_available_at > now
                            ? "cooling"
                            : "queued";
          enrollments.push({
            id: row.id,
            version: row.version,
            configuredStatus: row.status,
            state,
            settings: row.settings,
            objectivePruned: row.objective_pruned,
            deadlineAt: row.deadline_at,
            nextEligibleAt: row.next_eligible_at,
            remainingCalls,
            remainingTokenCapacity,
            allocatedCalls: row.allocated_calls,
            allocatedTokenCapacity: row.allocated_tokens,
            activeRun: run,
            lastSuccessfulTurnAt: row.last_success_at,
            pendingWork,
            workCursor: row.work_cursor,
            pendingSequence: row.pending_sequence,
          });
        }
        const last = rows[2];
        return {
          enrollments,
          next: rows.length > 3 && last ? { beforeAt: last.created_at.toISOString(), beforeId: last.id } : null,
          host: {
            id: HOST,
            available: fresh,
            heartbeatFresh,
            executionEnabled: Boolean(host?.available),
            lastHeartbeatAt: host?.last_heartbeat_at ?? null,
            nextAvailableAt: host?.next_available_at ?? null,
          },
          timezone: "Europe/Berlin",
          timeBasis: "Fixed UTC deadlines and elapsed UTC intervals; daylight-saving changes do not replenish budgets.",
          budgetMeaning:
            "Lifetime allocation ceilings, never inferred spend. Each slice reserves its full call/token caps; unused reservations are not renewed/refunded. Run counters show separately recorded usage.",
          supportedRoutes: ["api"],
          externalRoutes:
            "Local/Codex/consumer-host enrollment adapters require their separate acceptance. Existing stopped local runs are not enrolled by migration.",
        };
      },
      { isolation: "REPEATABLE READ" },
    );
  }
  /** Called only by the inference worker. A heartbeat/cooling row serializes simultaneous workers. */
  async dispatch(available: boolean) {
    const now = this.options.clock.now();
    return withTransaction(this.pool, async (client) => {
      await client.query(
        "INSERT INTO persistent_execution_hosts(product_scope,host_id,last_heartbeat_at,available,next_available_at) VALUES($1,$2,$3,$4,$3) ON CONFLICT(product_scope,host_id) DO UPDATE SET last_heartbeat_at=EXCLUDED.last_heartbeat_at,available=EXCLUDED.available",
        [this.scope, HOST, now, available],
      );
      const host = (
        await client.query(
          "SELECT next_available_at FROM persistent_execution_hosts WHERE product_scope=$1 AND host_id=$2 FOR UPDATE",
          [this.scope, HOST],
        )
      ).rows[0];
      const candidate = (
        await client.query<{ account_id: string }>(
          "SELECT e.account_id FROM persistent_enrollments e JOIN accounts a ON a.product_scope=e.product_scope AND a.id=e.account_id WHERE e.product_scope=$1 AND (e.status='active' OR (e.status='needs_owner' AND e.deadline_at<=$2)) AND a.status='active' AND (a.email_verified_at IS NOT NULL OR a.is_guest) ORDER BY e.next_eligible_at,e.id LIMIT 1",
          [this.scope, now],
        )
      ).rows[0];
      if (!candidate) return { code: "NO_ENROLLMENT" };
      await this.owner(client, candidate.account_id);
      const row = (
        await client.query<Row>(
          "SELECT * FROM persistent_enrollments WHERE product_scope=$1 AND account_id=$2 AND status IN ('active','needs_owner') FOR UPDATE",
          [this.scope, candidate.account_id],
        )
      ).rows[0];
      if (!row) return { code: "NO_ENROLLMENT" };
      if (row.deadline_at <= now) {
        if (row.active_run_id) await this.options.runs.stop(row.account_id, row.active_run_id, client);
        await this.state(client, row, "expired");
        return { code: "DEADLINE_PASSED" };
      }
      if (row.active_run_id) {
        const run = await this.options.runs.get(row.active_run_id, row.account_id, client);
        if (run?.status === "running") {
          if (run.deadlineAt <= now || run.execution?.state === "lease_missing") {
            await this.options.runs.stop(row.account_id, run.runId, client);
            await this.state(client, row, "needs_owner");
            return { code: "NEEDS_OWNER", runId: run.runId };
          }
          await client.query(
            "UPDATE persistent_enrollments SET next_eligible_at=$4 WHERE product_scope=$1 AND account_id=$2 AND id=$3",
            [this.scope, row.account_id, row.id, new Date(now.getTime() + 30_000)],
          );
          return { code: "RUN_ACTIVE", runId: run.runId };
        }
        const safeTransient =
          run?.status === "finished" &&
          ["PROVIDER_UNAVAILABLE", "RECOVERED_NO_GAME_EFFECTS"].includes(run.lastErrorCode ?? "") &&
          !run.ambiguousCrash &&
          !(
            await client.query("SELECT 1 FROM envoy_model_attempts WHERE run_id=$1 AND status='unknown' LIMIT 1", [
              run.runId,
            ])
          ).rowCount;
        if (run?.status !== "finished" || (run.lastErrorCode && !safeTransient)) {
          await this.state(client, row, "needs_owner");
          return { code: "NEEDS_OWNER" };
        }
        await client.query(
          "UPDATE persistent_enrollments SET work_cursor=$4,active_run_id=NULL,last_success_at=CASE WHEN $5 THEN $6 ELSE last_success_at END WHERE product_scope=$1 AND account_id=$2 AND id=$3",
          [this.scope, row.account_id, row.id, row.pending_sequence, run.usedCalls > 0, now],
        );
        row.active_run_id = null;
        row.work_cursor = row.pending_sequence;
      }
      const latest = (
        await client.query(
          "SELECT COALESCE(max(sequence),0)::text AS n FROM inbox_events WHERE product_scope=$1 AND account_id=$2 AND type NOT LIKE 'run.%'",
          [this.scope, row.account_id],
        )
      ).rows[0].n;
      const pending = row.pending_work || BigInt(latest) > BigInt(row.work_cursor);
      await client.query(
        "UPDATE persistent_enrollments SET pending_work=$4,pending_sequence=$5,updated_at=$6 WHERE product_scope=$1 AND account_id=$2 AND id=$3",
        [this.scope, row.account_id, row.id, pending, latest, now],
      );
      const s = row.settings;
      if (
        row.allocated_calls + s.sliceCalls > s.totalCallBudget ||
        Number(row.allocated_tokens) + s.sliceTokens > s.totalTokenBudget
      ) {
        await this.state(client, row, "exhausted");
        return { code: "BUDGET_EXHAUSTED" };
      }
      if (!available) return { code: "HOST_UNAVAILABLE" };
      if (row.next_eligible_at > now || host.next_available_at > now) return { code: "COOLING" };
      if (s.mode === "events" && !pending) {
        await client.query(
          "UPDATE persistent_enrollments SET next_eligible_at=$4 WHERE product_scope=$1 AND account_id=$2 AND id=$3",
          [this.scope, row.account_id, row.id, new Date(now.getTime() + 30000)],
        );
        return { code: "WAITING_FOR_EVENT" };
      }
      if (!(await this.options.routeAvailable(client, row.account_id, s.credentialId, s.provider))) {
        await this.state(client, row, "needs_owner");
        return { code: "ROUTE_UNAVAILABLE" };
      }
      let run: RunView;
      try {
        run = await this.options.runs.start(
          {
            accountId: row.account_id,
            objective: s.objective,
            provider: s.provider,
            model: s.model,
            credentialId: s.credentialId,
            limits: {
              durationMs: Math.min(s.sliceDurationMs, row.deadline_at.getTime() - now.getTime()),
              maxCalls: s.sliceCalls,
              maxTokens: s.sliceTokens,
              maxMessages: s.maxMessages,
              maxConversations: s.maxConversations,
            },
          },
          client,
        );
      } catch (error) {
        if (!(error instanceof RunError) || !["RUN_ALREADY_ACTIVE", "LEASE_HELD"].includes(error.code)) throw error;
        await client.query(
          "UPDATE persistent_enrollments SET next_eligible_at=$4 WHERE product_scope=$1 AND account_id=$2 AND id=$3",
          [this.scope, row.account_id, row.id, new Date(now.getTime() + 30000)],
        );
        return { code: "COMPETING_WRITER" };
      }
      const sequence = row.slice_sequence + 1;
      await client.query(
        "INSERT INTO persistent_work_slices(product_scope,account_id,enrollment_id,sequence,run_id,event_sequence,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [this.scope, row.account_id, row.id, sequence, run.runId, latest, now],
      );
      await client.query(
        "UPDATE persistent_enrollments SET active_run_id=$4,slice_sequence=$5,allocated_calls=allocated_calls+$6,allocated_tokens=allocated_tokens+$7,pending_work=false,pending_sequence=$8,next_eligible_at=$9,updated_at=$10 WHERE product_scope=$1 AND account_id=$2 AND id=$3",
        [
          this.scope,
          row.account_id,
          row.id,
          run.runId,
          sequence,
          s.sliceCalls,
          s.sliceTokens,
          latest,
          new Date(now.getTime() + s.minIntervalMs),
          now,
        ],
      );
      await client.query(
        "UPDATE persistent_execution_hosts SET next_available_at=$3 WHERE product_scope=$1 AND host_id=$2",
        [this.scope, HOST, new Date(now.getTime() + COOLING_MS)],
      );
      return { code: "SLICE_ADMITTED", runId: run.runId, sequence };
    });
  }
  private state(client: PoolClient, row: Row, status: string) {
    return client.query(
      "UPDATE persistent_enrollments SET status=$4,updated_at=$5 WHERE product_scope=$1 AND account_id=$2 AND id=$3",
      [this.scope, row.account_id, row.id, status, this.options.clock.now()],
    );
  }
}
