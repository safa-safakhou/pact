import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvitationPanel } from "./invitation-panel.js";

afterEach(() => vi.unstubAllGlobals());
const request = async () => ({});
describe("invitation entry controls", () => {
  it("shows an ordinary keyboard button to create an invitation only to a signed-in founder", () => {
    vi.stubGlobal("window", { location: { search: "", href: "https://pact.example/pact/" } });
    const html = renderToStaticMarkup(<InvitationPanel request={request} authenticated canWrite kingdomId="fixture" />);
    expect(html).toContain('aria-label="Invitations"');
    expect(html).toContain('type="button"');
    expect(html).toContain("Create contact invitation");
    expect(html).not.toContain("Accept contact");
    expect(renderToStaticMarkup(<InvitationPanel request={request} authenticated={false} canWrite={false} />)).toBe("");
  });
  it("provides an anonymous landing without an automatic acceptance control", () => {
    vi.stubGlobal("window", { location: { search: `?invite=${"A".repeat(32)}`, href: "https://pact.example/pact/" } });
    const html = renderToStaticMarkup(<InvitationPanel request={request} authenticated={false} canWrite={false} />);
    expect(html).toContain("Invitations");
    expect(html).not.toContain("Accept invitation");
    expect(html).not.toContain("Create contact invitation");
  });
});
