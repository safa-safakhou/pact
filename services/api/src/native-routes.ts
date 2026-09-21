import { type CommandDispatcher, DispatcherError } from "@pact/application";
import { ApprovalError, type ApprovalService } from "@pact/approvals";
import { ProductScopeSchema } from "@pact/contracts";
import type { OAuthService } from "@pact/oauth";
import type { OnboardingService } from "@pact/onboarding";
import { createCorrelationIds } from "@pact/telemetry";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

function bearer(request: FastifyRequest): string {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) throw new ApprovalError("FORBIDDEN");
  return authorization.slice(7);
}

async function principal(request: FastifyRequest, oauth: OAuthService, requiredScope: string) {
  const grant = await oauth.introspectAccessToken(bearer(request));
  if (grant?.audience !== "human" || grant.clientId !== "pact-native" || !grant.scopes.includes(requiredScope)) {
    throw new ApprovalError("FORBIDDEN");
  }
  return grant;
}

async function safe(reply: FastifyReply, operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApprovalError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "EXPIRED" ? 409 : 403;
      return reply.code(status).send({ error: { code: error.code } });
    }
    if (error instanceof DispatcherError) {
      return reply.code(error.code === "STALE_VERSION" ? 409 : 400).send({ error: { code: error.code } });
    }
    throw error;
  }
}

export function registerNativeRoutes(
  server: FastifyInstance,
  oauth: OAuthService,
  onboarding: OnboardingService,
  dispatcher: CommandDispatcher,
  approvals: ApprovalService,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/native/")) reply.header("cache-control", "no-store");
    return payload;
  });

  server.get("/v1/native/draft", async (request, reply) =>
    safe(reply, async () => {
      const grant = await principal(request, oauth, "world:read");
      return onboarding.getDraft(grant.accountId);
    }),
  );

  server.post("/v1/native/commands", async (request, reply) =>
    safe(reply, async () => {
      const grant = await principal(request, oauth, "game:act");
      return dispatcher.dispatch(
        {
          accountId: grant.accountId,
          productScope: ProductScopeSchema.parse("pact"),
          audience: "human",
          sessionId: grant.grantId,
        },
        request.body,
        createCorrelationIds({ requestId: request.id }),
      );
    }),
  );

  server.get<{ Params: { approvalId: string } }>("/v1/native/approvals/:approvalId", async (request, reply) =>
    safe(reply, async () => {
      const grant = await principal(request, oauth, "world:read");
      return approvals.review(request.params.approvalId, grant.accountId);
    }),
  );

  server.post<{ Params: { approvalId: string } }>("/v1/native/approvals/:approvalId/approve", async (request, reply) =>
    safe(reply, async () => {
      const grant = await principal(request, oauth, "game:act");
      return approvals.approveForHumanPrincipal(grant.accountId, grant.grantId, request.params.approvalId);
    }),
  );
}
