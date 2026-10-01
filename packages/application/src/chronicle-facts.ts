import type { ChronicleFactPort } from "@pact/kingdom";
import type { PoolClient } from "pg";

/** A publication-safe receipt projection, never the payload, charges, objective or private run. */
export class ChronicleFactReader implements ChronicleFactPort {
  constructor(
    private readonly scope: string,
    private readonly clock: { now(): Date },
    private readonly outcomes?: {
      read(client: PoolClient, accountId: string, records: string[]): Promise<Record<string, unknown>[]>;
    },
  ) {}
  async list(client: PoolClient, accountId: string) {
    const ids = (
      await client.query<{ command_id: string }>(
        "SELECT command_id FROM command_receipts WHERE product_scope=$1 AND account_id=$2 AND code='COMMITTED' AND created_at>$3 ORDER BY created_at DESC,command_id DESC LIMIT 50",
        [this.scope, accountId, new Date(this.clock.now().getTime() - 180 * 86400000)],
      )
    ).rows;
    const facts: Record<string, unknown>[] = [];
    for (const row of ids) {
      const fact = await this.read(client, accountId, row.command_id);
      if (fact) facts.push(fact);
    }
    return facts;
  }
  async read(client: PoolClient, accountId: string, commandId: string) {
    const row = (
      await client.query<{ receipt: { committedAt?: string; recordVersions: Record<string, number> } }>(
        "SELECT receipt FROM command_receipts WHERE product_scope=$1 AND account_id=$2 AND command_id=$3 AND code='COMMITTED' AND created_at>$4",
        [this.scope, accountId, commandId, new Date(this.clock.now().getTime() - 180 * 86400000)],
      )
    ).rows[0];
    if (!row) return null;
    return {
      label: "Engine fact",
      commandId,
      code: "COMMITTED",
      recordedAt: row.receipt.committedAt ?? null,
      outcome: "This command committed. This is not proof that a pending operation or negotiation completed.",
      records: Object.entries(row.receipt.recordVersions).map(([record, version]) => ({ record, version })),
      consequences: this.outcomes
        ? await this.outcomes.read(client, accountId, Object.keys(row.receipt.recordVersions))
        : [],
    };
  }
}
