import { WorldViewQuerySchema } from "@pact/contracts";
import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import type { WorldViewService } from "@pact/kingdom";
import type { OAuthService } from "@pact/oauth";
import type { FastifyInstance, FastifyRequest } from "fastify";

function sessionToken(request: FastifyRequest): string {
  const match = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("pact_session="));
  if (!match) throw new IdentityError("FORBIDDEN");
  return decodeURIComponent(match.slice("pact_session=".length));
}

/** The caller names only the subject; owner/participant/public visibility is derived by WorldViewService. */
export function registerWorldViewRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  worldViews: WorldViewService,
  oauth?: OAuthService,
): void {
  server.get<{ Params: { kingdomId: string }; Querystring: { forecastMinutes?: string } }>(
    "/v1/world/kingdoms/:kingdomId",
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      let accountId: string;
      try {
        const bearer = request.headers.authorization;
        if (bearer) {
          if (!bearer.startsWith("Bearer ") || !oauth) throw new IdentityError("FORBIDDEN");
          const grant = await oauth.introspectAccessToken(bearer.slice(7));
          if (!grant?.scopes.includes("world:read")) throw new IdentityError("FORBIDDEN");
          accountId = grant.accountId;
        } else {
          accountId = (await identity.authenticate(sessionToken(request))).accountId;
        }
      } catch (error) {
        if (error instanceof IdentityError) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
        throw error;
      }
      const forecastMinutes = request.query.forecastMinutes === undefined ? 60 : Number(request.query.forecastMinutes);
      const parsed = WorldViewQuerySchema.safeParse({ targetKingdomId: request.params.kingdomId, forecastMinutes });
      if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
      const view = await worldViews.read(accountId, parsed.data.targetKingdomId, parsed.data.forecastMinutes);
      if (!view) return reply.code(404).send({ error: { code: "NOT_FOUND" } });
      return view;
    },
  );
}
