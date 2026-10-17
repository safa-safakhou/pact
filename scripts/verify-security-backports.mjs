import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = JSON.parse(await readFile("package.json", "utf8")),
  native = JSON.parse(await readFile("apps/native/package.json", "utf8")),
  provenance = JSON.parse(await readFile("vendor/security/provenance.json", "utf8"));
if (root.devDependencies.expo !== native.dependencies.expo) throw Error("ROOT_EXPO_PIN_MUST_MATCH_NATIVE_WORKSPACE");
if (
  root.overrides.braces !== "$braces" ||
  root.overrides["node-forge"] !== "$node-forge" ||
  root.overrides.xcode.uuid !== "11.1.1"
)
  throw Error("SECURITY_OVERRIDES_CHANGED_REVIEW_REQUIRED");
for (const entry of provenance.packages) {
  const base = `vendor/security/${entry.name}`,
    files = [];
  async function walk(directory) {
    for (const f of await readdir(directory, { withFileTypes: true })) {
      const path = `${directory}/${f.name}`;
      if (f.isDirectory()) await walk(path);
      else if (f.isFile()) files.push(path.slice(base.length + 1));
      else throw Error("UNEXPECTED_VENDOR_LINK");
    }
  }
  await walk(base);
  if (JSON.stringify(files.sort()) !== JSON.stringify(Object.keys(entry.localFiles).sort()))
    throw Error("BACKPORT_FILE_INVENTORY_CHANGED");
  for (const [file, digest] of Object.entries(entry.localFiles))
    if (
      createHash("sha256")
        .update(await readFile(`${base}/${file}`))
        .digest("hex") !== digest
    )
      throw Error(`BACKPORT_HASH_CHANGED:${entry.name}/${file}`);
  const pkg = JSON.parse(await readFile(`${base}/package.json`, "utf8"));
  if (pkg.name !== entry.name || pkg.version !== entry.localVersion || pkg.private !== true)
    throw Error("BACKPORT_IDENTITY_CHANGED");
}
for (const [consumer, name] of [
  ["micromatch", "braces"],
  ["@expo/cli/package.json", "node-forge"],
  ["@expo/code-signing-certificates", "node-forge"],
]) {
  const actual = createRequire(require.resolve(consumer))(name),
    expected = require(name);
  if (actual !== expected) throw Error(`UNPATCHED_TRANSITIVE_COPY:${consumer}`);
}
const uuid = createRequire(require.resolve("xcode"))("uuid/package.json");
if (uuid.version !== "11.1.1") throw Error("XCODE_UUID_NOT_PATCHED");
console.log("PASS: local backport hashes/inventory, consumer resolution, native Expo pin and patched UUID");
