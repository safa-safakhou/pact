import { spawnSync } from "node:child_process";

const compiler = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tests/fixtures/non-game/tsconfig.json", "--listFiles"],
  { encoding: "utf8" },
);
if (compiler.status !== 0) {
  process.stderr.write(compiler.stdout + compiler.stderr);
  process.exit(1);
}
if (/\/packages\/(?:domain|kingdom|world|ledger|application|db)\/|\/@types\/pg\//.test(compiler.stdout))
  throw new Error("NON_GAME_FORBIDDEN_TYPE_DEPENDENCY");
const run = spawnSync(process.execPath, ["--import", "./scripts/non-game-import-guard.mjs", ".tmp/non-game/main.js"], {
  encoding: "utf8",
  env: { ...process.env, DATABASE_URL: "", TEST_DATABASE_URL: "" },
});
process.stdout.write(run.stdout);
process.stderr.write(run.stderr);
if (run.status !== 0) process.exit(1);
const denied = spawnSync(
  process.execPath,
  ["--import", "./scripts/non-game-import-guard.mjs", "--input-type=module", "-e", 'await import("@pact/application")'],
  { encoding: "utf8" },
);
if (denied.status === 0 || !denied.stderr.includes("NON_GAME_FORBIDDEN_IMPORT"))
  throw new Error("NON_GAME_IMPORT_GUARD_FAILED");
process.stdout.write(
  "PASS: isolated compile/runtime closure excludes PACT domain, database and deployment dependencies; forbidden import rejected\n",
);
