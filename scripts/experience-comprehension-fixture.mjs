import { writeFileSync } from "node:fs";
import { resultSummary } from "../apps/web/src/result-summary.ts";
import { resourceRateFacts } from "../packages/domain/src/resource-facts.ts";

const entry = (category, code, currentFacts = []) => ({
  id: "synthetic-result",
  category,
  code,
  commandId: "11111111-1111-4111-8111-111111111111",
  nextStep: "Inspect current authorized records.",
  currentFacts,
});
const brief = (item, extra = {}) =>
  resultSummary(
    { status: "recorded", nextStep: "Read current state.", entries: item ? [item] : [], ...extra },
    "trader",
  );
const fixture = {
  kind: "synthetic comprehension only; no live player or external message",
  rates: resourceRateFacts("450", "150"),
  forecast: {
    currentStockWhole: "60",
    expectedEndingStockWhole: "90",
    assumption: "Scenario only: current production, troop upkeep and active signed supply flows continue.",
  },
  examples: {
    committed: brief(
      entry("committed", "COMMITTED", [
        { label: "Farm II", status: "completed", nextStep: "Choose your next objective." },
      ]),
    ),
    proposed: brief(entry("proposed", "COMMITTED")),
    failed: brief(entry("failed", "STOCK_LOW")),
    waiting: brief(
      entry("committed", "COMMITTED", [{ label: "Farm II", status: "active", nextStep: "Wait on the game clock." }]),
    ),
    approval: brief(
      entry("approval_needed", "APPROVAL_REQUIRED", [
        {
          label: "Exact human approval",
          status: "pending",
          nextStep: "Human: review exact terms.",
          reviewPath: "/pact/?approval=11111111-1111-4111-8111-111111111111",
        },
      ]),
    ),
    unknown: brief(undefined, { stale: true }),
  },
  authority: {
    agentMaySupplySignWithinMandate: true,
    humanOnlyContactAcceptance: true,
    humanOnlyAuthorityChanges: true,
  },
};
writeFileSync(
  "docs/implementation/reports/evidence/experience-comprehension-fixture.json",
  `${JSON.stringify(fixture, null, 2)}\n`,
);
