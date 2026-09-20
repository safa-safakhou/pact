import type { ProductScope } from "@pact/contracts";

/** Server-derived command actor. Never taken from caller-owned identity fields. */
export interface AuthenticatedPrincipal {
  readonly accountId: string;
  readonly productScope: ProductScope;
  readonly audience: "human" | "agent" | "service";
  readonly sessionId?: string;
}

export type DispatcherFailureCode = "INVALID_COMMAND" | "FORBIDDEN" | "STALE_VERSION";

export class DispatcherError extends Error {
  constructor(readonly code: DispatcherFailureCode) {
    super(code);
    this.name = "DispatcherError";
  }
}
