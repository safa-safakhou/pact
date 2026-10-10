import { CollectionCommandSchema, CollectionQuerySchema } from "@pact/contracts";
import { IdentityError, type IdentityService } from "@pact/identity";
import { CollectionError, type CollectionStoriesService } from "@pact/kingdom";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

function token(request: FastifyRequest) {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("pact_session="));
  if (!cookie || request.headers.authorization) throw new IdentityError("FORBIDDEN");
  try {
    return decodeURIComponent(cookie.slice(13));
  } catch {
    throw new IdentityError("FORBIDDEN");
  }
}
export function registerCollectionRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  collections: CollectionStoriesService,
) {
  server.get("/v1/collections/public/:handle", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const handle = z
      .string()
      .min(1)
      .max(80)
      .parse((request.params as { handle: string }).handle);
    const card = await collections.publicCard(handle);
    return card ?? reply.code(404).send({ error: { code: "DISPLAY_UNAVAILABLE" } });
  });
  server.route({
    method: ["GET", "POST"],
    url: "/v1/collections",
    handler: async (request, reply) => {
      reply.header("cache-control", "no-store");
      try {
        if (request.method === "GET")
          return collections.read(
            (await identity.authenticate(token(request))).accountId,
            CollectionQuerySchema.parse(request.query),
          );
        const csrf = request.headers["x-csrf-token"],
          origin = request.headers.origin;
        if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
        const owner = await identity.authorizeCookieWrite(token(request), csrf, origin);
        return collections.command(owner.accountId, CollectionCommandSchema.parse(request.body));
      } catch (error) {
        if (error instanceof IdentityError || (error instanceof CollectionError && error.code === "FORBIDDEN"))
          return reply.code(403).send({ error: { code: "FORBIDDEN" } });
        if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
        if (error instanceof CollectionError) return reply.code(409).send({ error: { code: error.code } });
        throw error;
      }
    },
  });
}
