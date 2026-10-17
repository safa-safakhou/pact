import { randomUUID } from "node:crypto";
import type { AgentEventCard } from "@pact/contracts";
import { claimOutboxDelivery, markOutboxDelivered, withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
// Explicit coverage. Unsupported events never imply complete environmental awareness.
export const agentEventCoverage = {
  "building.completed.v1": "completion",
  "training.unit.completed.v1": "completion",
  "message.sent.v1": "conversation",
  "contact.requested.v1": "contact",
  "contact.accepted.v1": "contact",
  "contact.declined.v1": "contact",
  "supply.offer.created.v1": "offer",
  "supply.offer.countered.v1": "offer",
  "supply.offer.withdrawn.v1": "offer",
  "garrison.offer.created.v1": "offer",
  "garrison.offer.withdrawn.v1": "offer",
  "garrison.offer.expired.v1": "offer",
  "supply.contract.activated.v1": "contract",
  "supply.contract.defaulted.v1": "contract",
  "supply.contract.closed.v1": "contract",
  "supply.delivery.executed.v1": "contract",
  "garrison.contract.activated.v1": "contract",
  "garrison.contract.closed.v1": "contract",
  "garrison.contract.seized.v1": "contract",
  "raid.declared.v1": "raid",
  "raid.locked.v1": "raid",
  "raid.resolved.v1": "raid",
  "upkeep.hungry.v1": "resource",
  "garrison.host_underfunded.v1": "resource",
} as const;
type Source = { event_id: string; type: string; payload: Record<string, unknown>; created_at: Date };
type Selected = {
  kingdoms: string[];
  gameTime: string;
  recordRef: string;
  groupRef: string;
  deadline?: AgentEventCard["deadline"];
  quiet?: boolean;
};
type Publication = Omit<AgentEventCard, "sequence" | "publishedAt"> & { accountId: string };
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const time = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0
    ? String(v)
    : typeof v === "string" && /^\d{1,20}$/.test(v)
      ? v
      : undefined;
export class AgentEventProjector {
  private readonly workerId = "agent-events-" + randomUUID();
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      clock: { now(): Date };
      publish: (c: PoolClient, input: Publication) => Promise<void>;
    },
  ) {}
  private async select(c: PoolClient, e: Source): Promise<Selected | null> {
    const p = e.payload,
      type = e.type;
    let kingdoms: string[] = [],
      recordRef = "",
      groupRef = "",
      gameTime = time(p.gameTimeMs),
      deadline: AgentEventCard["deadline"] | undefined,
      quiet: boolean | undefined;
    if (type === "building.completed.v1" || type === "training.unit.completed.v1") {
      if (!uuid(type.startsWith("building") ? p.instructionId : p.batchId)) return null;
      kingdoms = [p.kingdomId].filter(uuid);
      recordRef = (type.startsWith("building") ? "construction:" : "training:") + String(p.instructionId ?? p.batchId);
      groupRef = "development";
    } else if (type === "upkeep.hungry.v1") {
      kingdoms = [p.payerKingdomId].filter(uuid);
      recordRef = "upkeep:" + e.event_id;
      groupRef = "resources";
    } else if (type === "message.sent.v1" && uuid(p.messageId)) {
      const row = (
        await c.query<{ sender_kingdom_id: string; recipient_kingdom_id: string; sent_game_time_ms: string }>(
          "SELECT sender_kingdom_id,recipient_kingdom_id,sent_game_time_ms::text FROM direct_messages WHERE product_scope=$1 AND id=$2",
          [this.options.productScope, p.messageId],
        )
      ).rows[0];
      if (!row) return null;
      kingdoms = [row.recipient_kingdom_id];
      gameTime = row.sent_game_time_ms;
      recordRef = "message:" + p.messageId;
      groupRef = "conversation:" + [row.sender_kingdom_id, row.recipient_kingdom_id].sort().join(":");
      quiet = Boolean(
        (
          await c.query(
            "SELECT 1 FROM social_mutes WHERE product_scope=$1 AND muter_kingdom_id=$2 AND muted_kingdom_id=$3",
            [this.options.productScope, row.recipient_kingdom_id, row.sender_kingdom_id],
          )
        ).rowCount,
      );
    } else if (type.startsWith("contact.") && uuid(p.requestId)) {
      const row = (
        await c.query<{ sender_kingdom_id: string; recipient_kingdom_id: string; created_game_time_ms: string }>(
          "SELECT sender_kingdom_id,recipient_kingdom_id,created_game_time_ms::text FROM cold_contact_requests WHERE product_scope=$1 AND id=$2",
          [this.options.productScope, p.requestId],
        )
      ).rows[0];
      if (!row) return null;
      kingdoms = [row.sender_kingdom_id, row.recipient_kingdom_id];
      if (type === "contact.requested.v1") gameTime ??= row.created_game_time_ms;
      recordRef = "contact-request:" + p.requestId;
      groupRef = recordRef;
    } else if (
      (type.startsWith("supply.") || type.startsWith("garrison.")) &&
      uuid(p.offerId) &&
      type.includes(".offer.")
    ) {
      const supply = type.startsWith("supply.");
      const row = (
        await c.query<{ a: string; b: string; game_time: string; expires: string }>(
          `SELECT ${supply ? "kingdom_a" : "lender_kingdom_id"} AS a,${supply ? "kingdom_b" : "host_kingdom_id"} AS b,created_game_time_ms::text AS game_time,expires_game_time_ms::text AS expires FROM ${supply ? "supply_offers" : "garrison_offers"} WHERE product_scope=$1 AND id=$2`,
          [this.options.productScope, p.offerId],
        )
      ).rows[0];
      if (!row) return null;
      kingdoms = [row.a, row.b];
      if (type.endsWith("created.v1")) gameTime ??= row.game_time;
      recordRef = (supply ? "supply-offer:" : "garrison-offer:") + p.offerId;
      groupRef = recordRef;
      if (type.endsWith("created.v1") || type.endsWith("countered.v1"))
        deadline = { kind: "offer_expiry", gameTime: row.expires };
    } else if ((type.startsWith("supply.") || type.startsWith("garrison.")) && uuid(p.contractId)) {
      const supply = type.startsWith("supply.");
      const row = (
        await c.query<{ a: string; b: string; game_time: string }>(
          `SELECT ${supply ? "kingdom_a" : "lender_kingdom_id"} AS a,${supply ? "kingdom_b" : "host_kingdom_id"} AS b,start_game_time_ms::text AS game_time FROM ${supply ? "supply_contracts" : "garrison_contracts"} WHERE product_scope=$1 AND id=$2`,
          [this.options.productScope, p.contractId],
        )
      ).rows[0];
      if (!row) return null;
      kingdoms = [row.a, row.b];
      // Historical activation sources without occurrence time are intentionally uncovered.
      recordRef = (supply ? "supply-contract:" : "garrison-contract:") + p.contractId;
      groupRef = recordRef;
    } else if (type.startsWith("raid.") && uuid(p.raidId)) {
      const row = (
        await c.query<{
          a: string;
          b: string;
          declared: string;
          lock: string;
          resolved: string | null;
          resolution: string;
        }>(
          "SELECT leader_kingdom_id AS a,target_kingdom_id AS b,declared_game_time_ms::text AS declared,lock_game_time_ms::text AS lock,resolved_game_time_ms::text AS resolved,resolution_game_time_ms::text AS resolution FROM raids WHERE product_scope=$1 AND id=$2",
          [this.options.productScope, p.raidId],
        )
      ).rows[0];
      if (!row) return null;
      kingdoms = [row.a, row.b];
      const participants = (
        await c.query<{ kingdom_id: string }>(
          "SELECT kingdom_id FROM raid_contributions WHERE product_scope=$1 AND raid_id=$2",
          [this.options.productScope, p.raidId],
        )
      ).rows;
      kingdoms.push(...participants.map((v) => v.kingdom_id));
      gameTime ??=
        type === "raid.declared.v1" ? row.declared : type === "raid.locked.v1" ? row.lock : (row.resolved ?? undefined);
      recordRef = "raid:" + p.raidId;
      groupRef = recordRef;
      if (type === "raid.declared.v1") deadline = { kind: "battle_lock", gameTime: row.lock };
    } else if (type === "garrison.host_underfunded.v1" && Array.isArray(p.detachments)) {
      const rows = (
        await c.query<{ a: string; b: string }>(
          "SELECT lender_kingdom_id AS a,host_kingdom_id AS b FROM garrison_contracts WHERE product_scope=$1 AND id=ANY($2::uuid[])",
          [this.options.productScope, p.detachments.filter(uuid)],
        )
      ).rows;
      kingdoms = rows.flatMap((v) => [v.a, v.b]);
      recordRef = "obligation:" + e.event_id;
      groupRef = "resources";
    }
    if (!kingdoms.length || !gameTime || !recordRef) return null;
    return {
      kingdoms: [...new Set(kingdoms)],
      gameTime,
      recordRef,
      groupRef,
      ...(deadline ? { deadline } : {}),
      ...(quiet ? { quiet } : {}),
    };
  }
  async authorizeOwner(c: PoolClient, accountId: string): Promise<boolean> {
    return !!(
      await c.query("SELECT 1 FROM accounts WHERE product_scope=$1 AND id=$2 AND status='active'", [
        this.options.productScope,
        accountId,
      ])
    ).rowCount;
  }
  async authorized(c: PoolClient, accountId: string, eventId: string): Promise<boolean> {
    const e = (
      await c.query<Source>(
        "SELECT event_id,type,payload,created_at FROM outbox_events WHERE product_scope=$1 AND event_id=$2",
        [this.options.productScope, eventId],
      )
    ).rows[0];
    if (!e || !(e.type in agentEventCoverage)) return false;
    const s = await this.select(c, e);
    return (
      !!s &&
      (
        await c.query(
          "SELECT 1 FROM kingdoms k JOIN accounts a ON a.id=k.account_id AND a.product_scope=k.product_scope WHERE k.product_scope=$1 AND k.account_id=$2 AND k.id=ANY($3::uuid[]) AND a.status='active'",
          [this.options.productScope, accountId, s.kingdoms],
        )
      ).rowCount !== 0
    );
  }
  async processBatch(limit = 100): Promise<{ delivered: number }> {
    const consumer = "agent-events-v1";
    const sources = (
      await this.pool.query<Source>(
        `SELECT e.event_id,e.type,e.payload,e.created_at FROM outbox_events e LEFT JOIN outbox_deliveries d ON d.outbox_event_id=e.id AND d.consumer=$2 WHERE e.product_scope=$1 AND e.type=ANY($3::text[]) AND (d.outbox_event_id IS NULL OR (d.status<>'delivered' AND d.lease_expires_at<=now())) ORDER BY e.id LIMIT $4`,
        [this.options.productScope, consumer, Object.keys(agentEventCoverage), Math.min(Math.max(limit, 1), 1000)],
      )
    ).rows;
    let delivered = 0;
    for (const e of sources)
      await withTransaction(this.pool, async (c) => {
        if (
          !(await claimOutboxDelivery(c, {
            consumer,
            eventId: e.event_id,
            workerId: this.workerId,
            leaseMilliseconds: 60000,
          }))
        )
          return;
        const selected = await this.select(c, e);
        if (selected) {
          const owners = (
            await c.query<{ account_id: string }>(
              "SELECT k.account_id FROM kingdoms k JOIN accounts a ON a.id=k.account_id AND a.product_scope=k.product_scope WHERE k.product_scope=$1 AND k.id=ANY($2::uuid[]) AND a.status='active' ORDER BY k.account_id",
              [this.options.productScope, selected.kingdoms],
            )
          ).rows;
          for (const owner of owners)
            await this.options.publish(c, {
              accountId: owner.account_id,
              eventId: e.event_id,
              type: e.type,
              sourceRef: "outbox:" + e.event_id,
              occurredAt: e.created_at.toISOString(),
              gameTime: selected.gameTime,
              ...(selected.deadline ? { deadline: selected.deadline } : {}),
              metadata: {
                category: agentEventCoverage[e.type as keyof typeof agentEventCoverage],
                recordRef: selected.recordRef,
                groupRef: selected.groupRef,
                ...(selected.quiet ? { quiet: true } : {}),
              },
            });
        }
        if (!(await markOutboxDelivered(c, consumer, e.event_id, this.workerId)))
          throw new Error("OUTBOX_DELIVERY_LEASE_LOST");
        delivered++;
      });
    return { delivered };
  }
}
