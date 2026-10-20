import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createDecipheriv, createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.argv[2],
  label = process.argv[3] ?? "ready";
if (!root || !/^[a-z0-9-]{1,64}$/.test(label)) throw Error("Explicit state directory and safe snapshot label required");
const c = JSON.parse(readFileSync(resolve(root, "config.json"), "utf8"));
if (c.root !== resolve(root)) throw Error("State identity mismatch");
const clone = `${c.id}-restore-${randomUUID().slice(0, 8)}`;
const docker = (args, input) =>
  execFileSync("docker", args, {
    input,
    encoding: input ? undefined : "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
let created = false;
const hashes = {};
try {
  docker([
    "run",
    "-d",
    "--network",
    "none",
    "--name",
    clone,
    "--label",
    `pact.restore-check=${c.id}`,
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    c.postgresImage,
  ]);
  created = true;
  for (let i = 0; i < 80; i++) {
    try {
      docker(["exec", clone, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  for (const kind of ["pact", "fleet"]) {
    const encrypted = readFileSync(resolve(root, "evidence", `${label}-${kind}.dump.enc`));
    const key = readFileSync(resolve(root, "keys", `${label}-${kind}.key`));
    const cipher = createDecipheriv("aes-256-gcm", key, encrypted.subarray(0, 12));
    cipher.setAuthTag(encrypted.subarray(12, 28));
    const plain = Buffer.concat([cipher.update(encrypted.subarray(28)), cipher.final()]);
    assert.equal(
      createHash("sha256").update(plain).digest("hex"),
      readFileSync(resolve(root, "evidence", `${label}-${kind}.sha256`), "utf8"),
    );
    docker(["exec", clone, "psql", "-U", "postgres", "-d", "postgres", "-c", `CREATE DATABASE ${kind}`]);
    docker(
      ["exec", "-i", clone, "pg_restore", "-U", "postgres", "-d", kind, "--no-owner", "--no-acl", "--exit-on-error"],
      plain,
    );
    const tables =
      kind === "pact"
        ? [
            "accounts",
            "kingdoms",
            "kingdom_mandates",
            "resource_balances",
            "building_instructions",
            "direct_messages",
            "social_contacts",
            "supply_offers",
            "supply_contracts",
            "command_receipts",
          ]
        : docker([
            "exec",
            clone,
            "psql",
            "-U",
            "postgres",
            "-d",
            "fleet",
            "-tA",
            "-c",
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
          ])
            .trim()
            .split("\n")
            .filter((x) => !["worker_heartbeats", "worker_health"].includes(x));
    hashes[kind] = {};
    for (const table of tables) {
      if (!/^[a-z_]+$/.test(table)) throw Error("Unexpected table name");
      const sql = `SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) FROM public.${table} t`;
      const actual = docker(["exec", c[`${kind}Container`], "psql", "-U", kind, "-d", kind, "-tA", "-c", sql]).trim();
      const restored = docker(["exec", clone, "psql", "-U", "postgres", "-d", kind, "-tA", "-c", sql]).trim();
      assert.equal(restored, actual, `${kind}/${table} complete-row restore mismatch`);
      hashes[kind][table] = actual;
    }
  }
  const proof = {
    verifiedAt: new Date().toISOString(),
    label,
    encryptedArchivesAuthenticated: true,
    networkDisabledRestore: true,
    completeRowTables: { pact: Object.keys(hashes.pact).length, fleet: Object.keys(hashes.fleet).length },
    hashes,
  };
  writeFileSync(resolve(root, "evidence", "restore-verification.json"), JSON.stringify(proof, null, 2), {
    mode: 0o600,
  });
  console.log(JSON.stringify({ restored: true, ...proof.completeRowTables }));
} finally {
  if (created) {
    assert.equal(docker(["inspect", clone, "--format", '{{index .Config.Labels "pact.restore-check"}}']).trim(), c.id);
    docker(["rm", "-f", "-v", clone]);
  }
}
