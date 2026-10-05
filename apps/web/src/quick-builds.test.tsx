import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { OwnerView } from "./game-app.js";
import { BuilderStatus, QuickBuilds, suggestedBuilds } from "./quick-builds.js";

function fixture(): OwnerView {
  return {
    ambition: "farmer",
    buildings: ["hall", "farm", "mine", "market", "wall", "barracks", "storehouse"].map((kind) => ({ kind, level: 1 })),
    balances: {
      iron: { ordinaryUnits: "12000", foundingAllowanceUnits: "120000" },
      silver: { ordinaryUnits: "12000", foundingAllowanceUnits: "60000" },
    },
    builders: [
      { slot: 1, instructionId: null, kind: null, state: null, dueGameTimeMs: null },
      { slot: 2, instructionId: null, kind: null, state: null, dueGameTimeMs: null },
    ],
    asOfGameTimeMs: 0,
    worldStatus: "running",
  } as unknown as OwnerView;
}
it("prioritizes ambition with catalog costs and removes queued and maximum upgrades", () => {
  const view = fixture();
  expect(suggestedBuilds(view)[0]).toMatchObject({
    building: "farm",
    from: 1,
    to: 2,
    before: 30,
    after: 45,
    iron: "40",
    silver: "20",
    minutes: 10,
    blocker: null,
  });
  view.builders[0] = { slot: 1, instructionId: "busy", kind: "farm", state: "active", dueGameTimeMs: 300000 };
  expect(suggestedBuilds(view).every((c) => c.building !== "farm")).toBe(true);
  view.buildings = view.buildings.map((b) => ({ ...b, level: 6 }));
  expect(suggestedBuilds(view)).toEqual([]);
});
it("shows prerequisite and stock blockers and disables commitments with no free slot", () => {
  const view = fixture();
  view.buildings = view.buildings.map((b) => (b.kind === "hall" ? b : { ...b, level: 2 }));
  expect(suggestedBuilds(view).every((c) => c.blocker === "Upgrade your Hall first")).toBe(true);
  view.buildings = view.buildings.map((b) => ({ ...b, level: 1 }));
  for (const stock of Object.values(view.balances)) {
    stock.ordinaryUnits = "0";
    stock.foundingAllowanceUnits = "0";
  }
  expect(suggestedBuilds(view).every((c) => c.blocker === "Need more Iron or Silver")).toBe(true);
});
it("keeps the free second builder visible while the first is active and explains two busy slots", () => {
  const view = fixture();
  view.builders[0] = { slot: 1, instructionId: "busy1", kind: "farm", state: "active", dueGameTimeMs: 300000 };
  expect(renderToStaticMarkup(<BuilderStatus view={view} />)).toContain("Free");
  view.builders[1] = { slot: 2, instructionId: "busy2", kind: "mine", state: "waiting", dueGameTimeMs: null };
  const html = renderToStaticMarkup(<QuickBuilds view={view} disabled={false} onBuild={() => {}} />);
  expect(html).toContain("Both builders are busy");
  expect(html).toContain('disabled=""');
  expect(renderToStaticMarkup(<BuilderStatus view={view} />)).not.toContain(">Free<");
});
