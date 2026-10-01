import { SealReadQuerySchema, SealSelectionSchema } from "@pact/contracts";
import { IdentityError, type IdentityService } from "@pact/identity";
import { SealError, type SealService } from "@pact/kingdom";
import type { FastifyInstance, FastifyRequest } from "fastify";

function token(request: FastifyRequest) {
  const value = request.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("pact_session="))
    ?.slice(13);
  if (!value) throw new IdentityError("FORBIDDEN");
  return decodeURIComponent(value);
}
export function registerSealRoutes(server: FastifyInstance, identity: IdentityService, seals: SealService) {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/seals") || request.url.startsWith("/.well-known/pact-signing-keys.json"))
      reply.header("cache-control", "no-store");
    return payload;
  });
  server.get("/.well-known/pact-signing-keys.json", async () => seals.keys());
  server.get<{ Params: { sealId: string } }>("/v1/seals/:sealId", async (request, reply) => {
    const parsed = SealReadQuerySchema.safeParse({ sealId: request.params.sealId });
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_SELECTION" } });
    let accountId: string | undefined;
    if (request.headers.cookie)
      try {
        accountId = (await identity.authenticate(token(request))).accountId;
      } catch (e) {
        if (!(e instanceof IdentityError)) throw e;
      }
    return seals.read(parsed.data.sealId, accountId);
  });
  server.post("/v1/seals/preview", async (request, reply) => {
    const parsed = SealSelectionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_SELECTION" } });
    try {
      const csrf = request.headers["x-csrf-token"],
        origin = request.headers.origin;
      if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
      const human = await identity.authorizeCookieWrite(token(request), csrf, origin);
      return seals.preview(human.accountId, parsed.data);
    } catch (error) {
      if (error instanceof SealError || error instanceof IdentityError)
        return reply.code(error.code === "FORBIDDEN" ? 403 : 409).send({ error: { code: error.code } });
      throw error;
    }
  });
}
