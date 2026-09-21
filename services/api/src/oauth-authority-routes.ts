import { AuthorityError, type AuthorityService } from "@pact/authority";
import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import type { OAuthService } from "@pact/oauth";
import { OAuthError } from "@pact/oauth";
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
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "RECENT_AUTH_REQUIRED" ? 401 : 400;
      return reply.code(status).send({ error: { code: error.code, message: "The request could not be completed." } });
    }
    if (error instanceof OAuthError) {
      const status = error.code === "FORBIDDEN" || error.code === "ACCESS_DENIED" ? 403 : 400;
      return reply.code(status).send({ error: error.code });
    }
    if (error instanceof AuthorityError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "RECENT_AUTH_REQUIRED"
            ? 401
            : error.code === "STALE_VERSION"
              ? 409
              : 400;
      return reply.code(status).send({ error: { code: error.code, message: "The request could not be completed." } });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "The request could not be completed." } });
    }
    throw error;
  }
}

export function registerOAuthRoutes(server: FastifyInstance, oauth: OAuthService, identity: IdentityService): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/.well-known/") || request.url.startsWith("/oauth/")) {
      reply.header("cache-control", "no-store");
    }
    return payload;
  });

  server.get("/.well-known/oauth-authorization-server", async () => oauth.authorizationServerMetadata());
  server.get("/.well-known/oauth-protected-resource", async () => oauth.protectedResourceMetadata("mcp"));
  server.get("/.well-known/oauth-protected-resource/human", async () => oauth.protectedResourceMetadata("human"));

  server.post("/oauth/register", async (request, reply) =>
    safe(reply, async () => {
      const body = z
        .object({
          client_name: z.string().min(1).max(200),
          redirect_uris: z.array(z.string().url()).min(1).max(10),
          audience: z.enum(["human", "mcp"]).default("mcp"),
        })
        .parse(request.body);
      const client = await oauth.registerDynamic({
        displayName: body.client_name,
        audience: body.audience,
        redirectUris: body.redirect_uris,
      });
      return {
        client_id: client.clientId,
        client_name: client.displayName,
        redirect_uris: client.redirectUris,
        audience: client.audience,
      };
    }),
  );

  server.post("/oauth/authorize", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const body = z
        .object({
          client_id: z.string().min(1),
          redirect_uri: z.string().min(1),
          scope: z.string().min(1),
          code_challenge: z.string().min(43),
          code_challenge_method: z.literal("S256"),
          resource: z.string().min(1),
          subject_label: z.string().min(1).max(200),
          audience: z.enum(["human", "mcp"]),
        })
        .parse(request.body);
      const result = await oauth.beginAuthorization({
        clientId: body.client_id,
        redirectUri: body.redirect_uri,
        scopes: body.scope,
        codeChallenge: body.code_challenge,
        codeChallengeMethod: body.code_challenge_method,
        resource: body.resource,
        accountId: session.accountId,
        subjectLabel: body.subject_label,
        expectedAudience: body.audience,
      });
      return { code: result.code, consent: result.consent };
    }),
  );

  server.post("/oauth/token", async (request, reply) =>
    safe(reply, async () => {
      const body = z
        .object({
          grant_type: z.enum(["authorization_code", "refresh_token"]),
          client_id: z.string().min(1),
          code: z.string().optional(),
          redirect_uri: z.string().optional(),
          code_verifier: z.string().optional(),
          refresh_token: z.string().optional(),
          resource: z.string().optional(),
        })
        .parse(request.body);
      if (body.grant_type === "authorization_code") {
        if (!body.code || !body.redirect_uri || !body.code_verifier) throw new OAuthError("INVALID_REQUEST");
        const tokens = await oauth.exchangeAuthorizationCode({
          clientId: body.client_id,
          code: body.code,
          redirectUri: body.redirect_uri,
          codeVerifier: body.code_verifier,
          ...(body.resource ? { resource: body.resource } : {}),
        });
        return {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: tokens.tokenType,
          expires_in: tokens.expiresIn,
          scope: tokens.scope,
          audience: tokens.audience,
        };
      }
      if (!body.refresh_token) throw new OAuthError("INVALID_REQUEST");
      const tokens = await oauth.refresh({
        clientId: body.client_id,
        refreshToken: body.refresh_token,
        ...(body.resource ? { resource: body.resource } : {}),
      });
      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresIn,
        scope: tokens.scope,
        audience: tokens.audience,
      };
    }),
  );

  server.post("/oauth/revoke", async (request, reply) =>
    safe(reply, async () => {
      const body = z.object({ token: z.string().min(1) }).parse(request.body);
      await oauth.revoke(body.token);
      return reply.code(200).send({ revoked: true });
    }),
  );
}

export function registerAuthorityRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  authority: AuthorityService,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/mandate")) reply.header("cache-control", "no-store");
    return payload;
  });

  server.get("/v1/mandate", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      return authority.ensureMandate(session.accountId);
    }),
  );

  server.post("/v1/mandate", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const body = z
        .object({
          allowedActions: z.array(z.string().min(1).max(64)).min(1).max(50),
          resourceLimits: z.record(z.string(), z.string().regex(/^(0|[1-9][0-9]{0,17})$/)),
          reserveFloors: z.record(z.string(), z.string().regex(/^(0|[1-9][0-9]{0,17})$/)).optional(),
          troopLimit: z.number().int().nonnegative().optional(),
          sessionLimit: z.number().int().nonnegative().optional(),
          expectedVersion: z.number().int().positive(),
        })
        .parse(request.body);
      return authority.raiseMandate(context.sessionToken, {
        allowedActions: body.allowedActions,
        resourceLimits: body.resourceLimits,
        expectedVersion: body.expectedVersion,
        ...(body.reserveFloors ? { reserveFloors: body.reserveFloors } : {}),
        ...(body.troopLimit !== undefined ? { troopLimit: body.troopLimit } : {}),
        ...(body.sessionLimit !== undefined ? { sessionLimit: body.sessionLimit } : {}),
      });
    }),
  );
}
