import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { AgentOperationService } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import {
  appendOutbox,
  createPool,
  createSchemaPool,
  createTestSchema,
  dropTestSchema,
  withTransaction,
} from "@pact/db";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { AgentEventService } from "../../packages/inbox/src/agent-events.js";
import { AgentEventProjector } from "../../packages/kingdom/src/agent-events.js";
import { registerAgentEventRoutes } from "../../services/api/src/agent-event-routes.js";
import { agentEventBatch } from "../../workers/notification/src/agent-events.js";

let admin: Pool, pool: Pool, schema: string, service: AgentEventService, projector: AgentEventProjector;
let now = new Date("2026-10-17T08:00:00Z");
beforeEach(() => {
  now = new Date("2026-10-17T08:00:00Z");
});
const url = process.env.TEST_DATABASE_URL!;
beforeAll(async () => {
  if (!url?.includes("127.0.0.1:5438/pact_test")) throw new Error("isolated phase2 test database required");
  admin = createPool(url);
  schema = await createTestSchema(admin, "agent_events");
  pool = createSchemaPool(url, schema);
  service = new AgentEventService(pool, {
    productScope: "pact",
    worldScope: "test",
    clock: { now: () => now },
    cursorKey: Buffer.alloc(32, 3),
    authorizeOwner: (c, account) => projector.authorizeOwner(c, account),
    authorize: async (c, accountId, eventId) => projector.authorized(c, accountId, eventId),
  });
  projector = new AgentEventProjector(pool, {
    productScope: "pact",
    clock: { now: () => now },
    publish: (c, input) => service.publishForAccount(c, input),
  });
});
afterAll(async () => {
  await pool?.end();
  if (schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
async function owner() {
  const accountId = randomUUID(),
    kingdomId = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at) VALUES($1::uuid,'pact',$2,'fixture',$3)",
    [accountId, accountId + "@example.test", now],
  );
  await pool.query(
    `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1::uuid,'pact',$2,$3,'Fixture','portrait.wolf',$4,0,0,60000,$5)`,
    [kingdomId, accountId, "evt_" + randomUUID().slice(0, 8), now, randomUUID()],
  );
  return { accountId, kingdomId, audience: "human" as const, sessionId: randomUUID(), productScope: "pact" };
}
async function emit(kingdomId: string, c?: import("pg").PoolClient) {
  const eventId = randomUUID();
  const write = (db: import("pg").PoolClient) =>
    appendOutbox(db, {
      productScope: "pact",
      eventId,
      type: "building.completed.v1",
      payload: { kingdomId, gameTimeMs: "60000", instructionId: randomUUID(), body: "NEVER COPY" },
    });
  if (c) await write(c);
  else await withTransaction(pool, write);
  return eventId;
}
it("publishes defaults/caps/bytes, deduplicates and rejects a foreign cursor", async () => {
  const a = await owner(),
    b = await owner();
  for (let i = 0; i < 55; i++) await emit(a.kingdomId);
  await projector.processBatch(100);
  await projector.processBatch(100);
  const page = await service.read(a);
  expect(page.events).toHaveLength(20);
  const max = await service.read(a, undefined, 50);
  expect(max.events).toHaveLength(50);
  expect(Buffer.byteLength(JSON.stringify(max))).toBeLessThanOrEqual(32768);
  expect(JSON.stringify(max)).not.toContain("NEVER COPY");
  expect((await service.read(b)).events).toHaveLength(0);
  await expect(service.read(b, page.nextCursor!)).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(service.read({ ...a, sessionId: randomUUID() }, page.nextCursor!)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  let cursor: string | null = null,
    ids: string[] = [];
  do {
    const p = await service.read(a, cursor ?? undefined);
    ids.push(...p.events.map((e) => e.eventId));
    if (!p.events.length) break;
    cursor = p.nextCursor;
  } while (ids.length < 100);
  expect(new Set(ids).size).toBe(55);
});
it("finds a lower sequence committed after a higher one and rolls back delivery atomically", async () => {
  const a = await owner(),
    c = await pool.connect();
  await c.query("BEGIN");
  try {
    const late = await emit(a.kingdomId, c),
      early = await emit(a.kingdomId);
    await projector.processBatch(100);
    expect((await service.read(a)).events.map((e) => e.eventId)).toEqual([early]);
    await c.query("COMMIT");
    await projector.processBatch(100);
    expect((await service.read(a)).events.map((e) => e.eventId)).toEqual([early, late]);
    await c.query("BEGIN");
    await emit(a.kingdomId, c);
    await c.query("ROLLBACK");
    await projector.processBatch(100);
    expect((await service.read(a)).events).toHaveLength(2);
  } finally {
    c.release();
  }
});
it("signals retention and source deletion gaps and refuses closing owners", async () => {
  const a = await owner();
  const id = await emit(a.kingdomId);
  await projector.processBatch(100);
  const p = await service.read(a);
  await pool.query("DELETE FROM outbox_events WHERE event_id=$1", [id]);
  expect((await service.read(a, p.nextCursor!)).resyncRequired).toBe(true);
  now = new Date(now.getTime() + 8 * 86400000);
  expect((await service.read(a, p.nextCursor!)).resyncRequired).toBe(true);
  await withTransaction(pool, (c) => service.retention.prune(c, now));
  await pool.query("UPDATE accounts SET status='closing' WHERE id=$1", [a.accountId]);
  await expect(service.read(a)).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("shares API/MCP authorization, rechecks revoked grants and never acknowledges or invokes inference", async () => {
  const a = await owner(),
    grantId = randomUUID();
  await emit(a.kingdomId);
  await projector.processBatch(100);
  let active = true;
  const server = Fastify();
  registerAgentEventRoutes(server, {} as never, service, {
    introspectAccessToken: async () => (active ? { accountId: a.accountId, grantId, scopes: ["world:read"] } : null),
  } as never);
  const api = await server.inject({ url: "/v1/agent-events", headers: { authorization: "Bearer fixture" } });
  expect(api.statusCode).toBe(200);
  expect(api.json().events).toHaveLength(1);
  const ops = new AgentOperationService({
    productScope: "pact",
    origin: "https://fixture",
    clock: { now: () => now },
    dispatcher: {} as never,
    agentEvents: service,
  });
  const principal = {
    accountId: a.accountId,
    productScope: ProductScopeSchema.parse("pact"),
    audience: "agent" as const,
    agentGrantId: grantId,
    agentScopes: ["world:read" as const],
  };
  expect(ops.listOperations(principal).some((o) => o.name === "pact_agent_events_v1")).toBe(true);
  const mcp = await ops.execute(principal, { name: "pact_agent_events_v1", arguments: {} });
  expect(mcp.structuredContent).toMatchObject({ events: [{ eventId: api.json().events[0].eventId }] });
  active = false;
  expect(
    (await server.inject({ url: "/v1/agent-events", headers: { authorization: "Bearer fixture" } })).statusCode,
  ).toBe(403);
  expect((await pool.query("SELECT * FROM inbox_acknowledgements")).rowCount).toBe(0);
  expect((await pool.query("SELECT * FROM envoy_runs")).rowCount).toBe(0);
  await server.close();
});
it("projects without SMTP, isolates failures and leaves default-off projection idle", async () => {
  const a = await owner();
  await emit(a.kingdomId);
  let failures = 0;
  expect(
    await agentEventBatch(
      false,
      () => projector.processBatch(),
      () => failures++,
    ),
  ).toBe(0);
  expect((await service.read(a)).events).toHaveLength(0);
  expect(
    await agentEventBatch(
      true,
      () => projector.processBatch(),
      () => failures++,
    ),
  ).toBeGreaterThan(0);
  expect((await service.read(a)).events).toHaveLength(1);
  expect(
    await agentEventBatch(
      true,
      async () => {
        throw new Error("offline");
      },
      () => failures++,
    ),
  ).toBe(0);
  expect(failures).toBe(1);
});
it("rolls back failed publication and retries expired outbox claims", async () => {
  const a = await owner(),
    id = await emit(a.kingdomId);
  const failed = new AgentEventProjector(pool, {
    productScope: "pact",
    clock: { now: () => now },
    publish: async (c, input) => {
      await service.publishForAccount(c, input);
      throw new Error("CRASH");
    },
  });
  await expect(failed.processBatch(100)).rejects.toThrow("CRASH");
  expect((await service.read(a)).events).toHaveLength(0);
  await pool.query(
    "INSERT INTO outbox_deliveries(consumer,outbox_event_id,status,leased_by,lease_expires_at,attempts) SELECT 'agent-events-v1',id,'leased','dead',now()-interval '1 second',1 FROM outbox_events WHERE event_id=$1",
    [id],
  );
  await projector.processBatch(100);
  expect((await service.read(a)).events).toHaveLength(1);
});

it("keeps message bodies private, marks muted sources and invalidates deleted messages", async () => {
  const a = await owner(),
    b = await owner(),
    id = randomUUID();
  await pool.query(
    "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms) VALUES($1::uuid,'pact',$2,$3,'PRIVATE PEER TEXT',true,$1::text,120000)",
    [id, b.kingdomId, a.kingdomId],
  );
  await pool.query("INSERT INTO social_mutes VALUES('pact',$1,$2)", [a.kingdomId, b.kingdomId]);
  await withTransaction(pool, (c) =>
    appendOutbox(c, {
      productScope: "pact",
      eventId: randomUUID(),
      type: "message.sent.v1",
      payload: { messageId: id },
    }),
  );
  await projector.processBatch(100);
  const page = await service.read(a);
  expect(page.events[0]).toMatchObject({ gameTime: "120000", metadata: { category: "conversation", quiet: true } });
  expect(JSON.stringify(page)).not.toContain("PRIVATE PEER TEXT");
  expect((await service.read(b)).events).toHaveLength(0);
  await pool.query("DELETE FROM direct_messages WHERE id=$1", [id]);
  expect((await service.read(a, page.nextCursor!)).resyncRequired).toBe(true);
});
it("maps actual offer, contract, raid and resource sources only to authorized parties", async () => {
  const a = await owner(),
    b = await owner(),
    other = await owner(),
    offer = randomUUID(),
    contract = randomUUID(),
    raid = randomUUID(),
    contact = randomUUID();
  await pool.query(
    "INSERT INTO supply_offers(id,product_scope,kingdom_a,kingdom_b,version,terms,status,expires_game_time_ms,created_game_time_ms,updated_game_time_ms) VALUES($1::uuid,'pact',$2,$3,1,'{}','active',600000,0,0)",
    [offer, a.kingdomId, b.kingdomId],
  );
  await pool.query(
    "INSERT INTO supply_contracts(id,product_scope,offer_id,offer_version,kingdom_a,kingdom_b,terms,start_game_time_ms,end_game_time_ms,status) VALUES($1::uuid,'pact',$2,1,$3,$4,'{}',0,3600000,'active')",
    [contract, offer, a.kingdomId, b.kingdomId],
  );
  await pool.query(
    "INSERT INTO raids(id,product_scope,leader_kingdom_id,target_kingdom_id,rules_version,declared_game_time_ms,lock_game_time_ms,resolution_game_time_ms,status,loot_priority,declaration_terms) VALUES($1::uuid,'pact',$2,$3,'1',0,900000,1200000,'declared','{}','{}')",
    [raid, a.kingdomId, b.kingdomId],
  );
  await pool.query(
    "INSERT INTO cold_contact_requests(id,product_scope,sender_kingdom_id,recipient_kingdom_id,note,operation_key,created_game_time_ms,expires_game_time_ms,status) VALUES($1::uuid,'pact',$2,$3,'PRIVATE',$1::text,0,600000,'pending')",
    [contact, a.kingdomId, b.kingdomId],
  );
  for (const [type, payload] of [
    ["contact.requested.v1", { requestId: contact }],
    ["supply.offer.created.v1", { offerId: offer }],
    ["supply.contract.activated.v1", { contractId: contract, gameTimeMs: 0 }],
    ["raid.declared.v1", { raidId: raid }],
    ["raid.locked.v1", { raidId: raid, gameTimeMs: 900000 }],
    ["upkeep.hungry.v1", { payerKingdomId: a.kingdomId, gameTimeMs: 1200000 }],
  ] as const)
    await withTransaction(pool, (c) => appendOutbox(c, { productScope: "pact", eventId: randomUUID(), type, payload }));
  await projector.processBatch(100);
  const page = await service.read(a);
  expect(page.events).toHaveLength(6);
  expect(page.events.find((e) => e.type === "raid.declared.v1")?.deadline).toEqual({
    kind: "battle_lock",
    gameTime: "900000",
  });
  expect((await service.read(b)).events).toHaveLength(5);
  expect((await service.read(other)).events).toHaveLength(0);
});

it("splits by serialized bytes without losing entries and resumes a retention gap safely", async () => {
  const a = await owner();
  for (let i = 0; i < 50; i++)
    await withTransaction(pool, async (c) => {
      const id = await emit(a.kingdomId, c);
      await service.publishForAccount(c, {
        accountId: a.accountId,
        eventId: id,
        type: "building.completed.v1",
        sourceRef: "outbox:" + id,
        occurredAt: now.toISOString(),
        gameTime: "60000",
        metadata: { category: "completion", groupRef: "g".repeat(200), recordRef: "r".repeat(200) },
      });
    });
  const first = await service.read(a, undefined, 50);
  expect(first.events.length).toBeLessThan(50);
  expect(first.events.length).toBeGreaterThan(0);
  expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThanOrEqual(32768);
  const second = await service.read(a, first.nextCursor ?? undefined, 50);
  expect(new Set([...first.events, ...second.events].map((e) => e.eventId)).size).toBe(50);
  await pool.query("DELETE FROM outbox_events WHERE event_id=$1", [first.events[0]?.eventId]);
  const gap = await service.read(a, second.nextCursor ?? undefined);
  expect(gap.resyncRequired).toBe(true);
  expect(gap.resumeFrom).toBeTruthy();
  const resumed = await service.read(a, gap.resumeFrom);
  expect(resumed.resyncRequired).toBe(false);
});

it("forgets account metadata across prior world namespaces", async () => {
  const a = await owner(),
    id = await emit(a.kingdomId);
  const prior = new AgentEventService(pool, {
    productScope: "pact",
    worldScope: "prior",
    clock: { now: () => now },
    cursorKey: Buffer.alloc(32, 3),
    authorizeOwner: (c, account) => projector.authorizeOwner(c, account),
    authorize: (c, account, event) => projector.authorized(c, account, event),
  });
  await withTransaction(pool, (c) =>
    prior.publishForAccount(c, {
      accountId: a.accountId,
      eventId: id,
      type: "building.completed.v1",
      sourceRef: "outbox:" + id,
      occurredAt: now.toISOString(),
      gameTime: "0",
      metadata: { category: "completion", groupRef: "development", recordRef: "source" },
    }),
  );
  await withTransaction(pool, (c) => service.retention.forgetAccount(c, a.accountId));
  expect((await pool.query("SELECT * FROM agent_events WHERE account_id=$1", [a.accountId])).rowCount).toBe(0);
});

it("boots the actual notification worker with SMTP absent and no inference service", async () => {
  const connection = new URL(url);
  connection.searchParams.set("options", `-c search_path=${schema},public`);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: connection.toString(),
    IDENTITY_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64url"),
    PACT_PUBLIC_BASE_URL: "https://fixture.test",
    PACT_AGENT_EVENTS_ENABLED: "1",
  };
  delete env.SMTP_URL;
  const child = spawn(process.execPath, ["workers/notification/dist/main.js"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const until = Date.now() + 5000;
      const timer = setInterval(() => {
        if (output.includes('"adapter":"disabled"')) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() > until || child.exitCode !== null) {
          clearInterval(timer);
          reject(new Error("WORKER_START_FAILED"));
        }
      }, 20);
    });
    expect(output).toContain('"event":"notification.ready"');
  } finally {
    child.kill("SIGTERM");
    await exited;
  }
});
