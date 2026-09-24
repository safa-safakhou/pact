import type { AgentScope, ProductScope } from "@pact/contracts";

/** Server-derived command actor. Never taken from caller-owned identity fields. */
export interface AuthenticatedPrincipal {
  readonly accountId: string;
  readonly productScope: ProductScope;
  readonly audience: "human" | "agent" | "service";
  readonly sessionId?: string;
  /** Granted by the authenticating route, never copied from a command envelope. */
  readonly agentScopes?: readonly AgentScope[];
}

export type DispatcherFailureCode =
  | "INVALID_COMMAND"
  | "FORBIDDEN"
  | "STALE_VERSION"
  | "RATE_LIMITED"
  | "EXPIRED"
  | "INSUFFICIENT_STOCK"
  | "RESERVE_FLOOR"
  | "UNIT_LOCKED";

export class DispatcherError extends Error {
  constructor(readonly code: DispatcherFailureCode) {
    super(code);
    this.name = "DispatcherError";
  }
}
