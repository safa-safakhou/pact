import type { SendMailOptions } from "nodemailer";

export interface SecurityEmailPayload {
  readonly accountId: string;
  readonly template: string;
  readonly recipientEmail?: string;
  readonly sealedToken?: string;
}

const subjects: Readonly<Record<string, string>> = {
  verify_email: "Verify your PACT email",
  moderation_decision: "A PACT moderation decision is available",
  password_reset: "Reset your PACT password",
  reset_password: "Reset your PACT password",
  email_change_old: "Your PACT email is changing",
  email_change_new: "Confirm your new PACT email",
  verify_new_email: "Confirm your new PACT email",
  email_changed_notice: "Your PACT email changed",
  password_changed: "Your PACT password changed",
};

export function parseSecurityEmailPayload(input: unknown): SecurityEmailPayload {
  if (typeof input !== "object" || input === null) throw new Error("INVALID_SECURITY_EMAIL_PAYLOAD");
  const value = input as Record<string, unknown>;
  if (typeof value.accountId !== "string" || typeof value.template !== "string") {
    throw new Error("INVALID_SECURITY_EMAIL_PAYLOAD");
  }
  return {
    accountId: value.accountId,
    template: value.template,
    ...(typeof value.recipientEmail === "string" ? { recipientEmail: value.recipientEmail } : {}),
    ...(typeof value.sealedToken === "string" ? { sealedToken: value.sealedToken } : {}),
  };
}

export function renderSecurityEmail(input: {
  readonly payload: SecurityEmailPayload;
  readonly recipient: string;
  readonly token?: string;
  readonly publicBaseUrl: string;
  readonly from: string;
}): SendMailOptions {
  const subject = subjects[input.payload.template] ?? "PACT account security notice";
  if (input.payload.template === "moderation_decision") {
    const url = new URL(input.publicBaseUrl.replace(/\/$/, "") + "/");
    if (input.token) url.hash = "appeal=" + input.token;
    return {
      from: input.from,
      to: input.recipient,
      subject,
      text: `${subject}. You can submit one appeal within fourteen days at ${url.href}. A different staff member reviews appeals within seven days. This link grants only the right to appeal this case; it cannot open an account or change game state.`,
    };
  }
  const tokenLine = input.token ? `\nOne-time code: ${input.token}\n` : "";
  return {
    from: input.from,
    to: input.recipient,
    subject,
    text: `${subject}\n\nOpen ${input.publicBaseUrl} to continue.${tokenLine}\nIf you did not request this, do not share the code and change your password.`,
  };
}
