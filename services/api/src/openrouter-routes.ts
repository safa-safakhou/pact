import type { CredentialVaultService } from "@pact/credential-vault";
import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import { OpenRouterAuthError, type OpenRouterAuthService } from "@pact/openrouter";
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
  const csrfToken = request.headers["x-csrf-token"];
  const origin = request.headers.origin;
  if (typeof csrfToken !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
  return { sessionToken: sessionToken(request), csrfToken, origin };
}

async function safe(reply: FastifyReply, operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IdentityError) {
      return reply.code(error.code === "FORBIDDEN" ? 403 : 400).send({ error: { code: error.code } });
    }
    if (error instanceof OpenRouterAuthError) {
      const status = error.code === "EXPIRED" || error.code === "REPLAY" || error.code === "INVALID_STATE" ? 409 : 400;
      return reply.code(status).send({ error: { code: error.code } });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    }
    throw error;
  }
}

export function registerOpenRouterRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  openRouter: OpenRouterAuthService,
  vault?: CredentialVaultService,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/openrouter/")) reply.header("cache-control", "no-store");
    return payload;
  });

  server.post("/v1/openrouter/authorize", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const body = z.object({ callbackUrl: z.url() }).parse(request.body);
      return openRouter.begin({
        accountId: session.accountId,
        sessionId: session.sessionId,
        callbackUrl: body.callbackUrl,
      });
    }),
  );

  server.post("/v1/openrouter/callback", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const body = z
        .object({
          state: z.string().min(1),
          code: z.string().min(1),
          callbackUrl: z.url(),
          label: z.string().min(1).max(80).optional(),
        })
        .parse(request.body);
      const exchanged = await openRouter.complete({
        accountId: session.accountId,
        sessionId: session.sessionId,
        state: body.state,
        code: body.code,
        callbackUrl: body.callbackUrl,
      });
      if (!vault) return { apiKeyAttached: false, label: exchanged.label };
      const saved = await vault.save(session.accountId, {
        provider: "openrouter",
        label: body.label ?? exchanged.label,
        credential: exchanged.apiKey,
      });
      return { apiKeyAttached: true, connection: saved };
    }),
  );
}
