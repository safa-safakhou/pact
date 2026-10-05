import { IdentityError, type IdentityService } from "@pact/identity";
import { ModerationError, type ModerationService } from "@pact/kingdom";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const Target = z.enum(["message", "profile", "post", "article", "court", "pin", "seal"]);
function token(request: FastifyRequest) {
  const value = request.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("pact_session="));
  if (!value) throw new IdentityError("FORBIDDEN");
  try {
    return decodeURIComponent(value.slice(13));
  } catch {
    throw new IdentityError("FORBIDDEN");
  }
}
async function safe(reply: FastifyReply, action: () => Promise<unknown>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof IdentityError || error instanceof ModerationError)
      return reply
        .code(
          error.code === "FORBIDDEN"
            ? 403
            : error.code === "NOT_FOUND"
              ? 404
              : error.code === "INVALID_INPUT"
                ? 400
                : 409,
        )
        .send({ error: { code: error.code } });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    throw error;
  }
}
export function registerModerationRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  moderation: ModerationService,
  allowedOrigins: ReadonlySet<string>,
) {
  const human = async (request: FastifyRequest, write = false) => {
    const cookie = token(request);
    if (!write) return identity.authenticate(cookie);
    const csrf = request.headers["x-csrf-token"],
      origin = request.headers.origin;
    if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
    return identity.authorizeCookieWrite(cookie, csrf, origin);
  };
  const staff = async (request: FastifyRequest, write = false) => {
    await human(request, write);
    const s = await identity.requireStaffSession(token(request));
    return { accountId: s.accountId, sessionId: s.sessionId };
  };
  const id = (request: FastifyRequest) => z.object({ id: z.uuid() }).parse(request.params).id;
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/moderation")) reply.header("cache-control", "no-store");
    return payload;
  });
  server.post("/v1/moderation/reports", async (request, reply) =>
    safe(reply, async () => {
      const session = await human(request, true);
      const body = z
        .object({
          reportKey: z.uuid(),
          kind: Target,
          targetId: z.uuid(),
          category: z.enum(["doxxing", "threat", "abuse", "other"]),
          details: z.string().min(1).max(2000),
        })
        .strict()
        .parse(request.body);
      return moderation.report(session.accountId, body);
    }),
  );
  server.get("/v1/moderation/mine", async (request, reply) =>
    safe(reply, async () => moderation.myCases((await human(request)).accountId)),
  );
  server.post("/v1/moderation/cases/:id/appeal", async (request, reply) =>
    safe(reply, async () => {
      const session = await human(request, true),
        body = z
          .object({ reason: z.string().min(1).max(2000) })
          .strict()
          .parse(request.body);
      return moderation.appeal(session.accountId, id(request), body.reason);
    }),
  );
  // Limited one-use appeal capability also works after platform account closure. It never grants a game session.
  server.post("/v1/moderation/appeal", async (request, reply) =>
    safe(reply, async () => {
      const origin = request.headers.origin;
      if (typeof origin !== "string" || !allowedOrigins.has(origin)) throw new ModerationError("FORBIDDEN");
      const body = z
        .object({ token: z.string().min(43).max(43), reason: z.string().min(1).max(2000) })
        .strict()
        .parse(request.body);
      return moderation.appealByToken(body.token, body.reason);
    }),
  );
  server.get("/v1/moderation/queue", async (request, reply) =>
    safe(reply, async () => moderation.queue(await staff(request))),
  );
  server.post("/v1/moderation/cases/:id/claim", async (request, reply) =>
    safe(reply, async () => moderation.claim(await staff(request, true), id(request))),
  );
  server.get("/v1/moderation/cases/:id", async (request, reply) =>
    safe(reply, async () => moderation.read(await staff(request), id(request))),
  );
  server.post("/v1/moderation/cases/:id/actions", async (request, reply) =>
    safe(reply, async () => {
      const principal = await staff(request, true);
      const body = z
        .object({
          action: z.enum(["hide", "suspend-messaging", "suspend-play", "close", "dismiss", "overturn", "uphold"]),
          reason: z.string().min(1).max(1000),
          until: z.iso.datetime().optional(),
        })
        .strict()
        .parse(request.body);
      return moderation.action(principal, id(request), {
        action: body.action,
        reason: body.reason,
        ...(body.until ? { until: new Date(body.until) } : {}),
      });
    }),
  );
  server.post("/v1/moderation/cases/:id/hold", async (request, reply) =>
    safe(reply, async () => {
      const principal = await staff(request, true),
        body = z
          .object({
            basis: z.string().min(1).max(2000),
            reviewAt: z.iso.datetime(),
            authorizedStaffIds: z.array(z.uuid()).max(10).optional(),
          })
          .strict()
          .parse(request.body);
      return moderation.hold(principal, id(request), {
        basis: body.basis,
        reviewAt: new Date(body.reviewAt),
        ...(body.authorizedStaffIds ? { authorizedStaffIds: body.authorizedStaffIds } : {}),
      });
    }),
  );
  server.post("/v1/moderation/cases/:id/hold/release", async (request, reply) =>
    safe(reply, async () => moderation.releaseHold(await staff(request, true), id(request))),
  );
}
