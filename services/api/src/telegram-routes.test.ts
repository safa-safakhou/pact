import { describe, expect, it } from "vitest";
import { telegramSessionCookie } from "./telegram-routes.js";

describe("Telegram session cookies", () => {
  it("uses a secure partitioned cookie for Telegram Web's third-party iframe", () => {
    expect(telegramSessionCookie("channel/session")).toBe(
      "pact_session=channel%2Fsession; Path=/; HttpOnly; Secure; SameSite=None; Partitioned",
    );
  });

  it("clears the same partitioned cookie on unlink", () => {
    expect(telegramSessionCookie()).toBe(
      "pact_session=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0",
    );
  });
});
