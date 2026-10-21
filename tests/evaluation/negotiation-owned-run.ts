import { designDigest, type NegotiationCell } from "./negotiation-plan.js";
import { constructNegotiationWorld, type NegotiationWorld } from "./negotiation-world.js";
export type WorldSecrets = { rulesKey: string; tokenKey: string; encryptionKey: string };
export type OwnedWorldCheckpoint = {
  schemaVersion: "pact.negotiation-owned-world.v1";
  schema: string;
  nonce: string;
  worldId: string;
  cell: NegotiationCell;
  control: boolean;
  players: NegotiationWorld["players"];
  credentials: { kingdomId: string; accountId: string; token: string; holderId: string }[];
  secrets: WorldSecrets;
  openingOfferId: string | null;
  decisionStartGameTimeMs: number;
};
export type OwnedNegotiationWorld = Omit<NegotiationWorld, "close"> & {
  checkpoint(): OwnedWorldCheckpoint;
  disconnect(): Promise<void>;
  activateLeases(): Promise<void>;
  renewLeases(): Promise<void>;
  leaseFacts(): Promise<
    { accountId: string; kingdomId: string; holderId: string; leaseId: string | null; live: boolean }[]
  >;
};
export async function prepareOwnedNegotiationWorld(
  target: { pactUrl: string; nonce: string },
  cell: NegotiationCell,
  options: {
    control?: boolean;
    secrets: WorldSecrets;
    retention: "preserve";
    checkpoint?: OwnedWorldCheckpoint;
    onCreated?: (schema: string, worldId: string) => Promise<void>;
  },
): Promise<OwnedNegotiationWorld> {
  if (
    options.retention !== "preserve" ||
    !options.secrets ||
    Object.keys(options.secrets).length !== 3 ||
    (["rulesKey", "tokenKey", "encryptionKey"] as const).some((name) => {
      const key = options.secrets[name];
      return (
        typeof key !== "string" ||
        Buffer.from(key, "base64").length !== 32 ||
        Buffer.from(key, "base64").toString("base64") !== key
      );
    })
  )
    throw Error("OWNED_WORLD_SECRETS_REQUIRED");
  if (
    cell.stage !== "E1" ||
    cell.profile.id !== "reactive-cognition" ||
    cell.profile.version !== "1" ||
    !["C01", "C02"].includes(cell.family)
  )
    throw Error("OWNED_E1_BASELINE_REQUIRED");
  const c = options.checkpoint;
  if (
    c &&
    (c.schemaVersion !== "pact.negotiation-owned-world.v1" ||
      !/^test_negotiation_[a-f0-9]{32}$/.test(c.schema) ||
      c.nonce !== target.nonce ||
      designDigest(c.cell) !== designDigest(cell) ||
      c.control !== (options.control === true) ||
      designDigest(c.secrets) !== designDigest(options.secrets))
  )
    throw Error("OWNED_CHECKPOINT_MISMATCH");
  const world = await constructNegotiationWorld(target, cell, options);
  const { close: _close, ...retained } = world;
  return retained;
}
