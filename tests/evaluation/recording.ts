import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { design } from "./plan.js";
import { readScenarioOutcome } from "./scenarios.js";
import { evaluationWorld } from "./world.js";

const count = z.number().int().nonnegative(),
  units = z.string().regex(/^(0|[1-9][0-9]*)$/),
  text = z.string().max(2000);
const Outcome = z
  .object({
    schemaVersion: z.literal("pact.scenario-outcome.v1"),
    evidence: z.literal("deterministic_fake"),
    scenario: text,
    replicaId: text,
    split: z.enum(["development", "heldOut"]),
    seed: z.number().int(),
    rulesId: text,
    environmentTimeMs: units,
    garrisonFulfilment: z.enum(["fulfilled", "defaulted", "pending", "not_applicable"]),
    defenseResult: z.enum(["won", "lost", "pending", "not_applicable"]),
    motiveProven: z.literal(false),
    obligations: z.object({ due: count, fulfilled: count, defaulted: count, pending: count }).strict(),
    losses: z
      .object({
        ownTroops: count,
        hostedTroops: count,
        lootedUnits: z.object({ iron: units, silver: units, grain: units }).strict(),
      })
      .strict(),
    upkeep: z.object({ shortageMinutes: count, coveredMinutes: count }).strict(),
    sourceRefs: z.array(text).max(100),
    coverage: z
      .object({
        opponentPrivateState: z.literal(false),
        privatePeerText: z.literal(false),
        validWait: z.boolean(),
        obligations: text,
        losses: text,
        upkeep: text,
      })
      .strict(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.obligations.due !== v.obligations.fulfilled + v.obligations.defaulted ||
      v.upkeep.shortageMinutes > v.upkeep.coveredMinutes
    )
      c.addIssue({ code: "custom", message: "Invalid denominator" });
  });
export const ScenarioRecording = z
  .object({
    schemaVersion: z.literal("pact.scenario-recording.v1"),
    designDigest: z.string().regex(/^[a-f0-9]{64}$/),
    outcome: Outcome,
    coverage: z.literal(
      "Synthetic authoritative readback; no peer text, inference or hidden state. Playback does not independently certify an imported file.",
    ),
  })
  .strict();
const designDigest = () => createHash("sha256").update(JSON.stringify(design)).digest("hex");
export async function recordScenario(
  w: Parameters<typeof readScenarioOutcome>[0],
  actor: Parameters<typeof readScenarioOutcome>[1],
) {
  return ScenarioRecording.parse({
    schemaVersion: "pact.scenario-recording.v1",
    designDigest: designDigest(),
    outcome: await readScenarioOutcome(w, actor),
    coverage:
      "Synthetic authoritative readback; no peer text, inference or hidden state. Playback does not independently certify an imported file.",
  });
}
/** Pure file playback. No game/world handles or provider dependencies. */
export function playbackRecordedScenario(recording: unknown) {
  return ScenarioRecording.parse(recording).outcome;
}
/** A separately created isolated initial-fixture branch, never a restoration of unrecorded historical state. */
export async function scenarioBranch(admin: Pool, url: string, recording: unknown, arm: string) {
  const parsed = ScenarioRecording.parse(recording);
  if (parsed.designDigest !== designDigest()) throw Error("FROZEN_DESIGN_MISMATCH");
  const o = parsed.outcome,
    branch = await evaluationWorld(admin, url, `${o.scenario}:${o.seed}:${arm}`);
  return {
    ...branch,
    branch: {
      kind: "fresh_fixture_branch" as const,
      sourceReplicaId: o.replicaId,
      sourceEnvironmentTimeMs: o.environmentTimeMs,
      initialEnvironmentTimeMs: "0",
      coverage:
        "Independent sandbox schema from frozen starting conditions; no model calls. A seed never guarantees identical LLM choices.",
    },
  };
}
