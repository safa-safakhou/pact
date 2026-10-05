import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import { ExternalAgentActivity } from "@pact/runs";
import type { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

let admin: Pool, pool: Pool, schema: string;
const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "activity");
  pool = createSchemaPool(url, schema);
});
afterAll(async () => {
  if (pool) await pool.end();
  if (schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});
it("orders bigint IDs numerically and preserves original metadata when current reads fail", async () => {
  const account = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,terms_version) VALUES($1,'pact',$2,'fixture-only','terms-v1')",
    [account, `${account}@example.test`],
  );
  for (const id of [9, 10, 99, 100])
    await pool.query(
      "INSERT INTO external_agent_activity(id,product_scope,account_id,session_id,summary,created_at) OVERRIDING SYSTEM VALUE VALUES($1,'pact',$2,$3,$4,clock_timestamp())",
      [id, account, randomUUID(), JSON.stringify({ code: "COMMITTED", commandId: randomUUID() })],
    );
  const reader = new ExternalAgentActivity(pool, "pact", { now: () => new Date() }, async () => {
    throw new Error("unavailable");
  });
  const view = await reader.read(account);
  expect(view.entries.map((e) => e.id)).toEqual(["9", "10", "99", "100"]);
  expect(view.stale).toBe(true);
  expect(view.entries.every((e) => e.code === "COMMITTED" && e.nextStep?.includes("historical result retained"))).toBe(
    true,
  );
  expect((await reader.read(randomUUID())).entries).toEqual([]);
});
