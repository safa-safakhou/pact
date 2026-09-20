import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "./migrate.js";

export async function createTestSchema(pool: Pool, label = "suite"): Promise<string> {
  const schema = `test_${label.replace(/[^a-z0-9_]/gi, "_").toLowerCase()}_${randomUUID().replaceAll("-", "")}`;
  await migrate(pool, { schema });
  return schema;
}

export async function dropTestSchema(pool: Pool, schema: string): Promise<void> {
  if (!/^test_[a-z0-9_]+$/.test(schema)) throw new Error("Refusing to drop a non-test schema");
  await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
}

export function createSchemaPool(connectionString: string, schema: string): Pool {
  if (!/^test_[a-z0-9_]+$/.test(schema)) throw new Error("Invalid test schema");
  return new Pool({ connectionString, options: `-c search_path=${schema},public`, max: 5 });
}
