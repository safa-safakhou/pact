import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KingdomScene, type SceneFacts, sceneState } from "./kingdom-scene.js";

const facts: SceneFacts = {
  audience: "owner",
  buildings: [
    { kind: "farm", level: 1 },
    { kind: "mine", level: 1 },
  ],
  builders: [{ kind: "farm", state: "active", instructionId: "committed-fixture" }],
};
describe("recorded settlement art", () => {
  it("retains completed art while work is active, without using a deadline", () => {
    expect(sceneState(facts)[0]).toMatchObject({ file: "experience/scene/farm-1.svg", working: true, level: 1 });
    const complete = {
      ...facts,
      buildings: [
        { kind: "farm", level: 2 },
        { kind: "mine", level: 2 },
      ],
      builders: [],
    };
    expect(sceneState(complete).map((b) => [b.file, b.working])).toEqual([
      ["experience/scene/farm-2.svg", false],
      ["experience/scene/mine-2.svg", false],
    ]);
  });
  it("omits scaffolding for waiting/canceled/idle work; keeps higher levels factual", () => {
    for (const state of ["waiting", "canceled", "idle"])
      expect(
        sceneState({ ...facts, builders: [{ kind: "farm", instructionId: "fixture", state }] }).every(
          (b) => !b.working,
        ),
      ).toBe(true);
    expect(sceneState({ ...facts, buildings: [{ kind: "farm", level: 6 }], builders: [] })[0]).toMatchObject({
      level: 6,
      illustratedLevel: 1,
    });
  });
  it("does not decorate public projections or include owner data in static URLs", () => {
    expect(sceneState({ ...facts, audience: "public" })).toEqual([]);
    expect(renderToStaticMarkup(<KingdomScene facts={{ ...facts, audience: "public" }} />)).toBe("");
    const html = renderToStaticMarkup(<KingdomScene facts={facts} />);
    expect(html).toContain("farm 1");
    expect(html).toContain("Active construction");
    expect(html).not.toContain("committed-fixture");
  });
});
