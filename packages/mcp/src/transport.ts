import { randomUUID } from "node:crypto";
import type { AuthenticatedPrincipal, CommandDispatcher } from "@pact/application";
import {
  AgentGameActionSchema,
  AgentGuideQuerySchema,
  ApprovalProposalSchema,
  ApprovalStatusQuerySchema,
  ConversationReadQuerySchema,
  commandJsonSchema,
  InboxReadQuerySchema,
  ProductScopeSchema,
  pactAgentGuideTool,
  pactApprovalProposalTool,
  pactApprovalStatusTool,
  pactConversationReadTool,
  pactGameActionTool,
  pactInboxReadTool,
  pactReceiptReadTool,
  pactReportReadTool,
  pactWorldReadTool,
  ReceiptReadQuerySchema,
  ReportReadQuerySchema,
  SCHEMA_VERSION,
  WorldViewQuerySchema,
} from "@pact/contracts";
import type { Pool } from "pg";

export const MCP_PROTOCOL_PRIMARY = "2025-11-25";
export const MCP_PROTOCOL_COMPAT = "2025-06-18";
export const SUPPORTED_MCP_PROTOCOLS = new Set([MCP_PROTOCOL_PRIMARY, MCP_PROTOCOL_COMPAT]);

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
  readonly pool: Pool;
  readonly productScope: string;
  readonly dispatcher: CommandDispatcher;
  readonly origin: string;
  readonly clock: { now(): Date };
  readonly worldViews?: WorldViewReader;
  readonly agentGuide?: AgentGuideReader;
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
}

/** Product-owned owner projection and learning guide; MCP never accepts a caller-supplied account. */
export interface AgentGuideReader {
  read(
    accountId: string,
    topic: "start" | "development" | "diplomacy" | "military" | "authority",
  ): Promise<Record<string, unknown>>;
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
      case "tools/list":
        await this.requireSession(principal.accountId, sessionId);
        return {
          response: this.result(body.id, {
            tools: [
              ...(this.options.agentGuide && principal.agentScopes?.includes("world:read") ? [pactAgentGuideTool] : []),
              ...(this.options.worldViews && principal.agentScopes?.includes("world:read") ? [pactWorldReadTool] : []),
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
                ? [pactApprovalProposalTool]
                : []),
              ...(principal.agentScopes?.includes("game:act") ? [pactGameActionTool] : []),
              ...(principal.agentScopes?.includes("game:act") ? SANDBOX_TOOLS : []),
            ],
          }),
          ...(sessionId ? { sessionId } : {}),
        };
      case "tools/call":
        await this.requireSession(principal.accountId, sessionId);
        return {
          response: this.result(body.id, await this.callTool(principal, body.params ?? {}, sessionId)),
          ...(sessionId ? { sessionId } : {}),
        };
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
    const row = await this.requireSession(principal.accountId, sessionId);
    return { protocolVersion: row.protocol_version };
  }

  /** MCP HTTP DELETE: terminate only the authenticated session and its matching write lease. */
  async closeSession(principal: AuthenticatedPrincipal, sessionId: string): Promise<void> {
    await this.requireSession(principal.accountId, sessionId);
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
    const sessionId = randomUUID();
    const now = this.options.clock.now();
    await this.options.pool.query(
      `INSERT INTO mcp_sessions(id, product_scope, account_id, protocol_version, created_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [sessionId, this.options.productScope, principal.accountId, requested, now],
    );
    return {
      sessionId,
      response: this.result(body.id, {
        protocolVersion: requested,
        capabilities: { tools: { listChanged: false } },
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
    const args = (params.arguments ?? {}) as Record<string, unknown>;
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
    if (name === pactWorldReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.worldViews)
        throw new McpError("FORBIDDEN", 403);
      const query = WorldViewQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const view = await this.options.worldViews.read(
        principal.accountId,
        query.data.targetKingdomId,
        query.data.forecastMinutes,
      );
      if (!view) throw new McpError("INVALID_REQUEST", 404);
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
      if (!receipt) throw new McpError("INVALID_REQUEST", 404);
      return { content: [{ type: "text", text: JSON.stringify(receipt) }], structuredContent: receipt };
    }
    if (name === pactApprovalStatusTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.approvals)
        throw new McpError("FORBIDDEN", 403);
      const query = ApprovalStatusQuerySchema.safeParse(args);
      if (!query.success) throw new McpError("INVALID_REQUEST");
      const status = await this.options.approvals.read(principal.accountId, query.data.approvalId);
      if (!status) throw new McpError("INVALID_REQUEST", 404);
      return {
        content: [{ type: "text", text: JSON.stringify(status) }],
        structuredContent: status as Record<string, unknown>,
      };
    }
    if (name === pactApprovalProposalTool.name) {
      if (!principal.agentScopes?.includes("game:act") || !this.options.approvalProposals || !sessionId)
        throw new McpError("FORBIDDEN", 403);
      const parsed = ApprovalProposalSchema.safeParse(args);
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
    if (name === pactGameActionTool.name) {
      const parsed = AgentGameActionSchema.safeParse(args);
      if (!parsed.success) throw new McpError("INVALID_REQUEST");
      const command = {
        schemaVersion: SCHEMA_VERSION,
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
      return { content: [{ type: "text", text: JSON.stringify(receipt) }], structuredContent: receipt };
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
    return { content: [{ type: "text", text: JSON.stringify(receipt) }], structuredContent: receipt };
  }

  private async requireSession(
    accountId: string,
    sessionId: string | undefined,
  ): Promise<{ protocol_version: string }> {
    if (!sessionId) throw new McpError("SESSION_NOT_FOUND", 404);
    const result = await this.options.pool.query<{ protocol_version: string; account_id: string }>(
      `SELECT protocol_version, account_id FROM mcp_sessions
       WHERE id = $1 AND product_scope = $2 AND closed_at IS NULL`,
      [sessionId, this.options.productScope],
    );
    const row = result.rows[0];
    if (!row) throw new McpError("SESSION_NOT_FOUND", 404);
    if (row.account_id !== accountId) throw new McpError("FORBIDDEN", 403);
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
