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

  it.each([
    ["reset_password", "Reset your PACT password"],
    ["verify_new_email", "Confirm your new PACT email"],
    ["email_changed_notice", "Your PACT email changed"],
  ])("labels the emitted %s template with its account action", (template, subject) => {
    const message = renderSecurityEmail({
      payload: { accountId: "account-1", template },
      recipient: "player@example.test",
      token: "synthetic-code",
      publicBaseUrl: "https://safa.dedyn.io/pact",
      from: "PACT <noreply@safa.dedyn.io>",
    });
    expect(message.subject).toBe(subject);
    expect(message.text).toContain(subject);
    expect(message.text).toContain("synthetic-code");
  });

  it("rejects malformed outbox payloads", () => {
    expect(() => parseSecurityEmailPayload({ template: "verify_email" })).toThrow("INVALID_SECURITY_EMAIL_PAYLOAD");
  });
});
