import { describe, expect, it } from "vitest";
import { isCouncilHumanLink } from "./council-links.js";

describe("Council human navigation", () => {
  const origin = "https://pact.tinyagenttools.com";
  it("opens the actual root approval review used by the server", () => {
    expect(isCouncilHumanLink(new URL("/?approval=00000000-0000-4000-8000-000000000001", origin), origin)).toBe(true);
  });
  it("opens first-party character editing and introductions", () => {
    for (const path of ["/?envoy=edit", "/?council=introductions"])
      expect(isCouncilHumanLink(new URL(path, origin), origin)).toBe(true);
  });
  it("rejects foreign origins and URLs carrying action parameters", () => {
    expect(isCouncilHumanLink(new URL("https://example.com/?envoy=edit"), origin)).toBe(false);
    expect(
      isCouncilHumanLink(new URL("/?approval=00000000-0000-4000-8000-000000000001&approve=true", origin), origin),
    ).toBe(false);
    expect(isCouncilHumanLink(new URL("/v1/game/building?envoy=edit", origin), origin)).toBe(false);
  });
});
