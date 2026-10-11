import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import { KingdomError, type KingdomService } from "@pact/kingdom";
import type { OnboardingService } from "@pact/onboarding";
import { OnboardingError } from "@pact/onboarding";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  browserAccountList,
  browserCookies,
  forgetBrowserAccount,
  pruneBrowserAccounts,
  rememberBrowserAccount,
  savedAccountToken,
} from "./browser-accounts.js";
import { browserAccountsPage } from "./browser-accounts-page.js";
import type { OperatorPreflight } from "./operator-preflight.js";

const SignupSchema = z.object({
  email: z.string().max(254),
  password: z.string().max(1024),
  age18Declared: z.literal(true),
  acceptedTermsVersion: z.string().min(1).max(64),
});
const LoginSchema = z.object({
  email: z.string().max(254),
  password: z.string().max(1024),
  label: z.string().max(100).optional(),
  mfaCode: z.string().max(64).optional(),
});
const TokenSchema = z.object({ token: z.string().min(20).max(500) });
const PasswordResetSchema = TokenSchema.extend({ password: z.string().max(1024) });
const DraftSchema = z.object({
  displayName: z.string().max(100),
  proposedHandle: z.string().max(24),
  portrait: z.string().max(128),
  expectedVersion: z.number().int().nonnegative(),
});

function cookieValue(request: FastifyRequest, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function sessionToken(request: FastifyRequest): string {
  const token = cookieValue(request, "pact_session");
  if (!token) throw new IdentityError("FORBIDDEN");
  return token;
}

function writeContext(request: FastifyRequest): { sessionToken: string; csrfToken: string; origin: string } {
  const csrf = request.headers["x-csrf-token"];
  const origin = request.headers.origin;
  if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
  return { sessionToken: sessionToken(request), csrfToken: csrf, origin };
}

async function safe<T>(reply: FastifyReply, operation: () => Promise<T>): Promise<T | FastifyReply> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IdentityError) {
      const status = error.code === "RATE_LIMITED" ? 429 : error.code === "FORBIDDEN" ? 403 : 400;
      return reply.code(status).send({ error: { code: error.code, message: "The request could not be completed." } });
    }
    if (error instanceof OnboardingError) {
      const status = error.code === "FORBIDDEN" ? 403 : 409;
      return reply.code(status).send({ error: { code: error.code, message: "The request could not be completed." } });
    }
    if (error instanceof KingdomError) {
      const status = error.code === "WORLD_PAUSED" ? 503 : 409;
      if (error.code === "TICK_PENDING") reply.header("retry-after", "1");
      return reply.code(status).send({
        error: { code: error.code, message: "The request could not be completed.", suggestions: error.suggestions },
      });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "The request could not be completed." } });
    }
    throw error;
  }
}

export function registerIdentityRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  onboarding: OnboardingService,
  operatorPreflight: OperatorPreflight,
  kingdom?: KingdomService,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/auth/") || request.url.startsWith("/v1/setup/")) {
      reply.header("cache-control", "no-store");
    }
    return payload;
  });
  server.post("/v1/auth/signup", async (request, reply) => {
    if (!operatorPreflight.registrationEnabled) {
      return reply.code(503).send({
        error: { code: "REGISTRATION_UNAVAILABLE", message: "Registration is not currently available." },
      });
    }
    return safe(reply, () => identity.signup({ ...SignupSchema.parse(request.body), requestId: request.id }));
  });
  server.get("/v1/auth/session", async (request, reply) =>
    safe(reply, () => identity.sessionBootstrap(sessionToken(request))),
  );
  server.get("/accounts", async (_request, reply) => {
    reply
      .header("cache-control", "no-store")
      .header("referrer-policy", "no-referrer")
      .header(
        "content-security-policy",
        "default-src 'none'; connect-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      )
      .type("text/html; charset=utf-8");
    return browserAccountsPage(undefined, identity.guestPlayEnabled);
  });
  server.get("/v1/auth/accounts", async (request, reply) =>
    safe(reply, async () => {
      const token = browserCookies(request).get("pact_session");
      const session = token ? await identity.authenticate(token, false).catch(() => null) : null;
      if (session && token && (await identity.browserAccountActive(session.accountId)))
        rememberBrowserAccount(request, reply, { ...session, sessionToken: token }, false);
      const list = await browserAccountList(request, identity, kingdom);
      pruneBrowserAccounts(
        request,
        reply,
        list.accounts.map((account) => account.accountId),
      );
      return list;
    }),
  );
  server.post("/v1/auth/accounts/recovery-check", async (request, reply) =>
    safe(reply, async () => {
      const c = writeContext(request);
      const session = await identity.authorizeCookieWrite(c.sessionToken, c.csrfToken, c.origin);
      const input = z.object({ code: z.uuid() }).strict().parse(request.body);
      return { matches: await identity.matchesGuestRecovery(session.accountId, input.code) };
    }),
  );
  for (const operation of ["switch", "forget"] as const) {
    server.post(`/v1/auth/accounts/${operation}`, async (request, reply) =>
      safe(reply, async () => {
        const input = z.object({ accountId: z.uuid() }).strict().parse(request.body);
        const token = savedAccountToken(request, input.accountId);
        const csrf = request.headers["x-csrf-token"],
          origin = request.headers.origin;
        if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
        const session = await identity.authorizeCookieWrite(token, csrf, origin);
        if (session.accountId !== input.accountId || !(await identity.browserAccountActive(session.accountId)))
          throw new IdentityError("FORBIDDEN");
        if (operation === "switch") {
          rememberBrowserAccount(request, reply, { ...session, sessionToken: token });
          return identity.sessionBootstrap(token);
        }
        const current = browserCookies(request).get("pact_session");
        const active = current ? await identity.authenticate(current, false).catch(() => null) : null;
        await identity.signOutSession(token);
        forgetBrowserAccount(reply, input.accountId, active?.accountId === input.accountId);
        return { forgotten: true };
      }),
    );
  }
  server.post("/v1/auth/guest/recovery/replace", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const input = z.object({ currentCode: z.uuid(), newCode: z.uuid() }).strict().parse(request.body);
      return identity.rotateGuestRecovery(context.sessionToken, input.currentCode, input.newCode);
    }),
  );
  server.post("/v1/auth/sessions/revoke", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const input = z.object({ sessionId: z.uuid() }).strict().parse(request.body);
      await identity.revokeSession(context.sessionToken, input.sessionId);
      return { revoked: true };
    }),
  );
  server.post("/v1/auth/guest/save", async (request, reply) => {
    if (!operatorPreflight.registrationEnabled)
      return reply.code(503).send({ error: { code: "REGISTRATION_UNAVAILABLE" } });
    return safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      return identity.saveGuest(context.sessionToken, { ...SignupSchema.parse(request.body), requestId: request.id });
    });
  });
  server.post("/v1/auth/logout", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      await identity.signOutSession(context.sessionToken);
      forgetBrowserAccount(reply, session.accountId, true);
      return { signedOut: true, accountId: session.accountId };
    }),
  );
  server.post("/v1/auth/verify", async (request, reply) =>
    safe(reply, async () => {
      const verified = await identity.verifyEmail(TokenSchema.parse(request.body).token, request.id);
      await onboarding.ensureDraft(verified.accountId);
      return { verified: true };
    }),
  );
  server.post("/v1/auth/login", async (request, reply) =>
    safe(reply, async () => {
      if (typeof request.headers.origin === "string") identity.assertBrowserOrigin(request.headers.origin);
      const input = LoginSchema.parse(request.body);
      const tokens = await identity.login({
        email: input.email,
        password: input.password,
        ip: request.ip,
        requestId: request.id,
        ...(input.label ? { label: input.label } : {}),
        ...(input.mfaCode ? { mfaCode: input.mfaCode } : {}),
      });
      rememberBrowserAccount(request, reply, tokens);
      return { authenticated: true, csrfToken: tokens.csrfToken, idleExpiresAt: tokens.idleExpiresAt.toISOString() };
    }),
  );
  server.post("/v1/auth/reset/request", async (request, reply) =>
    safe(reply, () =>
      identity.requestPasswordReset(z.object({ email: z.string() }).parse(request.body).email, request.id),
    ),
  );
  server.post("/v1/auth/reset/confirm", async (request, reply) =>
    safe(reply, async () => {
      const input = PasswordResetSchema.parse(request.body);
      await identity.resetPassword(input.token, input.password, request.id);
      return { reset: true };
    }),
  );
  server.post("/v1/auth/reauthenticate", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const input = z.object({ password: z.string(), mfaCode: z.string().optional() }).parse(request.body);
      const tokens = await identity.reauthenticate({
        sessionToken: context.sessionToken,
        password: input.password,
        requestId: request.id,
        ...(input.mfaCode ? { mfaCode: input.mfaCode } : {}),
      });
      rememberBrowserAccount(request, reply, tokens);
      return { authenticated: true, csrfToken: tokens.csrfToken };
    }),
  );
  server.post("/v1/auth/sign-out-everywhere", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const current = await identity.authenticate(context.sessionToken);
      await identity.signOutEverywhere(context.sessionToken, request.id);
      forgetBrowserAccount(reply, current.accountId, true);
      return { revoked: true };
    }),
  );
  server.get("/v1/auth/connections", async (request, reply) =>
    safe(reply, () => identity.connectionInventory(sessionToken(request))),
  );
  server.post("/v1/auth/email-change/request", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const input = z.object({ currentPassword: z.string(), newEmail: z.string() }).parse(request.body);
      await identity.requestEmailChange({ ...input, sessionToken: context.sessionToken, requestId: request.id });
      return { accepted: true };
    }),
  );
  server.post("/v1/auth/email-change/confirm", async (request, reply) =>
    safe(reply, async () => {
      await identity.confirmEmailChange(TokenSchema.parse(request.body).token, request.id);
      return { changed: true };
    }),
  );
  server.post("/v1/auth/mfa/begin", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      return identity.beginTotp(context.sessionToken);
    }),
  );
  server.post("/v1/auth/mfa/confirm", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      return identity.confirmTotp(
        context.sessionToken,
        z.object({ code: z.string().length(6) }).parse(request.body).code,
      );
    }),
  );
  server.get("/v1/setup/draft", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      return onboarding.getDraft(session.accountId);
    }),
  );
  server.patch("/v1/setup/draft", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      return onboarding.updateDraft(session.accountId, DraftSchema.parse(request.body));
    }),
  );
  server.post("/v1/setup/connection-check", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      return onboarding.recordConnectionCheck(session.accountId);
    }),
  );
  server.post("/v1/setup/sandbox-activation", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      return onboarding.activateSandboxFixture(session.accountId);
    }),
  );
  if (kingdom) {
    server.patch("/v1/kingdom/ambition", async (request, reply) =>
      safe(reply, async () => {
        const context = writeContext(request);
        const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
        const input = z
          .object({ ambition: z.string().max(8000) })
          .strict()
          .parse(request.body);
        if (!(await kingdom.getByAccount(session.accountId)))
          return reply.code(404).send({ error: { code: "KINGDOM_NOT_FOUND", message: "Found your kingdom first." } });
        return kingdom.setAmbition(session.accountId, input.ambition);
      }),
    );
    server.post("/v1/setup/activate", async (request, reply) =>
      safe(reply, async () => {
        const context = writeContext(request);
        const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
        return kingdom.activate(session.accountId);
      }),
    );
    server.get("/v1/kingdom/me", async (request, reply) =>
      safe(reply, async () => {
        const session = await identity.authenticate(sessionToken(request));
        const current = await kingdom.getByAccount(session.accountId);
        return (
          current ??
          reply.code(404).send({ error: { code: "KINGDOM_NOT_FOUND", message: "The request could not be completed." } })
        );
      }),
    );
  }
}
