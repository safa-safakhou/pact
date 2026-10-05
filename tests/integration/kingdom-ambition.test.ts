import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  hashPassword,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { KingdomService, WorldViewService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { OnboardingService } from "@pact/onboarding";
import { WorldClockService } from "@pact/world";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIdentityRoutes } from "../../services/api/src/identity-routes.js";
import type { OperatorPreflight } from "../../services/api/src/operator-preflight.js";

let admin: Pool, pool: Pool, schema: string, identity: IdentityService, kingdomService: KingdomService;
const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const password = "A long synthetic ambition password 123!",
  origin = "https://pact.example";
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "ambition");
  pool = createSchemaPool(url, schema);
  const clock = { now: () => new Date("2026-10-03T17:00:00Z") };
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set([origin]),
    clock,
    digester: new TokenDigester(Buffer.alloc(32, 9)),
    secretBox: new AesGcmSecretBox(Buffer.alloc(32, 7)),
    compromisedPasswords: new LocalCompromisedPasswordChecker([]),
  });
  const onboarding = new OnboardingService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    now: clock.now,
  });
  const world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  kingdomService = new KingdomService(pool, {
    productScope: "pact",
    onboarding,
    world,
    ledger: new ResourceLedger("pact"),
  });
});
afterAll(async () => {
  await pool?.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
async function player() {
  const id = randomUUID(),
    kingdomId = randomUUID(),
    email = `${id}@example.test`;
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,$3,clock_timestamp(),'terms-v1')",
    [id, email, await hashPassword(password)],
  );
  await pool.query(
    "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Private goal','portrait.wolf',clock_timestamp(),0,0,60000,$4)",
    [kingdomId, id, `goal_${id.slice(0, 8)}`, randomUUID()],
  );
  const client = await pool.connect();
  try {
    await new ResourceLedger("pact").initializeKingdom(client, kingdomId, 0);
  } finally {
    client.release();
  }
  const session = await identity.login({ email, password, ip: "127.0.0.1" });
  return { id, kingdomId, session };
}
describe("private human ambition", () => {
  it("persists all choices through human writes and keeps every other projection private", async () => {
    const owner = await player(),
      other = await player(),
      server = Fastify();
    const onboarding = new OnboardingService(pool, {
      productScope: "pact",
      currentTermsVersion: "terms-v1",
      now: () => new Date(),
    });
    registerIdentityRoutes(server, identity, onboarding, {} as OperatorPreflight, kingdomService);
    const headers = {
      cookie: `pact_session=${owner.session.sessionToken}`,
      "x-csrf-token": owner.session.csrfToken,
      origin,
    };
    const views = new WorldViewService(pool, "pact");
    for (const ambition of ["farmer", "trader", "defender", "neutral"]) {
      const r = await server.inject({ method: "PATCH", url: "/v1/kingdom/ambition", headers, payload: { ambition } });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ ambition });
      const own = await views.read(owner.id, owner.kingdomId, 15);
      expect(own?.audience).toBe("owner");
      expect(own).toHaveProperty("ambition", ambition);
      const publicView = await views.read(other.id, owner.kingdomId, 15);
      expect(publicView).not.toHaveProperty("ambition");
      expect(publicView?.profile).not.toHaveProperty("ambition");
    }
    for (const payload of [
      { ambition: "mage" },
      { ambition: "trader", accountId: other.id },
      { ambition: "farmer", kingdomId: other.kingdomId },
    ]) {
      expect((await server.inject({ method: "PATCH", url: "/v1/kingdom/ambition", headers, payload })).statusCode).toBe(
        400,
      );
    }
    expect(
      (
        await server.inject({
          method: "PATCH",
          url: "/v1/kingdom/ambition",
          headers: { authorization: "Bearer synthetic-agent" },
          payload: { ambition: "trader" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: "PATCH",
          url: "/v1/kingdom/ambition",
          headers: { ...headers, origin: "https://wrong.example" },
          payload: { ambition: "trader" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: "PATCH",
          url: "/v1/kingdom/ambition",
          headers: { ...headers, "x-csrf-token": "wrong" },
          payload: { ambition: "trader" },
        })
      ).statusCode,
    ).toBe(403);
    expect((await pool.query("SELECT ambition FROM kingdoms WHERE id=$1", [other.kingdomId])).rows[0].ambition).toBe(
      "neutral",
    );
    await server.close();
  });
  it("exports the private setting and erases it to neutral without changing economics", async () => {
    const p = await player();
    const before = (
      await pool.query(
        "SELECT resource,ordinary_units,allowance_units FROM resource_balances WHERE kingdom_id=$1 ORDER BY resource",
        [p.kingdomId],
      )
    ).rows;
    await kingdomService.setAmbition(p.id, "farmer");
    const client = await pool.connect();
    try {
      expect(await kingdomService.exportExperience(client, p.id)).toEqual([{ ambition: "farmer" }]);
      await kingdomService.forgetExperience(client, p.id);
      expect(await kingdomService.exportExperience(client, p.id)).toEqual([{ ambition: "neutral" }]);
    } finally {
      client.release();
    }
    expect(
      (
        await pool.query(
          "SELECT resource,ordinary_units,allowance_units FROM resource_balances WHERE kingdom_id=$1 ORDER BY resource",
          [p.kingdomId],
        )
      ).rows,
    ).toEqual(before);
    expect((await pool.query("SELECT count(*)::int AS n FROM envoy_runs WHERE account_id=$1", [p.id])).rows[0].n).toBe(
      0,
    );
  });
});
