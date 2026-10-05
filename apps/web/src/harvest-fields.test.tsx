import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HarvestFields, harvestOverlay } from "./harvest-fields.js";

describe("public harvest decoration", () => {
  it("maps all six authoritative weeks without changing facts", () => {
    for (const [index, percent] of [100, 100, 90, 80, 80, 100].entries()) {
      const c = { configured: true, week: index + 1, harvestPercent: percent, asOfGameTimeMs: 0 };
      const before = JSON.stringify(c);
      expect(harvestOverlay(c)).toBe(`experience/scene/harvest-${percent}.svg`);
      expect(JSON.stringify(c)).toBe(before);
    }
  });
  it("does not fabricate art for missing or inconsistent facts", () => {
    for (const c of [
      { configured: false },
      { configured: true, week: 4, harvestPercent: 100 },
      { configured: true, week: 7, harvestPercent: 80 },
    ])
      expect(harvestOverlay(c)).toBeNull();
  });
  it("always retains the exact schedule and labels paused/unknown clocks", () => {
    const c = { configured: true, week: 4, harvestPercent: 80 };
    expect(renderToStaticMarkup(<HarvestFields current={c} worldStatus="paused" />)).toContain("Clock paused");
    const html = renderToStaticMarkup(<HarvestFields current={{ configured: false }} worldStatus="unknown" />);
    expect(html).toContain("Clock status unavailable");
    expect(html).toContain("100% / 100% / 90% / 80% / 80% / 100%");
    expect(html).not.toContain("<img");
  });
});
