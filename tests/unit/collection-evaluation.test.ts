import { expect, it } from "vitest";
import { evaluateCollections } from "../../scripts/evaluation/collections.js";

it("never treats pieces or chat counts as negotiation/model/human acceptance", () => {
  const o = {
    case: "fixture",
    source: "synthetic_postgres_fixture",
    attempts: 100,
    rawMessages: 100,
    pieces: 1,
    instances: 0,
    setCompletions: 0,
    contractActivations: 0,
    changedDeliveringTerms: 0,
    positiveBilateralTicks: 0,
    repeatedGrants: 0,
    newGems: 0,
    quarantinedEvents: 0,
    modelCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    gpuGenerationMs: 0,
    p95ReadMs: null,
  };
  const report = evaluateCollections([o]);
  expect(report.antiFarmingChecks).toBe(true);
  expect(report.strategicModelQuality).toBeNull();
  expect(report.humanEnjoyment).toBeNull();
  expect(report.observations[0]?.contractActivations).toBe(0);
  expect(evaluateCollections([{ ...o, newGems: 1 }]).antiFarmingChecks).toBe(false);
  expect(() => evaluateCollections([{ ...o, source: "invented_live_success" }])).toThrow();
});
