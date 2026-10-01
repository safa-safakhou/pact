import type { ReportReadQuery } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import type { Pool } from "pg";
import { RaidError, type RaidService } from "./raids.js";
import { ScoutError, type ScoutService } from "./scouting.js";

/** One PACT-owned, credential-derived report projection across all adapters. */
export class GameReportReader {
  /** Only original participants, not purchasers/recipients of shared scout information, may attest sources. */
  async sealSource(client: import("pg").PoolClient, accountId: string, kind: "scout" | "battle", id: string) {
    if (kind === "scout") {
      const row = (
        await client.query<{ completed_at: Date }>(
          "SELECT o.completed_at FROM scout_operations o JOIN kingdoms k ON k.id=o.scout_kingdom_id AND k.product_scope=o.product_scope WHERE o.product_scope=$3 AND o.id=$1 AND o.status='completed' AND k.account_id=$2 FOR SHARE OF o",
          [id, accountId, this.scope],
        )
      ).rows[0];
      if (!row) return null;
      const report = await this.scouts.readReport(client, accountId, id);
      return {
        fields: { ...report },
        participants: [report.scoutKingdomId, report.targetKingdomId],
        createdAt: row.completed_at,
        observedGameTimeMs: report.observedGameTimeMs,
      };
    }
    if (!this.raids) return null;
    // Delegate participation to the existing authoritative report reader (a public report is not enough).
    try {
      const report = await this.raids.readParticipantReport(client, accountId, id);
      const row = (
        await client.query<{ closed_at: Date }>(
          "SELECT closed_at FROM raids WHERE product_scope=$2 AND id=$1 AND status='resolved' FOR SHARE",
          [id, this.scope],
        )
      ).rows[0];
      if (!row) return null;
      const participants = (
        await client.query<{ kingdom_id: string }>(
          "SELECT kingdom_id FROM raid_contributions WHERE product_scope=$2 AND raid_id=$1 AND status='committed' ORDER BY kingdom_id",
          [id, this.scope],
        )
      ).rows.map((r) => r.kingdom_id);
      return {
        fields: report,
        participants: [...participants, String(report.targetKingdomId)],
        createdAt: row.closed_at,
        observedGameTimeMs: Number(report.gameTimeMs),
      };
    } catch (error) {
      if (error instanceof RaidError && error.code === "REPORT_NOT_FOUND") return null;
      throw error;
    }
  }
  constructor(
    private readonly pool: Pool,
    private readonly scouts: ScoutService,
    private readonly raids?: RaidService,
    private readonly scope = "pact",
  ) {}

  async read(accountId: string, kind: ReportReadQuery["kind"], recordId: string): Promise<unknown | null> {
    try {
      return await withTransaction(this.pool, async (client) => {
        if (kind === "scout") return this.scouts.readReport(client, accountId, recordId);
        if (!this.raids) return null;
        if (kind === "raid_participant") return this.raids.readParticipantReport(client, accountId, recordId);
        if (kind === "raid_public") return this.raids.readPublicReport(client, recordId);
        return null;
      });
    } catch (error) {
      if ((error instanceof ScoutError || error instanceof RaidError) && error.code === "REPORT_NOT_FOUND") return null;
      throw error;
    }
  }
}
