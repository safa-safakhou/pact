import { describe, expect, it } from "vitest";
import { resolvePactOrigin, telegramConfirmationUrl } from "./urls.js";

describe("Telegram public URLs", () => {
  it("derives the shared PACT root from the nested Telegram base", () => {
    expect(resolvePactOrigin("/pact/telegram/", undefined, "https://pact.example").toString()).toBe(
      "https://pact.example/pact/",
    );
  });

  it("normalizes an explicitly configured PACT origin", () => {
    expect(resolvePactOrigin("/ignored/", "https://pact.example/pact", "https://ignored.example").toString()).toBe(
      "https://pact.example/pact/",
    );
  });

  it("creates the signed-in confirmation handoff without changing the API root", () => {
    expect(telegramConfirmationUrl(new URL("https://pact.example/pact/"), "bootstrap-token")).toBe(
      "https://pact.example/pact/?telegram_bootstrap=bootstrap-token",
    );
  });
});
