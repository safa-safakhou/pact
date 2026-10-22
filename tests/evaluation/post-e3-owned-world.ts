import type { OwnedNegotiationWorld, OwnedWorldCheckpoint, WorldSecrets } from "./negotiation-owned-run.js";
import { designDigest } from "./negotiation-plan.js";
import { constructNegotiationWorld } from "./negotiation-world.js";
import { type PostE3Cell, type PostE3Protocol, validatePostE3Cell } from "./post-e3-rc2-plan.js";

/** Separate validated study entrypoint; the original owned-world entrypoint
 * still refuses R1 stages and specialist profiles. No destructive cleanup. */
export async function prepareOwnedRC1World<C extends PostE3Cell>(
  target: { pactUrl: string; nonce: string },
  protocol: PostE3Protocol,
  cell: C,
  options: {
    control?: boolean;
    retention: "preserve";
    secrets: WorldSecrets;
    checkpoint?: OwnedWorldCheckpoint<C>;
    onCreated?: (schema: string, worldId: string) => Promise<void>;
  },
): Promise<OwnedNegotiationWorld<C>> {
  validatePostE3Cell(protocol, cell);
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
    (c.schemaVersion !==
      (cell.study === "negotiation-r18"
        ? "pact.rc18-owned-world.v1"
        : cell.study === "negotiation-r17"
          ? "pact.rc17-owned-world.v1"
          : cell.study === "negotiation-r16"
            ? "pact.rc16-owned-world.v1"
            : cell.study === "negotiation-r15"
              ? "pact.rc15-owned-world.v1"
              : cell.study === "negotiation-r14"
                ? "pact.rc14-owned-world.v1"
                : cell.study === "negotiation-r13"
                  ? "pact.rc13-owned-world.v1"
                  : cell.study === "negotiation-r12"
                    ? "pact.rc12-owned-world.v1"
                    : cell.study === "negotiation-r11"
                      ? "pact.rc11-owned-world.v1"
                      : cell.study === "negotiation-r10"
                        ? "pact.rc10-owned-world.v1"
                        : cell.study === "negotiation-r9"
                          ? "pact.rc9-owned-world.v1"
                          : cell.study === "negotiation-r8"
                            ? "pact.rc8-owned-world.v1"
                            : cell.study === "negotiation-r7"
                              ? "pact.rc7-owned-world.v1"
                              : cell.study === "negotiation-r6"
                                ? "pact.rc6-owned-world.v1"
                                : cell.study === "negotiation-r5"
                                  ? "pact.rc5-owned-world.v1"
                                  : cell.study === "negotiation-r4"
                                    ? "pact.rc4-owned-world.v1"
                                    : cell.study === "negotiation-r3"
                                      ? "pact.rc3-owned-world.v1"
                                      : cell.study === "negotiation-r2"
                                        ? "pact.rc2-owned-world.v1"
                                        : "pact.rc1-owned-world.v1") ||
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

/** Same owned fixture implementation, separately validated R2 namespace. */
export const prepareOwnedRC2World = prepareOwnedRC1World;

/** New R3 checkpoint namespace with the repaired read-contract configuration. */
export const prepareOwnedRC3World = prepareOwnedRC1World;

/** Independent repaired-source R4 checkpoint namespace. */
export const prepareOwnedRC4World = prepareOwnedRC1World;

export const prepareOwnedRC5World = prepareOwnedRC1World;

export const prepareOwnedRC6World = prepareOwnedRC1World;

export const prepareOwnedRC7World = prepareOwnedRC1World;

export const prepareOwnedRC8World = prepareOwnedRC1World;

export const prepareOwnedRC9World = prepareOwnedRC1World;

export const prepareOwnedRC10World = prepareOwnedRC1World;

export const prepareOwnedRC11World = prepareOwnedRC1World;

export const prepareOwnedRC12World = prepareOwnedRC1World;

export const prepareOwnedRC13World = prepareOwnedRC1World;

export const prepareOwnedRC14World = prepareOwnedRC1World;

export const prepareOwnedRC15World = prepareOwnedRC1World;

export const prepareOwnedRC16World = prepareOwnedRC1World;

export const prepareOwnedRC17World = prepareOwnedRC1World;

export const prepareOwnedRC18World = prepareOwnedRC1World;
