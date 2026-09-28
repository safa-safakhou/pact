import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionCharges, Kingdom } from "./game-app.js";

function kingdom(level: number, queued = false): string {
  const view: ComponentProps<typeof Kingdom>["view"] = {
    audience: "owner",
    profile: { kingdomId: "synthetic-kingdom", handle: "synthetic", displayName: "Synthetic" },
    asOfGameTimeMs: 1790000000000,
    committedTickSequence: "1",
    worldStatus: "active",
    balances: {},
    buildings: [{ kind: "farm", level }],
    builders: [
      {
        slot: 1,
        instructionId: queued ? "synthetic-instruction" : null,
        kind: queued ? "farm" : null,
        state: queued ? "waiting" : null,
        dueGameTimeMs: null,
      },
    ],
    troops: [],
    training: [],
    upkeep: { perMinuteUnits: "0", hungry: false },
    contracts: [],
    raids: [],
    scouts: [],
    threats: [],
    records: [],
    forecast: { throughGameTimeMs: 1790003600000, assumption: "Synthetic", expected: {} },
  };
  return renderToStaticMarkup(
    createElement(Kingdom, {
      view,
      busy: false,
      act: async () => undefined,
      social: null,
      kingdomId: view.profile.kingdomId,
      onPeople: () => undefined,
    }),
  );
}

describe("construction guidance", () => {
  it("derives the next exact level from the committed building rather than resetting to II", () => {
    expect(kingdom(1)).toContain('readOnly="" value="2"');
    const developed = kingdom(3);
    expect(developed).toContain('readOnly="" value="4"');
    expect(developed).toContain("Next upgrade: farm 3 → 4");
    expect(developed).toContain("Missing stock or prerequisites can leave an instruction waiting");
    expect(developed).not.toContain('disabled="">Queue upgrade');
  });

  it("does not offer a downgrade or level VII at the development cap", () => {
    const html = kingdom(6);
    expect(html).toContain('disabled="">Maximum level reached');
    expect(html).toContain("Level VI is the development cap.");
    expect(html).not.toContain('value="7"');
  });

  it("explains a queued building without hiding its cancellation control", () => {
    const html = kingdom(3, true);
    expect(html).toContain('disabled="">Upgrade already queued');
    expect(html).toContain("Cancel slot 1");
  });
});

describe("shared action charge guidance", () => {
  it("shows exact pools, regeneration and the exhausted warning without inventing a client-side allowance", () => {
    const html = renderToStaticMarkup(
      createElement(ActionCharges, {
        charges: [
          {
            kind: "scout",
            available: 0,
            capacity: 4,
            regenerationHours: 6,
            nextRegenerationGameTimeMs: 1790000000000,
            retryAtGameTimeMs: 1790000000000,
          },
          {
            kind: "raid",
            available: 3,
            capacity: 3,
            regenerationHours: 8,
            nextRegenerationGameTimeMs: null,
            retryAtGameTimeMs: null,
          },
        ],
      }),
    );
    expect(html).toContain("scout: 0 / 4");
    expect(html).toContain("raid: 3 / 3");
    expect(html).toContain("No charges available");
    expect(html).toContain("Pool full.");
    expect(html).toContain("game time.");
    expect(html).toContain("Shared by manual play and agents");
    expect(html).toContain("Regenerates one every 6 game hours");
  });

  it("does not manufacture full pools when an older snapshot has no charge data", () => {
    expect(renderToStaticMarkup(createElement(ActionCharges, { charges: [] }))).toBe("");
  });
});
