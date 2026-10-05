import { createECDH } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: node generate-web-push-keys.mjs SECRETS_DIRECTORY");
const root = resolve(directory);
mkdirSync(root, { recursive: true, mode: 0o700 });
const privatePath = join(root, "web_push_private_key"),
  publicPath = join(root, "web_push_public_key"),
  ecdh = createECDH("prime256v1");
const existing = existsSync(privatePath) ? readFileSync(privatePath, "utf8").trim() : "";
if (existing) ecdh.setPrivateKey(Buffer.from(existing, "base64url"));
else {
  ecdh.generateKeys();
  writeFileSync(privatePath, ecdh.getPrivateKey().toString("base64url") + "\n", { mode: 0o600 });
}
chmodSync(privatePath, 0o600);
const publicKey = ecdh.getPublicKey().toString("base64url");
writeFileSync(publicPath, publicKey + "\n", { mode: 0o600 });
console.log(publicKey);
