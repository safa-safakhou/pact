import { ReportReadQuerySchema } from "@pact/contracts";
import { IdentityError, type IdentityService } from "@pact/identity";
import type { OAuthService } from "@pact/oauth";
import type { FastifyInstance } from "fastify";
import type { GameReportReader } from "./game-report-reader.js";
import { authenticatedWorldViewer } from "./world-read-auth.js";

/** A scoped record read; no caller-supplied viewer field is accepted. */
export function registerReportRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  reports: GameReportReader,
  oauth?: OAuthService,
): void {
  server.get<{ Params: { kind: string; recordId: string } }>("/v1/reports/:kind/:recordId", async (request, reply) => {
    reply.header("cache-control", "no-store");
    let accountId: string;
    try {
      accountId = await authenticatedWorldViewer(request, identity, oauth);
    } catch (error) {
      if (error instanceof IdentityError) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
      throw error;
    }
    const query = ReportReadQuerySchema.safeParse(request.params);
    if (!query.success) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    const report = await reports.read(accountId, query.data.kind, query.data.recordId);
    if (!report) return reply.code(404).send({ error: { code: "NOT_FOUND" } });
    return report;
  });
}
