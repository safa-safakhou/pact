import type { BotDeliveryPort, BotReply } from "@pact/telegram";
export class TelegramApiDelivery implements BotDeliveryPort {
  constructor(
    private readonly token: string,
    private readonly httpFetch: typeof fetch = fetch,
  ) {}
  async sendMessage(userId: string, reply: BotReply): Promise<{ messageId: number }> {
    const response = await this.httpFetch("https://api.telegram.org/bot" + this.token + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        chat_id: userId,
        text: reply.text,
        protect_content: true,
        link_preview_options: { is_disabled: true },
        ...(reply.buttons?.length
          ? {
              reply_markup: {
                inline_keyboard: reply.buttons.map((b) => [
                  {
                    text: b.text,
                    ...(b.callbackData ? { callback_data: b.callbackData } : { web_app: { url: b.webAppUrl } }),
                  },
                ]),
              },
            }
          : {}),
      }),
    });
    const data = (await response.json()) as { ok?: boolean; error_code?: number; result?: { message_id?: number } };
    if (!response.ok || !data.ok) {
      throw Object.assign(new Error("TELEGRAM_DELIVERY_FAILED"), { statusCode: data.error_code ?? response.status });
    }
    if (!Number.isSafeInteger(data.result?.message_id)) throw new Error("TELEGRAM_DELIVERY_INVALID");
    return { messageId: data.result!.message_id! };
  }
  send(userId: string, reply: BotReply) {
    return this.sendMessage(userId, reply);
  }
}
