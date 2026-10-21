import type { OwnedNegotiationWorld, OwnedWorldCheckpoint, WorldSecrets } from "./negotiation-owned-run.js";
import { designDigest } from "./negotiation-plan.js";
import { constructNegotiationWorld } from "./negotiation-world.js";
import { type RC1Cell, type RC1Protocol, validateRC1Cell } from "./post-e3-plan.js";

/** Separate validated study entrypoint; the original owned-world entrypoint
 * still refuses R1 stages and specialist profiles. No destructive cleanup. */
export async function prepareOwnedRC1World(
  target: { pactUrl: string; nonce: string },
  protocol: RC1Protocol,
  cell: RC1Cell,
  options: {
    control?: boolean;
    retention: "preserve";
    secrets: WorldSecrets;
    checkpoint?: OwnedWorldCheckpoint<RC1Cell>;
    onCreated?: (schema: string, worldId: string) => Promise<void>;
  },
): Promise<OwnedNegotiationWorld<RC1Cell>> {
  validateRC1Cell(protocol, cell);
  if (
    options.retention !== "preserve" ||
    Object.keys(options.secrets).sort().join() !== "encryptionKey,rulesKey,tokenKey" ||
    Object.values(options.secrets).some(
      (v) =>
        typeof v !== "string" ||
        Buffer.from(v, "base64").length !== 32 ||
        Buffer.from(v, "base64").toString("base64") !== v,
    )
  )
    throw Error("OWNED_WORLD_SECRETS_REQUIRED");
  const c = options.checkpoint;
  if (
    c &&
    (c.schemaVersion !== "pact.rc1-owned-world.v1" ||
      !/^test_negotiation_[a-f0-9]{32}$/.test(c.schema) ||
      c.nonce !== target.nonce ||
      designDigest(c.cell) !== designDigest(cell) ||
      c.control !== (options.control === true) ||
      designDigest(c.secrets) !== designDigest(options.secrets))
  )
    throw Error("OWNED_CHECKPOINT_MISMATCH");
  const { close: _close, ...world } = await constructNegotiationWorld(target, cell, {
    ...options,
    rc1Protocol: protocol,
  });
  return world;
}
