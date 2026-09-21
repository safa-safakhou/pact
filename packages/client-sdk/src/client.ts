import {
  type AgentScope,
  API_VERSION,
  type CapabilityDocument,
  CapabilityDocumentSchema,
  type ClientAudience,
  type CommandReceipt,
  CommandReceiptSchema,
  EVENT_SCHEMA_VERSION,
  EventEnvelopeSchema,
  ProductScopeSchema,
  SCHEMA_VERSION,
} from "@pact/contracts";
import type {
  ClientRequest,
  ClientResponse,
  InboxEventProjection,
  InboxPageProjection,
  PactClientOptions,
  PreparedCommand,
  SandboxAction,
} from "./types.js";

const allowedAgentScopes = new Set<AgentScope>(["world:read", "messages:write", "game:act"]);

export type ClientErrorCode =
  | "UNSUPPORTED_API_VERSION"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NETWORK_UNCERTAIN"
  | "INVALID_RESPONSE"
  | "SERVER_ERROR";

export class PactClientError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status?: number,
    readonly serverCode?: string,
  ) {
    super(code);
    this.name = "PactClientError";
  }
}

function responseError(status: number, body: unknown): PactClientError {
  const serverCode =
    typeof body === "object" && body !== null && "error" in body
      ? typeof body.error === "string"
        ? body.error
        : typeof body.error === "object" && body.error !== null && "code" in body.error
          ? String(body.error.code)
          : undefined
      : undefined;
  const code: ClientErrorCode =
    serverCode === "UNSUPPORTED_API_VERSION"
      ? "UNSUPPORTED_API_VERSION"
      : status === 401
        ? "AUTHENTICATION_REQUIRED"
        : status === 403
          ? "FORBIDDEN"
          : status === 404
            ? "NOT_FOUND"
            : status === 409
              ? "CONFLICT"
              : status === 429
                ? "RATE_LIMITED"
                : status >= 500
                  ? "SERVER_ERROR"
                  : "INVALID_RESPONSE";
  return new PactClientError(code, status, serverCode);
}

export class PactClient<A extends ClientAudience> {
  readonly audience: A;
  readonly agentScopes: readonly AgentScope[];

  constructor(private readonly options: PactClientOptions<A>) {
    this.audience = options.audience;
    const scopes = [...(options.agentScopes ?? [])];
    if (options.audience === "human" && scopes.length > 0) {
      throw new PactClientError("FORBIDDEN", undefined, "HUMAN_CLIENT_HAS_NO_AGENT_SCOPES");
    }
    if (scopes.some((scope) => !allowedAgentScopes.has(scope))) {
      throw new PactClientError("FORBIDDEN", undefined, "INVALID_AGENT_SCOPE");
    }
    this.agentScopes = Object.freeze(scopes);
  }

  prepareCommand(action: SandboxAction, expectedVersion?: number): PreparedCommand {
    const command: PreparedCommand = {
      schemaVersion: SCHEMA_VERSION,
      commandId: this.options.commandIds.create(),
      // This non-owning sentinel satisfies the shared wire schema. The server always replaces it from credentials.
      actor: {
        principalId: "server-derived",
        productScope: ProductScopeSchema.parse("pact"),
        audience: this.audience,
        subject: { type: this.audience === "agent" ? "agent" : "account", id: "server-derived" },
      },
      ...(expectedVersion !== undefined ? { expectedVersion } : {}),
      action,
      submittedAt: this.options.clock.now().toISOString(),
    };
    Object.freeze(command.actor.subject);
    Object.freeze(command.actor);
    Object.freeze(command.action);
    return Object.freeze(command);
  }

  async submitCommand(command: PreparedCommand): Promise<CommandReceipt> {
    const response = await this.send({
      method: "POST",
      path: "/v1/commands",
      headers: { "content-type": "application/json", "x-pact-api-version": API_VERSION },
      body: command,
    });
    if (response.status < 200 || response.status >= 300) throw responseError(response.status, response.body);
    return parseReceipt(response.body);
  }

  /** Retry the exact prepared object; this API never creates a replacement command id. */
  retryCommand(command: PreparedCommand): Promise<CommandReceipt> {
    return this.submitCommand(command);
  }

  async reconcileReceipt(commandId: string): Promise<CommandReceipt | null> {
    const response = await this.send({
      method: "GET",
      path: `/v1/receipts/${encodeURIComponent(commandId)}`,
      headers: { "x-pact-api-version": API_VERSION },
    });
    if (response.status === 404) return null;
    if (response.status < 200 || response.status >= 300) throw responseError(response.status, response.body);
    return parseReceipt(response.body);
  }

  async capabilities(): Promise<CapabilityDocument> {
    const response = await this.send({
      method: "GET",
      path: `/v1/capabilities?audience=${this.audience}`,
      headers: { "x-pact-api-version": API_VERSION },
    });
    if (response.status < 200 || response.status >= 300) throw responseError(response.status, response.body);
    const parsed = CapabilityDocumentSchema.safeParse(response.body);
    if (!parsed.success) throw new PactClientError("INVALID_RESPONSE");
    return parsed.data;
  }

  async readInbox(cursor?: string, limit = 50): Promise<InboxPageProjection> {
    const query = `${cursor ? `cursor=${encodeURIComponent(cursor)}&` : ""}limit=${encodeURIComponent(String(limit))}`;
    const response = await this.send({
      method: "GET",
      path: `/v1/inbox?${query}`,
      headers: { "x-pact-api-version": API_VERSION },
    });
    if (response.status < 200 || response.status >= 300) throw responseError(response.status, response.body);
    return parseInboxPage(response.body);
  }

  async *subscribeInbox(cursor?: string): AsyncIterable<InboxEventProjection> {
    if (!this.options.transport.subscribe) throw new PactClientError("INVALID_RESPONSE", undefined, "NO_SUBSCRIPTION");
    for await (const raw of this.options.transport.subscribe({
      method: "GET",
      path: "/v1/inbox/stream",
      headers: {
        "x-pact-api-version": API_VERSION,
        ...(cursor ? { "last-event-id": cursor } : {}),
      },
    })) {
      yield parseInboxEvent(raw);
    }
  }

  private async send(request: ClientRequest): Promise<ClientResponse> {
    try {
      return await this.options.transport.send(request);
    } catch (error) {
      if (error instanceof PactClientError) throw error;
      throw new PactClientError("NETWORK_UNCERTAIN");
    }
  }
}

function parseReceipt(input: unknown): CommandReceipt {
  const parsed = CommandReceiptSchema.safeParse(input);
  if (!parsed.success) throw new PactClientError("INVALID_RESPONSE");
  return parsed.data;
}

function parseInboxPage(input: unknown): InboxPageProjection {
  if (typeof input !== "object" || input === null || !("events" in input) || !Array.isArray(input.events)) {
    throw new PactClientError("INVALID_RESPONSE");
  }
  const nextCursor =
    "nextCursor" in input && (input.nextCursor === null || typeof input.nextCursor === "string")
      ? input.nextCursor
      : null;
  const resumeFrom = "resumeFrom" in input && typeof input.resumeFrom === "string" ? input.resumeFrom : undefined;
  return {
    events: input.events.map(parseInboxEvent),
    nextCursor,
    resyncRequired: "resyncRequired" in input && input.resyncRequired === true,
    ...(resumeFrom ? { resumeFrom } : {}),
  };
}

function parseInboxEvent(input: unknown): InboxEventProjection {
  if (
    typeof input !== "object" ||
    input === null ||
    !("sequence" in input) ||
    typeof input.sequence !== "string" ||
    !("payload" in input)
  ) {
    throw new PactClientError("INVALID_RESPONSE");
  }
  const parsed = EventEnvelopeSchema.safeParse(input.payload);
  if (!parsed.success) throw new PactClientError("INVALID_RESPONSE");
  const event = parsed.data;
  if (event.schemaVersion !== EVENT_SCHEMA_VERSION) throw new PactClientError("INVALID_RESPONSE");
  return {
    sequence: input.sequence,
    eventId: event.eventId,
    type: event.type,
    occurredAt: event.occurredAt,
    event,
  };
}
