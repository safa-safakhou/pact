import { spawnSync } from "node:child_process";

const repetitions = 5;
const commands = [
  [
    "test",
    "--",
    "--run",
    "packages/model-provider/src/openai.test.ts",
    "packages/model-provider/src/openrouter.test.ts",
    "packages/model-provider/src/provider-adapters.test.ts",
    "packages/model-provider/src/provider-contract.test.ts",
    "services/api/src/capability-routes.test.ts",
  ],
  [
    "run",
    "test:integration",
    "--",
    "--run",
    "tests/integration/identity-onboarding.test.ts",
    "tests/integration/oauth.test.ts",
    "tests/integration/mcp-approval-inbox.test.ts",
    "tests/integration/openrouter.test.ts",
    "tests/integration/telegram.test.ts",
  ],
];

const results = [];
for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  const startedAt = performance.now();
  for (const args of commands) {
    const result = spawnSync("npm", args, { stdio: "inherit", env: process.env });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  results.push({ repetition, durationMs: Math.round(performance.now() - startedAt), result: "passed" });
}

process.stdout.write(`${JSON.stringify({ schemaVersion: 1, repetitions, results }, undefined, 2)}\n`);
