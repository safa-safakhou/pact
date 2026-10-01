import type { Pool, PoolClient } from "pg";
import { factualRunReport } from "./report.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Store server-issued result metadata only: never arguments, messages, credentials or reasoning. */
export class ExternalAgentActivity {
  constructor(
    private readonly pool: Pool,
    private readonly productScope: string,
    private readonly clock: { now(): Date },
  ) {}

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
        "SELECT id::text,summary,created_at FROM external_agent_activity WHERE product_scope=$1 AND account_id=$2 ORDER BY id DESC LIMIT 50",
        [this.productScope, accountId],
      )
    ).rows.reverse();
    return {
      source: "external",
      ...factualRunReport(
        rows.map((row) => ({ ...row, call_id: row.id })),
        "recorded",
        null,
      ),
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
