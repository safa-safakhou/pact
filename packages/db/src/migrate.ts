import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";

const migrationUrls = [
  new URL("../migrations/", import.meta.url),
  new URL("../../identity/migrations/", import.meta.url),
  new URL("../../onboarding/migrations/", import.meta.url),
  new URL("../../application/migrations/", import.meta.url),
];
const identifierPattern = /^[a-z_][a-z0-9_]{0,62}$/;

export interface MigrationOptions {
  schema?: string;
  migrationsDirectory?: URL;
  migrationDirectories?: URL[];
}

async function setSearchPath(client: PoolClient, schema: string): Promise<void> {
  if (!identifierPattern.test(schema)) throw new Error(`Invalid PostgreSQL schema name: ${schema}`);
  await client.query(`SET search_path TO "${schema}", public`);
}

export async function migrate(pool: Pool, options: MigrationOptions = {}): Promise<string[]> {
  const schema = options.schema ?? "public";
  const directories =
    options.migrationDirectories ?? (options.migrationsDirectory ? [options.migrationsDirectory] : migrationUrls);
  const client = await pool.connect();
  const applied: string[] = [];
  let globalLockHeld = false;
  let schemaLockHeld = false;
  try {
    if (schema !== "public") await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await setSearchPath(client, schema);
    await client.query("SELECT pg_advisory_lock(hashtext($1))", ["pact:migrations:global"]);
    globalLockHeld = true;
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [`pact:migrations:${schema}`]);
    schemaLockHeld = true;
    await client.query(
      "CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const migrations = (
      await Promise.all(
        directories.map(async (directory) =>
          (
            await readdir(fileURLToPath(directory))
          )
            .filter((name) => name.endsWith(".sql"))
            .map((name) => ({ name, url: new URL(name, directory) })),
        ),
      )
    )
      .flat()
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    if (new Set(migrations.map((item) => item.name)).size !== migrations.length) {
      throw new Error("Migration names must be unique across modules");
    }
    for (const file of migrations) {
      const exists = await client.query<{ exists: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM app_migrations WHERE name = $1) AS exists",
        [file.name],
      );
      if (exists.rows[0]?.exists) continue;
      const sql = await readFile(file.url, "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO app_migrations(name) VALUES ($1)", [file.name]);
        await client.query("COMMIT");
        applied.push(file.name);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return applied;
  } finally {
    if (schemaLockHeld) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [`pact:migrations:${schema}`]);
    if (globalLockHeld) await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["pact:migrations:global"]);
    client.release();
  }
}
