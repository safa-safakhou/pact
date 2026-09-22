import { describe, expect, it } from "vitest";
import { parseSecurityEmailPayload, renderSecurityEmail } from "./email.js";

describe("security email delivery", () => {
  it("renders the one-time code without placing it in metadata", () => {
    const message = renderSecurityEmail({
      payload: parseSecurityEmailPayload({ accountId: "account-1", template: "verify_email" }),
      recipient: "player@example.test",
      token: "one-time-secret",
      publicBaseUrl: "https://safa.dedyn.io/pact",
      from: "PACT MVP <noreply@safa.dedyn.io>",
    });

    expect(message.subject).toBe("Verify your PACT email");
    expect(message.text).toContain("one-time-secret");
    expect(JSON.stringify({ from: message.from, to: message.to, subject: message.subject })).not.toContain(
      "one-time-secret",
    );
  });

  it("rejects malformed outbox payloads", () => {
    expect(() => parseSecurityEmailPayload({ template: "verify_email" })).toThrow("INVALID_SECURITY_EMAIL_PAYLOAD");
  });
});
