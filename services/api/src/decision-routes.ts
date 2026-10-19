import type { DecisionSupportReader } from "@pact/application";
import { AgentOutlookQuerySchema, DecisionSupportQuerySchema } from "@pact/contracts";
import { IdentityError, type IdentityService } from "@pact/identity";
import type { OAuthService } from "@pact/oauth";
import type { FastifyInstance } from "fastify";
import { authenticatedWorldViewer } from "./world-read-auth.js";

export function registerDecisionRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  reader: DecisionSupportReader,
  oauth?: OAuthService,
) {
  server.get("/v1/game/decision-support", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const raw = request.query as Record<string, unknown>;
    const query = DecisionSupportQuerySchema.safeParse({
      ...raw,
      ...(raw.proposalOffset === undefined ? {} : { proposalOffset: Number(raw.proposalOffset) }),
    });
    if (!query.success) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    try {
      const accountId = await authenticatedWorldViewer(request, identity, oauth);
      const result = await reader.read(accountId, query.data.candidateId, query.data.proposalOffset);
      return result ?? reply.code(404).send({ error: { code: "NOT_FOUND" } });
    } catch (error) {
      if (error instanceof IdentityError) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
      throw error;
    }
  });
}

export function registerOutlookRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  reader: import("@pact/kingdom").AgentOutlookService,
  oauth?: OAuthService,
) {
  server.get("/v1/game/agent-outlook", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const raw = request.query as Record<string, unknown>,
      q = AgentOutlookQuerySchema.safeParse({
        ...raw,
        ...(raw.forecastMinutes === undefined ? {} : { forecastMinutes: Number(raw.forecastMinutes) }),
      });
    if (!q.success) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    try {
      const accountId = await authenticatedWorldViewer(request, identity, oauth);
      return await reader.readOwner({ accountId, productScope: "pact", audience: "human" }, q.data);
    } catch (error) {
      if (error instanceof IdentityError || (error instanceof Error && error.message === "FORBIDDEN"))
        return reply.code(403).send({ error: { code: "FORBIDDEN" } });
      throw error;
    }
  });
}
