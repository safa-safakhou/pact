import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CourtPanel } from "./court-panel.js";

afterEach(() => vi.unstubAllGlobals());
describe("Court entry controls", () => {
  it("labels human creation and discovery and explains independent agreements", () => {
    vi.stubGlobal("window", { location: { search: "" } });
    const html = renderToStaticMarkup(<CourtPanel request={async () => ({})} kingdomId="fixture" canWrite />);
    expect(html).toContain("Communities, not shared armies or treasuries");
    expect(html).toContain('name="handle"');
    expect(html).toContain("Find Court");
    expect(html).toContain("Request approval");
    expect(html).toContain("Invitation only");
    expect(html).toContain('type="submit"');
    expect(html).not.toContain("Accept ownership");
  });
  it("keeps write controls disabled without a usable human session", () => {
    vi.stubGlobal("window", { location: { search: "" } });
    expect(
      renderToStaticMarkup(<CourtPanel request={async () => ({})} kingdomId="fixture" canWrite={false} />),
    ).toContain('disabled=""');
  });
});
