import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["scripts/check-boundaries.mjs"], {
  env: { ...process.env, BOUNDARY_ROOT: "tests/fixtures/forbidden-platform" },
  encoding: "utf8",
});

if (result.status !== 1 || !result.stderr.includes("platform code cannot import @pact/domain")) {
  console.error("Boundary checker did not reject the forbidden platform-to-domain fixture.");
  process.exitCode = 1;
} else {
  console.log("Forbidden platform-to-domain fixture was rejected.");
}
