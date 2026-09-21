import type { AgentScope, ClientAudience, CommandEnvelope, CommandReceipt, EventEnvelope } from "@pact/contracts";

export type ClientMethod = "GET" | "POST";

export interface ClientRequest {
  readonly method: ClientMethod;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export interface ClientResponse {
  readonly status: number;
  readonly body: unknown;
}

/** Host-owned transport. Browser, native, Telegram, and Node adapters provide authentication here. */
export interface ClientTransport {
  send(request: ClientRequest): Promise<ClientResponse>;
  subscribe?(request: ClientRequest): AsyncIterable<unknown>;
}

export interface CommandIdFactory {
  create(): string;
}

export interface ClientClock {
  now(): Date;
}

export interface PactClientOptions<A extends ClientAudience> {
  readonly audience: A;
  readonly transport: ClientTransport;
  readonly commandIds: CommandIdFactory;
  readonly clock: ClientClock;
  readonly agentScopes?: readonly AgentScope[];
}

export type SandboxAction = CommandEnvelope["action"];
export type PreparedCommand = Readonly<CommandEnvelope>;

export interface InboxEventProjection {
  readonly sequence: string;
  readonly eventId: string;
  readonly type: string;
  readonly occurredAt: string;
  readonly event: EventEnvelope;
}

export interface InboxPageProjection {
  readonly events: readonly InboxEventProjection[];
  readonly nextCursor: string | null;
  readonly resyncRequired: boolean;
  readonly resumeFrom?: string;
}

export interface ReceiptViewModel {
  readonly commandId: string;
  readonly code: CommandReceipt["code"];
  readonly state: "committed" | "approval-required" | "rejected";
  readonly isTerminal: boolean;
  readonly committedAt?: string;
  readonly approvalId?: string;
}

/** Ordered steps for account / Envoy connection setup (PACT-023). */
export type SetupStep = "account" | "draft" | "provider" | "credentials" | "model" | "allowance" | "run" | "inbox";

export type RunStatusLabel = "Working" | "Waiting" | "Stopped";

export type PricingMessageKind = "estimate" | "unavailable";

export interface PricingMessage {
  readonly kind: PricingMessageKind;
  readonly text: string;
}

export interface InvitationDestination {
  readonly invite?: string;
  readonly destination?: string;
}

export interface SetupSnapshotInput {
  readonly step: SetupStep;
  readonly invitation?: InvitationDestination;
  readonly runStatus?: string;
  readonly pricing?: {
    readonly available: boolean;
    readonly estimateText?: string;
  };
  readonly errorCode?: string;
  readonly externalHostMessage?: string;
  readonly connectorPrerequisiteMessage?: string;
  /** Server-hydrated draft/run/approval fields; closing the page must re-apply these. */
  readonly serverState?: Readonly<Record<string, unknown>>;
}

export interface SetupSnapshot {
  readonly step: SetupStep;
  readonly invitation: InvitationDestination;
  readonly runStatusLabel: RunStatusLabel;
  readonly pricing: PricingMessage;
  readonly errorMessage: string | null;
  readonly externalHostMessage: string | null;
  readonly connectorPrerequisiteMessage: string | null;
  readonly serverState: Readonly<Record<string, unknown>>;
  /** Setup never activates a live kingdom; drafts remain private. */
  readonly foundsLiveKingdom: false;
}
