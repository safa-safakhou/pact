import { glob, readFile } from "node:fs/promises";

const violations = [];
const importPattern = /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)["'](@pact\/[^"']+)["']/g;

const roots = process.env.BOUNDARY_ROOT
  ? [process.env.BOUNDARY_ROOT]
  : ["packages/platform/src", "packages/credential-vault/src", "packages/model-provider/src", "packages/evidence/src"];

for (const root of roots) {
  for await (const file of glob(`${root}/**/*.ts`)) {
    if (file.endsWith(".test.ts")) continue;
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      if (/^@pact\/(?:domain|kingdom|world|ledger|application)(?:\/|$)/.test(match[1] ?? "")) {
        violations.push(`${file}: reusable platform code cannot import ${match[1]}`);
      }
    }
  }
}

const sdkImportPattern = /(?:from\s+|import\s*\()["']([^"']+)["']/g;
const sdkForbiddenGlobal = /\b(?:window|document|navigator|localStorage|sessionStorage|fetch|WebSocket|EventSource)\b/;
for await (const file of glob("packages/client-sdk/src/**/*.ts")) {
  if (file.endsWith(".test.ts")) continue;
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(sdkImportPattern)) {
    const specifier = match[1] ?? "";
    if (/^(?:react(?:-native)?|@?telegram|expo|node:)/.test(specifier)) {
      violations.push(`${file}: client SDK imports host-specific runtime ${specifier}`);
    }
  }
  if (sdkForbiddenGlobal.test(source)) violations.push(`${file}: client SDK references a host-specific global`);
}

const privateCredentialCapability = /\b(?:CredentialKeyUnwrapper|CredentialResolver|RsaOaepPrivateKeyUnwrapper)\b/;
const privateSealCapability = /\b(?:SealSigner|SEAL_ENCRYPTION_KEY_BASE64)\b/;
for await (const file of glob("{services,workers}/**/*.ts")) {
  if (file.startsWith("workers/inference/") || file.endsWith(".test.ts")) continue;
  const source = await readFile(file, "utf8");
  if (privateCredentialCapability.test(source)) {
    violations.push(`${file}: credential unwrapping is restricted to the inference worker`);
  }
}
for await (const file of glob("{services,workers}/*/src/**/*.ts")) {
  if (file.startsWith("workers/rules/src/seal-") || file.endsWith(".test.ts")) continue;
  if (privateSealCapability.test(await readFile(file, "utf8")))
    violations.push(`${file}: Seal private-key capability is restricted to the signing worker`);
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Architecture boundaries are valid.");
}
