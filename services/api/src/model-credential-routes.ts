import { CredentialVaultError, type CredentialVaultService, MODEL_PROVIDERS } from "@pact/credential-vault";
import { IdentityError, type IdentityService } from "@pact/identity";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const CredentialIdSchema = z.object({ credentialId: z.string().uuid() });
const SaveCredentialSchema = z.object({
  provider: z.enum(MODEL_PROVIDERS),
  label: z.string().min(1).max(80),
  credential: z.string().min(1).max(16_384),
});
const ReplaceCredentialSchema = z.object({
  credential: z.string().min(1).max(16_384),
  label: z.string().min(1).max(80).optional(),
  expectedVersion: z.number().int().positive(),
});

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

async function safe<T>(reply: FastifyReply, operation: () => Promise<T>): Promise<T | FastifyReply> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IdentityError) {
      const status = error.code === "FORBIDDEN" || error.code === "RECENT_AUTH_REQUIRED" ? 403 : 400;
      return reply.code(status).send({ error: { code: error.code, message: "The request could not be completed." } });
    }
    if (error instanceof CredentialVaultError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND" || error.code === "REVOKED"
            ? 404
            : error.code === "INVALID_INPUT"
              ? 400
              : 409;
      return reply.code(status).send({ error: { code: error.code, message: "The request could not be completed." } });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "The request could not be completed." } });
    }
    throw error;
  }
}

export function registerModelCredentialRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  vault: CredentialVaultService,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/model-connections")) reply.header("cache-control", "no-store");
    return payload;
  });

  server.get("/v1/model-connections", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      return { connections: await vault.list(session.accountId) };
    }),
  );

  server.post("/v1/model-connections", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      return vault.save(session.accountId, SaveCredentialSchema.parse(request.body));
    }),
  );

  server.put("/v1/model-connections/:credentialId", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const authorized = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const recent = await identity.requireRecentHumanSession(context.sessionToken, "model-credential.replace");
      if (recent.accountId !== authorized.accountId) throw new IdentityError("FORBIDDEN");
      const input = ReplaceCredentialSchema.parse(request.body);
      return vault.replace(recent.accountId, CredentialIdSchema.parse(request.params).credentialId, {
        credential: input.credential,
        expectedVersion: input.expectedVersion,
        ...(input.label === undefined ? {} : { label: input.label }),
      });
    }),
  );

  server.post("/v1/model-connections/:credentialId/revoke", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      return vault.revoke(session.accountId, CredentialIdSchema.parse(request.params).credentialId);
    }),
  );
}
