import { createHash, randomUUID } from "node:crypto";
import {
  AgentCard,
  type CancelTaskRequest,
  type GetTaskRequest,
  type ListTasksRequest,
  type ListTasksResponse,
  Message,
  Role,
  type SendMessageRequest,
  type StreamResponse,
  Task,
  TaskState,
} from "@a2a-js/sdk";
import {
  ContentTypeNotSupportedError,
  PushNotificationNotSupportedError,
  RequestMalformedError,
  TaskNotCancelableError,
  TaskNotFoundError,
  UnsupportedOperationError,
} from "@a2a-js/sdk/errors";
import {
  type A2ARequestHandler,
  JsonRpcTransportHandler,
  ServerCallContext,
  validateVersion,
} from "@a2a-js/sdk/server";
import {
  AgentOperationError,
  type AgentOperationOptions,
  AgentOperationService,
  type AuthenticatedPrincipal,
  agentRecovery,
  type CommandDispatcher,
  DispatcherError,
} from "@pact/application";
import { AgentScopeSchema, type CommandReceipt, CommandReceiptSchema, ProductScopeSchema } from "@pact/contracts";
import type { OAuthService } from "@pact/oauth";
import type { RunService } from "@pact/runs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const operationSchema = z
  .object({ operation: z.string().min(1).max(100), arguments: z.record(z.string(), z.unknown()).default({}) })
  .strict();
const principalKey = "pactAuthenticatedPrincipal";
function principal(context: ServerCallContext): AuthenticatedPrincipal {
  const p = context.state.get(principalKey) as AuthenticatedPrincipal | undefined;
  if (context.tenant || !p || p.audience !== "agent" || !p.agentGrantId)
    throw new RequestMalformedError("Authentication required");
  return p;
}
function contextId(p: AuthenticatedPrincipal) {
  const hex = createHash("sha256").update(`pact:a2a:${p.productScope}:${p.accountId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function taskId(commandId: string) {
  return `pact-receipt:${commandId}`;
}
function receiptTask(p: AuthenticatedPrincipal, receipt: CommandReceipt, includeArtifacts = true): Task {
  const success = ["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.code);
  return Task.fromJSON({
    id: taskId(receipt.commandId),
    contextId: contextId(p),
    status: { state: success ? "TASK_STATE_COMPLETED" : "TASK_STATE_FAILED", timestamp: receipt.committedAt },
    artifacts: includeArtifacts
      ? [
          {
            artifactId: receipt.commandId,
            name: "Canonical game command receipt",
            parts: [
              {
                data: {
                  receipt,
                  meaning: "Command processing result; not proof of completed construction, negotiation or delivery",
                },
                mediaType: "application/json",
              },
            ],
          },
        ]
      : [],
    history: [],
    metadata: { source: "canonical_game_receipt", operationOnly: true },
  });
}
export class PactA2AHandler implements A2ARequestHandler {
  readonly operations: AgentOperationService;
  constructor(
    readonly baseUrl: string,
    readonly options: AgentOperationOptions,
    private readonly runs: RunService,
    private readonly dispatcher: CommandDispatcher,
  ) {
    this.operations = new AgentOperationService({
      ...options,
      runLeases: {
        openMcpLease: (i) => runs.openExternalLease({ ...i, kind: "a2a" }),
        releaseMcpLease: (i) => runs.releaseExternalLease({ ...i, kind: "a2a" }),
      },
    });
  }
  async getAgentCard(): Promise<AgentCard> {
    return AgentCard.fromJSON({
      name: "PACT game agent gateway",
      description:
        "Optional structured game access. Agents choose their interface. All actions use the same game ownership, permissions, leases and receipts; no inference is started.",
      version: "1.0.0",
      supportedInterfaces: [{ url: `${this.baseUrl}/a2a`, protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
      capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: true },
      defaultInputModes: ["application/json"],
      defaultOutputModes: ["application/json"],
      securitySchemes: {
        pactOAuth: {
          oauth2SecurityScheme: {
            flows: {
              authorizationCode: {
                authorizationUrl: `${this.baseUrl}/oauth/authorize?audience=a2a`,
                tokenUrl: `${this.baseUrl}/oauth/token`,
                scopes: {
                  "world:read": "Read authorized game records",
                  "game:act": "Propose permitted game commands",
                  "messages:write": "Communication scope; game permissions still apply",
                },
              },
            },
          },
        },
      },
      securityRequirements: [{ schemes: { pactOAuth: { list: [] } } }],
      skills: [
        {
          id: "game.observe",
          name: "Observe game",
          description:
            "Send one JSON data part with {operation,arguments} using the game operation names and schemas from the authenticated /a2a/operations endpoint. Owner/private reads derive identity from the OAuth grant.",
          securityRequirements: [{ schemes: { pactOAuth: { list: ["world:read"] } } }],
          tags: ["game", "discovery"],
          examples: ['{"operation":"pact_world_read_v1","arguments":{}}'],
        },
        {
          id: "game.command",
          name: "Submit a game command",
          description:
            "game:act and an explicitly opened lease are required. Use a stable commandId; normal mandates/social delegation/human-only rules apply. Canonical receipts are recoverable as operation tasks.",
          securityRequirements: [{ schemes: { pactOAuth: { list: ["game:act"] } } }],
          tags: ["game", "commands"],
          examples: [
            '{"operation":"pact_game_action_v2","arguments":{"commandId":"<UUID>","action":{"kind":"game.message.send","recipientKingdomId":"<observed UUID>","body":"Your proposal"}}}',
          ],
        },
        {
          id: "game.lease",
          name: "Open or close this connection lease",
          description:
            "run.open/run.close reserve or release only this grant's exclusive fifteen-minute write lease. They never start inference or enroll a scheduler.",
          securityRequirements: [{ schemes: { pactOAuth: { list: ["game:act"] } } }],
          tags: ["lease"],
        },
      ],
    });
  }
  async getAuthenticatedExtendedAgentCard(_params: unknown, context: ServerCallContext): Promise<AgentCard> {
    const p = principal(context),
      card = await this.getAgentCard();
    card.skills = card.skills.filter((s) =>
      s.id === "game.observe" ? p.agentScopes?.includes("world:read") : p.agentScopes?.includes("game:act"),
    );
    return card;
  }
  async sendMessage(params: SendMessageRequest, context: ServerCallContext): Promise<Message | Task> {
    const p = principal(context),
      m = params.message;
    if (
      params.tenant ||
      !m ||
      m.role !== Role.ROLE_USER ||
      !z.uuid().safeParse(m.messageId).success ||
      (m.contextId && m.contextId !== contextId(p)) ||
      m.referenceTaskIds.length
    )
      throw new RequestMalformedError("Invalid message or context");
    if (params.configuration?.taskPushNotificationConfig) throw new PushNotificationNotSupportedError();
    if (
      params.configuration?.acceptedOutputModes.length &&
      !params.configuration.acceptedOutputModes.includes("application/json")
    )
      throw new ContentTypeNotSupportedError();
    if (
      m.parts.length !== 1 ||
      m.parts[0]?.content?.$case !== "data" ||
      (m.parts[0].mediaType && m.parts[0].mediaType !== "application/json")
    )
      throw new ContentTypeNotSupportedError(
        "One structured JSON data part is required; prose, URLs and files are not executable instructions",
      );
    const input = operationSchema.safeParse(m.parts[0].content.value);
    if (!input.success)
      throw new RequestMalformedError("Use {operation,arguments}; identity and permissions cannot be supplied");
    const { operation, arguments: args } = input.data;
    if (!operation.startsWith("pact_") && !["run.open", "run.close"].includes(operation))
      throw new RequestMalformedError("Unsupported game operation");
    const commandId = args.commandId;
    if (
      m.taskId &&
      (typeof commandId !== "string" ||
        !z.uuid().safeParse(commandId).success ||
        m.taskId !== taskId(commandId) ||
        !(await this.dispatcher.lookupReceipt(p, commandId)))
    )
      throw new TaskNotFoundError();
    let output: Record<string, unknown>;
    try {
      if (operation === "run.close") {
        if (!p.agentScopes?.includes("game:act")) throw new AgentOperationError("FORBIDDEN", 403);
        if (Object.keys(args).length) throw new AgentOperationError("INVALID_REQUEST");
        await this.runs.releaseExternalLease({
          accountId: p.accountId,
          holderId: `a2a:${p.agentGrantId}`,
          kind: "a2a",
        });
        output = { closed: true };
      } else
        output = await this.operations.execute(
          { ...p, agentOrigin: "external" },
          { name: operation, arguments: args },
          `a2a:${p.agentGrantId}`,
        );
    } catch (error) {
      const code =
        error instanceof RequestMalformedError
          ? "INVALID_REQUEST"
          : error &&
              typeof error === "object" &&
              "code" in error &&
              typeof error.code === "string" &&
              /^[A-Z][A-Z0-9_]{1,70}$/.test(error.code)
            ? error.code
            : "TRANSPORT_UNCERTAIN";
      output = {
        isError: true,
        structuredContent: {
          code,
          uncertain: code === "TRANSPORT_UNCERTAIN",
          ...(error instanceof DispatcherError
            ? {
                ...(error.reason ? { reason: error.reason } : {}),
                ...(error.detail ? { detail: error.detail } : {}),
                ...(error.retryAfterMs === undefined ? {} : { retryAfterMs: error.retryAfterMs }),
              }
            : {}),
          recovery:
            code === "TRANSPORT_UNCERTAIN"
              ? "Inspect the original command receipt before retrying. New credentials, permissions or command IDs are not inferred."
              : agentRecovery(code, error instanceof DispatcherError ? error.detail : undefined),
        },
      };
    }
    if (["pact_game_action_v2", "pact_game_action_v1", "pact_command_v1"].includes(operation)) {
      const parsed = CommandReceiptSchema.safeParse(output.structuredContent);
      if (parsed.success && parsed.data.commandId === commandId && parsed.data.code !== "IDEMPOTENCY_CONFLICT") {
        // Only the actual result of this invocation may become a task. An old receipt
        // must never mask a fresh authorization, validation or payload denial.
        const receipt = await this.dispatcher.lookupReceipt(p, parsed.data.commandId);
        if (receipt && receipt.code === parsed.data.code) return receiptTask(p, receipt);
      }
    }
    return Message.fromJSON({
      messageId: randomUUID(),
      contextId: contextId(p),
      role: "ROLE_AGENT",
      parts: [
        {
          data: output.structuredContent ?? output,
          metadata: { isError: Boolean(output.isError) },
          mediaType: "application/json",
        },
      ],
    });
  }
  async getTask(params: GetTaskRequest, context: ServerCallContext): Promise<Task> {
    const p = principal(context);
    if (params.tenant || !params.id.startsWith("pact-receipt:") || !z.uuid().safeParse(params.id.slice(13)).success)
      throw new TaskNotFoundError();
    const receipt = await this.dispatcher.lookupReceipt(p, params.id.slice(13));
    if (!receipt) throw new TaskNotFoundError();
    return receiptTask(p, receipt);
  }
  async cancelTask(params: CancelTaskRequest, context: ServerCallContext): Promise<Task> {
    await this.getTask(params, context);
    throw new TaskNotCancelableError("A processed game command cannot be undone by canceling an A2A task");
  }
  async listTasks(params: ListTasksRequest, context: ServerCallContext): Promise<ListTasksResponse> {
    const p = principal(context);
    if (!p.agentScopes?.includes("world:read")) throw new RequestMalformedError("world:read required");
    if (params.tenant || (params.contextId && params.contextId !== contextId(p))) throw new TaskNotFoundError();
    const offset = params.pageToken ? Number(params.pageToken) : 0,
      limit = params.pageSize ?? 50;
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > 10000 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (params.pageToken && !/^\d+$/.test(params.pageToken)) ||
      (params.statusTimestampAfter && !z.iso.datetime({ offset: true }).safeParse(params.statusTimestampAfter).success)
    )
      throw new RequestMalformedError("Invalid task pagination or timestamp");
    if (params.status && ![TaskState.TASK_STATE_COMPLETED, TaskState.TASK_STATE_FAILED].includes(params.status))
      return { tasks: [], pageSize: limit, nextPageToken: "", totalSize: 0 };
    const found = await this.dispatcher.listReceipts(p, {
      offset,
      limit,
      ...(params.statusTimestampAfter ? { after: params.statusTimestampAfter } : {}),
      ...(params.status ? { committed: params.status === TaskState.TASK_STATE_COMPLETED } : {}),
    });
    return {
      tasks: found.receipts.map((r) => receiptTask(p, r, params.includeArtifacts ?? false)),
      pageSize: limit,
      totalSize: found.total,
      nextPageToken: offset + found.receipts.length < found.total ? String(offset + found.receipts.length) : "",
    };
  }
  sendMessageStream(): AsyncGenerator<StreamResponse, void, undefined> {
    throw new UnsupportedOperationError("Streaming is not advertised");
  }
  resubscribe(): AsyncGenerator<StreamResponse, void, undefined> {
    throw new UnsupportedOperationError("Streaming is not advertised");
  }
  async createTaskPushNotificationConfig(): Promise<never> {
    throw new PushNotificationNotSupportedError();
  }
  async getTaskPushNotificationConfig(): Promise<never> {
    throw new PushNotificationNotSupportedError();
  }
  async listTaskPushNotificationConfigs(): Promise<never> {
    throw new PushNotificationNotSupportedError();
  }
  async deleteTaskPushNotificationConfig(): Promise<never> {
    throw new PushNotificationNotSupportedError();
  }
}

export function registerA2ARoutes(
  server: FastifyInstance,
  handler: PactA2AHandler,
  oauth: OAuthService,
  origin: string,
) {
  const transport = new JsonRpcTransportHandler(handler);
  server.decorateRequest("a2aPrincipal");
  server.get("/.well-known/agent-card.json", async (_r, reply) =>
    reply.header("cache-control", "no-store").send(AgentCard.toJSON(await handler.getAgentCard())),
  );
  server.get("/.well-known/oauth-protected-resource/a2a", async (_r, reply) =>
    reply.header("cache-control", "no-store").send(oauth.protectedResourceMetadata("a2a")),
  );
  server.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.url !== "/a2a" && request.routeOptions.url !== "/a2a/operations") return;
    reply.header("cache-control", "no-store").header("A2A-Version", "1.0");
    if (request.headers.origin && request.headers.origin !== origin)
      return reply.code(403).send({ error: { code: "FORBIDDEN" } });
    const auth = request.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? await oauth.introspectAccessToken(auth.slice(7), "a2a") : null;
    if (!token)
      return reply
        .code(401)
        .header(
          "www-authenticate",
          `Bearer resource_metadata="${handler.baseUrl}/.well-known/oauth-protected-resource/a2a"`,
        )
        .send({ error: { code: "AUTH_REQUIRED" } });
    const p: AuthenticatedPrincipal = {
      accountId: token.accountId,
      productScope: ProductScopeSchema.parse("pact"),
      audience: "agent",
      agentScopes: z.array(AgentScopeSchema).parse(token.scopes),
      agentGrantId: token.grantId,
    };
    request.a2aPrincipal = p;
  });
  server.get("/a2a/operations", async (request) => ({
    input: { operation: "name from operations", arguments: "object matching inputSchema" },
    operations: [
      ...handler.operations.listOperations(request.a2aPrincipal as AuthenticatedPrincipal),
      ...(request.a2aPrincipal?.agentScopes?.includes("game:act")
        ? [
            {
              name: "run.close",
              description: "Release only this OAuth grant's external lease; no game cancellation or scheduler change.",
              inputSchema: { type: "object", properties: {}, additionalProperties: false },
            },
          ]
        : []),
    ],
  }));
  server.post("/a2a", { bodyLimit: 65536 }, async (request, reply) => {
    const p = request.a2aPrincipal as AuthenticatedPrincipal;
    const version = request.headers["a2a-version"];
    try {
      validateVersion(typeof version === "string" ? version : "0.3", await handler.getAgentCard(), "JSONRPC");
      if (["SendStreamingMessage", "SubscribeToTask"].includes(String((request.body as { method?: unknown })?.method)))
        throw new UnsupportedOperationError("Streaming is not advertised");
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: (request.body as { id?: unknown })?.id ?? null,
        error: JsonRpcTransportHandler.mapToJSONRPCError(error),
      };
    }
    const result = await transport.handle(
      request.body as Record<string, unknown>,
      new ServerCallContext({
        requestedVersion: typeof version === "string" ? version : "0.3",
        state: new Map([[principalKey, p]]),
      }),
    );
    if (Symbol.asyncIterator in result) return reply.code(400).send({ error: { code: "UNSUPPORTED_OPERATION" } });
    // The SDK includes unknown Error.message in internal errors. Never expose
    // database/infrastructure details or accidentally echoed private content.
    if (result.error && typeof result.error === "object" && "code" in result.error && result.error.code === -32603)
      result.error = {
        code: -32603,
        message: "The operation could not be completed. Inspect the original receipt before retrying.",
      };
    return result;
  });
}

declare module "fastify" {
  interface FastifyRequest {
    a2aPrincipal?: AuthenticatedPrincipal;
  }
}
