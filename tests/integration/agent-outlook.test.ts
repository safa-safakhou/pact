import { randomUUID } from "node:crypto";
import { AgentOperationService } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { WorldViewService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { WorldClockService } from "@pact/world";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { outlookFeasibility } from "../../packages/application/src/agent-outlook.js";
import { AgentOutlookService } from "../../packages/kingdom/src/agent-outlook.js";
import { registerOutlookRoutes } from "../../services/api/src/decision-routes.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool, pool: Pool, schema: string, world: WorldViewService, outlook: AgentOutlookService;
beforeAll(async () => {
  const target = new URL(url);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || target.pathname !== "/pact_test")
    throw new Error("ISOLATED_TEST_DATABASE_REQUIRED");
  admin = createPool(url);
  schema = await createTestSchema(admin, "agent_outlook");
  pool = createSchemaPool(url, schema);
  await new WorldClockService(pool, "pact").bootstrap();
  world = new WorldViewService(pool, "pact");
  outlook = new AgentOutlookService(pool, "pact", world, outlookFeasibility);
});
afterAll(async () => {
  await pool?.end();
  if (schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
async function owner() {
  const accountId = randomUUID(),
    kingdomId = randomUUID();
  await withTransaction(pool, async (c) => {
    await c.query(
      "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at) VALUES($1,'pact',$2,'fixture',now())",
      [accountId, accountId + "@example.test"],
    );
    await c.query(
      `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Fixture','portrait.wolf',now(),0,0,60000,$4)`,
      [kingdomId, accountId, "out_" + randomUUID().slice(0, 8), randomUUID()],
    );
    await new ResourceLedger("pact").initializeKingdom(c, kingdomId, 0);
    for (const kind of ["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"])
      await c.query("INSERT INTO kingdom_buildings(product_scope,kingdom_id,kind,level) VALUES('pact',$1,$2,1)", [
        kingdomId,
        kind,
      ]);
    await c.query(
      "INSERT INTO kingdom_builder_slots(product_scope,kingdom_id,slot) VALUES('pact',$1,1),('pact',$1,2)",
      [kingdomId],
    );
  });
  return { accountId, kingdomId, productScope: ProductScopeSchema.parse("pact"), audience: "human" as const };
}
it("returns the existing conditional food forecast and separates stock from permission without writes", async () => {
  const a = await owner(),
    before = await world.readSelf(a.accountId);
  const v = await outlook.readOwner(a, {});
  expect(v.resources.find((r) => r.resource === "grain")?.forecastUnits).toBe(
    before?.forecast.expected.grain.ordinaryUnits,
  );
  expect(v.assumptions).toContainEqual(expect.objectContaining({ source: "conditional_forecast" }));
  const build = v.feasibility.candidates.find((c) => c.action === "game.building.queue" && c.stockSufficient);
  expect(build).toMatchObject({ stockSufficient: true, authoritySufficient: false });
  expect(await world.readSelf(a.accountId)).toEqual(before);
  expect((await pool.query("SELECT * FROM command_receipts")).rowCount).toBe(0);
});
it("shows a known threat and pending material work without inventing enemy strength or success", async () => {
  const a = await owner(),
    b = await owner(),
    raid = randomUUID();
  await pool.query(
    "INSERT INTO raids(id,product_scope,leader_kingdom_id,target_kingdom_id,rules_version,declared_game_time_ms,lock_game_time_ms,resolution_game_time_ms,status,loot_priority,declaration_terms) VALUES($1,'pact',$2,$3,'1',0,900000,1200000,'declared','{}','{}')",
    [raid, b.kingdomId, a.kingdomId],
  );
  const v = await outlook.readOwner(a);
  expect(v.knownThreats[0]).toMatchObject({ id: raid, strength: null, lockGameTimeMs: "900000" });
  expect(v.coverage.opponentPrivateState).toBe(false);
  await expect(outlook.readOwner({ ...a, accountId: b.accountId, audience: "service" })).rejects.toThrow("FORBIDDEN");
});
it("keeps signed garrison food exposure distinct from the forecast and reports source completion independently", async () => {
  const host = await owner(),
    lender = await owner(),
    offer = randomUUID(),
    contract = randomUUID();
  const terms = { units: [{ type: "spearman", count: 2 }], durationHours: 1, lenderBond: null, hostBond: null };
  await pool.query(
    "INSERT INTO garrison_offers(id,product_scope,lender_kingdom_id,host_kingdom_id,terms,status,expires_game_time_ms,created_game_time_ms) VALUES($1,'pact',$2,$3,$4,'active',600000,0)",
    [offer, lender.kingdomId, host.kingdomId, terms],
  );
  await pool.query(
    "INSERT INTO garrison_contracts(id,product_scope,offer_id,lender_kingdom_id,host_kingdom_id,terms,status,start_game_time_ms,end_game_time_ms) VALUES($1,'pact',$2,$3,$4,$5,'active',0,3600000)",
    [contract, offer, lender.kingdomId, host.kingdomId, terms],
  );
  const v = await outlook.readOwner(host);
  expect(v.commitments.find((c) => c.id === contract)).toMatchObject({
    admission: "confirmed",
    fulfilment: "pending",
    hostFoodExposure: { signedMaximumUnits: "1300", maximumLockExtensionMinutes: 5 },
  });
  expect(v.dependencies.some((d) => d.counterpartyRef === lender.kingdomId)).toBe(true);
});

it("separates fulfilled assistance from a lost battle and does not claim early release as fulfilment", async () => {
  const host = await owner(),
    lender = await owner(),
    enemy = await owner(),
    offer = randomUUID(),
    contract = randomUUID(),
    raid = randomUUID();
  const terms = { units: [{ type: "spearman", count: 2 }], durationHours: 1, lenderBond: null, hostBond: null };
  await pool.query(
    "INSERT INTO garrison_offers(id,product_scope,lender_kingdom_id,host_kingdom_id,terms,status,expires_game_time_ms,created_game_time_ms) VALUES($1,'pact',$2,$3,$4,'active',600000,0)",
    [offer, lender.kingdomId, host.kingdomId, terms],
  );
  await pool.query(
    "INSERT INTO garrison_contracts(id,product_scope,offer_id,lender_kingdom_id,host_kingdom_id,terms,status,start_game_time_ms,end_game_time_ms,closed_game_time_ms,close_reason) VALUES($1,'pact',$2,$3,$4,$5,'closed',0,3600000,3600000,'expiry')",
    [contract, offer, lender.kingdomId, host.kingdomId, terms],
  );
  await pool.query(
    "INSERT INTO raids(id,product_scope,leader_kingdom_id,target_kingdom_id,rules_version,declared_game_time_ms,lock_game_time_ms,resolution_game_time_ms,resolved_game_time_ms,status,loot_priority,declaration_terms,public_report) VALUES($1,'pact',$2,$3,'1',0,900000,1200000,1200000,'resolved','{}','{}',$4)",
    [raid, enemy.kingdomId, host.kingdomId, { winner: "attacker", secret: "PRIVATE" }],
  );
  const v = await outlook.readOwner(host);
  expect(v.commitments.find((c) => c.id === contract)?.fulfilment).toBe("fulfilled");
  expect(v.outcomes).toContainEqual(expect.objectContaining({ id: raid, result: "lost" }));
  expect(JSON.stringify(v)).not.toContain("PRIVATE");
  expect((await outlook.readOwner(lender)).outcomes).toHaveLength(0);
  await pool.query("UPDATE garrison_contracts SET close_reason='mutual_release' WHERE id=$1", [contract]);
  expect((await outlook.readOwner(host)).commitments.find((c) => c.id === contract)?.fulfilment).toBe("cancelled");
});
it("shares authenticated API and agent operations, isolates owners and honors revoked authentication", async () => {
  const a = await owner(),
    b = await owner();
  let active = true;
  const server = Fastify();
  registerOutlookRoutes(server, {} as never, outlook, {
    introspectAccessToken: async () => (active ? { accountId: a.accountId, scopes: ["world:read"] } : null),
  } as never);
  const req = { url: "/v1/game/agent-outlook", headers: { authorization: "Bearer fixture" } };
  const api = await server.inject(req);
  expect(api.statusCode).toBe(200);
  expect(api.json().ownerRef).toBe(a.kingdomId);
  expect((await server.inject({ ...req, url: req.url + "?accountId=" + b.accountId })).statusCode).toBe(400);
  const principal = { ...a, audience: "agent" as const, agentScopes: ["world:read" as const] };
  const options = {
    productScope: "pact",
    origin: "https://fixture",
    clock: { now: () => new Date() },
    dispatcher: {} as never,
  };
  expect(
    new AgentOperationService(options).listOperations(principal).some((t) => t.name === "pact_agent_outlook_v1"),
  ).toBe(false);
  const ops = new AgentOperationService({ ...options, agentOutlook: outlook });
  const tool = await ops.execute(principal, { name: "pact_agent_outlook_v1", arguments: {} });
  expect(tool.structuredContent).toEqual(api.json());
  await expect(
    ops.execute({ ...principal, agentScopes: [] }, { name: "pact_agent_outlook_v1", arguments: {} }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  active = false;
  expect((await server.inject(req)).statusCode).toBe(403);
  await server.close();
  await pool.query("UPDATE accounts SET status='closing' WHERE id=$1", [a.accountId]);
  await expect(outlook.readOwner(a)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await pool.query("SELECT * FROM envoy_runs")).rowCount).toBe(0);
});

it("distinguishes accepted construction from material completion", async () => {
  const a = await owner(),
    id = randomUUID();
  await pool.query(
    "INSERT INTO building_instructions(id,product_scope,kingdom_id,account_id,builder_slot,building_kind,target_level,actor_kind,authority_ref,state,queued_game_time_ms) VALUES($1,'pact',$2,$3,1,'farm',2,'human','fixture','waiting',0)",
    [id, a.kingdomId, a.accountId],
  );
  expect((await outlook.readOwner(a)).commitments.find((c) => c.id === id)).toMatchObject({
    admission: "confirmed",
    fulfilment: "pending",
  });
  await pool.query(
    "UPDATE building_instructions SET state='completed',due_game_time_ms=0,settled_game_time_ms=0 WHERE id=$1",
    [id],
  );
  expect((await outlook.readOwner(a)).commitments.find((c) => c.id === id)?.fulfilment).toBe("fulfilled");
});
