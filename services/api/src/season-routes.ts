import { SeasonReadQuerySchema } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import type { IdentityService } from "@pact/identity";
import type { SeasonService } from "@pact/kingdom";
import type { OAuthService } from "@pact/oauth";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticatedWorldViewer } from "./world-read-auth.js";
export function registerSeasonRoutes(
  server: FastifyInstance,
  pool: Pool,
  identity: IdentityService,
  seasons: Pick<SeasonService, "readCurrent">,
  oauth?: OAuthService,
) {
  server.get<{ Querystring: { cohortStartGameTimeMs?: string } }>("/v1/seasons", async (request, reply) => {
    reply.header("cache-control", "no-store");
    let accountId: string;
    try {
      accountId = await authenticatedWorldViewer(request, identity, oauth);
    } catch {
      return reply.code(403).send({ error: { code: "FORBIDDEN" } });
    }
    const q = SeasonReadQuerySchema.safeParse({
      ...request.query,
      ...(request.query.cohortStartGameTimeMs === undefined
        ? {}
        : { cohortStartGameTimeMs: Number(request.query.cohortStartGameTimeMs) }),
    });
    if (!q.success) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    return withTransaction(pool, (c) => seasons.readCurrent(c, q.data.cohortStartGameTimeMs, accountId), {
      isolation: "REPEATABLE READ",
    });
  });
}
