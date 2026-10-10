import { z } from "zod";
export const CollectionObservationSchema = z
  .object({
    case: z.string().min(1).max(120),
    source: z.literal("synthetic_postgres_fixture"),
    attempts: z.number().int().nonnegative(),
    rawMessages: z.number().int().nonnegative(),
    pieces: z.number().int().nonnegative(),
    instances: z.number().int().nonnegative(),
    setCompletions: z.number().int().nonnegative(),
    contractActivations: z.number().int().nonnegative(),
    changedDeliveringTerms: z.number().int().nonnegative(),
    positiveBilateralTicks: z.number().int().nonnegative(),
    repeatedGrants: z.number().int().nonnegative(),
    newGems: z.number().int().nonnegative(),
    quarantinedEvents: z.number().int().nonnegative(),
    modelCalls: z.literal(0),
    inputTokens: z.literal(0),
    outputTokens: z.literal(0),
    gpuGenerationMs: z.literal(0),
    p95ReadMs: z.number().nonnegative().nullable(),
  })
  .strict();
export function evaluateCollections(raw: unknown) {
  const observations = z.array(CollectionObservationSchema).min(1).parse(raw);
  return {
    schemaVersion: "pact.collection-offline-evaluation.v1",
    observations,
    antiFarmingChecks: observations.every((o) => o.repeatedGrants === 0 && o.newGems === 0),
    humanComprehension: null,
    humanEnjoyment: null,
    liveRetention: null,
    strategicModelQuality: null,
    qualification:
      "Counts describe separate synthetic database fixtures, not a live population. Collection progress, real bargaining outcomes, model intelligence, human enjoyment and compute cost are separate measures. No model generation occurred.",
  };
}
