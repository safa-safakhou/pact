import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { type AgentEventCard, AgentEventCardSchema, type AgentEventPage, AgentEventQuerySchema } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";
export class AgentEventError extends Error {
  constructor(readonly code: "FORBIDDEN" | "INVALID_INPUT") {
    super(code);
  }
}
export type EventPrincipal = {
  accountId: string;
  productScope: string;
  audience: string;
  sessionId?: string;
  agentGrantId?: string;
  agentScopes?: readonly string[];
};
export type AgentEventPublication = Omit<AgentEventCard, "sequence" | "publishedAt"> & { accountId: string };
type Cursor = {
  account: string;
  scope: string;
  world: string;
  visibility: string;
  after: string;
  expires: number;
  version: 1;
  floor: string;
};
export class AgentEventService {
  constructor(
    private readonly pool: Pool,
    private readonly options: {
      productScope: string;
      worldScope: string;
      clock: { now(): Date };
      cursorKey: Buffer;
      authorizeOwner: (client: PoolClient, accountId: string) => Promise<boolean>;
      authorize: (client: PoolClient, accountId: string, eventId: string) => Promise<boolean>;
    },
  ) {
    if (options.cursorKey.length !== 32) throw new Error("CURSOR_KEY_REQUIRED");
  }
  private visibility(p: EventPrincipal) {
    if (p.productScope !== this.options.productScope || !["human", "agent"].includes(p.audience))
      throw new AgentEventError("FORBIDDEN");
    if (p.audience === "agent" && (!p.agentGrantId || !p.agentScopes?.includes("world:read")))
      throw new AgentEventError("FORBIDDEN");
    return p.audience + ":" + (p.audience === "agent" ? p.agentGrantId : (p.sessionId ?? "cookie"));
  }
  private cursor(p: EventPrincipal, after: string, floor = "0") {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.options.cursorKey, iv);
    const data: Cursor = {
      account: p.accountId,
      scope: this.options.productScope,
      world: this.options.worldScope,
      visibility: this.visibility(p),
      after,
      expires: this.options.clock.now().getTime() + 7 * 86400000,
      version: 1,
      floor,
    };
    cipher.setAAD(Buffer.from("agent-events-v1"));
    const body = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
  }
  private decode(p: EventPrincipal, token: string): Cursor {
    try {
      const b = Buffer.from(token, "base64url"),
        d = createDecipheriv("aes-256-gcm", this.options.cursorKey, b.subarray(0, 12));
      d.setAuthTag(b.subarray(12, 28));
      d.setAAD(Buffer.from("agent-events-v1"));
      const v = JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString()) as Cursor;
      if (
        v.version !== 1 ||
        v.account !== p.accountId ||
        v.scope !== this.options.productScope ||
        v.world !== this.options.worldScope ||
        v.visibility !== this.visibility(p) ||
        !/^\d{1,20}$/.test(v.after) ||
        !Number.isSafeInteger(v.expires)
      )
        throw new Error();
      return v;
    } catch {
      throw new AgentEventError("FORBIDDEN");
    }
  }
  async publishForAccount(c: PoolClient, input: AgentEventPublication): Promise<void> {
    const { accountId: _account, ...data } = input;
    const card = AgentEventCardSchema.parse({
      ...data,
      sequence: "0",
      publishedAt: this.options.clock.now().toISOString(),
    });
    await c.query(
      "INSERT INTO agent_event_owners(product_scope,world_scope,account_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [this.options.productScope, this.options.worldScope, input.accountId],
    );
    await c.query(
      "SELECT sequence FROM agent_event_owners WHERE product_scope=$1 AND world_scope=$2 AND account_id=$3 FOR UPDATE",
      [this.options.productScope, this.options.worldScope, input.accountId],
    );
    if (
      (
        await c.query(
          "SELECT 1 FROM agent_events WHERE product_scope=$1 AND world_scope=$2 AND account_id=$3 AND event_id=$4",
          [this.options.productScope, this.options.worldScope, input.accountId, input.eventId],
        )
      ).rowCount
    )
      return;
    if (new Date(input.occurredAt).getTime() <= this.options.clock.now().getTime() - 7 * 86400000) return;
    const row = (
      await c.query<{ sequence: string }>(
        "UPDATE agent_event_owners SET sequence=sequence+1 WHERE product_scope=$1 AND world_scope=$2 AND account_id=$3 RETURNING sequence::text",
        [this.options.productScope, this.options.worldScope, input.accountId],
      )
    ).rows[0]!;
    await c.query(
      "INSERT INTO agent_events(product_scope,world_scope,account_id,sequence,event_id,type,source_ref,occurred_at,published_at,game_time,deadline,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        this.options.productScope,
        this.options.worldScope,
        input.accountId,
        row.sequence,
        card.eventId,
        card.type,
        card.sourceRef,
        card.occurredAt,
        card.publishedAt,
        card.gameTime,
        card.deadline ?? null,
        card.metadata,
      ],
    );
  }
  async read(p: EventPrincipal, cursor?: string, limit?: number): Promise<AgentEventPage> {
    this.visibility(p);
    const q = AgentEventQuerySchema.parse({ cursor, limit });
    const token = cursor ? this.decode(p, cursor) : undefined;
    return withTransaction(this.pool, async (c) => {
      if (!(await this.options.authorizeOwner(c, p.accountId))) throw new AgentEventError("FORBIDDEN");
      await this.pruneOwner(c, p.accountId, this.options.clock.now());
      const owner = (
        await c.query<{ sequence: string; floor_sequence: string }>(
          "SELECT sequence::text,floor_sequence::text FROM agent_event_owners WHERE product_scope=$1 AND world_scope=$2 AND account_id=$3",
          [this.options.productScope, this.options.worldScope, p.accountId],
        )
      ).rows[0];
      const floor = owner?.floor_sequence ?? "0",
        after = token?.after ?? "0";
      if (
        token &&
        (token.expires <= this.options.clock.now().getTime() ||
          BigInt(token.floor ?? "0") < BigInt(floor) ||
          BigInt(after) > BigInt(owner?.sequence ?? "0"))
      ) {
        return {
          schemaVersion: "pact.agent-events.v1",
          events: [],
          nextCursor: null,
          resyncRequired: true,
          resumeFrom: this.cursor(p, owner?.sequence ?? "0", floor),
        };
      }
      const rows = (
        await c.query<{
          sequence: string;
          event_id: string;
          type: string;
          source_ref: string;
          occurred_at: Date;
          published_at: Date;
          game_time: string;
          deadline: AgentEventCard["deadline"];
          metadata: AgentEventCard["metadata"];
        }>(
          "SELECT * FROM agent_events WHERE product_scope=$1 AND world_scope=$2 AND account_id=$3 AND sequence>$4 ORDER BY sequence LIMIT $5",
          [this.options.productScope, this.options.worldScope, p.accountId, after, q.limit],
        )
      ).rows;
      const page: AgentEventPage = {
        schemaVersion: "pact.agent-events.v1",
        events: [],
        nextCursor: cursor ?? null,
        resyncRequired: false,
      };
      for (const row of rows) {
        if (!(await this.options.authorize(c, p.accountId, row.event_id))) {
          return {
            schemaVersion: "pact.agent-events.v1",
            events: [],
            nextCursor: null,
            resyncRequired: true,
            resumeFrom: this.cursor(p, owner?.sequence ?? "0", floor),
          };
        }
        const card: AgentEventCard = {
          sequence: row.sequence,
          eventId: row.event_id,
          type: row.type,
          sourceRef: row.source_ref,
          occurredAt: row.occurred_at.toISOString(),
          publishedAt: row.published_at.toISOString(),
          gameTime: row.game_time,
          ...(row.deadline ? { deadline: row.deadline } : {}),
          metadata: row.metadata,
        };
        const next = this.cursor(p, row.sequence, floor);
        const candidate = { ...page, events: [...page.events, card], nextCursor: next };
        if (Buffer.byteLength(JSON.stringify(candidate)) > 32768) break;
        page.events.push(card);
        page.nextCursor = next;
      }
      // Empty initial pages still carry a stable resume position for future polling.
      page.nextCursor ??= this.cursor(p, after, floor);
      return page;
    });
  }
  private async pruneOwner(c: PoolClient, account: string, now: Date, world = this.options.worldScope) {
    const rows = (
      await c.query<{ sequence: string; event_id: string; occurred_at: Date }>(
        "SELECT sequence::text,event_id,occurred_at FROM agent_events WHERE product_scope=$1 AND world_scope=$2 AND account_id=$3 ORDER BY sequence",
        [this.options.productScope, world, account],
      )
    ).rows;
    for (const row of rows)
      if (
        row.occurred_at.getTime() <= now.getTime() - 7 * 86400000 ||
        !(await this.options.authorize(c, account, row.event_id))
      ) {
        await c.query(
          "UPDATE agent_event_owners SET floor_sequence=GREATEST(floor_sequence,$4) WHERE product_scope=$1 AND world_scope=$2 AND account_id=$3",
          [this.options.productScope, world, account, row.sequence],
        );
        await c.query(
          "DELETE FROM agent_events WHERE product_scope=$1 AND world_scope=$2 AND account_id=$3 AND sequence=$4",
          [this.options.productScope, world, account, row.sequence],
        );
      }
  }
  readonly retention = {
    name: "agentEvents",
    forgetAccount: async (c: PoolClient, id: string) => {
      for (const table of ["agent_events", "agent_event_owners"])
        await c.query(`DELETE FROM ${table} WHERE product_scope=$1 AND account_id=$2`, [this.options.productScope, id]);
    },
    exportAccount: async (c: PoolClient, id: string) => {
      await this.pruneOwner(c, id, this.options.clock.now());
      return (
        await c.query(
          "SELECT sequence::text,event_id,type,source_ref,occurred_at,game_time,deadline,metadata FROM agent_events WHERE product_scope=$1 AND world_scope=$2 AND account_id=$3 ORDER BY sequence",
          [this.options.productScope, this.options.worldScope, id],
        )
      ).rows;
    },
    prune: async (c: PoolClient, now: Date) => {
      const owners = (
        await c.query<{ account_id: string; world_scope: string }>(
          "SELECT account_id,world_scope FROM agent_event_owners WHERE product_scope=$1",
          [this.options.productScope],
        )
      ).rows;
      for (const o of owners) await this.pruneOwner(c, o.account_id, now, o.world_scope);
      return owners.length;
    },
  };
}
