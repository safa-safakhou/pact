import { type CommandDispatcher, DispatcherError } from "@pact/application";
import { PoliticsReadQuerySchema, ProductScopeSchema } from "@pact/contracts";
import { IdentityError, type IdentityService } from "@pact/identity";
import {
  ActionLimitError,
  ChronicleError,
  CourtError,
  CourtInvitationError,
  type CourtService,
  InvitationError,
  type InvitationService,
  PoliticsError,
  type PoliticsService,
  SealError,
  SocialError,
} from "@pact/kingdom";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

function session(request: FastifyRequest): string {
  const value = request.headers.cookie
    ?.split(";")
    .find((value) => value.trim().startsWith("pact_session="))
    ?.trim()
    .slice("pact_session=".length);
  if (!value) throw new IdentityError("FORBIDDEN");
  return decodeURIComponent(value);
}
async function safe(reply: FastifyReply, operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof CourtInvitationError ||
      error instanceof CourtError ||
      error instanceof PoliticsError ||
      error instanceof SealError ||
      error instanceof ChronicleError ||
      error instanceof ActionLimitError ||
      error instanceof InvitationError ||
      error instanceof SocialError ||
      error instanceof DispatcherError ||
      error instanceof IdentityError
    )
      return reply
        .code(
          error.code === "FORBIDDEN"
            ? 403
            : error.code === "INVALID_COMMAND" || error.code === "INVALID_INVITATION"
              ? 400
              : 409,
        )
        .send({ error: { code: error.code, message: error.message } });
    throw error;
  }
}
export function registerInvitationRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  dispatcher: CommandDispatcher,
  invitations: InvitationService,
  gameTime: () => Promise<number>,
  courts?: CourtService,
  politics?: PoliticsService,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (
      request.url.startsWith("/v1/invitations") ||
      request.url.startsWith("/v1/social/commands") ||
      request.url.startsWith("/v1/courts") ||
      request.url.startsWith("/v1/politics")
    )
      reply.header("cache-control", "no-store");
    return payload;
  });
  if (politics)
    server.get<{ Querystring: { handle?: string; offset?: string } }>("/v1/politics", async (request, reply) =>
      safe(reply, async () => {
        const query = PoliticsReadQuerySchema.safeParse({
          ...request.query,
          ...(request.query.offset === undefined ? {} : { offset: Number(request.query.offset) }),
        });
        if (!query.success) throw new DispatcherError("INVALID_COMMAND");
        let accountId: string | undefined;
        if (request.headers.cookie)
          try {
            accountId = (await identity.authenticate(session(request))).accountId;
          } catch (error) {
            if (!(error instanceof IdentityError)) throw error;
          }
        return politics.read(query.data.handle, query.data.offset, accountId, await gameTime());
      }),
    );
  if (courts)
    server.get<{ Querystring: { handle?: string; offset?: string } }>("/v1/courts", async (request, reply) =>
      safe(reply, async () => {
        const { CourtReadQuerySchema } = await import("@pact/contracts");
        const parsed = CourtReadQuerySchema.safeParse({
          ...request.query,
          ...(request.query.offset === undefined ? {} : { offset: Number(request.query.offset) }),
        });
        if (!parsed.success) throw new DispatcherError("INVALID_COMMAND");
        let accountId: string | undefined;
        if (request.headers.cookie) {
          try {
            accountId = (await identity.authenticate(session(request))).accountId;
          } catch (error) {
            if (!(error instanceof IdentityError)) throw error;
          }
        }
        return courts.read(parsed.data.handle, parsed.data.offset, accountId);
      }),
    );
  server.get("/v1/invitations/remembered", async (request, reply) =>
    safe(reply, async () => {
      const account = await identity.authenticate(session(request));
      return invitations.withRead(async (client) => ({
        invitation: await invitations.remembered(client, account.accountId, await gameTime()),
      }));
    }),
  );
  server.get<{ Params: { token: string } }>("/v1/invitations/:token", async (request, reply) =>
    safe(reply, async () => {
      let accountId: string | undefined;
      if (request.headers.cookie) {
        try {
          accountId = (await identity.authenticate(session(request))).accountId;
        } catch (error) {
          if (!(error instanceof IdentityError)) throw error;
        }
      }
      return invitations.withRead(async (client) =>
        invitations.read(client, request.params.token, await gameTime(), accountId),
      );
    }),
  );
  server.post("/v1/social/commands", async (request, reply) =>
    safe(reply, async () => {
      const csrf = request.headers["x-csrf-token"];
      const origin = request.headers.origin;
      if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
      const account = await identity.authorizeCookieWrite(session(request), csrf, origin);
      return dispatcher.dispatchSocial(
        {
          accountId: account.accountId,
          productScope: ProductScopeSchema.parse("pact"),
          audience: "human",
          sessionId: account.sessionId,
        },
        request.body,
      );
    }),
  );
}
