import { agentRecovery, type CommandDispatcher, DispatcherError } from "@pact/application";
import { ApprovalError, type ApprovalService } from "@pact/approvals";
import { AgentScopeSchema, ProductScopeSchema } from "@pact/contracts";
import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import { InboxError, type InboxService } from "@pact/inbox";
import { McpError, type McpTransport } from "@pact/mcp";
import type { OAuthService } from "@pact/oauth";
import { RunError } from "@pact/runs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

function cookieValue(request: FastifyRequest, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function sessionToken(request: FastifyRequest): string {
  const token = cookieValue(request, "pact_session");
  if (!token) throw new IdentityError("FORBIDDEN");
  return token;
}

function writeContext(request: FastifyRequest): { sessionToken: string; csrfToken: string; origin: string } {
  const csrf = request.headers["x-csrf-token"];
  const origin = request.headers.origin;
  if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
  return { sessionToken: sessionToken(request), csrfToken: csrf, origin };
}

async function safe(reply: FastifyReply, operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IdentityError) {
      return reply.code(error.code === "FORBIDDEN" ? 403 : 400).send({ error: { code: error.code } });
    }
    if (error instanceof McpError) {
      return reply
        .code(error.httpStatus)
        .send({ error: { code: error.code, ...(error.detail ? { detail: error.detail } : {}) } });
    }
    if (error instanceof DispatcherError) {
      return reply
        .code(
          error.code === "FORBIDDEN"
            ? 403
            : error.code === "STALE_VERSION" || error.code === "TICK_PENDING"
              ? 409
              : error.code === "RATE_LIMITED"
                ? 429
                : 400,
        )
        .send({ error: { code: error.code } });
    }
    if (error instanceof ApprovalError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "EXPIRED" || error.code === "ALREADY_RESOLVED" || error.code === "NOT_COMMITTED"
              ? 409
              : 400;
      return reply.code(status).send({ error: { code: error.code } });
    }
    if (error instanceof RunError) {
      return reply
        .code(error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 409)
        .send({ error: { code: error.code } });
    }
    if (error instanceof InboxError) {
      const status = error.code === "CURSOR_EXPIRED" ? 410 : 400;
      return reply.code(status).send({ error: { code: error.code } });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    }
    throw error;
  }
}

export function registerMcpRoutes(
  server: FastifyInstance,
  mcp: McpTransport,
  oauth: OAuthService,
  origin: string,
): void {
  const resourceMetadataUrl = `${String(oauth.authorizationServerMetadata().issuer)}/.well-known/oauth-protected-resource`;
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url === "/mcp" || request.url.startsWith("/mcp?")) {
      reply.header("cache-control", "no-store");
      if (reply.statusCode === 401) {
        reply.header("www-authenticate", `Bearer resource_metadata="${resourceMetadataUrl}"`);
      }
    }
    return payload;
  });

  server.post("/mcp", async (request, reply) =>
    safe(reply, async () => {
      mcp.assertOrigin(typeof request.headers.origin === "string" ? request.headers.origin : origin);
      const auth = request.headers.authorization;
      if (!auth?.startsWith("Bearer ")) throw new McpError("FORBIDDEN", 401);
      const token = await oauth.introspectAccessToken(auth.slice("Bearer ".length));
      if (token?.audience !== "mcp") throw new McpError("FORBIDDEN", 401);
      const principal = {
        accountId: token.accountId,
        productScope: ProductScopeSchema.parse("pact"),
        audience: "agent" as const,
        agentScopes: z.array(AgentScopeSchema).parse(token.scopes),
        agentGrantId: token.grantId,
      };
      const sessionHeader = request.headers["mcp-session-id"];
      const sessionId = typeof sessionHeader === "string" ? sessionHeader : undefined;
      const body = request.body as { method: string; id?: string | number | null; params?: Record<string, unknown> };
      let result: Awaited<ReturnType<McpTransport["handlePost"]>>;
      try {
        result = await mcp.handlePost(principal, body, sessionId);
      } catch (error) {
        if (
          body.method === "tools/call" &&
          ((error instanceof McpError && error.code !== "SESSION_NOT_FOUND") ||
            error instanceof DispatcherError ||
            error instanceof ApprovalError ||
            error instanceof RunError ||
            error instanceof InboxError ||
            error instanceof z.ZodError)
        ) {
          const code = error instanceof z.ZodError ? "INVALID_INPUT" : error.code;
          const missingLease =
            (error instanceof RunError && code === "FORBIDDEN") ||
            (error instanceof DispatcherError && error.reason === "WRITE_LEASE_REQUIRED");
          return {
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: {
                      code,
                      ...(missingLease ? { reason: "WRITE_LEASE_REQUIRED" } : {}),
                      ...(error instanceof DispatcherError && error.detail ? { detail: error.detail } : {}),
                      ...(error instanceof DispatcherError && error.retryAfterMs
                        ? { retryAfterMs: error.retryAfterMs }
                        : {}),
                    },
                    recovery: missingLease
                      ? "Call run.open with empty arguments to open or renew this connection’s 15-minute write lease, then retry the same intended command. This denial does not establish a missing kingdom permission. Do not ask the human to expand authority unless a separate mandate denial requires it."
                      : agentRecovery(code, error instanceof DispatcherError ? error.detail : undefined),
                  }),
                },
              ],
              isError: true,
            },
          };
        }
        throw error;
      }
      if (result.sessionId) reply.header("mcp-session-id", result.sessionId);
      if (body.method === "notifications/initialized") return reply.code(202).send();
      return result.response;
    }),
  );

  server.get("/mcp", async (request, reply) =>
    safe(reply, async () => {
      mcp.assertOrigin(typeof request.headers.origin === "string" ? request.headers.origin : origin);
      const auth = request.headers.authorization;
      if (!auth?.startsWith("Bearer ")) throw new McpError("FORBIDDEN", 401);
      const token = await oauth.introspectAccessToken(auth.slice("Bearer ".length));
      if (token?.audience !== "mcp") throw new McpError("FORBIDDEN", 401);
      const sessionHeader = request.headers["mcp-session-id"];
      if (typeof sessionHeader !== "string") throw new McpError("SESSION_NOT_FOUND", 404);
      const stream = await mcp.openStream(
        {
          accountId: token.accountId,
          productScope: ProductScopeSchema.parse("pact"),
          audience: "agent",
          agentScopes: z.array(AgentScopeSchema).parse(token.scopes),
          agentGrantId: token.grantId,
        },
        sessionHeader,
      );
      reply.header("content-type", "text/event-stream");
      reply.header("cache-control", "no-store");
      return `event: ready\ndata: ${JSON.stringify(stream)}\n\n`;
    }),
  );

  server.delete("/mcp", async (request, reply) =>
    safe(reply, async () => {
      mcp.assertOrigin(typeof request.headers.origin === "string" ? request.headers.origin : origin);
      const auth = request.headers.authorization;
      if (!auth?.startsWith("Bearer ")) throw new McpError("FORBIDDEN", 401);
      const token = await oauth.introspectAccessToken(auth.slice("Bearer ".length));
      if (token?.audience !== "mcp") throw new McpError("FORBIDDEN", 401);
      const sessionHeader = request.headers["mcp-session-id"];
      if (typeof sessionHeader !== "string") throw new McpError("SESSION_NOT_FOUND", 404);
      await mcp.closeSession(
        {
          accountId: token.accountId,
          productScope: ProductScopeSchema.parse("pact"),
          audience: "agent",
          agentScopes: z.array(AgentScopeSchema).parse(token.scopes),
          agentGrantId: token.grantId,
        },
        sessionHeader,
      );
      return reply.code(204).send();
    }),
  );
}

export function registerApprovalRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  approvals: ApprovalService,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/approvals") || request.url.startsWith("/approvals/")) {
      reply.header("cache-control", "no-store");
    }
    return payload;
  });

  server.get("/v1/approvals", async (request, reply) =>
    safe(reply, async () =>
      approvals.pendingForAccount((await identity.authenticate(sessionToken(request))).accountId),
    ),
  );

  server.get<{ Params: { approvalId: string } }>("/v1/approvals/:approvalId", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      return approvals.review(request.params.approvalId, session.accountId);
    }),
  );

  server.get<{ Params: { approvalId: string } }>("/approvals/:approvalId", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      // Deep link GET never approves.
      return approvals.review(request.params.approvalId, session.accountId);
    }),
  );

  server.post<{ Params: { approvalId: string } }>("/v1/approvals/:approvalId/approve", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      return approvals.approve(context.sessionToken, request.params.approvalId);
    }),
  );

  server.post<{ Params: { approvalId: string } }>("/v1/approvals/:approvalId/reject", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      return approvals.reject(context.sessionToken, request.params.approvalId);
    }),
  );
}

export function registerInboxRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  inbox: InboxService,
  _dispatcher?: CommandDispatcher,
): void {
  void _dispatcher;
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/inbox")) reply.header("cache-control", "no-store");
    return payload;
  });

  server.get("/v1/inbox", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      const query = z
        .object({ cursor: z.string().optional(), limit: z.coerce.number().int().positive().max(100).optional() })
        .parse(request.query);
      return inbox.list(session.accountId, query.cursor, query.limit ?? 50);
    }),
  );

  server.post("/v1/inbox/ack", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const body = z.object({ cursor: z.string().min(1) }).parse(request.body);
      return inbox.acknowledge(session.accountId, body.cursor);
    }),
  );

  server.get("/v1/inbox/stream", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      const lastEventId = request.headers["last-event-id"];
      const cursor = typeof lastEventId === "string" ? lastEventId : undefined;
      const page = await inbox.list(session.accountId, cursor, 20);
      inbox.assertNoProviderInvocation();
      reply.header("content-type", "text/event-stream");
      const lines = page.events.map((event) => `id: ${event.sequence}\nevent: inbox\ndata: ${JSON.stringify(event)}\n`);
      return `${lines.join("\n")}\n`;
    }),
  );
}
