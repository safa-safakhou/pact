import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pactRepo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fleetRepo = process.argv[2];
if (!fleetRepo) throw Error("Explicit isolated Fleet source directory required");
for (const port of [3400, 3401, 5451, 5452, 8830]) {
  const server = createServer();
  await new Promise((ok, no) => {
    server.once("error", no);
    server.listen(port, "127.0.0.1", ok);
  });
  await new Promise((r) => server.close(r));
}
const id = `local-four-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8)}`;
const root = resolve(homedir(), "Library/Application Support/PACT Local Worlds", id);
await mkdir(dirname(root), { mode: 0o700, recursive: true });
await mkdir(root, { mode: 0o700 });
for (const dir of ["logs", "evidence", "keys"]) await mkdir(resolve(root, dir), { mode: 0o700 });
const secret = (encoding = "base64url") => randomBytes(32).toString(encoding);
const pactPassword = secret(),
  fleetPassword = secret();
const pactEnv = {
  NODE_ENV: "development",
  HOST: "127.0.0.1",
  PORT: "3401",
  DATABASE_URL: `postgres://pact:${pactPassword}@127.0.0.1:5451/pact`,
  PACT_ORIGIN: "http://127.0.0.1:3400",
  PACT_PUBLIC_BASE_URL: "http://127.0.0.1:3400",
  CURRENT_TERMS_VERSION: "development-v1",
  IDENTITY_TOKEN_PEPPER: secret(),
  IDENTITY_ENCRYPTION_KEY: secret(),
  RAID_SEED_ENCRYPTION_KEY_BASE64: secret("base64"),
  SEAL_ENCRYPTION_KEY_BASE64: secret("base64"),
  PACT_GUEST_PLAY: "1",
  PACT_ENABLE_LIVE_MODEL_CALLS: "0",
  PACT_A2A_ENABLED: "0",
  PACT_AGENT_EVENTS_ENABLED: "1",
  PACT_AGENT_OUTLOOK_ENABLED: "1",
  LOG_LEVEL: "warn",
  PACT_DELETION_REGISTRY_FILE: resolve(root, "deletion-registry.ndjson"),
};
const fleetEnv = {
  DATABASE_URL: `postgres://fleet:${fleetPassword}@127.0.0.1:5452/fleet`,
  FLEET_OPERATOR_SECRET: secret(),
  FLEET_VAULT_KEY: secret("base64"),
  FLEET_ORIGIN: "http://127.0.0.1:8830",
  PORT: "8830",
  FLEET_GAME: "pact",
  FLEET_GAME_BASE_URL: pactEnv.PACT_ORIGIN,
  FLEET_ENVIRONMENT_ID: "pact",
  FLEET_ENVIRONMENT_VERSION: "1",
  FLEET_ENVIRONMENT_INSTANCE: id,
  FLEET_ALLOW_HTTP: "1",
  FLEET_LIVE_ENABLED: "1",
  FLEET_RUN_WINDOW_FILE: resolve(root, "window.json"),
  FLEET_CONCURRENCY: "1",
  FLEET_KEEP_AWAKE: "1",
  FLEET_STATE_PATH: root,
  FLEET_MIN_FREE_BYTES: "0",
  FLEET_PACT_EVENT_FEED_VERSION: "pact.agent-events.v1",
  FLEET_PACT_OUTLOOK_VERSION: "pact.agent-outlook.v1",
  OLLAMA_BASE_URL: "http://127.0.0.1:11434",
  FLEET_LAYA_URL: "http://127.0.0.1:8832",
};
const image = execFileSync("docker", ["image", "inspect", "postgres:17-alpine", "--format", "{{.Id}}"], {
  encoding: "utf8",
}).trim();
const config = {
  schemaVersion: "pact.local-world.v1",
  id,
  root,
  pactRepo,
  fleetRepo: resolve(fleetRepo),
  node: process.execPath,
  postgresImage: image,
  ollamaVersion: "0.40.3",
  modelDigest: "6cc467f054393a55e98a74098abde0c762ffb6d1d8cd64becf30458f38886197",
  pactContainer: `${id}-pact-db`,
  fleetContainer: `${id}-fleet-db`,
  pactEnv,
  fleetEnv,
};
await writeFile(resolve(root, "config.json"), JSON.stringify(config, null, 2), { mode: 0o600, flag: "wx" });
await writeFile(
  resolve(root, "window.json"),
  JSON.stringify({ id, status: "prepared", durationMs: 3600000, startsAt: null, endsAt: null }),
  { mode: 0o600, flag: "wx" },
);
for (const [kind, password, port] of [
  ["pact", pactPassword, 5451],
  ["fleet", fleetPassword, 5452],
]) {
  const envFile = resolve(root, `${kind}-postgres.env`);
  await writeFile(envFile, `POSTGRES_USER=${kind}\nPOSTGRES_DB=${kind}\nPOSTGRES_PASSWORD=${password}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--name",
      config[`${kind}Container`],
      "--label",
      `pact.local-world=${id}`,
      "--env-file",
      envFile,
      "-p",
      `127.0.0.1:${port}:5432`,
      "-v",
      `${id}-${kind}-data:/var/lib/postgresql/data`,
      image,
    ],
    { stdio: "pipe" },
  );
}
console.log(root);
