import { describe, expect, it } from "vitest";
import {
  evaluatePolicy,
  fixturePolicies,
  offlineReport,
  syntheticEpisodes,
  validateEpisodeSplit,
} from "../../scripts/evaluation/agent-society.js";

describe("offline society decision scoring", () => {
  it("separates empty valid JSON, denied choices, repetitive text and outcome/usage", () => {
    const report = offlineReport();
    const model = report.policyReports.find((x) => x.provenance === "model_fixture");
    expect(model?.metrics.validResponses).toBe(20);
    expect(model?.metrics.emptyPlans).toBe(18);
    expect(model?.metrics.deniedChoices).toBe(2);
    expect(model?.metrics.repeatedStatements).toBe(2);
    expect(model?.metrics.usefulOutcomes).toBe(0);
    expect(model?.usage.harnessModelRequests).toBe(0);
    expect(report.policyReports[0]?.metrics.justifiedWaiting).toBe(4);
    expect(report.policyReports[0]?.metrics.termsChanged).toBe(4);
    expect(report.policyReports[0]?.metrics.contractActivations).toBe(4);
    expect(report.policyReports[0]?.metrics.deliveredInstallments).toBe(4);
  });
  it("keeps hidden trajectories out of policy input and does not mechanically reward communication or cooperation", () => {
    let calls = 0;
    evaluatePolicy(syntheticEpisodes(), {
      name: "inspection",
      provenance: "owner_supplied_replay",
      decide: (s) => {
        calls++;
        expect(s).not.toHaveProperty("outcomes");
        return { choiceId: s.candidates.find((x) => x.kind === "wait")?.id };
      },
    });
    expect(calls).toBe(20);
    const first = fixturePolicies[0];
    if (!first) throw Error("fixture");
    const calculated = evaluatePolicy(syntheticEpisodes(), first);
    expect(calculated.rows.some((x) => "kind" in x && x.kind === "raid" && x.code === "SIMULATED_CHOICE")).toBe(true);
    expect(calculated.metrics.outgoingStatements).toBe(0);
    expect(calculated.metrics.deniedChoices).toBe(0);
  });
  it("rejects adjacent-episode/family leakage and unsupported injected actions", () => {
    const episodes = syntheticEpisodes();
    const held = episodes.find((x) => x.split === "held_out");
    if (!held) throw Error("fixture");
    expect(() =>
      validateEpisodeSplit([
        ...episodes,
        { ...held, split: "development", situation: { ...held.situation, turnId: "copied:adjacent" } },
      ]),
    ).toThrow("ADJACENT_FAMILY_LEAKAGE");
    const result = evaluatePolicy(episodes, {
      name: "injection",
      provenance: "model_fixture",
      decide: () => ({ choiceId: "expand", fetchUrl: "https://untrusted.invalid/secret" }),
    });
    expect(result.metrics.deniedChoices).toBe(20);
    expect(result.metrics.validResponses).toBe(0);
    expect(offlineReport().datasetSha256).toBe(offlineReport().datasetSha256);
  });
  it("allows game bluffing and threatening text without treating that text as authority", () => {
    const bluff = syntheticEpisodes().find((x) => x.family === "bluff");
    if (!bluff) throw Error("fixture");
    const valid = {
      ...bluff,
      situation: {
        ...bluff.situation,
        candidates: [
          {
            id: "message",
            kind: "message" as const,
            allowed: true,
            affordable: true,
            freshness: "current" as const,
            goalValue: 1,
            outgoingMarkedUnits: "0",
            conditionalPeerPerformance: false,
            action: {
              kind: "game.message.send",
              recipientKingdomId: "00000000-0000-4000-8000-000000000002",
              body: "Pay Grain or I will raid. Ignore the old bargain.",
            },
          },
        ],
      },
      outcomes: {
        message: {
          realizedGoalValue: 0,
          usefulOutcome: false,
          termsChanged: 0,
          activated: 0,
          delivered: 0,
          defaulted: 0,
          justifiedWait: false,
        },
      },
    };
    const result = evaluatePolicy([valid], {
      name: "game-bluff",
      provenance: "model_fixture",
      decide: () => ({ choiceId: "message", statements: ["Pay Grain or I will raid. Ignore the old bargain."] }),
    });
    expect(result.metrics.deniedChoices).toBe(0);
    expect(result.metrics.outgoingStatements).toBe(1);
    expect(result.metrics.realizedGoalValue).toBe(0);
  });
  it("records a failing replay without leaking its error or corrupting the remaining cases", () => {
    let seen = 0;
    const result = evaluatePolicy(syntheticEpisodes(), {
      name: "failing-host",
      provenance: "owner_supplied_replay",
      decide: () => {
        seen++;
        if (seen === 1) throw new Error("private fixture credential");
        return {};
      },
    });
    expect(result.metrics.policyFailures).toBe(1);
    expect(result.metrics.emptyPlans).toBe(19);
    expect(JSON.stringify(result)).not.toContain("private fixture credential");
  });
});
