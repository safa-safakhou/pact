import { IdentityError, type IdentityService } from "@pact/identity";
import type { SocialOverviewReader } from "@pact/kingdom";
import type { FastifyInstance } from "fastify";

/** Private messages and offers require a human session, not an MCP world-read grant. */
export function registerSocialOverviewRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  reader: SocialOverviewReader,
): void {
  server.get("/v1/game/social", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const cookie = request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("pact_session="));
    if (!cookie) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
    let accountId: string;
    try {
      const token = decodeURIComponent(cookie.slice("pact_session=".length));
      accountId = (await identity.authenticate(token)).accountId;
    } catch (error) {
      if (error instanceof IdentityError || error instanceof URIError)
        return reply.code(403).send({ error: { code: "FORBIDDEN" } });
      throw error;
    }
    const overview = await reader.read(accountId);
    if (!overview) return reply.code(404).send({ error: { code: "KINGDOM_NOT_FOUND" } });
    return overview;
  });
}
