import { rulesCatalog } from "@pact/domain";
import { expect, it } from "vitest";
import { design, independentPlan } from "../evaluation/plan.js";

it("fixes independent worlds, seed splits and balanced arm order before any result", () => {
  const plan = independentPlan();
  expect(plan).toHaveLength(12 * 4 * 14);
  expect(new Set(plan.map((p) => p.replicaId)).size).toBe(plan.length);
  expect(independentPlan()).toEqual(plan);
  expect(plan.every((p) => p.worldIsolationRequired)).toBe(true);
  expect(design.seeds.development.every((s) => !design.seeds.heldOut.includes(s))).toBe(true);
  for (const scenario of design.scenarios)
    for (const seed of [...design.seeds.development, ...design.seeds.heldOut])
      expect(new Set(plan.filter((p) => p.scenario === scenario.id && p.seed === seed).map((p) => p.order)).size).toBe(
        14,
      );
  expect(
    plan.filter((p) => p.scenario === "ceiling_control").every((p) => p.goalEligibility === "owner_decision_required"),
  ).toBe(true);
  const base = rulesCatalog.levels[0];
  expect(base?.grainPerHour).toBe(30);
  expect(rulesCatalog.founding.homeGuardSpearmen * rulesCatalog.units.spearman.grainPerHour).toBe(8);
});

it("freezes six survival scenarios with explicit mechanics and no forced communication", () => {
  const expected = ["threat-help", "costly-help", "unneeded-help", "early-recall", "food-pressure", "silence-valid"];
  for (const id of expected) {
    const scenario = design.scenarios.find((s) => s.id === id);
    expect(scenario, id).toBeDefined();
    expect(scenario).toHaveProperty("fixture");
  }
  expect(design.scenarios.find((s) => s.id === "silence-valid")).toHaveProperty("requiresMessage", false);
});
