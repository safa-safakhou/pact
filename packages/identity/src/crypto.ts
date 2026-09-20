import {
  argon2,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { domainToASCII } from "node:url";
import { promisify } from "node:util";
import type { CompromisedPasswordChecker, SecretBox } from "./types.js";

const deriveArgon2 = promisify(argon2);
const passwordPrefix = "$pact-argon2id$v=1$m=65536,t=3,p=1";

export const baselineCompromisedPasswordDigests = [
  "2e2b24f8ee40bb847fe85bb23336a39ef5948e6b49d897419ced68766b16967a",
  "cbe6beb26479b568e5f15b50217c6c83c0ee051dc4e522b9840d8e291d6aaf46",
  "565881db2cc09de0cd280e4d89892987c10b23b5ef88cfea16830a69c9e9f5bb",
] as const;

export function normalizeEmail(input: string): string {
  const trimmed = input.trim();
  const separator = trimmed.lastIndexOf("@");
  if (separator <= 0 || separator === trimmed.length - 1) throw new Error("Invalid email");
  const local = trimmed.slice(0, separator).toLocaleLowerCase("en-US");
  const domain = domainToASCII(trimmed.slice(separator + 1)).toLowerCase();
  if (!domain || local.length > 64 || `${local}@${domain}`.length > 254 || /\s/.test(local)) {
    throw new Error("Invalid email");
  }
  return `${local}@${domain}`;
}

export function validatePassword(password: string): void {
  const codePoints = [...password].length;
  if (codePoints < 15 || codePoints > 128 || Buffer.byteLength(password, "utf8") > 1024) {
    throw new Error("Password must contain 15–128 Unicode code points and at most 1,024 UTF-8 bytes");
  }
}

async function derive(password: string, salt: Uint8Array): Promise<Buffer> {
  return deriveArgon2("argon2id", {
    message: password,
    nonce: salt,
    parallelism: 1,
    tagLength: 32,
    memory: 65_536,
    passes: 3,
  });
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `${passwordPrefix}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  const [prefix, version, parameters, saltValue, hashValue] = encoded.split("$").filter(Boolean);
  if (prefix !== "pact-argon2id" || version !== "v=1" || parameters !== "m=65536,t=3,p=1" || !saltValue || !hashValue) {
    return false;
  }
  const expected = Buffer.from(hashValue, "base64url");
  const actual = await derive(password, Buffer.from(saltValue, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export class TokenDigester {
  constructor(private readonly pepper: Uint8Array) {
    if (pepper.byteLength < 32) throw new Error("Identity token pepper must be at least 32 bytes");
  }

  issue(bytes = 32): { raw: string; hash: string } {
    const raw = randomBytes(bytes).toString("base64url");
    return { raw, hash: this.digest(raw) };
  }

  digest(value: string): string {
    return createHmac("sha256", this.pepper).update(value, "utf8").digest("hex");
  }
}

export class AesGcmSecretBox implements SecretBox {
  constructor(private readonly key: Uint8Array) {
    if (key.byteLength !== 32) throw new Error("Identity encryption key must contain exactly 32 bytes");
  }

  seal(plaintext: Uint8Array): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return [
      "v1",
      nonce.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  }

  open(ciphertext: string): Uint8Array {
    const [version, nonceValue, tagValue, encryptedValue] = ciphertext.split(".");
    if (version !== "v1" || !nonceValue || !tagValue || !encryptedValue) throw new Error("Invalid ciphertext");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(nonceValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]);
  }
}

export class LocalCompromisedPasswordChecker implements CompromisedPasswordChecker {
  readonly #digests: ReadonlySet<string>;

  constructor(sha256Digests: Iterable<string>) {
    this.#digests = new Set([...sha256Digests].map((value) => value.toLowerCase()));
  }

  async isCompromised(password: string): Promise<boolean> {
    const digest = createHash("sha256").update(password, "utf8").digest("hex");
    return this.#digests.has(digest);
  }
}

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(input: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += base32Alphabet[(value << (5 - bits)) & 31];
  return output;
}

function hotp(secret: Uint8Array, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(buffer).digest();
  const offset = (digest.at(-1) ?? 0) & 15;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return binary.toString().padStart(6, "0");
}

export function verifyTotp(secret: Uint8Array, code: string, now: Date): boolean {
  if (!/^[0-9]{6}$/.test(code)) return false;
  const counter = Math.floor(now.getTime() / 30_000);
  return [-1, 0, 1].some((offset) => hotp(secret, counter + offset) === code);
}

export function totpForFixture(secret: Uint8Array, now: Date): string {
  return hotp(secret, Math.floor(now.getTime() / 30_000));
}
