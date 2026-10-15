import type { AgentScope, ProductScope } from "@pact/contracts";

/** Server-derived command actor. Never taken from caller-owned identity fields. */
export interface AuthenticatedPrincipal {
  readonly accountId: string;
  readonly productScope: ProductScope;
  readonly audience: "human" | "agent" | "service";
  readonly sessionId?: string;
  /** Authenticated OAuth connection, never supplied by a tool argument. */
  readonly agentGrantId?: string;
  /** Transport-derived origin, never copied from a command actor. */
  readonly agentOrigin?: "external" | "in_app";
  /** Granted by the authenticating route, never copied from a command envelope. */
  readonly agentScopes?: readonly AgentScope[];
}

export type DispatcherFailureCode =
  | "TICK_PENDING"
  | "MESSAGE_QUEUE_FULL"
  | "CONTACT_QUEUE_FULL"
  | "REQUEST_EXISTS"
  | "ALREADY_CONTACT"
  | "INVALID_COMMAND"
  | "FORBIDDEN"
  | "STALE_VERSION"
  | "RATE_LIMITED"
  | "EXPIRED"
  | "INSUFFICIENT_ALLOWANCE"
  | "TROOP_LIMIT"
  | "INSUFFICIENT_STOCK"
  | "RESERVE_FLOOR"
  | "UNIT_LOCKED"
  | "BUILDING_BUSY"
  | "SLOT_BUSY"
  | "INVALID_LEVEL";

export class DispatcherError extends Error {
  constructor(
    readonly code: DispatcherFailureCode,
    readonly reason?: "WRITE_LEASE_REQUIRED",
    readonly detail?:
      | "CONTRACT_CAPACITY"
      | "OFFER_CLOSED"
      | "NOT_CONTACT"
      | "BLOCKED"
      | "SERVICE_THROTTLED"
      | "TRANSACTION_BUSY"
      | "DELEGATION_REQUIRED",
    readonly retryAfterMs?: number,
  ) {
    super(code);
    this.name = "DispatcherError";
  }
}
