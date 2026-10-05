import { describe, expect, it } from "vitest";
import { type ResultReport, resultSummary } from "./result-summary.js";

const report = (category: string, status = "recorded"): ResultReport => ({
  status,
  nextStep: "Read current permissions.",
  entries: [
    {
      id: "result",
      category,
      code: category === "failed" ? "STOCK_LOW" : "COMMITTED",
      commandId: "receipt-real",
      nextStep: "Read the actual receipt.",
    },
  ],
});
describe("factual result brief", () => {
  it.each(["committed", "proposed", "failed"] as const)("preserves %s receipt", (category) => {
    expect(resultSummary(report(category), "trader")).toMatchObject({
      state: category,
      ambition: "trader",
      receiptId: "receipt-real",
    });
  });
  it("prioritizes current human review but hides stale links", () => {
    const input = report("committed");
    input.entries.unshift({
      id: "earlier",
      category: "approval_needed",
      code: "APPROVAL_REQUIRED",
      nextStep: "old",
      currentFacts: [
        {
          label: "Exact approval",
          status: "pending",
          nextStep: "Human: review exact terms.",
          reviewPath: "/pact/?approval=real",
        },
      ],
    });
    expect(resultSummary(input)).toMatchObject({
      state: "approval-needed",
      reviewPath: "/pact/?approval=real",
      nextStep: "Human: review exact terms.",
    });
    input.stale = true;
    expect(resultSummary(input).state).toBe("unknown");
    expect(resultSummary(input)).not.toHaveProperty("reviewPath");
  });
  it("distinguishes waiting, resolved approval and unknown", () => {
    expect(resultSummary(report("waiting")).state).toBe("waiting");
    const input = report("committed", "waiting");
    expect(resultSummary(input).state).toBe("waiting");
    input.status = "recorded";
    if (!input.entries[0]) throw new Error("FIXTURE_MISSING");
    input.entries[0].currentFacts = [{ label: "Exact approval", status: "approved", nextStep: "Inspect receipt." }];
    expect(resultSummary(input).state).toBe("committed");
    expect(resultSummary({ status: "recorded", entries: [], nextStep: "Read records." }).state).toBe("unknown");
  });
  it("uses current build wait rather than historical commit", () => {
    const input = report("committed");
    if (!input.entries[0]) throw new Error("FIXTURE_MISSING");
    input.entries[0].currentFacts = [{ label: "Farm II", status: "active", nextStep: "Wait on game clock." }];
    expect(resultSummary(input)).toMatchObject({
      state: "waiting",
      currentDecision: "Farm II: active",
      nextStep: "Wait on game clock.",
    });
    expect(resultSummary(input).authority).toContain("agent may supply.sign");
    expect(resultSummary(input).authority).toContain("require the human");
  });
});
