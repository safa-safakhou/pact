import { IdentityError, type IdentityService } from "@pact/identity";
import { PrivacyError, type PrivacyService } from "@pact/privacy";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const ReauthenticationSchema = z.object({
  password: z.string().max(1024),
  mfaCode: z.string().max(64).optional(),
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
  const csrf = request.headers["x-csrf-token"];
  const origin = request.headers.origin;
  if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
  return { sessionToken: sessionToken(request), csrfToken: csrf, origin };
}

function setSession(reply: FastifyReply, tokens: { sessionToken: string; absoluteExpiresAt: Date }): void {
  const maxAge = Math.max(0, Math.floor((tokens.absoluteExpiresAt.getTime() - Date.now()) / 1000));
  reply.header(
    "set-cookie",
    `pact_session=${encodeURIComponent(tokens.sessionToken)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`,
  );
}

async function safe<T>(reply: FastifyReply, operation: () => Promise<T>): Promise<T | FastifyReply> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IdentityError || error instanceof PrivacyError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 409;
      return reply.code(status).send({ error: { code: error.code, message: "The request could not be completed." } });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "The request could not be completed." } });
    }
    throw error;
  }
}

async function reauthenticate(
  request: FastifyRequest,
  reply: FastifyReply,
  identity: IdentityService,
): Promise<{ accountId: string; sessionToken: string; csrfToken: string }> {
  const context = writeContext(request);
  await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
  const input = ReauthenticationSchema.parse(request.body);
  const tokens = await identity.reauthenticate({
    sessionToken: context.sessionToken,
    password: input.password,
    requestId: request.id,
    ...(input.mfaCode ? { mfaCode: input.mfaCode } : {}),
  });
  setSession(reply, tokens);
  return { accountId: tokens.accountId, sessionToken: tokens.sessionToken, csrfToken: tokens.csrfToken };
}

export function registerPrivacyRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  privacy: PrivacyService,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/privacy/")) reply.header("cache-control", "no-store");
    return payload;
  });

  server.post("/v1/privacy/exports", async (request, reply) =>
    safe(reply, async () => {
      const authenticated = await reauthenticate(request, reply, identity);
      await identity.requireRecentHumanSession(authenticated.sessionToken, "account.export");
      const ticket = await privacy.requestExport(authenticated.accountId);
      return {
        exportId: ticket.exportId,
        downloadUrl: `/v1/privacy/exports/${ticket.downloadToken}`,
        expiresAt: ticket.expiresAt.toISOString(),
        csrfToken: authenticated.csrfToken,
      };
    }),
  );

  server.get("/v1/privacy/exports/:token", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      const token = z.object({ token: z.string().min(32).max(128) }).parse(request.params).token;
      const archive = await privacy.downloadExport(session.accountId, token);
      reply.header(
        "content-disposition",
        `attachment; filename="pact-account-export-${archive.generatedAt.slice(0, 10)}.json"`,
      );
      return archive;
    }),
  );

  server.get("/v1/privacy/status", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      return privacy.status(session.accountId);
    }),
  );

  server.post("/v1/privacy/deletion", async (request, reply) =>
    safe(reply, async () => {
      const authenticated = await reauthenticate(request, reply, identity);
      await identity.requireRecentHumanSession(authenticated.sessionToken, "account.delete");
      const deletion = await privacy.requestDeletion(authenticated.accountId, request.id);
      reply.header("set-cookie", "pact_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax");
      return {
        status: "closing",
        requestedAt: deletion.requestedAt.toISOString(),
        purgeDueAt: deletion.purgeDueAt.toISOString(),
      };
    }),
  );
}
