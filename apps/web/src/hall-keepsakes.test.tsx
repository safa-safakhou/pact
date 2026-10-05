import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { contextOwner, emptyContextOwner } from "./experience-context-fixtures.js";
import { HallKeepsakes } from "./hall-keepsakes.js";

describe("private read-only Hall", () => {
  it("renders exactly three earliest retained records with stable dates and IDs across reload", () => {
    const view = emptyContextOwner();
    if (!view.consequences) throw Error("fixture");
    view.consequences.firstRetained = {
      build: { recordId: "first-build", occurredGameTimeMs: 0, summary: "farm level 2 completed" },
      contact: { recordId: "peer:10", occurredGameTimeMs: 10, summary: "Contact accepted with @peer" },
      delivery: { recordId: "first-contract", occurredGameTimeMs: 60000, summary: "Received 600 marked grain" },
    };
    const one = renderToStaticMarkup(<HallKeepsakes owner={contextOwner} view={view} />);
    const reload = renderToStaticMarkup(<HallKeepsakes owner={contextOwner} view={structuredClone(view)} />);
    expect(one).toBe(reload);
    expect(one.match(/data-keepsake=/g)).toHaveLength(3);
    expect(one).toContain("1970-01-01T00:01:00.000Z");
    expect(one).toContain("first-contract");
    expect(one.match(/href="\/v1\/world\/kingdoms\/preview-owner"/g)).toHaveLength(3);
    expect(one).not.toContain("/world/owner");
    expect(one).not.toContain("<button");
    expect(one).toContain("no game currency");
  });
  it("does not reconstruct missing/purged/proposed history or expose another owner", () => {
    const view = emptyContextOwner();
    const missing = renderToStaticMarkup(<HallKeepsakes owner={contextOwner} view={view} />);
    expect(missing.match(/Retained accomplishment unavailable/g)).toHaveLength(3);
    if (!view.consequences) throw Error("fixture");
    view.consequences.firstRetained = {
      build: { recordId: "PRIVATE", occurredGameTimeMs: 0, summary: "PRIVATE SUMMARY" },
      contact: null,
      delivery: null,
    };
    for (const props of [
      { owner: "outsider", view },
      { owner: contextOwner, view, stale: true },
      { owner: contextOwner, view: { ...view, audience: "public" } },
    ]) {
      const html = renderToStaticMarkup(<HallKeepsakes {...props} />);
      expect(html).not.toContain("PRIVATE");
      expect(html.match(/Retained accomplishment unavailable/g)).toHaveLength(3);
    }
  });
});
