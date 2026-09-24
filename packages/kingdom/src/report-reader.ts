import type { ReportReadQuery } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import type { Pool } from "pg";
import { RaidError, type RaidService } from "./raids.js";
import { ScoutError, type ScoutService } from "./scouting.js";

/** One PACT-owned, credential-derived report projection across all adapters. */
export class GameReportReader {
  constructor(
    private readonly pool: Pool,
    private readonly scouts: ScoutService,
    private readonly raids?: RaidService,
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
