import { rulesCatalog, upgradeCost } from "@pact/domain";
import { describe, expect, it } from "vitest";
import { type BuildingLevels, checkUpgrade, upgradeQuote } from "./building-rules.js";

const starting: BuildingLevels = {
  hall: 1,
  farm: 1,
  mine: 1,
  market: 1,
  storehouse: 1,
  barracks: 1,
  wall: 1,
};

describe("building upgrade prerequisites", () => {
  it("requires sequential levels and the Hall/Farm/Barracks/Storehouse dependency ladder", () => {
    const levels = { ...starting };
    expect(checkUpgrade(levels, "hall", 2)).toBe("hall_prerequisite");
    expect(checkUpgrade(levels, "farm", 3)).toBe("not_next_level");
    expect(checkUpgrade(levels, "farm", 7)).toBe("invalid_level");
    for (let target = 2; target <= 6; target += 1) {
      expect(checkUpgrade(levels, "farm", target)).toBe("ready");
      levels.farm = target;
      expect(checkUpgrade(levels, "barracks", target)).toBe("ready");
      levels.barracks = target;
      if (target < 6) {
        expect(checkUpgrade(levels, "storehouse", target)).toBe("ready");
        levels.storehouse = target;
      }
      expect(checkUpgrade(levels, "hall", target)).toBe("ready");
      levels.hall = target;
    }
    expect(checkUpgrade(levels, "hall", 7)).toBe("invalid_level");
    expect(checkUpgrade(levels, "mine", 2)).toBe("ready");
    expect(checkUpgrade({ ...starting, hall: 2, mine: 2 }, "mine", 4)).toBe("not_next_level");
    expect(checkUpgrade({ ...starting, hall: 2, mine: 3 }, "mine", 4)).toBe("hall_limit");
  });

  it("quotes exact target cost and the strictly next game-minute start boundary", () => {
    const quote = upgradeQuote("hall", 6, 123_456);
    expect(quote.iron).toBe(upgradeCost("hall", 6).iron);
    expect(quote.silver).toBe(upgradeCost("hall", 6).silver);
    expect(quote.constructionMinutes).toBe(72 * 60);
    expect(quote.dueGameTimeMs).toBe(180_000 + 72 * 60 * 60_000);
    expect(rulesCatalog.construction.activeCancelRefundPercent).toBe(50);
  });
});
