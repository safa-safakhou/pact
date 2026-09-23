import type { FastifyInstance } from "fastify";
import type { OperatorPreflight } from "./operator-preflight.js";

export function registerOperatorRoutes(server: FastifyInstance, preflight: OperatorPreflight): void {
  server.get("/v1/legal/notices", async (_request, reply) => {
    reply.header("cache-control", "public, max-age=300");
    const notice = preflight.publicNotice();
    return notice ?? { registrationEnabled: false, noticesConfigured: false };
  });

  server.get("/v1/legal/registration-status", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    return { registrationEnabled: preflight.registrationEnabled };
  });
}
