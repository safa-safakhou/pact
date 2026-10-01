import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvidencePanel } from "./evidence-panel.js";

describe("evidence viewer boundaries", () => {
  it("labels byte selection, context and exact human publication review", () => {
    const html = renderToStaticMarkup(<EvidencePanel request={async () => ({})} canWrite />);
    expect(html).toContain("UTF-8 byte ranges");
    expect(html).toContain("not an accusation");
    expect(html).toContain("Omitted originals are never available");
    expect(html).toContain("original scout only");
    expect(html).not.toContain("Publish reviewed evidence");
  });
  it("disables private preview without a usable human session", () => {
    expect(renderToStaticMarkup(<EvidencePanel request={async () => ({})} canWrite={false} />)).toContain(
      'disabled=""',
    );
  });
});
