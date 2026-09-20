export type AccountRole = "player" | "staff";

export interface IdentityClock {
  now(): Date;
}

export interface CompromisedPasswordChecker {
  isCompromised(password: string): Promise<boolean>;
}

export interface SecretBox {
  seal(plaintext: Uint8Array): string;
  open(ciphertext: string): Uint8Array;
}

export interface SessionTokens {
  readonly accountId: string;
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export interface HumanSession {
  readonly sessionId: string;
  readonly accountId: string;
  readonly audience: "human";
  readonly authenticatedAt: Date;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export type SensitiveAction =
  | "password.change"
  | "email.change"
  | "model-credential.replace"
  | "account.delete"
  | "account.export"
  | "authority.raise"
  | "approval.commit";

export class IdentityError extends Error {
  constructor(
    readonly code:
      | "INVALID_CREDENTIALS"
      | "INVALID_INPUT"
      | "INVALID_TOKEN"
      | "RATE_LIMITED"
      | "FORBIDDEN"
      | "RECENT_AUTH_REQUIRED"
      | "MFA_REQUIRED"
      | "INVALID_MFA"
      | "PASSWORD_REJECTED"
      | "TERMS_REQUIRED",
  ) {
    super(code);
    this.name = "IdentityError";
  }
}
