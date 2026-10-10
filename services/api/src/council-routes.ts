import { IdentityError, type IdentityService } from "@pact/identity";
import type { CouncilReader, EnvoyCharacter } from "@pact/kingdom";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

function sessionToken(request: FastifyRequest) {
  const cookie = request.headers.cookie?.split(";").find((p) => p.trim().startsWith("pact_session="));
  if (!cookie) throw new IdentityError("FORBIDDEN");
  try {
    return decodeURIComponent(cookie.trim().slice(13));
  } catch {
    throw new IdentityError("FORBIDDEN");
  }
}
async function safe(reply: FastifyReply, operation: () => Promise<unknown>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IdentityError) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    throw error;
  }
}
export function registerCouncilRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  council: CouncilReader,
  read: (
    accountId: string,
    query: { search: string; offset: number },
    human?: boolean,
  ) => Promise<Record<string, unknown>>,
) {
  server.get("/v1/game/council", async (request, reply) =>
    safe(reply, async () => {
      reply.header("cache-control", "no-store");
      const session = await identity.authenticate(sessionToken(request));
      const query = z
        .object({
          search: z.string().max(80).default(""),
          offset: z.coerce.number().int().min(0).max(10000).default(0),
        })
        .parse(request.query);
      return read(session.accountId, query, true);
    }),
  );
  server.get("/v1/game/council/thread", async (request, reply) =>
    safe(reply, async () => {
      reply.header("cache-control", "no-store");
      const session = await identity.authenticate(sessionToken(request));
      const query = z
        .object({
          kingdomId: z.uuid(),
          beforeGameTimeMs: z
            .string()
            .regex(/^\d{1,18}$/)
            .optional(),
          beforeId: z.uuid().optional(),
        })
        .strict()
        .parse(request.query);
      if (Boolean(query.beforeId) !== Boolean(query.beforeGameTimeMs))
        return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
      return council.thread(
        session.accountId,
        query.kingdomId,
        query.beforeId && query.beforeGameTimeMs
          ? { id: query.beforeId, gameTimeMs: query.beforeGameTimeMs }
          : undefined,
      );
    }),
  );
  server.get("/v1/game/conversations/agreements", async (request, reply) =>
    safe(reply, async () => {
      reply.header("cache-control", "no-store");
      const session = await identity.authenticate(sessionToken(request));
      const query = z
        .object({
          kingdomId: z.uuid(),
          beforeGameTimeMs: z
            .string()
            .regex(/^\d{1,18}$/)
            .optional(),
          beforeId: z.uuid().optional(),
        })
        .strict()
        .parse(request.query);
      if (Boolean(query.beforeId) !== Boolean(query.beforeGameTimeMs))
        return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
      return council.history.agreements(
        session.accountId,
        query.kingdomId,
        query.beforeId && query.beforeGameTimeMs
          ? { id: query.beforeId, gameTimeMs: query.beforeGameTimeMs }
          : undefined,
      );
    }),
  );
  server.get("/v1/game/conversations/versions", async (request, reply) =>
    safe(reply, async () => {
      reply.header("cache-control", "no-store");
      const session = await identity.authenticate(sessionToken(request));
      const query = z
        .object({ kingdomId: z.uuid(), offerId: z.uuid(), beforeVersion: z.coerce.number().int().positive() })
        .strict()
        .parse(request.query);
      return council.history.versions(session.accountId, query.kingdomId, query.offerId, query.beforeVersion);
    }),
  );
  server.get("/v1/game/conversations/consents", async (request, reply) =>
    safe(reply, async () => {
      reply.header("cache-control", "no-store");
      const session = await identity.authenticate(sessionToken(request));
      const query = z.object({ kingdomId: z.uuid() }).strict().parse(request.query);
      return { consents: await council.history.consents(session.accountId, query.kingdomId) };
    }),
  );
  server.get("/v1/game/conversations/observations", async (request, reply) =>
    safe(reply, async () => {
      reply.header("cache-control", "no-store");
      const session = await identity.authenticate(sessionToken(request));
      const query = z
        .object({ offset: z.coerce.number().int().min(0).max(10000).default(0) })
        .strict()
        .parse(request.query);
      return council.history.observations(session.accountId, query.offset);
    }),
  );
  server.get("/v1/game/conversations/observe", async (request, reply) =>
    safe(reply, async () => {
      reply.header("cache-control", "no-store");
      const session = await identity.authenticate(sessionToken(request));
      const query = z
        .object({
          leftKingdomId: z.uuid(),
          rightKingdomId: z.uuid(),
          beforeGameTimeMs: z
            .string()
            .regex(/^\d{1,18}$/)
            .optional(),
          beforeId: z.uuid().optional(),
        })
        .strict()
        .parse(request.query);
      if (Boolean(query.beforeId) !== Boolean(query.beforeGameTimeMs))
        return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
      return (
        (await council.history.observed(
          session.accountId,
          query.leftKingdomId,
          query.rightKingdomId,
          query.beforeId && query.beforeGameTimeMs
            ? { id: query.beforeId, gameTimeMs: query.beforeGameTimeMs }
            : undefined,
        )) ?? reply.code(403).send({ error: { code: "OBSERVATION_NOT_CONSENTED" } })
      );
    }),
  );
  server.put("/v1/game/council/character", async (request, reply) =>
    safe(reply, async () => {
      reply.header("cache-control", "no-store");
      const csrf = request.headers["x-csrf-token"],
        origin = request.headers.origin;
      if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
      const session = await identity.authorizeCookieWrite(sessionToken(request), csrf, origin);
      const input = z
        .object({
          character: z
            .object({
              name: z.string().trim().min(1).max(60),
              seed: z.string().max(160),
              color: z.string().regex(/^#[a-f0-9]{6}$/i),
              variation: z.number().int().min(0).max(1000000),
            })
            .strict(),
          expectedVersion: z.number().int().positive(),
        })
        .strict()
        .parse(request.body);
      const result = await council.customize(
        session.accountId,
        input.character as EnvoyCharacter,
        input.expectedVersion,
      );
      return (
        result ??
        reply.code(409).send({
          error: { code: "STALE_CHARACTER", message: "Your character changed elsewhere. Refresh before saving." },
        })
      );
    }),
  );
}
