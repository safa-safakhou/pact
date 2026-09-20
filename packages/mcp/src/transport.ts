import { randomUUID } from "node:crypto";
import type { AuthenticatedPrincipal, CommandDispatcher } from "@pact/application";
import { commandJsonSchema, ProductScopeSchema, SCHEMA_VERSION } from "@pact/contracts";
import type { Pool } from "pg";

export const MCP_PROTOCOL_PRIMARY = "2025-11-25";
export const MCP_PROTOCOL_COMPAT = "2025-06-18";
export const SUPPORTED_MCP_PROTOCOLS = new Set([MCP_PROTOCOL_PRIMARY, MCP_PROTOCOL_COMPAT]);

export class McpError extends Error {
  constructor(
    readonly code: "UNSUPPORTED_PROTOCOL" | "FORBIDDEN" | "INVALID_REQUEST" | "SESSION_NOT_FOUND",
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
          response: this.result(body.id, { tools: SANDBOX_TOOLS }),
          ...(sessionId ? { sessionId } : {}),
        };
      case "tools/call":
        await this.requireSession(principal.accountId, sessionId);
        return {
          response: this.result(body.id, await this.callTool(principal, body.params ?? {})),
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
  ): Promise<Record<string, unknown>> {
    const name = String(params.name ?? "");
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    if (name === "pact_command_v1") {
      const receipt = await this.options.dispatcher.dispatch(principal, args);
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
    const receipt = await this.options.dispatcher.dispatch(principal, command);
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
