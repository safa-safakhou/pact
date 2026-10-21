import { execFile, spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { createPool, dropTestSchema, migrate } from "@pact/db";
import { expect, it } from "vitest";
import { prepareOwnedNegotiationWorld } from "../evaluation/negotiation-owned-run.js";
import { designDigest, negotiationPlan } from "../evaluation/negotiation-plan.js";

const exec = promisify(execFile);
const docker = async (args: string[]) => (await exec("docker", args, { maxBuffer: 16 * 1024 * 1024 })).stdout.trim();
async function pipeSQL(id: string, sql: Buffer) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "docker",
      ["exec", "-i", id, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "architecture_fixture", "-d", "pact_test"],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    child.stderr.resume();
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(Error("OWNED_RESTORE_FAILED"))));
    child.stdin.on("error", reject);
    child.stdin.end(sql);
  });
}
it("encrypted owned C02 archive restores every table and sequence on a network-disabled fresh clone without replay", async () => {
  const pactUrl = process.env.TEST_DATABASE_URL ?? "",
    nonce = process.env.FLEET_ARCHITECTURE_NONCE ?? "";
  if (!/^[a-f0-9]{64}$/.test(nonce)) throw Error("OWNED_FIXTURE_REQUIRED");
  const source = await docker(["ps", "--filter", `label=fleet.architecture.fixture=${nonce}`, "-q"]);
  if (
    !/^[a-f0-9]{12,64}$/.test(source) ||
    (await docker(["inspect", "--format", '{{ index .Config.Labels "fleet.architecture.fixture" }}', source])) !== nonce
  )
    throw Error("OWNED_FIXTURE_REQUIRED");
  const cell = negotiationPlan("E1", {
    sources: { fleet: "a".repeat(40), pact: "b".repeat(40) },
    modelDigest: "c".repeat(64),
    policyDigest: "d".repeat(64),
    selectedProfile: { id: "reactive-cognition", version: "1" },
  }).find((c) => c.family === "C02");
  if (!cell) throw Error("CELL_REQUIRED");
  const keys = {
    rulesKey: randomBytes(32).toString("base64"),
    tokenKey: randomBytes(32).toString("base64"),
    encryptionKey: randomBytes(32).toString("base64"),
  };
  const w = await prepareOwnedNegotiationWorld({ pactUrl, nonce }, cell, { retention: "preserve", secrets: keys });
  let clone = "";
  try {
    const c = w.checkpoint(),
      schema = c.schema;
    expect(await migrate(w.pool, { schema })).toEqual([]);
    // Build explicit table queries from PostgreSQL's catalog; identifiers originate
    // only in this owned migrated schema. Row order is canonical, never replayed.
    const tables = (
      await w.pool.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename", [schema])
    ).rows.map((r) => String(r.tablename));
    const quoted = (v: string) => '"' + v.replaceAll('"', '""') + '"';
    const rowsSQL = tables
      .map(
        (t) =>
          `SELECT jsonb_build_object('table','${t}','rows',COALESCE(jsonb_agg(r ORDER BY r::text),'[]'::jsonb)) FROM (SELECT to_jsonb(t) r FROM ${quoted(schema)}.${quoted(t)} t) data`,
      )
      .join(" UNION ALL ");
    const sequences = (
      await w.pool.query("SELECT sequencename FROM pg_sequences WHERE schemaname=$1 ORDER BY sequencename", [schema])
    ).rows.map((r) => String(r.sequencename));
    const sequenceSQL = sequences
      .map(
        (t) =>
          `SELECT jsonb_build_object('sequence','${t}','last_value',last_value::text,'is_called',is_called) FROM ${quoted(schema)}.${quoted(t)}`,
      )
      .join(" UNION ALL ");
    const query = [rowsSQL, sequenceSQL].filter(Boolean).join(" UNION ALL ");
    const fingerprint = (text: string) =>
      text
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const row = JSON.parse(line);
          return { name: row.table ?? row.sequence, digest: designDigest(row) };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "en"));
    const before = fingerprint(
      await docker([
        "exec",
        source,
        "psql",
        "-X",
        "-qAt",
        "-U",
        "architecture_fixture",
        "-d",
        "pact_test",
        "-c",
        query,
      ]),
    );
    const raw = (
      await exec(
        "docker",
        [
          "exec",
          source,
          "pg_dump",
          "-U",
          "architecture_fixture",
          "-d",
          "pact_test",
          `--schema=${schema}`,
          "--no-owner",
          "--no-privileges",
        ],
        { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 },
      )
    ).stdout;
    const archiveKey = randomBytes(32),
      iv = randomBytes(12),
      aad = Buffer.from(`${nonce}:${c.worldId}`);
    const cipher = createCipheriv("aes-256-gcm", archiveKey, iv);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([
        cipher.update(Buffer.from(JSON.stringify({ checkpoint: c, sql: raw.toString("base64") }))),
        cipher.final(),
      ]),
      tag = cipher.getAuthTag();
    expect(encrypted.includes(Buffer.from(c.credentials[0]?.token ?? "MISSING"))).toBe(false);
    const decrypt = () => {
      const d = createDecipheriv("aes-256-gcm", archiveKey, iv);
      d.setAAD(aad);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(encrypted), d.final()]);
    };
    const restored = JSON.parse(decrypt().toString()) as { checkpoint: typeof c; sql: string };
    expect(designDigest(restored.checkpoint)).toBe(designDigest(c));
    clone = await docker([
      "run",
      "--pull=never",
      "-d",
      "--network",
      "none",
      "--label",
      `pact.negotiation.restore=${nonce}`,
      "-e",
      "POSTGRES_USER=architecture_fixture",
      "-e",
      "POSTGRES_DB=pact_test",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "sha256:79bd7c99e923138f136f8009d6bffa66e21e9d4fda5c0c561b00fc9c90cfe537",
    ]);
    for (let i = 0; i < 100; i++) {
      try {
        await docker([
          "exec",
          clone,
          "psql",
          "-X",
          "-qAt",
          "-U",
          "architecture_fixture",
          "-d",
          "pact_test",
          "-c",
          "SELECT 1",
        ]);
        break;
      } catch {
        if (i === 99) throw Error("OWNED_RESTORE_NOT_READY");
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    expect(await docker(["inspect", "--format", "{{.HostConfig.NetworkMode}}", clone])).toBe("none");
    await pipeSQL(clone, Buffer.from(restored.sql, "base64"));
    expect(
      fingerprint(
        await docker([
          "exec",
          clone,
          "psql",
          "-X",
          "-qAt",
          "-U",
          "architecture_fixture",
          "-d",
          "pact_test",
          "-c",
          query,
        ]),
      ),
    ).toEqual(before);
    expect((await w.leaseFacts()).every((l) => l.leaseId === null && !l.live)).toBe(true);
    expect((await w.pool.query("SELECT count(*) n FROM envoy_runs")).rows[0].n).toBe("0");
    // Authentication survives disconnect using the original private checkpoint.
    await w.disconnect();
    const reopened = await prepareOwnedNegotiationWorld({ pactUrl, nonce }, cell, {
      retention: "preserve",
      secrets: keys,
      checkpoint: restored.checkpoint,
    });
    try {
      expect(reopened.players).toEqual(c.players);
      expect((await reopened.actor(c.players[0].kingdomId).readSelf())?.profile.kingdomId).toBe(c.players[0].kingdomId);
    } finally {
      await reopened.disconnect();
    }
    encrypted[0] = (encrypted[0] ?? 0) ^ 1;
    expect(decrypt).toThrow();
  } finally {
    await w.disconnect();
    if (
      clone &&
      (await docker(["inspect", "--format", '{{ index .Config.Labels "pact.negotiation.restore" }}', clone])) === nonce
    )
      await docker(["rm", "-f", "-v", clone]);
    const admin = createPool(pactUrl);
    try {
      if ((await admin.query("SELECT nonce FROM public.architecture_fixture_owner")).rows[0]?.nonce === nonce)
        await dropTestSchema(admin, w.checkpoint().schema);
    } finally {
      await admin.end();
    }
  }
}, 60000);
