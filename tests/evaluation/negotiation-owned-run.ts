import { designDigest, type NegotiationCell } from "./negotiation-plan.js";
import { constructNegotiationWorld, type NegotiationFixtureCell, type NegotiationWorld } from "./negotiation-world.js";
export type WorldSecrets = { rulesKey: string; tokenKey: string; encryptionKey: string };
export type OwnedWorldCheckpoint<C extends NegotiationFixtureCell = NegotiationCell> = {
  schemaVersion:
    | "pact.negotiation-owned-world.v1"
    | "pact.rc1-owned-world.v1"
    | "pact.rc2-owned-world.v1"
    | "pact.rc3-owned-world.v1"
    | "pact.rc4-owned-world.v1"
    | "pact.rc5-owned-world.v1"
    | "pact.rc6-owned-world.v1"
    | "pact.rc7-owned-world.v1"
    | "pact.rc8-owned-world.v1"
    | "pact.rc9-owned-world.v1";
  schema: string;
  nonce: string;
  worldId: string;
  cell: C;
  control: boolean;
  players: NegotiationWorld["players"];
  credentials: { kingdomId: string; accountId: string; token: string; holderId: string }[];
  secrets: WorldSecrets;
  openingOfferId: string | null;
  decisionStartGameTimeMs: number;
};
export type OwnedNegotiationWorld<C extends NegotiationFixtureCell = NegotiationCell> = Omit<
  NegotiationWorld<C>,
  "close"
> & {
  checkpoint(): OwnedWorldCheckpoint<C>;
  disconnect(): Promise<void>;
  activateLeases(): Promise<void>;
  renewLeases(): Promise<void>;
  refreshControlledSchedule(): Promise<void>;
  startNativeClock(): Promise<void>;
  tickNativeClock(): Promise<{ committed: boolean; gameTimeMs: number; sequence: string; nextTickDueAt: string }>;
  pauseClock(reason?: string): Promise<void>;
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
    /** Fixed source-owned synthetic setup, never deserialized operator code. */
    onPrepared?: (world: NegotiationWorld) => Promise<void>;
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
    !["E1", "E2", "E3", "E4"].includes(cell.stage) ||
    cell.profile.id !== "reactive-cognition" ||
    !["1", "1.1", "2"].includes(cell.profile.version)
  )
    throw Error("OWNED_NEGOTIATION_PROFILE_REQUIRED");
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
