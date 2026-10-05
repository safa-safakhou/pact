import { createHash } from "node:crypto";
import type { BrowserSubscription, NotificationDeliveryPort } from "@pact/inbox";
import type { Transporter } from "nodemailer";
import webpush from "web-push";
export function smtpGamePort(transport: Transporter, from: string): NotificationDeliveryPort {
  return {
    channel: "email",
    deliver: async ({ recipient, preview, idempotencyKey }) => {
      if (typeof recipient !== "string") throw new Error("INVALID_RECIPIENT");
      const messageId = createHash("sha256").update(idempotencyKey).digest("hex");
      await transport.sendMail({
        from,
        to: recipient,
        subject: "PACT: action available",
        messageId: `<${messageId}@notifications.pact>`,
        text: `${preview.body}\n\n${preview.url}\n\nManage or disable optional notifications in your signed-in PACT account under Envoy. Security emails are separate.`,
      });
    },
  };
}
export function webPushPort(input: {
  subject: string;
  publicKey: string;
  privateKey: string;
}): NotificationDeliveryPort {
  return {
    channel: "webpush",
    deliver: async ({ recipient, preview }) => {
      if (typeof recipient === "string") throw new Error("INVALID_RECIPIENT");
      await webpush.sendNotification(recipient as BrowserSubscription, JSON.stringify(preview), {
        vapidDetails: input,
        contentEncoding: "aes128gcm",
        TTL: 600,
        timeout: 10_000,
        topic: preview.tag,
        urgency: "normal",
      });
    },
  };
}
