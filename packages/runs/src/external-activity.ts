import type { Pool, PoolClient } from "pg";
import { factualRunReport, type ReportEntry } from "./report.js";

export interface CurrentActivityFact {
  label: string;
  status: string;
  nextStep: string;
  asOfGameTimeMs?: number;
  reviewPath?: string;
}
export type ActivityStateResolver = (
  accountId: string,
  entries: ReportEntry[],
) => Promise<Record<string, CurrentActivityFact[]>>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Store server-issued result metadata only: never arguments, messages, credentials or reasoning. */
export class ExternalAgentActivity {
  constructor(
    private readonly pool: Pool,
    private readonly productScope: string,
    private readonly clock: { now(): Date },
    private readonly resolveCurrent?: ActivityStateResolver,
  ) {}

  /** Public observation only; never objectives, approvals, model data or a guaranteed reply. */
  async councilActivity(accountIds: string[]) {
    const rows = (
      await this.pool.query<{ account_id: string; observed_at: Date | null; run_active: boolean }>(
        `SELECT a.id AS account_id,
       GREATEST((SELECT max(created_at) FROM external_agent_activity e WHERE e.product_scope=$1 AND e.account_id=a.id),
         (SELECT max(updated_at) FROM envoy_runs r WHERE r.product_scope=$1 AND r.account_id=a.id)) AS observed_at,
       EXISTS(SELECT 1 FROM envoy_runs r WHERE r.product_scope=$1 AND r.account_id=a.id AND r.status='running'
         AND r.deadline_at>$3 AND EXISTS(SELECT 1 FROM write_leases l WHERE l.product_scope=r.product_scope
           AND l.run_id=r.run_id AND l.released_at IS NULL AND l.expires_at>$3)) AS run_active
       FROM accounts a WHERE a.product_scope=$1 AND a.id=ANY($2::uuid[])`,
        [this.productScope, accountIds, this.clock.now()],
      )
    ).rows;
    return Object.fromEntries(
      rows.map((r) => [
        r.account_id,
        { lastObservedAt: r.observed_at?.toISOString() ?? null, runActive: r.run_active },
      ]),
    );
  }

  async record(
    client: PoolClient | Pool,
    input: { accountId: string; sessionId: string; summary: Record<string, unknown> },
  ): Promise<void> {
    const data = input.summary;
    if (typeof data.code !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(data.code)) return;
    const commandId = typeof data.commandId === "string" && uuid.test(data.commandId) ? data.commandId : null;
    const records = Object.entries(
      data.recordVersions && typeof data.recordVersions === "object" ? data.recordVersions : {},
    )
      .filter(
        ([key, version]) =>
          /^[a-z][a-z-]{0,40}:[0-9a-f-]{36}$/i.test(key) &&
          typeof version === "number" &&
          Number.isSafeInteger(version),
      )
      .slice(0, 20);
    const summary = {
      code: data.code,
      ...Object.fromEntries(
        ["toolName", "actionKind", "reason", "detail"].flatMap((key) =>
          typeof data[key] === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,80}$/.test(data[key]) ? [[key, data[key]]] : [],
        ),
      ),
      ...(commandId ? { commandId } : {}),
      ...(typeof data.approvalId === "string" && uuid.test(data.approvalId) ? { approvalId: data.approvalId } : {}),
      ...(data.disposition === "proposed" ? { disposition: "proposed" } : {}),
      recordVersions: Object.fromEntries(records),
    };
    await client.query(
      `INSERT INTO external_agent_activity(product_scope,account_id,session_id,dedup_id,summary,created_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(product_scope,dedup_id) DO NOTHING`,
      [
        this.productScope,
        input.accountId,
        input.sessionId,
        data.code === "COMMITTED" ? commandId : (summary.approvalId ?? null),
        JSON.stringify(summary),
        this.clock.now(),
      ],
    );
  }

  async read(accountId: string) {
    const rows = (
      await this.pool.query<{ id: string; summary: string; created_at: Date }>(
        "SELECT id::text,summary,created_at FROM external_agent_activity WHERE product_scope=$1 AND account_id=$2 ORDER BY external_agent_activity.id DESC LIMIT 50",
        [this.productScope, accountId],
      )
    ).rows.reverse();
    const report = factualRunReport(
      rows.map((row) => ({ ...row, call_id: row.id })),
      "recorded",
      null,
    );
    let current: Record<string, CurrentActivityFact[]> = {},
      stale = !this.resolveCurrent;
    if (this.resolveCurrent) {
      try {
        current = await this.resolveCurrent(accountId, report.entries);
      } catch {
        stale = true;
      }
    }
    return {
      source: "external",
      ...report,
      stale,
      checkedAt: this.clock.now().toISOString(),
      entries: report.entries.map((entry) => ({
        ...entry,
        currentFacts: current[entry.id] ?? [],
        nextStep: stale
          ? "Current state unavailable; historical result retained. Refresh before deciding."
          : current[entry.id]?.length
            ? current[entry.id]?.map((fact) => fact.nextStep).join(" ")
            : entry.category === "failed"
              ? "Historical failed attempt. Read current state before choosing a new move; no success is established by this result."
              : "Historical result retained; current record status unknown. Inspect the authorized record before deciding.",
      })),
      timestamps: Object.fromEntries(rows.map((row) => [row.id, row.created_at.toISOString()])),
    };
  }

  readonly retention = {
    name: "externalAgentActivity",
    forgetAccount: async (client: PoolClient, accountId: string): Promise<void> => {
      await client.query("DELETE FROM external_agent_activity WHERE product_scope=$1 AND account_id=$2", [
        this.productScope,
        accountId,
      ]);
    },
    prune: async (client: PoolClient, now: Date): Promise<number> => {
      const result = await client.query(
        "DELETE FROM external_agent_activity WHERE product_scope=$1 AND created_at <= $2",
        [this.productScope, new Date(now.getTime() - 30 * 86400000)],
      );
      return result.rowCount ?? 0;
    },
    exportAccount: async (client: PoolClient, accountId: string): Promise<unknown> =>
      (
        await client.query(
          "SELECT id::text,summary,created_at FROM external_agent_activity WHERE product_scope=$1 AND account_id=$2 ORDER BY id",
          [this.productScope, accountId],
        )
      ).rows,
  };
}
