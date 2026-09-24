import { WorldViewQuerySchema } from "@pact/contracts";
import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import type { WorldViewService } from "@pact/kingdom";
import type { OAuthService } from "@pact/oauth";
import type { FastifyInstance } from "fastify";
import { authenticatedWorldViewer } from "./world-read-auth.js";

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
        accountId = await authenticatedWorldViewer(request, identity, oauth);
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
