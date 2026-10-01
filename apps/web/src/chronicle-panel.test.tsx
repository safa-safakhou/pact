import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChroniclePanel, StoryCard } from "./chronicle-panel.js";

describe("public Chronicle interface", () => {
  it("separates recorded consequences and untrusted commentary, escaping player markup", () => {
    const html = renderToStaticMarkup(
      <StoryCard
        post={{
          id: "fixture",
          type: "story",
          version: 1,
          status: "published",
          title: "A test result",
          commentary: "<script>claim</script>",
          author: { handle: "fixture" },
          path: "/pact/?post=fixture",
          fact: {
            commandId: "receipt",
            outcome: "Command committed, not necessarily complete",
            recordedAt: "fixture",
            records: [],
            consequences: [{ record: "building:fixture", status: "completed", consequence: "Farm II completed" }],
          },
        }}
      />,
    );
    expect(html).toContain("Engine fact");
    expect(html).toContain("Player commentary");
    expect(html).toContain("Farm II completed");
    expect(html).not.toContain("<script>");
    expect(html).toContain("/pact/?post=fixture");
  });
  it("anonymous recipients cannot publish and notices never promise agreement", () => {
    const html = renderToStaticMarkup(<ChroniclePanel request={async () => ({})} canWrite={false} />);
    expect(html).not.toContain("Preview a notice or story");
    expect(html).toContain("no counterpart acceptance");
  });
  it("human publication starts at preview, without a fabricated outcome", () => {
    const html = renderToStaticMarkup(<ChroniclePanel request={async () => ({})} canWrite />);
    expect(html).toContain("Preview exactly what will be public");
    expect(html).not.toContain("Publish reviewed content");
  });
});
