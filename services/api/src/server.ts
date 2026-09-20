import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";

export function buildServer(pool: Pool, logger: boolean | object = true): FastifyInstance {
  const server = Fastify({ logger });
  server.get("/health", async () => ({ status: "ok" }));
  server.get("/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });
  return server;
}
