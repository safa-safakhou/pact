import { describe, expect, it, vi } from "vitest";
import {
  confirmTelegramLink,
  readTelegramBootstrap,
  TelegramLinkError,
  type TelegramLinkFetch,
} from "./telegram-link.js";

describe("Telegram account-link confirmation", () => {
  it("accepts only API-sized bootstrap tokens", () => {
    const token = "a".repeat(32);
    expect(readTelegramBootstrap(`?telegram_bootstrap=${token}`)).toBe(token);
    expect(readTelegramBootstrap("?telegram_bootstrap=short")).toBeUndefined();
  });

  it("signs in before confirming with the returned CSRF token", async () => {
    const fetchImplementation = vi
      .fn<TelegramLinkFetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-proof" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ linked: true }), { status: 200 }));

    await confirmTelegramLink(fetchImplementation, new URL("https://pact.example/pact/"), "b".repeat(32), {
      email: "player@example.test",
      password: "secret",
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(fetchImplementation.mock.calls[0]?.[0].toString()).toBe("https://pact.example/pact/v1/auth/login");
    expect(fetchImplementation.mock.calls[1]?.[1]?.headers).toEqual({
      "content-type": "application/json",
      "x-csrf-token": "csrf-proof",
    });
  });

  it("stops before confirmation when sign-in fails", async () => {
    const fetchImplementation = vi
      .fn<TelegramLinkFetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "INVALID_CREDENTIALS" } }), { status: 400 }));

    await expect(
      confirmTelegramLink(fetchImplementation, new URL("https://pact.example/pact/"), "b".repeat(32), {
        email: "player@example.test",
        password: "wrong",
      }),
    ).rejects.toEqual(new TelegramLinkError("INVALID_CREDENTIALS"));
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});
