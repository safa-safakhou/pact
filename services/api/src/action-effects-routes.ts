import {
  type ActionEffectsService,
  type AuthenticatedPrincipal,
  type CommandDispatcher,
  DispatcherError,
} from "@pact/application";
import { ActionEffectsQuoteSchema, GuardedCommandSchema, ProductScopeSchema } from "@pact/contracts";
import { IdentityError, type IdentityService } from "@pact/identity";
import type { OAuthService } from "@pact/oauth";
import type { FastifyInstance, FastifyRequest } from "fastify";

export function actionEffectsAuthenticator(identity: IdentityService, oauth?: OAuthService) {
  return async (request: FastifyRequest, write: boolean): Promise<AuthenticatedPrincipal> => {
    const auth = request.headers.authorization;
    if (auth) {
      if (!auth.startsWith("Bearer ") || !oauth) throw new IdentityError("FORBIDDEN");
      const grant = await oauth.introspectAccessToken(auth.slice(7));
      if (
        !grant ||
        !(["mcp", "a2a"] as string[]).includes(grant.audience) ||
        !grant.scopes.includes(write ? "game:act" : "world:read")
      )
        throw new IdentityError("FORBIDDEN");
      const holder = request.headers["mcp-session-id"];
      if (write && (typeof holder !== "string" || holder.length > 256 || !holder)) throw new IdentityError("FORBIDDEN");
      return {
        accountId: grant.accountId,
        productScope: ProductScopeSchema.parse("pact"),
        audience: "agent",
        agentOrigin: "external",
        agentScopes: grant.scopes.filter((s): s is "world:read" | "game:act" | "messages:write" =>
          ["world:read", "game:act", "messages:write"].includes(s),
        ),
        ...(typeof holder === "string" ? { sessionId: holder } : {}),
      };
    }
    const cookie = request.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("pact_session="));
    if (!cookie) throw new IdentityError("FORBIDDEN");
    const token = decodeURIComponent(cookie.slice(13));
    if (write) {
      const csrf = request.headers["x-csrf-token"],
        origin = request.headers.origin;
      if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
      const session = await identity.authorizeCookieWrite(token, csrf, origin);
      return {
        accountId: session.accountId,
        sessionId: session.sessionId,
        productScope: ProductScopeSchema.parse("pact"),
        audience: "human",
      };
    }
    const session = await identity.authenticate(token);
    return { accountId: session.accountId, productScope: ProductScopeSchema.parse("pact"), audience: "human" };
  };
}
/** Caller omits registration entirely when the protocol flag is off. */
export function registerActionEffectsRoutes(
  server: FastifyInstance,
  authenticate: (request: FastifyRequest, write: boolean) => Promise<AuthenticatedPrincipal>,
  effects: ActionEffectsService,
  dispatcher: CommandDispatcher,
) {
  for (const write of [false, true])
    server.post(`/v1/agent-action-effects/${write ? "execute" : "quote"}`, async (request, reply) => {
      reply.header("cache-control", "no-store");
      try {
        const principal = await authenticate(request, write);
        const parsed = (write ? GuardedCommandSchema : ActionEffectsQuoteSchema).safeParse(request.body);
        if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
        return write
          ? await dispatcher.dispatchGuarded(principal, parsed.data)
          : await effects.quote(principal, parsed.data.command);
      } catch (error) {
        if (error instanceof IdentityError || error instanceof DispatcherError)
          return reply
            .code(error.code === "FORBIDDEN" ? 403 : error.code === "STALE_VERSION" ? 409 : 400)
            .send({ error: { code: error.code } });
        throw error;
      }
    });
}
