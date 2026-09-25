import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import { RunError, type RunService } from "@pact/runs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

function cookieValue(request: FastifyRequest, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function sessionToken(request: FastifyRequest): string {
  const token = cookieValue(request, "pact_session");
  if (!token) throw new IdentityError("FORBIDDEN");
  return token;
}

async function safe(reply: FastifyReply, operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IdentityError) {
      return reply.code(error.code === "FORBIDDEN" ? 403 : 400).send({ error: { code: error.code } });
    }
    if (error instanceof RunError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "RUN_ALREADY_ACTIVE" || error.code === "LEASE_HELD" || error.code === "IN_FLIGHT"
              ? 409
              : 400;
      return reply.code(status).send({ error: { code: error.code } });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    }
    throw error;
  }
}

export function registerRunRoutes(server: FastifyInstance, identity: IdentityService, runs: RunService): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/runs")) reply.header("cache-control", "no-store");
    return payload;
  });

  server.post("/v1/runs", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      const body = z
        .object({
          objective: z.string().min(1).max(4_000),
          provider: z.string().min(1),
          model: z.string().min(1),
          credentialId: z.string().uuid().optional(),
          maxCalls: z.number().int().positive().max(100).optional(),
          maxTokens: z.number().int().positive().max(200_000).optional(),
          maxMessages: z.number().int().min(1).max(24).optional(),
        })
        .parse(request.body);
      return runs.start({
        accountId: session.accountId,
        objective: body.objective,
        provider: body.provider,
        model: body.model,
        ...(body.credentialId ? { credentialId: body.credentialId } : {}),
        limits: {
          ...(body.maxCalls !== undefined ? { maxCalls: body.maxCalls } : {}),
          ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
          ...(body.maxMessages !== undefined ? { maxMessages: body.maxMessages } : {}),
        },
      });
    }),
  );

  server.get<{ Params: { runId: string } }>("/v1/runs/:runId", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      return runs.get(request.params.runId, session.accountId);
    }),
  );

  server.post<{ Params: { runId: string } }>("/v1/runs/:runId/stop", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      return runs.stop(session.accountId, request.params.runId);
    }),
  );

  server.post<{ Params: { runId: string } }>("/v1/runs/:runId/wait", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      return runs.wait(session.accountId, request.params.runId);
    }),
  );

  server.post<{ Params: { runId: string } }>("/v1/runs/:runId/resume", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      return runs.resume(session.accountId, request.params.runId);
    }),
  );
}
