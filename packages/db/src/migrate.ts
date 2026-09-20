import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";

const migrationsUrl = new URL("../migrations/", import.meta.url);
const identifierPattern = /^[a-z_][a-z0-9_]{0,62}$/;

export interface MigrationOptions {
  schema?: string;
  migrationsDirectory?: URL;
}

async function setSearchPath(client: PoolClient, schema: string): Promise<void> {
  if (!identifierPattern.test(schema)) throw new Error(`Invalid PostgreSQL schema name: ${schema}`);
  await client.query(`SET search_path TO "${schema}", public`);
}

export async function migrate(pool: Pool, options: MigrationOptions = {}): Promise<string[]> {
  const schema = options.schema ?? "public";
  const directory = options.migrationsDirectory ?? migrationsUrl;
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    if (schema !== "public") await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await setSearchPath(client, schema);
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [`pact:migrations:${schema}`]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const files = (await readdir(fileURLToPath(directory))).filter((name) => name.endsWith(".sql")).sort();
    for (const file of files) {
      const exists = await client.query<{ exists: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM app_migrations WHERE name = $1) AS exists",
        [file],
      );
      if (exists.rows[0]?.exists) continue;
      const sql = await readFile(new URL(file, directory), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO app_migrations(name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [`pact:migrations:${schema}`]);
    return applied;
  } finally {
    client.release();
  }
}
