import { MemoryReadSchema, MemorySourceSchema, MemoryWriteSchema } from "@pact/contracts";
import { IdentityError, type IdentityService } from "@pact/identity";
import { PrivateMemoryError, type PrivateMemoryService } from "@pact/kingdom";
import type { OAuthService } from "@pact/oauth";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedWorldViewer } from "./world-read-auth.js";

async function safe(reply: FastifyReply, operation: () => Promise<unknown>) {
  reply.header("cache-control", "no-store");
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IdentityError || (error instanceof PrivateMemoryError && error.code === "FORBIDDEN"))
      return reply.code(403).send({ error: { code: "FORBIDDEN" } });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    if (error instanceof PrivateMemoryError) return reply.code(409).send({ error: { code: error.code } });
    throw error;
  }
}
async function human(request: FastifyRequest, identity: IdentityService) {
  const csrf = request.headers["x-csrf-token"],
    origin = request.headers.origin;
  const cookie = request.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("pact_session="));
  if (!cookie || typeof csrf !== "string" || typeof origin !== "string" || request.headers.authorization)
    throw new IdentityError("FORBIDDEN");
  let token: string;
  try {
    token = decodeURIComponent(cookie.slice(13));
  } catch {
    throw new IdentityError("FORBIDDEN");
  }
  return (await identity.authorizeCookieWrite(token, csrf, origin)).accountId;
}
export function registerMemoryRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  memory: PrivateMemoryService,
  oauth?: OAuthService,
) {
  server.get("/v1/game/private-memory", (request, reply) =>
    safe(reply, async () => {
      const raw = request.query as Record<string, unknown>;
      const query = MemoryReadSchema.parse({
        ...raw,
        ...(raw.beforeVersion === undefined ? {} : { beforeVersion: Number(raw.beforeVersion) }),
      });
      return memory.read(await authenticatedWorldViewer(request, identity, oauth), query);
    }),
  );
  server.get("/v1/game/private-memory/source", (request, reply) =>
    safe(reply, async () => {
      const raw = request.query as Record<string, unknown>;
      const query = MemorySourceSchema.parse({
        ...raw,
        ...(raw.version === undefined ? {} : { version: Number(raw.version) }),
      });
      return (
        (await memory.source(await authenticatedWorldViewer(request, identity, oauth), query)) ??
        reply.code(404).send({ error: { code: "SOURCE_UNAVAILABLE" } })
      );
    }),
  );
  server.post("/v1/game/private-memory", (request, reply) =>
    safe(reply, async () =>
      memory.write(await human(request, identity), "human", MemoryWriteSchema.parse(request.body)),
    ),
  );
}
