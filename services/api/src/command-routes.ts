import { type CommandDispatcher, DispatcherError } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import { createCorrelationIds } from "@pact/telemetry";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

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
      const status = error.code === "FORBIDDEN" ? 403 : 400;
      return reply.code(status).send({ error: { code: error.code, message: "The request could not be completed." } });
    }
    if (error instanceof DispatcherError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "STALE_VERSION" || error.code === "TICK_PENDING"
            ? 409
            : error.code === "RATE_LIMITED"
              ? 429
              : 400;
      return reply.code(status).send({
        schemaVersion: "pact.command.v1",
        commandId: "00000000-0000-4000-8000-000000000000",
        code: error.code,
        ...(error.detail ? { detail: error.detail } : {}),
        ...(error.retryAfterMs ? { retryAfterMs: error.retryAfterMs } : {}),
        committedEventIds: [],
        recordVersions: {},
        charged: [],
      });
    }
    throw error;
  }
}

export function registerCommandRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  dispatcher: CommandDispatcher,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/commands") || request.url.startsWith("/v1/receipts")) {
      reply.header("cache-control", "no-store");
    }
    return payload;
  });

  server.post("/v1/commands", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const receipt = await dispatcher.dispatch(
        {
          accountId: session.accountId,
          productScope: ProductScopeSchema.parse("pact"),
          audience: "human",
          sessionId: session.sessionId,
        },
        request.body,
        createCorrelationIds({ requestId: request.id }),
      );
      const status = receipt.code === "IDEMPOTENCY_CONFLICT" ? 409 : 200;
      return reply.code(status).send(receipt);
    }),
  );

  server.get<{ Params: { commandId: string } }>("/v1/receipts/:commandId", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      const receipt = await dispatcher.lookupReceipt(
        {
          accountId: session.accountId,
          productScope: ProductScopeSchema.parse("pact"),
          audience: "human",
          sessionId: session.sessionId,
        },
        request.params.commandId,
      );
      if (!receipt) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "The request could not be completed." } });
      }
      return receipt;
    }),
  );
}
