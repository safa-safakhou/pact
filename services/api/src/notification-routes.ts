import { IdentityError, type IdentityService } from "@pact/identity";
import { NotificationError, type NotificationService } from "@pact/inbox";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

function token(request: FastifyRequest): string {
  const part = request.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("pact_session="));
  if (!part) throw new IdentityError("FORBIDDEN");
  try {
    return decodeURIComponent(part.slice(13));
  } catch {
    throw new IdentityError("FORBIDDEN");
  }
}
async function safe(reply: FastifyReply, action: () => Promise<unknown>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof IdentityError || error instanceof NotificationError)
      return reply
        .code(error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 400)
        .send({ error: { code: error.code } });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    throw error;
  }
}
export function registerNotificationRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  notifications: NotificationService,
  publicKey?: string,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/notifications")) reply.header("cache-control", "no-store");
    return payload;
  });
  const owner = async (request: FastifyRequest, write = false) => {
    if (!write) return (await identity.authenticate(token(request))).accountId;
    const csrf = request.headers["x-csrf-token"],
      origin = request.headers.origin;
    if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
    return (await identity.authorizeCookieWrite(token(request), csrf, origin)).accountId;
  };
  server.get("/v1/notifications/preferences", async (request, reply) =>
    safe(reply, async () => ({
      ...(await notifications.preferences(await owner(request))),
      webPushPublicKey: publicKey ?? null,
    })),
  );
  server.post("/v1/notifications/preferences", async (request, reply) =>
    safe(reply, async () => {
      const accountId = await owner(request, true);
      const body = z
        .object({ category: z.string().max(32), channel: z.enum(["email", "webpush"]), enabled: z.boolean() })
        .strict()
        .parse(request.body);
      return notifications.setPreference(accountId, body.category, body.channel, body.enabled);
    }),
  );
  server.post("/v1/notifications/subscriptions", async (request, reply) =>
    safe(reply, async () => {
      const accountId = await owner(request, true);
      if (!publicKey) throw new NotificationError("INVALID_INPUT");
      const body = z
        .object({
          permission: z.literal("granted"),
          subscription: z
            .object({
              endpoint: z.url().max(2048),
              keys: z.object({ auth: z.string().max(128), p256dh: z.string().max(256) }).strict(),
            })
            .strict(),
        })
        .strict()
        .parse(request.body);
      return notifications.subscribe(accountId, body.subscription, body.permission);
    }),
  );
  server.post("/v1/notifications/subscriptions/:id/revoke", async (request, reply) =>
    safe(reply, async () => {
      const accountId = await owner(request, true);
      const { id } = z.object({ id: z.uuid() }).parse(request.params);
      await notifications.unsubscribe(accountId, id);
      return { revoked: true };
    }),
  );
}
