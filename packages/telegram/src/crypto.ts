import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { TelegramError, type VerifiedTelegramLaunch } from "./types.js";

const MAX_AGE_MS = 5 * 60_000;
const FUTURE_SKEW_MS = 30_000;

function parseUnique(raw: string): Map<string, string> {
  if (!raw || raw.length > 16_384) throw new TelegramError("INVALID_INIT_DATA");
  const values = new Map<string, string>();
  for (const [key, value] of new URLSearchParams(raw)) {
    if (!key || values.has(key)) throw new TelegramError("INVALID_INIT_DATA");
    values.set(key, value);
  }
  return values;
}

function safeEqualHex(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function verifyTelegramInitData(raw: string, botToken: string, now: Date): VerifiedTelegramLaunch {
  if (!botToken) throw new TelegramError("INVALID_INIT_DATA");
  const values = parseUnique(raw);
  const claimedHash = values.get("hash");
  if (!claimedHash) throw new TelegramError("INVALID_INIT_DATA");
  const check = [...values.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(check).digest("hex");
  secret.fill(0);
  if (!safeEqualHex(claimedHash, expected)) throw new TelegramError("INVALID_INIT_DATA");

  const authSeconds = values.get("auth_date");
  if (!authSeconds || !/^(0|[1-9][0-9]{0,12})$/.test(authSeconds)) throw new TelegramError("INVALID_INIT_DATA");
  const authDate = new Date(Number(authSeconds) * 1000);
  const age = now.getTime() - authDate.getTime();
  if (!Number.isFinite(authDate.getTime()) || age < -FUTURE_SKEW_MS || age > MAX_AGE_MS) {
    throw new TelegramError("INVALID_INIT_DATA");
  }

  let user: { id?: unknown; username?: unknown };
  try {
    user = JSON.parse(values.get("user") ?? "") as { id?: unknown; username?: unknown };
  } catch {
    throw new TelegramError("INVALID_INIT_DATA");
  }
  if (!Number.isSafeInteger(user.id) || Number(user.id) <= 0) throw new TelegramError("INVALID_INIT_DATA");
  const chatValue = values.get("chat");
  if (chatValue) {
    try {
      const chat = JSON.parse(chatValue) as { type?: unknown };
      if (chat.type !== "private") throw new TelegramError("GROUP_CHAT_DENIED");
    } catch (error) {
      if (error instanceof TelegramError) throw error;
      throw new TelegramError("INVALID_INIT_DATA");
    }
  }
  const queryId = values.get("query_id");
  return {
    userId: String(user.id),
    ...(typeof user.username === "string" && user.username.length <= 64 ? { username: user.username } : {}),
    ...(queryId ? { queryId } : {}),
    authDate,
    fingerprint: createHash("sha256").update(check).digest("hex"),
  };
}

export function verifyWebhookSecret(received: string | undefined, expected: string): void {
  if (!received || !expected) throw new TelegramError("INVALID_WEBHOOK_SECRET");
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (left.byteLength !== right.byteLength || !timingSafeEqual(left, right)) {
    throw new TelegramError("INVALID_WEBHOOK_SECRET");
  }
}
