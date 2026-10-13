import { randomUUID } from "node:crypto";
import {
  AgentOperationError,
  AgentOperationService,
  type AuthenticatedPrincipal,
  type CommandDispatcher,
} from "@pact/application";
import {
  type ChronicleReadQuery,
  commandJsonSchema,
  type EnrollmentQuery,
  type KingdomDiscoveryQuery,
  pactAgentGuideTool,
  pactApprovalProposalTool,
  pactApprovalProposalV2Tool,
  pactApprovalStatusTool,
  pactChronicleReadTool,
  pactConversationReadTool,
  pactCourtReadTool,
  pactDecisionSupportTool,
  pactEnvoyReportTool,
  pactGameActionTool,
  pactGameActionV2Tool,
  pactInboxReadTool,
  pactKingdomDiscoveryTool,
  pactMemoryReadTool,
  pactMemorySourceTool,
  pactMemoryWriteTool,
  pactPlayerFindTool,
  pactPoliticsReadTool,
  pactProfileTool,
  pactReceiptReadTool,
  pactReportReadTool,
  pactSealReadTool,
  pactSeasonReadTool,
  pactWorldReadTool,
} from "@pact/contracts";
import type { Pool } from "pg";
import {
  chatgptDescriptor,
  conversationHistoryTool,
  councilThreadTool,
  LEGACY_PLAY_RESOURCE,
  notesReadTool,
  notesWriteTool,
  PLAY_MIME,
  PLAY_RESOURCE,
  playHtml,
  playTool,
} from "./chatgpt.js";

const enrollmentStatusTool = {
  name: "pact_persistent_play_status_v2",
  description:
    "Read your owner-consented enrollment, original deadline, lifetime allocation budget, queued work and actual host heartbeat. Reading never enrolls, renews, starts or approves work. Usage remains separate from allocation caps.",
  inputSchema: {
    type: "object",
    properties: { beforeAt: { type: "string", format: "date-time" }, beforeId: { type: "string", format: "uuid" } },
    additionalProperties: false,
  },
} as const;

export const MCP_PROTOCOL_PRIMARY = "2025-11-25";
export const MCP_PROTOCOL_COMPAT = "2025-06-18";
export const SUPPORTED_MCP_PROTOCOLS = new Set([MCP_PROTOCOL_PRIMARY, MCP_PROTOCOL_COMPAT, "2025-03-26"]);

export class McpError extends Error {
  constructor(
    readonly code:
      | "UNSUPPORTED_PROTOCOL"
      | "FORBIDDEN"
      | "INVALID_REQUEST"
      | "SESSION_NOT_FOUND"
      | "RUN_ALREADY_ACTIVE",
    readonly httpStatus = 400,
  ) {
    super(code);
    this.name = "McpError";
  }
}

export interface McpJsonRpcRequest {
  jsonrpc?: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpTransportOptions {
  readonly persistentPlay?: { read(accountId: string, query?: EnrollmentQuery): Promise<unknown> };
  readonly privateMemory?: {
    read(accountId: string, query: unknown): Promise<unknown>;
    source(accountId: string, query: unknown): Promise<unknown>;
    write(accountId: string, author: "agent", command: unknown): Promise<unknown>;
  };
  readonly decisionSupport?: {
    read(accountId: string, candidateId?: string, proposalOffset?: number): Promise<unknown | null>;
  };
  readonly playView?: {
    read(accountId: string, query?: { search: string; offset: number }): Promise<Record<string, unknown>>;
  };
  readonly councilThreads?: {
    read(accountId: string, peerId: string, before?: { gameTimeMs: string; id: string }): Promise<unknown>;
  };
  readonly conversationHistory?: {
    agreements(accountId: string, peerId: string, before?: { gameTimeMs: string; id: string }): Promise<unknown>;
    versions(accountId: string, peerId: string, offerId: string, beforeVersion: number): Promise<unknown>;
  };
  readonly notes?: {
    read(accountId: string): Promise<unknown>;
    write(accountId: string, text: string, expectedVersion: number): Promise<unknown>;
  };
  readonly pool: Pool;
  readonly productScope: string;
  readonly dispatcher: CommandDispatcher;
  readonly origin: string;
  readonly clock: { now(): Date };
  readonly worldViews?: WorldViewReader;
  readonly kingdomDiscovery?: { read(accountId: string, query: KingdomDiscoveryQuery): Promise<unknown> };
  readonly publicProfiles?: { read(handle: string): Promise<unknown | null> };
  readonly courts?: { read(handle: string | undefined, offset: number, accountId: string): Promise<unknown> };
  readonly politics?: { read(handle: string | undefined, offset: number, accountId: string): Promise<unknown> };
  readonly seals?: { read(sealId: string, accountId: string): Promise<unknown> };
  readonly chronicle?: { read(query: ChronicleReadQuery, accountId: string): Promise<unknown> };
  readonly runReports?: { read(runId: string | undefined, accountId: string): Promise<unknown> };
  readonly activity?: { record(accountId: string, sessionId: string, summary: Record<string, unknown>): Promise<void> };
  readonly seasons?: {
    read(query: { cohortStartGameTimeMs?: number | undefined }, accountId: string): Promise<unknown>;
  };
  readonly agentGuide?: AgentGuideReader;
  readonly profile?: ProfileReader;
  readonly reports?: ReportReader;
  readonly inbox?: InboxReader;
  readonly conversations?: ConversationReaderPort;
  readonly approvals?: ApprovalStatusPort;
  readonly approvalProposals?: ApprovalProposalPort;
  readonly runLeases?: {
    openMcpLease(input: { accountId: string; holderId: string }): Promise<{ leaseId: string; expiresAt: Date }>;
    releaseMcpLease(input: { accountId: string; holderId: string }): Promise<void>;
  };
}

/** Domain-owned projection behind a product-neutral MCP read port. */
export interface WorldViewReader {
  read(accountId: string, targetKingdomId: string, forecastMinutes: number): Promise<unknown>;
  readSelf?(accountId: string, forecastMinutes: number): Promise<unknown>;
}

/** Product-owned owner projection and learning guide; MCP never accepts a caller-supplied account. */
export interface AgentGuideReader {
  read(
    accountId: string,
    topic: "start" | "development" | "diplomacy" | "military" | "authority",
  ): Promise<Record<string, unknown>>;
}

/** Product-owned display label; stable account identity comes from the validated grant. */
export interface ProfileReader {
  read(accountId: string): Promise<{ nickname?: string }>;
}

/** Product-owned authorization behind a product-neutral MCP read port. */
export interface ReportReader {
  read(
    accountId: string,
    kind: "scout" | "raid_participant" | "raid_public",
    recordId: string,
  ): Promise<unknown | null>;
}

/** Owner identity is supplied by MCP authentication, never tool arguments. */
export interface InboxReader {
  readBounded(accountId: string, cursor: string | undefined, limit: number): Promise<unknown>;
}

/** Domain-owned direct-message projection; identity comes only from the MCP grant. */
export interface ConversationReaderPort {
  read(accountId: string, counterpartyKingdomId: string, limit: number): Promise<unknown | null>;
}

/** Approval status is a read-only, owner-scoped port; commits stay human-only. */
export interface ApprovalStatusPort {
  read(accountId: string, approvalId: string): Promise<unknown | null>;
}

/** Proposals may request human review; this port never executes approval. */
export interface ApprovalProposalPort {
  proposeAgent(
    principal: AuthenticatedPrincipal,
    proposal: unknown,
  ): Promise<{
    approvalId: string;
    deepLinkPath: string;
    effectsSummary: string;
    expiresAt: Date;
  }>;
}

const SANDBOX_TOOLS = [
  {
    name: "sandbox.echo",
    description: "Echo a harmless sandbox message",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", minLength: 1, maxLength: 500 } },
      required: ["message"],
      additionalProperties: false,
    },
  },
  {
    name: "sandbox.counter.increment",
    description: "Increment a private sandbox counter",
    inputSchema: {
      type: "object",
      properties: {
        counterId: { type: "string" },
        amount: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["counterId", "amount"],
      additionalProperties: false,
    },
  },
  {
    name: "sandbox.draft.read",
    description: "Read the private sandbox draft fixture",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "sandbox.draft.write",
    description: "Write the private sandbox draft fixture",
    inputSchema: {
      type: "object",
      properties: { note: { type: "string", maxLength: 500 } },
      required: ["note"],
      additionalProperties: false,
    },
  },
  {
    name: "pact_command_v1",
    description: "Submit one versioned PACT command",
    inputSchema: commandJsonSchema,
  },
] as const;

const RUN_OPEN_TOOL = {
  name: "run.open",
  description:
    "Open or renew this authenticated MCP connection's 15-minute gameplay write lease. Repeated calls on the same connection succeed; another active holder blocks it temporarily. This reserves one expiring session within existing permissions. It spends no game resources, executes no game action, changes no permissions and starts no model inference.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
} as const;

export class McpTransport {
  readonly operations: AgentOperationService;
  get operationOptions() {
    return this.options;
  }
  constructor(private readonly options: McpTransportOptions) {
    this.operations = new AgentOperationService(options);
  }

  assertOrigin(origin: string | undefined): void {
    if (!origin || origin !== this.options.origin) throw new McpError("FORBIDDEN", 403);
  }

  async handlePost(
    principal: AuthenticatedPrincipal,
    body: McpJsonRpcRequest,
    sessionId?: string,
  ): Promise<{ response: Record<string, unknown>; sessionId?: string }> {
    if (body.jsonrpc && body.jsonrpc !== "2.0") throw new McpError("INVALID_REQUEST");
    switch (body.method) {
      case "initialize":
        return this.initialize(principal, body);
      case "notifications/initialized":
        return { response: {}, ...(sessionId ? { sessionId } : {}) };
      case "ping":
        return { response: this.result(body.id, {}), ...(sessionId ? { sessionId } : {}) };
      case "resources/list":
        await this.requireSession(principal, sessionId);
        if (!principal.agentScopes?.includes("world:read")) throw new McpError("FORBIDDEN", 403);
        return {
          response: this.result(body.id, {
            resources: this.options.playView
              ? [
                  {
                    uri: PLAY_RESOURCE,
                    name: "PACT game",
                    mimeType: PLAY_MIME,
                    _meta: {
                      "openai/ui": {
                        availableDisplayModes: ["inline", "fullscreen"],
                        preferredDisplayMode: "fullscreen",
                      },
                    },
                    description: "Your kingdom and participating exchanges",
                  },
                ]
              : [],
          }),
        };
      case "resources/read":
        await this.requireSession(principal, sessionId);
        if (!principal.agentScopes?.includes("world:read") || !this.options.playView)
          throw new McpError("FORBIDDEN", 403);
        if (body.params?.uri !== PLAY_RESOURCE && body.params?.uri !== LEGACY_PLAY_RESOURCE)
          throw new McpError("INVALID_REQUEST");
        return {
          response: this.result(body.id, {
            contents: [
              {
                uri: body.params.uri,
                mimeType: PLAY_MIME,
                text: playHtml,
                _meta: {
                  ui: { csp: { connectDomains: [], resourceDomains: [] } },
                  "openai/ui": { availableDisplayModes: ["inline", "fullscreen"], preferredDisplayMode: "fullscreen" },
                  "openai/widgetDescription": "PACT kingdom and actual correspondence, refreshed on request",
                },
              },
            ],
          }),
        };
      case "tools/list":
        await this.requireSession(principal, sessionId);
        return {
          response: this.result(body.id, {
            tools: [
              ...(this.options.playView && principal.agentScopes?.includes("world:read")
                ? [playTool, ...(this.options.councilThreads ? [councilThreadTool] : [])]
                : []),
              ...(this.options.conversationHistory && principal.agentScopes?.includes("world:read")
                ? [conversationHistoryTool]
                : []),
              ...(this.options.decisionSupport && principal.agentScopes?.includes("world:read")
                ? [pactDecisionSupportTool]
                : []),
              ...(this.options.persistentPlay && principal.agentScopes?.includes("world:read")
                ? [enrollmentStatusTool]
                : []),
              ...(this.options.privateMemory && principal.agentScopes?.includes("world:read")
                ? [pactMemoryReadTool, pactMemorySourceTool]
                : []),
              ...(this.options.privateMemory && principal.agentScopes?.includes("game:act")
                ? [pactMemoryWriteTool]
                : []),
              ...(this.options.notes && principal.agentScopes?.includes("world:read") ? [notesReadTool] : []),
              ...(this.options.notes && principal.agentScopes?.includes("game:act") ? [notesWriteTool] : []),
              ...(this.options.profile && principal.agentScopes?.includes("world:read") ? [pactProfileTool] : []),
              ...(this.options.seasons && principal.agentScopes?.includes("world:read") ? [pactSeasonReadTool] : []),
              ...(this.options.agentGuide && principal.agentScopes?.includes("world:read") ? [pactAgentGuideTool] : []),
              ...(this.options.worldViews && principal.agentScopes?.includes("world:read") ? [pactWorldReadTool] : []),
              ...(this.options.publicProfiles && principal.agentScopes?.includes("world:read")
                ? [pactPlayerFindTool]
                : []),
              ...(this.options.kingdomDiscovery && principal.agentScopes?.includes("world:read")
                ? [pactKingdomDiscoveryTool]
                : []),
              ...(this.options.courts && principal.agentScopes?.includes("world:read") ? [pactCourtReadTool] : []),
              ...(this.options.politics && principal.agentScopes?.includes("world:read") ? [pactPoliticsReadTool] : []),
              ...(this.options.seals && principal.agentScopes?.includes("world:read") ? [pactSealReadTool] : []),
              ...(this.options.runReports && principal.agentScopes?.includes("world:read")
                ? [pactEnvoyReportTool]
                : []),
              ...(this.options.chronicle && principal.agentScopes?.includes("world:read")
                ? [pactChronicleReadTool]
                : []),
              ...(this.options.reports && principal.agentScopes?.includes("world:read") ? [pactReportReadTool] : []),
              ...(this.options.inbox && principal.agentScopes?.includes("world:read") ? [pactInboxReadTool] : []),
              ...(this.options.conversations && principal.agentScopes?.includes("world:read")
                ? [pactConversationReadTool]
                : []),
              ...(principal.agentScopes?.includes("world:read") ? [pactReceiptReadTool] : []),
              ...(this.options.approvals && principal.agentScopes?.includes("world:read")
                ? [pactApprovalStatusTool]
                : []),
              ...(this.options.runLeases && principal.agentScopes?.includes("game:act") ? [RUN_OPEN_TOOL] : []),
              ...(this.options.approvalProposals && principal.agentScopes?.includes("game:act")
                ? [pactApprovalProposalV2Tool, pactApprovalProposalTool]
                : []),
              ...(principal.agentScopes?.includes("game:act") ? [pactGameActionV2Tool, pactGameActionTool] : []),
              ...(principal.agentScopes?.includes("game:act") ? SANDBOX_TOOLS : []),
            ].map(chatgptDescriptor),
          }),
          ...(sessionId ? { sessionId } : {}),
        };
      case "tools/call":
        await this.requireSession(principal, sessionId);
        try {
          const result = await this.callTool({ ...principal, agentOrigin: "external" }, body.params ?? {}, sessionId);
          const summary = result.structuredContent;
          if (sessionId && summary && typeof summary === "object" && "code" in summary && summary.code !== "COMMITTED")
            await this.observe(principal.accountId, sessionId, { ...summary, ...this.safeActionMetadata(body.params) });
          return { response: this.result(body.id, result), ...(sessionId ? { sessionId } : {}) };
        } catch (error) {
          if (
            sessionId &&
            error instanceof Error &&
            "code" in error &&
            typeof error.code === "string" &&
            /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
          )
            await this.observe(principal.accountId, sessionId, {
              code: error.code,
              ...this.safeActionMetadata(body.params),
              ...("reason" in error ? { reason: error.reason } : {}),
              ...("detail" in error ? { detail: error.detail } : {}),
            });
          throw error;
        }
      default:
        return {
          response: {
            jsonrpc: "2.0",
            id: body.id ?? null,
            error: { code: -32601, message: `Method not found: ${body.method}` },
          },
          ...(sessionId ? { sessionId } : {}),
        };
    }
  }

  async openStream(principal: AuthenticatedPrincipal, sessionId: string): Promise<{ protocolVersion: string }> {
    const row = await this.requireSession(principal, sessionId);
    return { protocolVersion: row.protocol_version };
  }

  private safeActionMetadata(params: McpJsonRpcRequest["params"]): Record<string, unknown> {
    const name = params?.name;
    const action =
      params?.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>).action
        : undefined;
    const kind = action && typeof action === "object" && "kind" in action ? action.kind : undefined;
    return {
      ...(typeof name === "string" && /^[a-z][a-z0-9_.-]{0,80}$/.test(name) ? { toolName: name } : {}),
      ...(typeof kind === "string" && /^game\.[a-z.-]{1,60}$/.test(kind) ? { actionKind: kind } : {}),
    };
  }

  private async observe(accountId: string, sessionId: string, summary: Record<string, unknown>): Promise<void> {
    // A denial/proposal observation is ancillary. Never replace the original result with an observer failure.
    try {
      await this.options.activity?.record(accountId, sessionId, summary);
    } catch {
      /* Receipt truth is unaffected. */
    }
  }

  /** MCP HTTP DELETE: terminate only the authenticated session and its matching write lease. */
  async closeSession(principal: AuthenticatedPrincipal, sessionId: string): Promise<void> {
    await this.requireSession(principal, sessionId);
    await this.options.runLeases?.releaseMcpLease({ accountId: principal.accountId, holderId: sessionId });
    await this.options.pool.query(`DELETE FROM mcp_sessions WHERE id = $1 AND product_scope = $2 AND account_id = $3`, [
      sessionId,
      this.options.productScope,
      principal.accountId,
    ]);
  }

  private async initialize(
    principal: AuthenticatedPrincipal,
    body: McpJsonRpcRequest,
  ): Promise<{ response: Record<string, unknown>; sessionId: string }> {
    const requested = String(body.params?.protocolVersion ?? "");
    if (!SUPPORTED_MCP_PROTOCOLS.has(requested)) {
      throw new McpError("UNSUPPORTED_PROTOCOL");
    }
    const now = this.options.clock.now();
    const inserted = await this.options.pool.query<{ id: string }>(
      `INSERT INTO mcp_sessions(id, product_scope, account_id, protocol_version, created_at, last_seen_at, oauth_grant_id)
       VALUES ($1, $2, $3, $4, $5, $5, $6)
       ON CONFLICT (product_scope, oauth_grant_id)
         WHERE oauth_grant_id IS NOT NULL AND closed_at IS NULL
       DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at, protocol_version = EXCLUDED.protocol_version
       WHERE mcp_sessions.account_id = EXCLUDED.account_id
       RETURNING id`,
      [randomUUID(), this.options.productScope, principal.accountId, requested, now, principal.agentGrantId ?? null],
    );
    const sessionId = inserted.rows[0]?.id;
    if (!sessionId) throw new McpError("FORBIDDEN", 403);
    return {
      sessionId,
      response: this.result(body.id, {
        protocolVersion: requested,
        capabilities: {
          tools: { listChanged: false },
          ...(this.options.playView
            ? { resources: { listChanged: false }, extensions: { "io.modelcontextprotocol/ui": {} } }
            : {}),
        },
        serverInfo: { name: "pact", version: "0.1.0" },
      }),
    };
  }

  private async callTool(principal: AuthenticatedPrincipal, params: Record<string, unknown>, sessionId?: string) {
    try {
      return await this.operations.execute(principal, params, sessionId);
    } catch (error) {
      if (error instanceof AgentOperationError) throw new McpError(error.code, error.httpStatus);
      throw error;
    }
  }

  /** Last authenticated MCP request, not a continuously connected agent. */
  async councilObservations(accountIds: string[]) {
    const rows = (
      await this.options.pool.query<{ account_id: string; observed_at: Date }>(
        "SELECT account_id,max(last_seen_at) AS observed_at FROM mcp_sessions WHERE product_scope=$1 AND account_id=ANY($2::uuid[]) GROUP BY account_id",
        [this.options.productScope, accountIds],
      )
    ).rows;
    return Object.fromEntries(rows.map((r) => [r.account_id, r.observed_at.toISOString()]));
  }

  private async requireSession(
    principal: Pick<AuthenticatedPrincipal, "accountId" | "agentGrantId">,
    sessionId: string | undefined,
  ): Promise<{ protocol_version: string }> {
    if (!sessionId) throw new McpError("SESSION_NOT_FOUND", 404);
    const result = await this.options.pool.query<{
      protocol_version: string;
      account_id: string;
      oauth_grant_id: string | null;
    }>(
      `SELECT protocol_version, account_id, oauth_grant_id FROM mcp_sessions
       WHERE id = $1 AND product_scope = $2 AND closed_at IS NULL`,
      [sessionId, this.options.productScope],
    );
    const row = result.rows[0];
    if (!row) throw new McpError("SESSION_NOT_FOUND", 404);
    if (row.account_id !== principal.accountId || row.oauth_grant_id !== (principal.agentGrantId ?? null))
      throw new McpError("FORBIDDEN", 403);
    await this.options.pool.query("UPDATE mcp_sessions SET last_seen_at = $2 WHERE id = $1", [
      sessionId,
      this.options.clock.now(),
    ]);
    return row;
  }

  private result(id: string | number | null | undefined, result: unknown): Record<string, unknown> {
    return { jsonrpc: "2.0", id: id ?? null, result };
  }
}
