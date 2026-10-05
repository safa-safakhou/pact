import { randomUUID } from "node:crypto";
import { withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
export const gameNotificationCategories = [
  { id: "raid", critical: true, label: "Raid alert available" },
  { id: "approval", critical: true, label: "An exact action needs your review" },
  { id: "default", critical: true, label: "A contract default needs your attention" },
  { id: "starvation", critical: true, label: "A Grain shortage needs your attention" },
  { id: "completion", critical: false, label: "Queued work completed" },
  { id: "reply", critical: false, label: "A reply is available" },
  { id: "expiry", critical: false, label: "A contract is nearing expiry" },
] as const;
type Notice = { accountId: string; subjectId: string; eventId: string; category: string; occurredAt: Date };
interface Ports {
  publishForAccount(
    client: PoolClient,
    input: { accountId: string; eventId: string; type: string; payload: unknown; occurredAt: Date },
  ): Promise<string>;
  enqueue(client: PoolClient, input: Notice): Promise<void>;
}
export class GameNotificationProjector {
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      clock: { now(): Date };
      ports: Ports;
      readGameTime: () => Promise<number>;
    },
  ) {}
  async project(limit = 100): Promise<number> {
    return withTransaction(this.pool, async (client) => {
      await client.query("INSERT INTO game_notification_cursor(product_scope) VALUES($1) ON CONFLICT DO NOTHING", [
        this.options.productScope,
      ]);
      const cursor = (
        await client.query<{ sequence: string }>(
          "SELECT sequence FROM game_notification_cursor WHERE product_scope=$1 FOR UPDATE",
          [this.options.productScope],
        )
      ).rows[0];
      const events = (
        await client.query<{
          id: string;
          event_id: string;
          type: string;
          payload: Record<string, unknown>;
          created_at: Date;
        }>(
          "SELECT id::text,event_id,type,payload,created_at FROM outbox_events WHERE product_scope=$1 AND id>$2 ORDER BY id LIMIT $3",
          [this.options.productScope, cursor?.sequence ?? "0", Math.min(limit, 1000)],
        )
      ).rows;
      for (const event of events) {
        const p = event.payload;
        let category: string | undefined,
          kingdoms: string[] = [];
        const id = (value: unknown) =>
          typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined;
        if (event.type === "raid.declared.v1") {
          category = "raid";
          kingdoms = [id(p.leaderKingdomId), id(p.targetKingdomId)].filter((v): v is string => !!v);
        } else if (event.type === "upkeep.hungry.v1") {
          category = "starvation";
          kingdoms = [id(p.payerKingdomId)].filter((v): v is string => !!v);
        } else if (event.type === "supply.contract.defaulted.v1") {
          category = "default";
          kingdoms = [id(p.kingdomA), id(p.kingdomB)].filter((v): v is string => !!v);
        } else if (event.type === "garrison.host_underfunded.v1" && Array.isArray(p.detachments)) {
          category = "default";
          const contracts = await client.query<{ lender_kingdom_id: string; host_kingdom_id: string }>(
            "SELECT lender_kingdom_id,host_kingdom_id FROM garrison_contracts WHERE product_scope=$1 AND id=ANY($2::uuid[])",
            [this.options.productScope, p.detachments.filter((v) => id(v))],
          );
          kingdoms = contracts.rows.flatMap((r) => [r.lender_kingdom_id, r.host_kingdom_id]);
        } else if (["building.completed.v1", "training.unit.completed.v1"].includes(event.type)) {
          category = "completion";
          kingdoms = [id(p.kingdomId)].filter((v): v is string => !!v);
        } else if (event.type === "message.sent.v1" && p.alert === true) {
          category = "reply";
          kingdoms = [id(p.recipientKingdomId)].filter((v): v is string => !!v);
        }
        if (category) {
          const owners = await client.query<{ account_id: string; id: string }>(
            "SELECT k.account_id,k.id FROM kingdoms k JOIN accounts a ON a.id=k.account_id AND a.product_scope=k.product_scope WHERE k.product_scope=$1 AND k.id=ANY($2::uuid[]) AND a.status='active' ORDER BY k.account_id",
            [this.options.productScope, [...new Set(kingdoms)]],
          );
          for (const owner of owners.rows)
            await this.publish(
              client,
              {
                accountId: owner.account_id,
                subjectId: owner.id,
                eventId: event.event_id,
                category,
                occurredAt: event.created_at,
              },
              event.type,
              p,
            );
        }
      }
      const last = events.at(-1);
      if (last)
        await client.query("UPDATE game_notification_cursor SET sequence=$2 WHERE product_scope=$1", [
          this.options.productScope,
          last.id,
        ]);
      return events.length;
    });
  }
  async expiryNotices(): Promise<number> {
    const gameTime = await this.options.readGameTime();
    return withTransaction(this.pool, async (client) => {
      const contracts = (
        await client.query<{
          kind: string;
          id: string;
          kingdom_a: string;
          kingdom_b: string;
          end_game_time_ms: string;
        }>(
          `SELECT 'supply' AS kind,id,kingdom_a,kingdom_b,end_game_time_ms FROM supply_contracts
          WHERE product_scope=$1 AND status='active' AND end_game_time_ms>$2 AND end_game_time_ms<=$3
         UNION ALL SELECT 'garrison' AS kind,id,lender_kingdom_id,host_kingdom_id,end_game_time_ms FROM garrison_contracts
          WHERE product_scope=$1 AND status='active' AND end_game_time_ms>$2 AND end_game_time_ms<=$3`,
          [this.options.productScope, gameTime, gameTime + 3_600_000],
        )
      ).rows;
      let count = 0;
      for (const contract of contracts) {
        const added = await client.query(
          `INSERT INTO game_notification_expiry_notices(product_scope,kind,contract_id,end_game_time_ms,created_at)
          VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING contract_id`,
          [this.options.productScope, contract.kind, contract.id, contract.end_game_time_ms, this.options.clock.now()],
        );
        if (!added.rowCount) continue;
        const owners = await client.query<{ account_id: string; id: string }>(
          "SELECT k.account_id,k.id FROM kingdoms k JOIN accounts a ON a.id=k.account_id AND a.product_scope=k.product_scope WHERE k.product_scope=$1 AND k.id=ANY($2::uuid[]) AND a.status='active' ORDER BY k.account_id",
          [this.options.productScope, [contract.kingdom_a, contract.kingdom_b]],
        );
        for (const owner of owners.rows)
          await this.publish(
            client,
            {
              accountId: owner.account_id,
              subjectId: owner.id,
              eventId: randomUUID(),
              category: "expiry",
              occurredAt: this.options.clock.now(),
            },
            "contract.nearing_expiry.v1",
            {
              contractId: contract.id,
              kind: contract.kind,
              endGameTimeMs: contract.end_game_time_ms,
              gameTimeMs: gameTime,
            },
          );
        count++;
      }
      return count;
    });
  }
  private async publish(client: PoolClient, notice: Notice, type: string, payload: unknown) {
    await this.options.ports.publishForAccount(client, {
      accountId: notice.accountId,
      eventId: notice.eventId,
      type,
      payload,
      occurredAt: notice.occurredAt,
    });
    await this.options.ports.enqueue(client, notice);
  }
}
