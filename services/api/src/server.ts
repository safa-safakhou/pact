import type { CommandDispatcher } from "@pact/application";
import type { IdentityService } from "@pact/identity";
import type { OnboardingService } from "@pact/onboarding";
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
import { registerCommandRoutes } from "./command-routes.js";
import { registerIdentityRoutes } from "./identity-routes.js";

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

export function buildServer(
  pool: Pool,
  logger: boolean | object = true,
  telemetry: Telemetry = stdoutTelemetry(),
  modules?: { identity: IdentityService; onboarding: OnboardingService; dispatcher: CommandDispatcher },
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
  if (modules) {
    registerIdentityRoutes(server, modules.identity, modules.onboarding);
    registerCommandRoutes(server, modules.identity, modules.dispatcher);
  }
  return server;
}
