import { readdirSync, readFileSync } from "node:fs";

const root = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageNames = readdirSync(new URL("../packages/", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const command = root.scripts["build:packages"];
const steps = command.split(" && ").map((step) => {
  const match = /^npm run build --workspace (@pact\/[a-z-]+)$/.exec(step);
  if (!match) throw new Error(`Unexpected package build step: ${step}`);
  return match[1];
});
const positions = new Map(steps.map((name, index) => [name, index]));
if (positions.size !== steps.length) throw new Error("Duplicate package build step");
if (positions.size !== packageNames.length) throw new Error("Package build list does not cover every package");
for (const directory of packageNames) {
  const manifest = JSON.parse(readFileSync(new URL(`../packages/${directory}/package.json`, import.meta.url), "utf8"));
  const position = positions.get(manifest.name);
  if (position === undefined) throw new Error(`Missing package build step: ${manifest.name}`);
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    if (!dependency.startsWith("@pact/")) continue;
    const prerequisite = positions.get(dependency);
    if (prerequisite === undefined || prerequisite >= position)
      throw new Error(`${manifest.name} must build after ${dependency}`);
  }
}
process.stdout.write("Package build order follows workspace dependencies.\n");
