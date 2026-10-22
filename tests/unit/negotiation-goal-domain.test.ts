import { expect, it } from "vitest";
import design from "../evaluation/negotiation-design.json" with { type: "json" };
import * as authoring from "../evaluation/negotiation-goal.js";

it("labels every objective's resource quantities and GAME clock without changing a numeric objective or legacy bytes", () => {
  expect(authoring.negotiationGoalText).toBeTypeOf("function");
  const goals = design.families.flatMap((f) => Object.values(f.initialState.goals));
  goals.push({ ...goals[0], maximumSendPerHour: 4 });
  for (const source of goals) {
    const goal = Object.freeze({ ...source }),
      original = structuredClone(goal);
    expect(authoring.negotiationGoalText(goal, false)).toBe(JSON.stringify(original));
    const labelled = JSON.parse(authoring.negotiationGoalText(goal, true));
    expect(labelled).toMatchObject({
      ...original,
      quantityUnit: "whole resource units",
      timeUnit: "GAME hour",
      scope: "supply delivery rates; not communication allowance",
    });
    expect(labelled).not.toHaveProperty("messagesPerHour");
    expect(goal).toEqual(original);
  }
});
