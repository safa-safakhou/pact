import { createECDH } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateSubscription } from "./notification-policy.js";

describe("browser push endpoint restrictions", () => {
  it("allows encrypted browser push endpoints and rejects internal/untrusted URL destinations", () => {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const keys = { auth: Buffer.alloc(16, 7).toString("base64url"), p256dh: ecdh.getPublicKey().toString("base64url") };
    expect(() => validateSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/fixture", keys })).not.toThrow();
    for (const endpoint of [
      "http://fcm.googleapis.com/a",
      "https://127.0.0.1/private",
      "https://fcm.googleapis.com.evil.test/a",
      "https://evil.test/a",
      "https://user:pass@fcm.googleapis.com/a",
    ])
      expect(() => validateSubscription({ endpoint, keys })).toThrow();
    expect(() =>
      validateSubscription({ endpoint: "https://fcm.googleapis.com/a", keys: { ...keys, auth: "short" } }),
    ).toThrow();
  });
});
