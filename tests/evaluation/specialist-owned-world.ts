import { z } from "zod";
import { readNegotiationEvidence } from "./negotiation-outcome.js";
import {
  type OwnedNegotiationWorld,
  type OwnedWorldCheckpoint,
  prepareOwnedNegotiationWorld,
  type WorldSecrets,
} from "./negotiation-owned-run.js";
import { designDigest, negotiationPlan } from "./negotiation-plan.js";

const hash = z.string().regex(/^[a-f0-9]{64}$/),
  revision = z.string().regex(/^[a-f0-9]{40}$/);
const descriptorSchema = z
  .object({
    id: z.string().regex(/^KQ1:(resources-diplomacy|full):(advisory|guarded):(existing-goal|changed-consent-reserve)$/),
    configurationDigest: hash,
    scenario: z.enum(["existing-goal", "changed-consent-reserve"]),
    sources: z.object({ fleet: revision, pact: revision }).strict(),
    modelDigest: hash,
    policyDigest: hash,
  })
  .strict();
export type SpecialistWorldDescriptor = z.infer<typeof descriptorSchema>;
const terms = {
  aToB: { resource: "iron" as const, wholePerHour: 2 },
  bToA: { resource: "silver" as const, wholePerHour: 1 },
  aBond: null,
  bBond: null,
  durationHours: 1 as const,
  noticeHours: 0 as const,
};
export type SpecialistWorldCheckpoint = {
  schemaVersion: "pact.specialist-owned-world.v1";
  descriptorDigest: string;
  world: OwnedWorldCheckpoint;
};
export type OwnedSpecialistWorld = {
  worldId: string;
  pool: OwnedNegotiationWorld["pool"];
  accountId: string;
  actorId: string;
  peerId: string;
  actor: ReturnType<OwnedNegotiationWorld["actor"]>;
  offer: { id: string; version: number; terms: typeof terms };
  checkpoint(): SpecialistWorldCheckpoint;
  disconnect(): Promise<void>;
  activateLeases(): Promise<void>;
  renewLeases(): Promise<void>;
  leaseFacts: OwnedNegotiationWorld["leaseFacts"];
  advanceTo(minute: number): Promise<void>;
  refreshControlledSchedule(): Promise<void>;
  pauseClock(reason?: string): Promise<void>;
  applyCounterexample(): Promise<void>;
  evidence(): Promise<{
    actualFullDelivery: boolean;
    sourceRefs: string[];
    raw: Awaited<ReturnType<typeof readNegotiationEvidence>>;
  }>;
};

/** Reuses canonical C01 *bootstrap geometry only*. No negotiation control,
 * assessment or qualification is produced. KQ1 owns its separate descriptor,
 * scripted contact/peer-signature prefix and exact model-kingdom owner intent. */
export async function prepareOwnedSpecialistWorld(
  target: { pactUrl: string; nonce: string },
  raw: unknown,
  options: {
    retention: "preserve";
    secrets: WorldSecrets;
    checkpoint?: SpecialistWorldCheckpoint;
    onCreated?: (schema: string, worldId: string) => Promise<void>;
  },
): Promise<OwnedSpecialistWorld> {
  const descriptor = descriptorSchema.parse(raw),
    descriptorDigest = designDigest(descriptor);
  if (!descriptor.id.endsWith(`:${descriptor.scenario}`)) throw Error("KQ1_SCENARIO_MISMATCH");
  if (
    options.checkpoint &&
    (options.checkpoint.schemaVersion !== "pact.specialist-owned-world.v1" ||
      options.checkpoint.descriptorDigest !== descriptorDigest)
  )
    throw Error("KQ1_CHECKPOINT_MISMATCH");
  const bootstrap = negotiationPlan("E2", {
    sources: descriptor.sources,
    modelDigest: descriptor.modelDigest,
    policyDigest: descriptor.policyDigest,
    selectedProfile: { id: "reactive-cognition", version: "2" },
  }).find((c) => c.family === "C01" && c.seed === 11);
  if (!bootstrap) throw Error("KQ1_BOOTSTRAP_MISSING");
  const { checkpoint, ...setupOptions } = options;
  const world = await prepareOwnedNegotiationWorld(target, bootstrap, {
    ...setupOptions,
    ...(checkpoint ? { checkpoint: checkpoint.world } : {}),
    onPrepared: async (w) => {
      const peer = w.players[0],
        own = w.players[1],
        a = w.actor(peer.kingdomId),
        b = w.actor(own.kingdomId);
      const asked = await a.dispatch({
        kind: "game.contact.request",
        recipientKingdomId: own.kingdomId,
        note: "Disclosed KQ1 scripted reference peer",
      });
      const contact = Object.keys(asked.recordVersions).find((k) => k.startsWith("contact-request:"));
      if (
        !contact ||
        (
          await b.dispatch({
            kind: "game.contact.answer",
            requestId: contact.slice("contact-request:".length),
            accept: true,
          })
        ).code !== "COMMITTED"
      )
        throw Error("KQ1_CONTACT_SETUP_FAILED");
      const proposed = await a.dispatch({
        kind: "game.supply.offer",
        counterpartyKingdomId: own.kingdomId,
        terms,
        expiryMinutes: 60,
      });
      if (
        proposed.code !== "COMMITTED" ||
        (await a.dispatch({ kind: "game.supply.sign", offerId: proposed.commandId, version: 1 })).code !== "COMMITTED"
      )
        throw Error("KQ1_PEER_SETUP_FAILED");
      const parameters = {
        offerId: proposed.commandId,
        version: 1,
        counterpartyKingdomId: peer.kingdomId,
        termsJson: JSON.stringify(terms),
        minimumIron: "0",
        minimumSilver: "1000",
        minimumGrain: "0",
        assessmentDeadlineGameTimeMs: "7200000",
      };
      await w.ownerSetGoal(
        1,
        JSON.stringify({
          objective:
            "Receive the exact peer-signed one-hour exchange, preserving these reserves; create and retain this exact goal before later reuse. A receipt is not delivery.",
          routine: { kind: "evaluate_offer_for_existing_supply_goal@1", parameters },
        }),
      );
      await w.pool.query(
        "CREATE TABLE specialist_fixture_identity(singleton boolean PRIMARY KEY CHECK(singleton),cell_id text NOT NULL,descriptor_digest text NOT NULL,offer_id uuid NOT NULL,counterexample_applied boolean NOT NULL DEFAULT false)",
      );
      await w.pool.query(
        "INSERT INTO specialist_fixture_identity(singleton,cell_id,descriptor_digest,offer_id) VALUES(true,$1,$2,$3)",
        [descriptor.id, descriptorDigest, proposed.commandId],
      );
    },
  });
  try {
    const row = (
      await world.pool.query(
        "SELECT cell_id,descriptor_digest,offer_id FROM specialist_fixture_identity WHERE singleton",
      )
    ).rows[0];
    if (row?.cell_id !== descriptor.id || row?.descriptor_digest !== descriptorDigest)
      throw Error("KQ1_CHECKPOINT_MISMATCH");
    const peer = world.players[0],
      own = world.players[1],
      actor = world.actor(own.kingdomId);
    return {
      worldId: world.worldId,
      pool: world.pool,
      accountId: own.accountId,
      actorId: own.kingdomId,
      peerId: peer.kingdomId,
      actor,
      offer: { id: row.offer_id, version: 1, terms },
      checkpoint: () => ({
        schemaVersion: "pact.specialist-owned-world.v1",
        descriptorDigest,
        world: world.checkpoint(),
      }),
      disconnect: () => world.disconnect(),
      activateLeases: () => world.activateLeases(),
      renewLeases: () => world.renewLeases(),
      leaseFacts: () => world.leaseFacts(),
      refreshControlledSchedule: () => world.refreshControlledSchedule(),
      pauseClock: (r) => world.pauseClock(r),
      advanceTo: async (minute) => {
        if (!Number.isSafeInteger(minute) || minute < 0 || minute > 120) throw Error("KQ1_GAME_HORIZON");
        await world.advanceTo(minute);
      },
      applyCounterexample: async () => {
        if (descriptor.scenario !== "changed-consent-reserve") throw Error("KQ1_COUNTEREXAMPLE_NOT_PLANNED");
        const updated = await world.pool.query(
          "UPDATE specialist_fixture_identity SET counterexample_applied=true WHERE singleton AND NOT counterexample_applied RETURNING offer_id",
        );
        if (updated.rowCount !== 1) throw Error("KQ1_COUNTEREXAMPLE_ALREADY_APPLIED");
        // A partial transition is retained and cannot be silently retried.
        await world.ownerSetSupplyPermission(1, false);
        const receipt = await world
          .actor(peer.kingdomId)
          .dispatch({ kind: "game.supply.withdraw", offerId: row.offer_id });
        if (receipt.code !== "COMMITTED") throw Error("KQ1_COUNTEREXAMPLE_TRANSITION_FAILED");
      },
      evidence: async () => {
        const raw = await readNegotiationEvidence(world),
          relevant = raw.contracts.filter(
            (c) =>
              c.offerId === row.offer_id &&
              c.offerVersion === 1 &&
              c.kingdomA === peer.kingdomId &&
              c.kingdomB === own.kingdomId &&
              designDigest(c.terms) === designDigest(terms),
          );
        const actualFullDelivery =
          relevant.length === 1 &&
          relevant.every(
            (c) =>
              c.status === "expired" &&
              BigInt(c.endGameTimeMs) <= BigInt(raw.horizonGameTimeMs) &&
              c.flows.length === 2 &&
              c.flows.every(
                (f) =>
                  BigInt(f.dueUnits) > 0n &&
                  f.dueUnits === f.deliveredUnits &&
                  f.overflowUnits === "0" &&
                  f.failedInstallments === 0,
              ),
          );
        return {
          actualFullDelivery,
          sourceRefs: [...raw.coverage.sourceRefs, ...relevant.flatMap((c) => c.sourceRefs)],
          raw,
        };
      },
    };
  } catch (error) {
    await world.disconnect();
    throw error;
  }
}
