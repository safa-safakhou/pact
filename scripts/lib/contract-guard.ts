import { createHash } from "node:crypto";
export function contractFingerprint(schema: unknown): string {
  return createHash("sha256").update(JSON.stringify(schema)).digest("hex");
}
/** Retain published v1 schemas; breaking evolution adds new versioned exports, not an overwritten v1. */
export function checkPublishedContracts(published: Record<string, string>, current: Record<string, unknown>): void {
  for (const [name, digest] of Object.entries(published)) {
    if (!(name in current) || contractFingerprint(current[name]) !== digest)
      throw new Error(`PUBLISHED_CONTRACT_CHANGED: ${name}; retain v1 and add a versioned contract/migration plan`);
  }
}
