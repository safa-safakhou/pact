import type { CommandDispatcher } from "@pact/application";
import type { ApprovalService } from "@pact/approvals";
import type { AuthorityService } from "@pact/authority";
import type { CredentialVaultService } from "@pact/credential-vault";
import type { IdentityService } from "@pact/identity";
import type { InboxService, NotificationService } from "@pact/inbox";
import type { InvitationService, KingdomService, SocialOverviewReader, WorldViewService } from "@pact/kingdom";
import { agentEventCoverage } from "@pact/kingdom";
import type { McpTransport } from "@pact/mcp";
import type { OAuthService } from "@pact/oauth";
import type { OnboardingService } from "@pact/onboarding";
import type { OpenRouterAuthService } from "@pact/openrouter";
import type { PrivacyService } from "@pact/privacy";
import type { ExternalAgentActivity, RunService } from "@pact/runs";
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
import { PactA2AHandler, registerA2ARoutes } from "./a2a.js";
import type { AdminReader } from "./admin-reader.js";
import { type AdminSetup, registerAdminRoutes } from "./admin-routes.js";
import { registerAgentEventRoutes } from "./agent-event-routes.js";
import { registerCapabilityRoutes } from "./capability-routes.js";
import { registerChronicleRoutes } from "./chronicle-routes.js";
import { registerCommandRoutes } from "./command-routes.js";
import { registerCouncilRoutes } from "./council-routes.js";
import type { GameReportReader } from "./game-report-reader.js";
import { registerGuestRoutes } from "./guest-routes.js";
import { registerIdentityRoutes } from "./identity-routes.js";
import { registerInvitationRoutes } from "./invitation-routes.js";
import { registerApprovalRoutes, registerInboxRoutes, registerMcpRoutes } from "./mcp-approval-inbox-routes.js";
import { registerModelCredentialRoutes } from "./model-credential-routes.js";
import { registerModerationRoutes } from "./moderation-routes.js";
import { registerNativeRoutes } from "./native-routes.js";
import { registerNotificationRoutes } from "./notification-routes.js";
import { registerAuthorityRoutes, registerOAuthRoutes } from "./oauth-authority-routes.js";
import { registerOpenRouterRoutes } from "./openrouter-routes.js";
import { OperatorPreflight } from "./operator-preflight.js";
import { registerOperatorRoutes } from "./operator-routes.js";
import { registerPrivacyRoutes } from "./privacy-routes.js";
import { registerReportRoutes } from "./report-routes.js";
import { registerRunRoutes } from "./run-routes.js";
import { registerSealRoutes } from "./seal-routes.js";
import { registerSeasonRoutes } from "./season-routes.js";
import { registerSocialOverviewRoutes } from "./social-overview-routes.js";
import { registerTelegramRoutes } from "./telegram-routes.js";
import { registerWorldViewRoutes } from "./world-view-routes.js";

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
  admin?: { reader: AdminReader; provision: import("@pact/identity").AdminProvisioning; setup?: AdminSetup };
  collections?: import("@pact/kingdom").CollectionStoriesService;
  persistentPlay?: import("@pact/runs").PersistentPlayService;
  privateMemory?: import("@pact/kingdom").PrivateMemoryService;
  identity: IdentityService;
  onboarding: OnboardingService;
  kingdom?: KingdomService;
  kingdomDiscovery?: import("@pact/kingdom").KingdomDiscoveryReader;
  worldViews?: WorldViewService;
  decisionSupport?: DecisionSupportReader;
  socialOverview?: SocialOverviewReader;
  council?: import("@pact/kingdom").CouncilReader;
  readCouncil?: (
    accountId: string,
    query: { search: string; offset: number },
    human?: boolean,
  ) => Promise<Record<string, unknown>>;
  invitations?: InvitationService;
  gameTime?: () => Promise<number>;
  courts?: import("@pact/kingdom").CourtService;
  politics?: import("@pact/kingdom").PoliticsService;
  seals?: import("@pact/kingdom").SealService;
  chronicle?: import("@pact/kingdom").ChronicleService;
  seasons?: Pick<import("@pact/kingdom").SeasonService, "readCurrent">;
  reports?: GameReportReader;
  dispatcher: CommandDispatcher;
  oauth?: OAuthService;
  authority?: AuthorityService;
  mcp?: McpTransport;
  a2aEnabled?: boolean;
  a2aBaseUrl?: string;
  approvals?: ApprovalService;
  inbox?: InboxService;
  agentEvents?: import("@pact/inbox").AgentEventService;
  notifications?: NotificationService;
  moderation?: import("@pact/kingdom").ModerationService;
  webPushPublicKey?: string | undefined;
  credentialVault?: CredentialVaultService;
  runs?: RunService;
  externalActivity?: ExternalAgentActivity;
  openRouter?: OpenRouterAuthService;
  telegram?: TelegramService;
  telegramBot?: import("@pact/telegram").TelegramBotService;
  privacy?: PrivacyService;
  origin?: string;
  operatorPreflight?: OperatorPreflight;
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

  server.get("/v2/interfaces", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    const a2a = Boolean(modules?.a2aEnabled && modules.mcp && modules.oauth && modules.runs);
    return {
      api: { enabled: Boolean(modules), version: "v1" },
      mcp: { enabled: Boolean(modules?.mcp && modules?.oauth) },
      toolCalling: {
        enabled: Boolean(modules?.mcp),
        description: "Canonical game schemas via MCP or @pact/contracts; model-side tool calling is optional",
      },
      agentEvents: {
        enabled: Boolean(modules?.agentEvents),
        schemaVersion: modules?.agentEvents ? "pact.agent-events.v1" : null,
        delivery: "poll",
        parallelReasoning: false,
        sourceTypes: modules?.agentEvents ? Object.keys(agentEventCoverage) : [],
        completeWorld: false,
      },
      a2a: {
        enabled: a2a,
        protocolVersion: a2a ? "1.0" : null,
        binding: a2a ? "JSONRPC" : null,
        cardPath: a2a ? "/.well-known/agent-card.json" : null,
      },
    };
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
    if (modules.admin)
      registerAdminRoutes(server, modules.identity, modules.admin.reader, modules.admin.provision, modules.admin.setup);
    const operatorPreflight =
      modules.operatorPreflight ?? OperatorPreflight.unavailable("operator register not supplied");
    registerIdentityRoutes(server, modules.identity, modules.onboarding, operatorPreflight, modules.kingdom);
    registerOperatorRoutes(server, operatorPreflight);
    if (modules.kingdom)
      registerGuestRoutes(
        server,
        modules.identity,
        modules.onboarding,
        modules.kingdom,
        modules.origin ?? "https://pact.example",
      );
    registerCommandRoutes(server, modules.identity, modules.dispatcher);
    if (modules.invitations && modules.gameTime)
      registerInvitationRoutes(
        server,
        modules.identity,
        modules.dispatcher,
        modules.invitations,
        modules.gameTime,
        modules.courts,
        modules.politics,
      );
    if (modules.seals) registerSealRoutes(server, modules.identity, modules.seals);
    if (modules.seasons) registerSeasonRoutes(server, pool, modules.identity, modules.seasons, modules.oauth);
    if (modules.chronicle && modules.gameTime)
      registerChronicleRoutes(server, modules.identity, modules.chronicle, modules.gameTime);
    if (modules.worldViews)
      registerWorldViewRoutes(server, modules.identity, modules.worldViews, modules.oauth, modules.kingdomDiscovery);
    if (modules.persistentPlay) registerEnrollmentRoutes(server, modules.identity, modules.persistentPlay);
    if (modules.privateMemory) registerMemoryRoutes(server, modules.identity, modules.privateMemory, modules.oauth);
    if (modules.collections) registerCollectionRoutes(server, modules.identity, modules.collections);
    if (modules.decisionSupport)
      registerDecisionRoutes(server, modules.identity, modules.decisionSupport, modules.oauth);
    if (modules.council && modules.readCouncil)
      registerCouncilRoutes(server, modules.identity, modules.council, modules.readCouncil);
    if (modules.socialOverview) registerSocialOverviewRoutes(server, modules.identity, modules.socialOverview);
    if (modules.reports) registerReportRoutes(server, modules.identity, modules.reports, modules.oauth);
    if (modules.oauth) registerOAuthRoutes(server, modules.oauth, modules.identity);
    if (modules.authority) registerAuthorityRoutes(server, modules.identity, modules.authority);
    if (modules.mcp && modules.oauth) {
      registerMcpRoutes(server, modules.mcp, modules.oauth, modules.origin ?? "https://pact.example");
    }
    if (modules.a2aEnabled && modules.mcp && modules.oauth && modules.runs) {
      const base = modules.a2aBaseUrl ?? modules.origin ?? "https://pact.example";
      registerA2ARoutes(
        server,
        new PactA2AHandler(base, modules.mcp.operationOptions, modules.runs, modules.dispatcher),
        modules.oauth,
        modules.origin ?? base,
      );
    }
    if (modules.approvals) registerApprovalRoutes(server, modules.identity, modules.approvals);
    if (modules.oauth && modules.approvals) {
      registerNativeRoutes(server, modules.oauth, modules.onboarding, modules.dispatcher, modules.approvals);
    }
    if (modules.moderation)
      registerModerationRoutes(
        server,
        modules.identity,
        modules.moderation,
        new Set([modules.origin ?? "https://pact.example"]),
      );
    if (modules.notifications)
      registerNotificationRoutes(server, modules.identity, modules.notifications, modules.webPushPublicKey);
    if (modules.agentEvents) registerAgentEventRoutes(server, modules.identity, modules.agentEvents, modules.oauth);
    if (modules.inbox) registerInboxRoutes(server, modules.identity, modules.inbox, modules.dispatcher);
    if (modules.credentialVault) registerModelCredentialRoutes(server, modules.identity, modules.credentialVault);
    if (modules.runs) registerRunRoutes(server, modules.identity, modules.runs, modules.externalActivity);
    if (modules.openRouter) {
      registerOpenRouterRoutes(server, modules.identity, modules.openRouter, modules.credentialVault);
    }
    if (modules.telegram) registerTelegramRoutes(server, modules.identity, modules.telegram, modules.telegramBot);
    if (modules.privacy) registerPrivacyRoutes(server, modules.identity, modules.privacy);
  }
  return server;
}

import type { DecisionSupportReader } from "@pact/application";
import { registerCollectionRoutes } from "./collection-routes.js";
import { registerDecisionRoutes } from "./decision-routes.js";
import { registerEnrollmentRoutes } from "./enrollment-routes.js";
import { registerMemoryRoutes } from "./memory-routes.js";
