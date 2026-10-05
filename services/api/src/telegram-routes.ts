import { IdentityError, type IdentityService } from "@pact/identity";
import { type TelegramBotService, TelegramError, type TelegramService } from "@pact/telegram";
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

function writeContext(request: FastifyRequest): { sessionToken: string; csrfToken: string; origin: string } {
  const sessionToken = cookieValue(request, "pact_session");
  const csrfToken = request.headers["x-csrf-token"];
  const origin = request.headers.origin;
  if (!sessionToken || typeof csrfToken !== "string" || typeof origin !== "string") {
    throw new IdentityError("FORBIDDEN");
  }
  return { sessionToken, csrfToken, origin };
}

export function telegramSessionCookie(sessionToken?: string): string {
  const value = sessionToken ? encodeURIComponent(sessionToken) : "";
  return `pact_session=${value}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned${sessionToken ? "" : "; Max-Age=0"}`;
}

async function safe(reply: FastifyReply, operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IdentityError) {
      return reply.code(error.code === "FORBIDDEN" ? 403 : 400).send({ error: { code: error.code } });
    }
    if (error instanceof TelegramError) {
      const status =
        error.code === "FORBIDDEN" || error.code === "GROUP_CHAT_DENIED" || error.code === "INVALID_WEBHOOK_SECRET"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : 409;
      return reply.code(status).send({ error: { code: error.code } });
    }
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    throw error;
  }
}

export function registerTelegramRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  telegram: TelegramService,
  bot?: TelegramBotService,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/telegram/")) reply.header("cache-control", "no-store");
    return payload;
  });

  if (bot) {
    server.get("/v1/telegram/run-settings", async (request, reply) =>
      safe(reply, async () => {
        const raw = cookieValue(request, "pact_session");
        if (!raw) throw new IdentityError("FORBIDDEN");
        return bot.settings((await identity.authenticate(raw)).accountId);
      }),
    );
    server.post("/v1/telegram/run-settings", async (request, reply) =>
      safe(reply, async () => {
        const context = writeContext(request),
          session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
        const body = z
          .object({
            credentialId: z.uuid(),
            provider: z.string().min(1).max(50),
            model: z.string().min(1).max(200),
            maxCalls: z.number().int().min(1).max(20),
            maxTokens: z.number().int().min(1).max(40000),
            maxMessages: z.number().int().min(1).max(24),
            maxConversations: z.number().int().min(1).max(12),
          })
          .strict()
          .parse(request.body);
        return bot.saveSettings(session.accountId, body);
      }),
    );
  }
  server.post("/v1/telegram/bootstrap", async (request, reply) =>
    safe(reply, async () => {
      const body = z.object({ initData: z.string().min(1).max(16_384) }).parse(request.body);
      return telegram.beginBootstrap(body.initData);
    }),
  );

  server.post("/v1/telegram/link/confirm", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const body = z.object({ bootstrapToken: z.string().min(32).max(128) }).parse(request.body);
      await telegram.confirmLink(session.accountId, body.bootstrapToken);
      return { linked: true };
    }),
  );

  server.post("/v1/telegram/session", async (request, reply) =>
    safe(reply, async () => {
      const body = z
        .object({ initData: z.string().min(1).max(16_384), bootstrapToken: z.string().min(32).max(128) })
        .parse(request.body);
      const session = await telegram.exchangeBootstrap(body.initData, body.bootstrapToken);
      reply.header("set-cookie", telegramSessionCookie(session.sessionToken));
      return { csrfToken: session.csrfToken, telegramUserId: session.telegramUserId };
    }),
  );

  server.post("/v1/telegram/unlink", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      await telegram.unlink(session.accountId);
      reply.header("set-cookie", telegramSessionCookie());
      return { unlinked: true };
    }),
  );

  server.post("/telegram/webhook", async (request, reply) =>
    safe(reply, async () => {
      const secret = request.headers["x-telegram-bot-api-secret-token"];
      return telegram.acceptWebhook(typeof secret === "string" ? secret : undefined, request.body);
    }),
  );
}
