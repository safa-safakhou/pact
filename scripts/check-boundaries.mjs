import { glob, readFile } from "node:fs/promises";

const violations = [];
const importPattern = /(?:from\s+|import\s*\()["'](@pact\/[^"']+)["']/g;

const root = process.env.BOUNDARY_ROOT ?? "packages/platform/src";

for await (const file of glob(`${root}/**/*.ts`)) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    if (match[1] === "@pact/domain" || match[1]?.startsWith("@pact/domain/")) {
      violations.push(`${file}: platform code cannot import ${match[1]}`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Architecture boundaries are valid.");
}
