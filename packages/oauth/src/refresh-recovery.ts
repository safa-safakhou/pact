import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { OAuthError } from "./crypto.js";

export function recoveryKey(proof: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43}$/.test(proof) || Buffer.from(proof, "base64url").length !== 32)
    throw new OAuthError("INVALID_REQUEST");
  return createHash("sha256").update("pact.refresh-recovery.v1:").update(proof).digest();
}
export function sealRecovery(proof: string, binding: string, value: unknown): string {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", recoveryKey(proof), iv);
  cipher.setAAD(Buffer.from(binding));
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function openRecovery<T>(proof: string, binding: string, sealed: string): T {
  const bytes = Buffer.from(sealed, "base64url");
  const cipher = createDecipheriv("aes-256-gcm", recoveryKey(proof), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(binding));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString()) as T;
}
