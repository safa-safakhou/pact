import { randomUUID } from "node:crypto";
import { createPool } from "@pact/db";
import { AesGcmSecretBox } from "@pact/identity";
import { TelegramBotDelivery } from "@pact/telegram";
import { TelegramApiDelivery } from "./telegram-delivery.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = createPool(connectionString),
  token = process.env.TELEGRAM_BOT_TOKEN,
  key = process.env.IDENTITY_ENCRYPTION_KEY;
if (token && !key) throw new Error("IDENTITY_ENCRYPTION_KEY is required for Telegram delivery");
const workerId = "telegram-" + randomUUID(),
  clock = { now: () => new Date() },
  delivery =
    token && key
      ? new TelegramBotDelivery(pool, {
          productScope: "pact",
          clock,
          secretBox: new AesGcmSecretBox(Buffer.from(key, "base64url")),
        })
      : null,
  port = token ? new TelegramApiDelivery(token) : null;
let busy = false;
async function tick() {
  if (busy || !delivery || !port) return;
  busy = true;
  try {
    for (let i = 0; i < 10; i++) {
      if ((await delivery.deliver(port, workerId)) === 0) break;
    }
  } catch {
    console.error("Telegram delivery batch failed; retry remains queued");
  } finally {
    busy = false;
  }
}
const timer = setInterval(() => void tick(), 2000);
console.log(
  delivery ? "PACT private Telegram delivery ready" : "PACT channel worker ready; Telegram token not configured",
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    clearInterval(timer);
    void pool.end().then(() => {
      process.exitCode = 0;
    });
  });
