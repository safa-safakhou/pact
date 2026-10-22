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

it("separates incoming requirements from outgoing caps without inventing opposite bounds or changing older texts", () => {
  const goals = design.families.flatMap((f) => Object.values(f.initialState.goals));
  goals.push({ ...goals[0], maximumSendPerHour: 4 });
  for (const source of goals) {
    const goal: Readonly<Record<string, unknown>> = Object.freeze({ ...source }),
      old = structuredClone(goal);
    const text = authoring.negotiationGoalText(goal, "external.v2"),
      n = JSON.parse(text);
    const { receive, minimumReceivePerHour, maximumSendPerHour, ...other } = old;
    expect(n).toMatchObject(other);
    expect(n.quantityUnit).toBe("whole resource units");
    expect(n.timeUnit).toBe("GAME hour");
    expect(n.scope).toBe("external peer supply; excludes local production; not communication allowance");
    if (receive !== undefined || minimumReceivePerHour !== undefined)
      expect(n.incoming).toEqual({
        ...(receive !== undefined ? { resource: receive } : {}),
        ...(minimumReceivePerHour !== undefined ? { minimumPerHour: minimumReceivePerHour } : {}),
      });
    else expect(n).not.toHaveProperty("incoming");
    if (maximumSendPerHour !== undefined) expect(n.outgoing).toEqual({ maximumPerHour: maximumSendPerHour });
    else expect(n).not.toHaveProperty("outgoing");
    expect(n.incoming ?? {}).not.toHaveProperty("maximumPerHour");
    expect(n.outgoing ?? {}).not.toHaveProperty("minimumPerHour");
    expect(goal).toEqual(old);
    expect(authoring.negotiationGoalText(goal, false)).toBe(JSON.stringify(old));
    expect(authoring.negotiationGoalText(goal, true)).toBe(
      JSON.stringify({
        ...old,
        quantityUnit: "whole resource units",
        timeUnit: "GAME hour",
        scope: "supply delivery rates; not communication allowance",
      }),
    );
    expect(authoring.negotiationGoalText(goal, "external.v1")).toBe(
      JSON.stringify({
        ...old,
        quantityUnit: "whole resource units",
        timeUnit: "GAME hour",
        scope: "external peer supply delivery rates; excludes local production; not communication allowance",
      }),
    );
  }
});
