import { randomUUID } from "node:crypto";
import { type AuthenticatedPrincipal, agentRecovery, type CommandDispatcher } from "@pact/application";
import {
  AgentGameActionSchema,
  AgentGameActionV2Schema,
  AgentGuideQuerySchema,
  ApprovalProposalSchema,
  ApprovalProposalV2Schema,
  ApprovalStatusQuerySchema,
  type ChronicleReadQuery,
  ChronicleReadQuerySchema,
  type CommandReceipt,
  ConversationReadQuerySchema,
  CourtReadQuerySchema,
  commandJsonSchema,
  DecisionSupportQuerySchema,
  InboxReadQuerySchema,
  PlayerFindQuerySchema,
  PoliticsReadQuerySchema,
  ProductScopeSchema,
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
  pactPlayerFindTool,
  pactPoliticsReadTool,
  pactProfileTool,
  pactReceiptReadTool,
  pactReportReadTool,
  pactSealReadTool,
  pactSeasonReadTool,
  pactWorldReadTool,
  ReceiptReadQuerySchema,
  ReportReadQuerySchema,
  RunReportQuerySchema,
  SCHEMA_VERSION,
  SealReadQuerySchema,
  SeasonReadQuerySchema,
  worldReadValidationHelp,
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

export const MCP_PROTOCOL_PRIMARY = "2025-11-25";
export const MCP_PROTOCOL_COMPAT = "2025-06-18";
export const SUPPORTED_MCP_PROTOCOLS = new Set([MCP_PROTOCOL_PRIMARY, MCP_PROTOCOL_COMPAT, "2025-03-26"]);

function receiptToolResult(receipt: CommandReceipt) {
  const denied = receipt.code !== "COMMITTED" && receipt.code !== "ALREADY_COMMITTED";
  return {
    content: [
      { type: "text", text: JSON.stringify(receipt) },
      ...(denied ? [{ type: "text", text: agentRecovery(receipt.code) }] : []),
    ],
    structuredContent: receipt,
    ...(denied ? { isError: true } : {}),
  };
}

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
  description: "Open one bounded write lease for this authenticated MCP session; this does not start model inference.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
} as const;

export class McpTransport {
  constructor(private readonly options: McpTransportOptions) {}

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
              ...(this.options.notes && principal.agentScopes?.includes("world:read") ? [notesReadTool] : []),
              ...(this.options.notes && principal.agentScopes?.includes("game:act") ? [notesWriteTool] : []),
              ...(this.options.profile && principal.agentScopes?.includes("world:read") ? [pactProfileTool] : []),
              ...(this.options.seasons && principal.agentScopes?.includes("world:read") ? [pactSeasonReadTool] : []),
              ...(this.options.agentGuide && principal.agentScopes?.includes("world:read") ? [pactAgentGuideTool] : []),
              ...(this.options.worldViews && principal.agentScopes?.includes("world:read") ? [pactWorldReadTool] : []),
              ...(this.options.publicProfiles && principal.agentScopes?.includes("world:read")
                ? [pactPlayerFindTool]
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

  private async callTool(
    principal: AuthenticatedPrincipal,
    params: Record<string, unknown>,
    sessionId?: string,
  ): Promise<Record<string, unknown>> {
    if (principal.audience !== "agent") {
      throw new McpError("FORBIDDEN", 403);
    }
    const name = String(params.name ?? "");
    if (
      params.arguments !== undefined &&
      (params.arguments === null || typeof params.arguments !== "object" || Array.isArray(params.arguments))
    )
      throw new McpError("INVALID_REQUEST");
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    if (name === councilThreadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.councilThreads)
        throw new McpError("FORBIDDEN", 403);
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (
        Object.keys(args).some((k) => !["kingdomId", "beforeGameTimeMs", "beforeId"].includes(k)) ||
        typeof args.kingdomId !== "string" ||
        !uuid.test(args.kingdomId) ||
        Boolean(args.beforeId) !== Boolean(args.beforeGameTimeMs) ||
        (args.beforeId !== undefined && (typeof args.beforeId !== "string" || !uuid.test(args.beforeId))) ||
        (args.beforeGameTimeMs !== undefined &&
          (typeof args.beforeGameTimeMs !== "string" || !/^\d{1,18}$/.test(args.beforeGameTimeMs)))
      )
        throw new McpError("INVALID_REQUEST");
      const data = await this.options.councilThreads.read(
        principal.accountId,
        args.kingdomId,
        typeof args.beforeId === "string" && typeof args.beforeGameTimeMs === "string"
          ? { id: args.beforeId, gameTimeMs: args.beforeGameTimeMs }
          : undefined,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data), annotations: { audience: ["assistant"] } }],
        structuredContent: data,
      };
    }
    if (name === playTool.name || name === notesReadTool.name) {
      if (!principal.agentScopes?.includes("world:read")) throw new McpError("FORBIDDEN", 403);
      const port = name === playTool.name ? this.options.playView : this.options.notes;
      if (!port) throw new McpError("FORBIDDEN", 403);
      if (name === notesReadTool.name && Object.keys(args).length) throw new McpError("INVALID_REQUEST");
      if (
        name === playTool.name &&
        (Object.keys(args).some((k) => !["search", "offset"].includes(k)) ||
          (args.search !== undefined && (typeof args.search !== "string" || args.search.length > 80)) ||
          (args.offset !== undefined &&
            (!Number.isSafeInteger(args.offset) || Number(args.offset) < 0 || Number(args.offset) > 10000)))
      )
        throw new McpError("INVALID_REQUEST");
      const result =
        name === playTool.name
          ? await this.options.playView?.read(principal.accountId, {
              search: String(args.search ?? ""),
              offset: Number(args.offset ?? 0),
            })
          : await this.options.notes?.read(principal.accountId);
      const data = { ...(result && typeof result === "object" ? result : { result }), untrustedContent: true };
      return {
        content: [{ type: "text", text: JSON.stringify(data), annotations: { audience: ["assistant"] } }],
        structuredContent: data,
      };
    }
    if (name === notesWriteTool.name) {
      if (!principal.agentScopes?.includes("game:act") || !this.options.notes) throw new McpError("FORBIDDEN", 403);
      if (
        Object.keys(args).some((k) => !["text", "expectedVersion"].includes(k)) ||
        typeof args.text !== "string" ||
        args.text.length > 8000 ||
        !Number.isSafeInteger(args.expectedVersion) ||
        Number(args.expectedVersion) < 1
      )
        throw new McpError("INVALID_REQUEST");
      const result = await this.options.notes.write(principal.accountId, args.text, Number(args.expectedVersion));
      const data = { ...(result && typeof result === "object" ? result : { result }), untrustedContent: true };
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data,
        ...("saved" in data && data.saved === false ? { isError: true } : {}),
      };
    }
    if (name === pactProfileTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.profile) throw new McpError("FORBIDDEN", 403);
      if (
        (params.arguments !== undefined &&
          (params.arguments === null || typeof params.arguments !== "object" || Array.isArray(params.arguments))) ||
        Object.keys(args).length !== 0
      )
        throw new McpError("INVALID_REQUEST");
      const details = await this.options.profile.read(principal.accountId);
      const profile = { id: principal.accountId, ...(details.nickname ? { nickname: details.nickname } : {}) };
      return {
        content: [{ type: "text", text: JSON.stringify(profile) }],
        structuredContent: profile,
        isError: false,
      };
    }
    if (name === pactAgentGuideTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.agentGuide)
        throw new McpError("FORBIDDEN", 403);
      const query = AgentGuideQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const guide = await this.options.agentGuide.read(principal.accountId, query.data.topic);
      return {
        content: [{ type: "text", text: JSON.stringify(guide) }],
        structuredContent: guide,
      };
    }
    if (name === RUN_OPEN_TOOL.name) {
      if (
        !principal.agentScopes?.includes("game:act") ||
        !this.options.runLeases ||
        !sessionId ||
        Object.keys(args).length !== 0
      )
        throw new McpError("FORBIDDEN", 403);
      let lease: { leaseId: string; expiresAt: Date };
      try {
        lease = await this.options.runLeases.openMcpLease({ accountId: principal.accountId, holderId: sessionId });
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "RUN_ALREADY_ACTIVE")
          throw new McpError("RUN_ALREADY_ACTIVE", 409);
        throw error;
      }
      const result = { leaseId: lease.leaseId, expiresAt: lease.expiresAt.toISOString() };
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactPlayerFindTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.publicProfiles)
        throw new McpError("FORBIDDEN", 403);
      const query = PlayerFindQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const kingdom = await this.options.publicProfiles.read(query.data.handle);
      const result = { found: kingdom !== null, kingdom, untrustedContent: true };
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactCourtReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.courts) throw new McpError("FORBIDDEN", 403);
      const query = CourtReadQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const result = await this.options.courts.read(query.data.handle, query.data.offset, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactSealReadTool.name) {
      // Seal reads never expose original omitted evidence.
      if (!principal.agentScopes?.includes("world:read") || !this.options.seals) throw new McpError("FORBIDDEN", 403);
      const query = SealReadQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const result = await this.options.seals.read(query.data.sealId, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactChronicleReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.chronicle)
        throw new McpError("FORBIDDEN", 403);
      const query = ChronicleReadQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const result = await this.options.chronicle.read(query.data, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactPoliticsReadTool.name) {
      // Political prose cannot grant authority.
      if (!principal.agentScopes?.includes("world:read") || !this.options.politics)
        throw new McpError("FORBIDDEN", 403);
      const query = PoliticsReadQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const result = await this.options.politics.read(query.data.handle, query.data.offset, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactEnvoyReportTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.runReports)
        throw new McpError("FORBIDDEN", 403);
      const q = RunReportQuerySchema.safeParse(args);
      if (!q.success) throw new McpError("INVALID_REQUEST");
      const result = await this.options.runReports.read(q.data.runId, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactSeasonReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.seasons) throw new McpError("FORBIDDEN", 403);
      const q = SeasonReadQuerySchema.safeParse(args);
      if (!q.success) throw new McpError("INVALID_REQUEST");
      const result = await this.options.seasons.read(q.data, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactWorldReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.worldViews)
        throw new McpError("FORBIDDEN", 403);
      const parsed = worldReadValidationHelp(args);
      if (!parsed.valid) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(parsed.error) }],
          structuredContent: parsed.error,
        };
      }
      const query = { data: parsed.query };
      const view = query.data.targetKingdomId
        ? await this.options.worldViews.read(
            principal.accountId,
            query.data.targetKingdomId,
            query.data.forecastMinutes,
          )
        : await this.options.worldViews.readSelf?.(principal.accountId, query.data.forecastMinutes);
      if (!view) {
        const result = {
          code: "NOT_FOUND",
          receiptExists: false,
          message:
            "No authorized kingdom view is available. An unfounded owner must finish human signup and founding in PACT.",
        };
        return { isError: true, content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(view) }],
        structuredContent: view as Record<string, unknown>,
      };
    }
    if (name === pactReportReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.reports) throw new McpError("FORBIDDEN", 403);
      const query = ReportReadQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const report = await this.options.reports.read(principal.accountId, query.data.kind, query.data.recordId);
      if (!report) throw new McpError("INVALID_REQUEST", 404);
      return {
        content: [{ type: "text", text: JSON.stringify(report) }],
        structuredContent: report as Record<string, unknown>,
      };
    }
    if (name === pactInboxReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.inbox) throw new McpError("FORBIDDEN", 403);
      const query = InboxReadQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const page = await this.options.inbox.readBounded(principal.accountId, query.data.cursor, query.data.limit);
      return {
        content: [{ type: "text", text: JSON.stringify(page) }],
        structuredContent: page as Record<string, unknown>,
      };
    }
    if (name === pactDecisionSupportTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.decisionSupport)
        throw new McpError("FORBIDDEN", 403);
      const query = DecisionSupportQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST", 400);
      const result = await this.options.decisionSupport.read(
        principal.accountId,
        query.data.candidateId,
        query.data.proposalOffset,
      );
      const data = result ?? { code: "NOT_FOUND" };
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data as Record<string, unknown>,
      };
    }
    if (name === conversationHistoryTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.conversationHistory)
        throw new McpError("FORBIDDEN", 403);
      const peer = args?.kingdomId,
        before = args?.beforeGameTimeMs,
        beforeId = args?.beforeId,
        offerId = args?.offerId,
        beforeVersion = args?.beforeVersion;
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (
        typeof peer !== "string" ||
        !uuid.test(peer) ||
        Boolean(before) !== Boolean(beforeId) ||
        Boolean(offerId) !== Boolean(beforeVersion) ||
        Object.keys(args ?? {}).some(
          (k) => !["kingdomId", "beforeGameTimeMs", "beforeId", "offerId", "beforeVersion"].includes(k),
        )
      )
        throw new McpError("INVALID_REQUEST");
      if (
        before !== undefined &&
        (typeof before !== "string" ||
          !/^\d{1,18}$/.test(before) ||
          typeof beforeId !== "string" ||
          !uuid.test(beforeId))
      )
        throw new McpError("INVALID_REQUEST");
      if (
        offerId !== undefined &&
        (typeof offerId !== "string" ||
          !uuid.test(offerId) ||
          typeof beforeVersion !== "number" ||
          !Number.isSafeInteger(beforeVersion) ||
          beforeVersion < 1 ||
          before !== undefined)
      )
        throw new McpError("INVALID_REQUEST");
      const result =
        typeof offerId === "string" && typeof beforeVersion === "number"
          ? await this.options.conversationHistory.versions(principal.accountId, peer, offerId, beforeVersion)
          : await this.options.conversationHistory.agreements(
              principal.accountId,
              peer,
              typeof before === "string" && typeof beforeId === "string"
                ? { id: beforeId, gameTimeMs: before }
                : undefined,
            );
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactConversationReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.conversations)
        throw new McpError("FORBIDDEN", 403);
      const query = ConversationReadQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const page = await this.options.conversations.read(
        principal.accountId,
        query.data.counterpartyKingdomId,
        query.data.limit,
      );
      if (!page) throw new McpError("INVALID_REQUEST", 404);
      return {
        content: [{ type: "text", text: JSON.stringify(page) }],
        structuredContent: page as Record<string, unknown>,
      };
    }
    if (name === pactReceiptReadTool.name) {
      if (!principal.agentScopes?.includes("world:read")) throw new McpError("FORBIDDEN", 403);
      const query = ReceiptReadQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const receipt = await this.options.dispatcher.lookupReceipt(principal, query.data.commandId);
      if (!receipt) {
        const result = {
          code: "RECEIPT_NOT_FOUND",
          receiptExists: false,
          message:
            "No receipt for this account and command ID. A deterministic validation/rules denial before commit creates no receipt. Correct the denied action; do not interpret this as success. After a transport timeout reconcile the same ID before retrying.",
        };
        return { isError: true, content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
      }
      return receiptToolResult(receipt);
    }
    if (name === pactApprovalStatusTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.approvals)
        throw new McpError("FORBIDDEN", 403);
      const query = ApprovalStatusQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const status = await this.options.approvals.read(principal.accountId, query.data.approvalId);
      if (!status) throw new McpError("INVALID_REQUEST", 404);
      const result = {
        ...status,
        deepLink: `${this.options.origin}${String((status as Record<string, unknown>).deepLinkPath)}`,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
    if (name === pactApprovalProposalTool.name || name === pactApprovalProposalV2Tool.name) {
      if (!principal.agentScopes?.includes("game:act") || !this.options.approvalProposals || !sessionId)
        throw new McpError("FORBIDDEN", 403);
      const parsed = (
        name === pactApprovalProposalV2Tool.name ? ApprovalProposalV2Schema : ApprovalProposalSchema
      ).safeParse(args);
      if (!parsed.success) throw new McpError("INVALID_REQUEST");
      const approval = await this.options.approvalProposals.proposeAgent({ ...principal, sessionId }, parsed.data);
      const result = {
        code: "APPROVAL_REQUIRED",
        approvalId: approval.approvalId,
        deepLink: `${this.options.origin}${approval.deepLinkPath}`,
        effectsSummary: approval.effectsSummary,
        expiresAt: approval.expiresAt.toISOString(),
      };
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (!principal.agentScopes?.includes("game:act")) throw new McpError("FORBIDDEN", 403);
    if (name === pactGameActionTool.name || name === pactGameActionV2Tool.name) {
      const parsed = (name === pactGameActionV2Tool.name ? AgentGameActionV2Schema : AgentGameActionSchema).safeParse(
        args,
      );
      if (!parsed.success) throw new McpError("INVALID_REQUEST");
      const command = {
        schemaVersion: name === pactGameActionV2Tool.name ? "pact.command.v2" : SCHEMA_VERSION,
        commandId: parsed.data.commandId,
        actor: {
          principalId: principal.accountId,
          productScope: ProductScopeSchema.parse(this.options.productScope),
          audience: principal.audience,
          subject: { type: "account" as const, id: principal.accountId },
        },
        ...(parsed.data.expectedVersion === undefined ? {} : { expectedVersion: parsed.data.expectedVersion }),
        action: parsed.data.action,
        submittedAt: this.options.clock.now().toISOString(),
      };
      const receipt = await this.options.dispatcher.dispatch(
        { ...principal, ...(sessionId ? { sessionId } : {}) },
        command,
      );
      return receiptToolResult(receipt);
    }
    if (name === "pact_command_v1") {
      const receipt = await this.options.dispatcher.dispatch(
        { ...principal, ...(sessionId ? { sessionId } : {}) },
        args,
      );
      return { content: [{ type: "text", text: JSON.stringify(receipt) }], structuredContent: receipt };
    }
    const action =
      name === "sandbox.echo"
        ? { kind: "sandbox.echo" as const, message: String(args.message ?? "") }
        : name === "sandbox.counter.increment"
          ? {
              kind: "sandbox.counter.increment" as const,
              counterId: String(args.counterId ?? ""),
              amount: Number(args.amount ?? 0),
            }
          : name === "sandbox.draft.read"
            ? { kind: "sandbox.draft.read" as const }
            : name === "sandbox.draft.write"
              ? { kind: "sandbox.draft.write" as const, note: String(args.note ?? "") }
              : null;
    if (!action) throw new McpError("INVALID_REQUEST");
    const command = {
      schemaVersion: SCHEMA_VERSION,
      commandId: randomUUID(),
      actor: {
        principalId: principal.accountId,
        productScope: ProductScopeSchema.parse(this.options.productScope),
        audience: principal.audience,
        subject: { type: "account" as const, id: principal.accountId },
      },
      action,
      submittedAt: this.options.clock.now().toISOString(),
    };
    const receipt = await this.options.dispatcher.dispatch(
      { ...principal, ...(sessionId ? { sessionId } : {}) },
      command,
    );
    return receiptToolResult(receipt);
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
