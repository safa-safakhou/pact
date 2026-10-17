import { AgentEventQuerySchema } from "@pact/contracts";
import { IdentityError, type IdentityService } from "@pact/identity";
import type { AgentEventService, EventPrincipal } from "@pact/inbox";
import { AgentEventError } from "@pact/inbox";
import type { OAuthService } from "@pact/oauth";
import type { FastifyInstance } from "fastify";
export function registerAgentEventRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  events: AgentEventService,
  oauth?: OAuthService,
) {
  server.get("/v1/agent-events", async (request, reply) => {
    reply.header("cache-control", "no-store");
    try {
      const raw = request.query as Record<string, unknown>,
        q = AgentEventQuerySchema.safeParse({
          ...raw,
          ...(raw.limit === undefined ? {} : { limit: Number(raw.limit) }),
        });
      if (!q.success) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
      let principal: EventPrincipal;
      const auth = request.headers.authorization;
      if (auth) {
        if (!auth.startsWith("Bearer ") || !oauth) throw new IdentityError("FORBIDDEN");
        const grant = await oauth.introspectAccessToken(auth.slice(7));
        if (!grant?.scopes.includes("world:read")) throw new IdentityError("FORBIDDEN");
        principal = {
          accountId: grant.accountId,
          productScope: "pact",
          audience: "agent",
          agentGrantId: grant.grantId,
          agentScopes: grant.scopes,
        };
      } else {
        const value = request.headers.cookie
          ?.split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("pact_session="));
        if (!value) throw new IdentityError("FORBIDDEN");
        let token: string;
        try {
          token = decodeURIComponent(value.slice(13));
        } catch {
          throw new IdentityError("FORBIDDEN");
        }
        const session = await identity.authenticate(token);
        principal = {
          accountId: session.accountId,
          productScope: "pact",
          audience: "human",
          sessionId: session.sessionId,
        };
      }
      return await events.read(principal, q.data.cursor, q.data.limit);
    } catch (error) {
      if (error instanceof AgentEventError || error instanceof IdentityError)
        return reply.code(403).send({ error: { code: "FORBIDDEN" } });
      throw error;
    }
  });
}
