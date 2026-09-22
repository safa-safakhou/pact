import type { CommandDispatcher } from "@pact/application";
import type { ApprovalService } from "@pact/approvals";
import type { AuthorityService } from "@pact/authority";
import type { CredentialVaultService } from "@pact/credential-vault";
import type { IdentityService } from "@pact/identity";
import type { InboxService } from "@pact/inbox";
import type { McpTransport } from "@pact/mcp";
import type { OAuthService } from "@pact/oauth";
import type { OnboardingService } from "@pact/onboarding";
import type { OpenRouterAuthService } from "@pact/openrouter";
import type { PrivacyService } from "@pact/privacy";
import type { RunService } from "@pact/runs";
import type { TelegramService } from "@pact/telegram";
import {
  createCorrelationIds,
  fastifyRedactionPaths,
  safeErrorCode,
  stdoutTelemetry,
  type Telemetry,
  trustedCorrelationId,
} from "@pact/telemetry";
import Fastify, { type FastifyInstance, LogController } from "fastify";
import type { Pool } from "pg";
import { registerCapabilityRoutes } from "./capability-routes.js";
import { registerCommandRoutes } from "./command-routes.js";
import { registerIdentityRoutes } from "./identity-routes.js";
import { registerApprovalRoutes, registerInboxRoutes, registerMcpRoutes } from "./mcp-approval-inbox-routes.js";
import { registerModelCredentialRoutes } from "./model-credential-routes.js";
import { registerNativeRoutes } from "./native-routes.js";
import { registerAuthorityRoutes, registerOAuthRoutes } from "./oauth-authority-routes.js";
import { registerOpenRouterRoutes } from "./openrouter-routes.js";
import { registerPrivacyRoutes } from "./privacy-routes.js";
import { registerRunRoutes } from "./run-routes.js";
import { registerTelegramRoutes } from "./telegram-routes.js";

function safeLogger(logger: boolean | object): false | Record<string, unknown> {
  if (logger === false) return false;
  const base = logger === true ? {} : logger;
  return {
    ...base,
    redact: { paths: [...fastifyRedactionPaths], censor: "[REDACTED]" },
    serializers: {
      req: (request: { id?: string; method?: string }) => ({ id: request.id, method: request.method }),
      res: (response: { statusCode?: number }) => ({ statusCode: response.statusCode }),
      err: (error: unknown) => ({ code: safeErrorCode(error) }),
    },
  };
}

export interface ApiModules {
  identity: IdentityService;
  onboarding: OnboardingService;
  dispatcher: CommandDispatcher;
  oauth?: OAuthService;
  authority?: AuthorityService;
  mcp?: McpTransport;
  approvals?: ApprovalService;
  inbox?: InboxService;
  credentialVault?: CredentialVaultService;
  runs?: RunService;
  openRouter?: OpenRouterAuthService;
  telegram?: TelegramService;
  privacy?: PrivacyService;
  origin?: string;
}

export function buildServer(
  pool: Pool,
  logger: boolean | object = true,
  telemetry: Telemetry = stdoutTelemetry(),
  modules?: ApiModules,
): FastifyInstance {
  const failedRequests = new WeakSet<object>();
  const server = Fastify({
    logger: safeLogger(logger),
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: (request) => trustedCorrelationId(request.headers["x-request-id"]) ?? createCorrelationIds().requestId,
  });

  server.addHook("onRequest", async (request, reply) => {
    const correlation = createCorrelationIds({ requestId: request.id });
    reply.header("x-request-id", correlation.requestId);
    telemetry.recordStage("api", "started", correlation, { method: request.method });
  });

  server.addHook("onResponse", async (request, reply) => {
    if (!failedRequests.has(request)) {
      telemetry.recordStage(
        "api",
        reply.statusCode >= 400 ? "failed" : "succeeded",
        createCorrelationIds({ requestId: request.id }),
        {
          method: request.method,
          route: request.routeOptions.url,
          statusCode: reply.statusCode,
        },
      );
    }
  });

  server.setErrorHandler((error, request, reply) => {
    failedRequests.add(request);
    const correlation = createCorrelationIds({ requestId: request.id });
    telemetry.recordStage("api", "failed", correlation, {
      errorCode: safeErrorCode(error),
      method: request.method,
      route: request.routeOptions.url,
    });
    const reportedStatus =
      typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    const statusCode = reportedStatus >= 400 && reportedStatus < 500 ? reportedStatus : 500;
    return reply.code(statusCode).send({
      error: {
        code: statusCode < 500 ? "BAD_REQUEST" : "INTERNAL_ERROR",
        message: statusCode < 500 ? "The request is invalid." : "The request could not be completed.",
        requestId: correlation.requestId,
      },
    });
  });

  server.get("/health", async () => ({ status: "ok" }));
  server.get("/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      telemetry.metrics.setReady(true);
      return { status: "ready" };
    } catch {
      telemetry.metrics.setReady(false);
      return reply.code(503).send({ status: "unavailable" });
    }
  });
  server.get("/metrics", async (_request, reply) => {
    return reply.type("text/plain; version=0.0.4; charset=utf-8").send(telemetry.metrics.renderPrometheus());
  });
  registerCapabilityRoutes(server);
  if (modules) {
    registerIdentityRoutes(server, modules.identity, modules.onboarding);
    registerCommandRoutes(server, modules.identity, modules.dispatcher);
    if (modules.oauth) registerOAuthRoutes(server, modules.oauth, modules.identity);
    if (modules.authority) registerAuthorityRoutes(server, modules.identity, modules.authority);
    if (modules.mcp && modules.oauth) {
      registerMcpRoutes(server, modules.mcp, modules.oauth, modules.origin ?? "https://pact.example");
    }
    if (modules.approvals) registerApprovalRoutes(server, modules.identity, modules.approvals);
    if (modules.oauth && modules.approvals) {
      registerNativeRoutes(server, modules.oauth, modules.onboarding, modules.dispatcher, modules.approvals);
    }
    if (modules.inbox) registerInboxRoutes(server, modules.identity, modules.inbox, modules.dispatcher);
    if (modules.credentialVault) registerModelCredentialRoutes(server, modules.identity, modules.credentialVault);
    if (modules.runs) registerRunRoutes(server, modules.identity, modules.runs);
    if (modules.openRouter) {
      registerOpenRouterRoutes(server, modules.identity, modules.openRouter, modules.credentialVault);
    }
    if (modules.telegram) registerTelegramRoutes(server, modules.identity, modules.telegram);
    if (modules.privacy) registerPrivacyRoutes(server, modules.identity, modules.privacy);
  }
  return server;
}
