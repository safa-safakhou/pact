import { describe, expect, it, vi } from "vitest";
import { TelegramApiDelivery } from "./telegram-delivery.js";

describe("Telegram delivery boundary", () => {
  it("uses the configured bot endpoint and protects previews; it exposes only a normalized message ID", async () => {
    const send = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true, result: { message_id: 88 } }), { status: 200 }),
    );
    const port = new TelegramApiDelivery("fixture-token", send as typeof fetch);
    expect(
      await port.send("123", {
        text: "Exact bounded fixture",
        buttons: [
          { text: "Start", callbackData: "pact-run:fixture" },
          { text: "Read", webAppUrl: "https://pact.example/pact/telegram/?inbox" },
        ],
      }),
    ).toEqual({ messageId: 88 });
    expect(send.mock.calls[0]?.[0]).toBe("https://api.telegram.org/botfixture-token/sendMessage");
    const body = JSON.parse((send.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ chat_id: "123", protect_content: true, link_preview_options: { is_disabled: true } });
    expect(body.reply_markup.inline_keyboard[0][0]).toEqual({ text: "Start", callback_data: "pact-run:fixture" });
  });
  it("reports a sanitized refusal without returning the token or Telegram error body", async () => {
    const port = new TelegramApiDelivery(
      "fixture-secret",
      async () =>
        new Response(JSON.stringify({ ok: false, error_code: 403, description: "private fixture" }), { status: 403 }),
    );
    await expect(port.send("123", { text: "fixture" })).rejects.toMatchObject({
      message: "TELEGRAM_DELIVERY_FAILED",
      statusCode: 403,
    });
  });
});
