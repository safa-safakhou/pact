import { createHash } from "node:crypto";
import type { CommandEnvelope } from "@pact/contracts";

/** Hash the retry-sensitive command body. Actor identity is server-derived and excluded. */
export function canonicalPayloadHash(command: CommandEnvelope): string {
  const body = {
    schemaVersion: command.schemaVersion,
    commandId: command.commandId,
    expectedVersion: command.expectedVersion ?? null,
    action: command.action,
  };
  return createHash("sha256").update(JSON.stringify(body), "utf8").digest("hex");
}
