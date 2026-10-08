import { IdentityError, type IdentityService } from "@pact/identity";
import type { KingdomService } from "@pact/kingdom";
import type { OnboardingService } from "@pact/onboarding";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

function cookie(request: FastifyRequest): string {
  const part = request.headers.cookie?.split(";").find((p) => p.trim().startsWith("pact_session="));
  return part ? decodeURIComponent(part.trim().slice("pact_session=".length)) : "";
}
async function retryGuest<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (!["40001", "40P01", "DRAFT_EXPIRED"].includes(code) || attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1) + Math.random() * 100));
    }
  }
}
export function registerGuestRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  onboarding: OnboardingService,
  kingdom: KingdomService,
  origin: string,
) {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/play")) reply.header("cache-control", "no-store");
    return payload;
  });
  server.get("/v1/play", async (request) => {
    if (!identity.guestPlayEnabled) return { enabled: false };
    const current = await identity.guestSession(cookie(request)).catch(() => null);
    return { enabled: true, guest: Boolean(current), ...(current ?? {}) };
  });
  server.get("/v1/play/people", async (request, reply) => {
    if (!identity.guestPlayEnabled) return reply.code(404).send({ error: { code: "NOT_FOUND" } });
    const session = await identity.authenticate(cookie(request)).catch(() => null);
    if (!session) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
    const query = z.object({ offset: z.coerce.number().int().min(0).max(10000).default(0) }).parse(request.query);
    return kingdom.guestNeighbors(session.accountId, query.offset);
  });
  server.post("/v1/play/join", async (request, reply) => {
    if (!identity.guestPlayEnabled) return reply.code(404).send({ error: { code: "NOT_FOUND" } });
    if (request.headers.origin !== origin) return reply.code(403).send({ error: { code: "FORBIDDEN" } });
    const input = z
      .object({
        entryKey: z.uuid(),
        nickname: z.string().max(200).default(""),
        existingOnly: z.boolean().default(false),
      })
      .strict()
      .safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    try {
      return await retryGuest(async () => {
        const tokens = await identity.joinGuest(input.data.entryKey, input.data.existingOnly);
        const guest = await identity.guestSession(tokens.sessionToken);
        // Set the cookie before founding; ordinary world-tick retries resume the same account.
        reply.header(
          "set-cookie",
          `pact_session=${encodeURIComponent(tokens.sessionToken)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
        );
        let current = await kingdom.getByAccount(tokens.accountId);
        if (!current && input.data.existingOnly)
          return reply.code(409).send({ error: { code: "EXISTING_KINGDOM_REQUIRED" } });
        if (!current) {
          const nickname =
            input.data.nickname
              .replace(/[\p{Cc}]/gu, "")
              .trim()
              .slice(0, 40) || "Professor Turnip";
          const displayName = nickname.length === 1 ? `${nickname}!` : nickname;
          const slug =
            displayName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")
              .slice(0, 10) || "turnip";
          const draft = await onboarding.ensureDraft(tokens.accountId);
          if (!draft.displayName)
            await onboarding.updateDraft(tokens.accountId, {
              displayName,
              proposedHandle: `g${slug}_${tokens.accountId.replaceAll("-", "").slice(0, 8)}`,
              portrait: "alpha-default",
              expectedVersion: draft.version,
            });
          await onboarding.recordConnectionCheck(tokens.accountId);
          try {
            current = await kingdom.activate(tokens.accountId);
          } catch (error) {
            const code = error && typeof error === "object" && "code" in error ? String(error.code) : "JOIN_RETRY";
            if (["40001", "40P01", "DRAFT_EXPIRED"].includes(code)) throw error;
            return reply
              .code(409)
              .send({ error: { code: ["40001", "40P01"].includes(code) ? "JOIN_RETRY" : code }, ...guest });
          }
        }
        if (!current) return reply.code(409).send({ error: { code: "JOIN_RETRY" }, ...guest });
        return { ...guest, kingdomId: current.kingdomId, handle: current.handle };
      });
    } catch (error) {
      if (error instanceof IdentityError && error.code === "FORBIDDEN")
        return reply.code(403).send({ error: { code: "FORBIDDEN" } });
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (["40001", "40P01", "DRAFT_EXPIRED"].includes(code))
        return reply.code(409).send({ error: { code: "JOIN_RETRY" } });
      throw error;
    }
  });
}
