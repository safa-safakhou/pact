import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTelegramInitData } from "./crypto.js";

const token = "123456:telegram-fixture-token";
const now = new Date("2026-09-21T12:00:00Z");

function sign(values: Record<string, string>): string {
  const check = Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...values, hash }).toString();
}

describe("Telegram initData validation", () => {
  it("binds a fresh launch to the numeric user id, not the display handle", () => {
    const launch = verifyTelegramInitData(
      sign({
        auth_date: String(now.getTime() / 1000),
        query_id: "query-1",
        user: JSON.stringify({ id: 900719, username: "mutable_handle" }),
      }),
      token,
      now,
    );
    expect(launch).toMatchObject({ userId: "900719", username: "mutable_handle", queryId: "query-1" });
  });

  it("includes Telegram's third-party signature field in bot-token HMAC validation", () => {
    const raw = sign({
      auth_date: String(now.getTime() / 1000),
      query_id: "query-with-signature",
      signature: "telegram-ed25519-signature",
      user: JSON.stringify({ id: 900720 }),
    });

    expect(verifyTelegramInitData(raw, token, now)).toMatchObject({
      userId: "900720",
      queryId: "query-with-signature",
    });
    expect(() => verifyTelegramInitData(raw.replace("telegram-ed25519-signature", "changed"), token, now)).toThrow(
      "INVALID_INIT_DATA",
    );
  });

  it("rejects tampering, stale data, duplicate keys, and group launches", () => {
    const good = sign({ auth_date: String(now.getTime() / 1000), user: JSON.stringify({ id: 42 }) });
    expect(() => verifyTelegramInitData(good.replace("%7D", "%7Dchanged"), token, now)).toThrow("INVALID_INIT_DATA");
    expect(() =>
      verifyTelegramInitData(sign({ auth_date: "1", user: JSON.stringify({ id: 42 }) }), token, now),
    ).toThrow("INVALID_INIT_DATA");
    expect(() => verifyTelegramInitData(`${good}&auth_date=1`, token, now)).toThrow("INVALID_INIT_DATA");
    expect(() =>
      verifyTelegramInitData(
        sign({
          auth_date: String(now.getTime() / 1000),
          user: JSON.stringify({ id: 42 }),
          chat: JSON.stringify({ type: "group" }),
        }),
        token,
        now,
      ),
    ).toThrow("GROUP_CHAT_DENIED");
  });
});
