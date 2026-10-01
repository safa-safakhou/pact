import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeasonSummary, type SeasonView } from "./season-panel.js";

describe("season summary", () => {
  it("labels harvest, negative Fortune, pauses and pending equal-age scores", () => {
    const view: SeasonView = {
      current: {
        configured: true,
        number: 1,
        week: 4,
        harvestPercent: 80,
        schedule: [100, 100, 90, 80, 80, 100],
        asOfGameTimeMs: 0,
        nextTransitionGameTimeMs: 60000,
      },
      standings: [
        {
          kingdomId: "own",
          handle: "fixture",
          rank: 2,
          fortuneQuarterUnits: "-2400",
          denominator: "2400",
          band: "I-II",
        },
      ],
      cohorts: [
        {
          kingdomId: "own",
          handle: "fixture",
          status: "pending",
          rank: null,
          fortuneQuarterUnits: null,
          denominator: "2400",
          dueGameTimeMs: 60000,
          finalized: false,
        },
      ],
    };
    const html = renderToStaticMarkup(<SeasonSummary view={view} kingdomId="own" />);
    for (const text of [
      "Week 4/6",
      "80%",
      "-1.00",
      "pending",
      "not zero",
      "Pauses freeze",
      "carry over",
      "provisional",
    ])
      expect(html).toContain(text);
  });
  it("shows closing results and cosmetics without claiming finalized or small-band honors", () => {
    const view: SeasonView = {
      current: { configured: true, number: 2 },
      standings: [],
      cohorts: [],
      honors: {
        seasonNumber: 1,
        ownMeaningfulDays: 2,
        requiredMeaningfulDays: 3,
        ownCosmetics: ["medal.arrival", "banner.season.1"],
        results: [
          {
            kingdomId: "own",
            handle: "fixture",
            overallRank: 1,
            band: "I-II",
            bandRank: 1,
            eligible: true,
            meaningfulDays: 3,
            provisionalBorder: null,
            provisionalPlaque: true,
            eligibleBandPopulation: 2,
          },
        ],
      },
    };
    const html = renderToStaticMarkup(<SeasonSummary view={view} kingdomId="own" />);
    for (const text of [
      "provisional closing results",
      "provisional top-three plaque",
      "fewer than 100 eligible players",
      "not issued as final entitlements",
      "medal.arrival",
      "2/3",
    ])
      expect(html).toContain(text);
  });
});
