export type NotificationChannel = "email" | "webpush" | "native" | "telegram";
export interface NotificationCategory {
  readonly id: string;
  readonly critical: boolean;
  readonly label: string;
}
export interface BrowserSubscription {
  readonly endpoint: string;
  readonly keys: { readonly auth: string; readonly p256dh: string };
}
export interface NotificationPreview {
  readonly title: "PACT";
  readonly body: string;
  readonly url: string;
  readonly tag: string;
}
export interface NotificationDeliveryPort {
  readonly channel: NotificationChannel;
  deliver(input: {
    readonly idempotencyKey: string;
    readonly recipient: string | BrowserSubscription;
    readonly preview: NotificationPreview;
  }): Promise<void>;
}
export class NotificationError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "ENDPOINT_CONFLICT") {
    super(code);
  }
}
export function validateSubscription(value: BrowserSubscription): void {
  let url: URL;
  try {
    url = new URL(value.endpoint);
  } catch {
    throw new NotificationError("INVALID_INPUT");
  }
  const host = url.hostname;
  const allowed =
    host === "fcm.googleapis.com" ||
    host === "web.push.apple.com" ||
    host === "updates.push.services.mozilla.com" ||
    host.endsWith(".push.services.mozilla.com") ||
    host.endsWith(".notify.windows.com");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !allowed ||
    value.endpoint.length > 2048 ||
    !/^[A-Za-z0-9_-]+$/.test(value.keys.auth) ||
    !/^[A-Za-z0-9_-]+$/.test(value.keys.p256dh) ||
    Buffer.from(value.keys.auth, "base64url").length !== 16 ||
    Buffer.from(value.keys.p256dh, "base64url").length !== 65
  )
    throw new NotificationError("INVALID_INPUT");
}
