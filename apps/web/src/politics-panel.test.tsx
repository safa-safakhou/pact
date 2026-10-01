import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PoliticsPanel } from "./politics-panel.js";

describe("human political decisions", () => {
  it("labels exact human publication and mutual signatures without invented authority", () => {
    const html = renderToStaticMarkup(<PoliticsPanel request={async () => ({})} kingdomId="fixture" canWrite />);
    expect(html).toContain("Articles and allegiance");
    expect(html).toContain("no tribute, troop control");
    expect(html).toContain("creates no executable agreement");
    expect(html).toContain("The other human must also agree");
    expect(html).toContain('name="direction"');
    expect(html).toContain('type="checkbox" required=""');
  });
  it("disables publication and proposal writes without a usable human session", () => {
    const html = renderToStaticMarkup(
      <PoliticsPanel request={async () => ({})} kingdomId="fixture" canWrite={false} />,
    );
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("Sign exact allegiance");
  });
});
