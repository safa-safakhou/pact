import { readPlatformInsights } from "@pact/db";
import { readIdentityInsights } from "@pact/identity";
import { readAdminKingdoms, readKingdomInsights } from "@pact/kingdom";
import { readLedgerInsights } from "@pact/ledger";
import { readRunInsights } from "@pact/runs";
import { readWorldInsights } from "@pact/world";
import type { Pool, PoolClient } from "pg";

export class AdminReader {
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly now = () => new Date(),
  ) {}
  private async snapshot<T>(read: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout = '8s'");
      const result = await read(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  overview(hours: number) {
    return this.snapshot(async (client) => {
      const now = this.now(),
        since = new Date(now.getTime() - hours * 3600000);
      const world = await readWorldInsights(client, this.scope);
      const identity = await readIdentityInsights(client, this.scope, since);
      const game = await readKingdomInsights(client, this.scope, now, String(world?.gameTimeMs ?? "0"));
      const economy = await readLedgerInsights(client, this.scope);
      const agents = await readRunInsights(client, this.scope, since, now);
      const platform = await readPlatformInsights(client, this.scope, since, now);
      const pending =
        (
          await client.query("SELECT count(*)::int AS count FROM outbox_events WHERE product_scope=$1 AND id > $2", [
            this.scope,
            game.collection.cursor,
          ])
        ).rows[0]?.count ?? 0;
      return {
        generatedAt: now.toISOString(),
        since: since.toISOString(),
        hours,
        world,
        identity,
        game: { ...game, collection: { ...game.collection, pending } },
        economy,
        agents,
        platform,
      };
    });
  }
  kingdoms(search: string, offset: number) {
    return this.snapshot((c) => readAdminKingdoms(c, this.scope, search, offset));
  }
}
