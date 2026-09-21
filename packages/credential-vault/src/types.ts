export const MODEL_PROVIDERS = ["openai", "anthropic", "gemini", "xai", "openrouter"] as const;

export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export interface CredentialWrapContext {
  readonly productScope: string;
  readonly accountId: string;
  readonly credentialId: string;
  readonly provider: ModelProvider;
  readonly version: number;
}

export interface WrappedDataKey {
  readonly algorithm: "RSA-OAEP-256";
  readonly keyId: string;
  readonly wrappedKey: string;
}

/** API-facing capability. It can seal a data key but has no unwrapping method. */
export interface CredentialKeyWrapper {
  wrapKey(dataKey: Uint8Array, context: CredentialWrapContext): Promise<WrappedDataKey>;
}

/** Inference-only capability. Its private material must not be mounted into API processes. */
export interface CredentialKeyUnwrapper {
  unwrapKey(wrapped: WrappedDataKey, context: CredentialWrapContext): Promise<Uint8Array>;
}

export interface CredentialClock {
  now(): Date;
}

export interface CredentialIdFactory {
  create(): string;
}

export interface CredentialSummary {
  readonly id: string;
  readonly provider: ModelProvider;
  readonly label: string;
  readonly suffix: string;
  readonly version: number;
  readonly status: "active" | "revoked";
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly revokedAt?: Date;
}

export interface CredentialAdmission {
  readonly useId: string;
  readonly credentialId: string;
  readonly provider: ModelProvider;
  readonly label: string;
  readonly admittedAt: Date;
  readonly revocationNotice: "A provider request admitted before revocation may complete.";
}

export type CredentialVaultErrorCode =
  | "ALREADY_EXISTS"
  | "DECRYPTION_FAILED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "LIMIT_REACHED"
  | "NOT_FOUND"
  | "REVOKED"
  | "STALE_VERSION";

export class CredentialVaultError extends Error {
  constructor(readonly code: CredentialVaultErrorCode) {
    super(code);
    this.name = "CredentialVaultError";
  }
}
