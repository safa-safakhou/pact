import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../../services/api/src/server.js";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "smoke");
  pool = createSchemaPool(connectionString, schema);
});

afterAll(async () => {
  await pool.end();
  await dropTestSchema(admin, schema);
  await admin.end();
});

describe("API/database smoke", () => {
  it("reports process and migrated database readiness", async () => {
    const server = buildServer(pool, false);
    const health = await server.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    const ready = await server.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: "ready" });
    expect((await pool.query("SELECT name FROM app_migrations ORDER BY name")).rows).toEqual([
      { name: "0001_platform_foundation.sql" },
      { name: "0002_outbox_delivery_leases.sql" },
      { name: "0003_outbox_correlation.sql" },
      { name: "0004_identity_security.sql" },
      { name: "0005_private_kingdom_drafts.sql" },
      { name: "0006_sandbox_dispatcher.sql" },
      { name: "0007_oauth_authorization.sql" },
      { name: "0008_mandates_authority.sql" },
    ]);
    await server.close();
  });
});
