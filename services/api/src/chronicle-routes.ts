import { ChronicleReadQuerySchema, ChronicleSelectionSchema } from "@pact/contracts";
import { IdentityError, type IdentityService } from "@pact/identity";
import { ChronicleError, type ChronicleService } from "@pact/kingdom";
import type { FastifyInstance, FastifyRequest } from "fastify";

function session(r: FastifyRequest) {
  const t = r.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("pact_session="))
    ?.slice(13);
  if (!t) throw new IdentityError("FORBIDDEN");
  return decodeURIComponent(t);
}
export function registerChronicleRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  chronicle: ChronicleService,
  gameTime: () => Promise<number>,
) {
  server.addHook("onSend", async (r, reply, payload) => {
    if (r.url.startsWith("/v1/chronicle")) reply.header("cache-control", "no-store");
    return payload;
  });
  server.get("/v1/chronicle/facts", async (r, reply) => {
    try {
      return chronicle.ownFacts((await identity.authenticate(session(r))).accountId);
    } catch (e) {
      if (e instanceof IdentityError || e instanceof ChronicleError)
        return reply.code(403).send({ error: { code: e.code } });
      throw e;
    }
  });
  server.get<{ Querystring: Record<string, string> }>("/v1/chronicle", async (r, reply) => {
    const q = ChronicleReadQuerySchema.safeParse({
      ...r.query,
      ...(r.query.offset === undefined ? {} : { offset: Number(r.query.offset) }),
    });
    if (!q.success) return reply.code(400).send({ error: { code: "INVALID_QUERY" } });
    let accountId: string | undefined;
    if (r.headers.cookie)
      try {
        accountId = (await identity.authenticate(session(r))).accountId;
      } catch (e) {
        if (!(e instanceof IdentityError)) throw e;
      }
    return chronicle.read(q.data, await gameTime(), accountId);
  });
  server.post("/v1/chronicle/preview", async (r, reply) => {
    const s = ChronicleSelectionSchema.safeParse(r.body);
    if (!s.success) return reply.code(400).send({ error: { code: "INVALID_SELECTION" } });
    try {
      const csrf = r.headers["x-csrf-token"],
        origin = r.headers.origin;
      if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
      const human = await identity.authorizeCookieWrite(session(r), csrf, origin);
      return chronicle.preview(human.accountId, s.data);
    } catch (e) {
      if (e instanceof IdentityError || e instanceof ChronicleError)
        return reply.code(e.code === "FORBIDDEN" ? 403 : 409).send({ error: { code: e.code } });
      throw e;
    }
  });
}
