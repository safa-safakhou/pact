import { createHash, timingSafeEqual } from "node:crypto";
import { type AdminProvisioning, adminEmail, IdentityError, type IdentityService } from "@pact/identity";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AdminReader } from "./admin-reader.js";
import { rememberBrowserAccount } from "./browser-accounts.js";

export interface AdminSetup {
  token: string;
  expiresAt: string;
}
export function registerAdminRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  reader: AdminReader,
  provision: AdminProvisioning,
  setup?: AdminSetup,
  now = () => new Date(),
) {
  const attempts = new Map<string, { start: number; count: number }>();
  const admission = (request: FastifyRequest) => {
    const time = now().getTime();
    for (const [ip, value] of attempts) if (time - value.start >= 900000) attempts.delete(ip);
    const value = attempts.get(request.ip) ?? { start: time, count: 0 };
    value.count++;
    if (value.count > 10 || attempts.size >= 5000) throw new IdentityError("RATE_LIMITED");
    attempts.set(request.ip, value);
  };
  const safe = async (reply: FastifyReply, action: () => Promise<unknown>) => {
    reply.header("cache-control", "no-store");
    try {
      return await action();
    } catch (error) {
      if (error instanceof IdentityError)
        return reply.code(error.code === "RATE_LIMITED" ? 429 : 403).send({ error: { code: error.code } });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
      throw error;
    }
  };
  const token = (r: FastifyRequest) => {
    try {
      const value = r.headers.cookie
        ?.split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("pact_session="));
      if (!value) throw new IdentityError("FORBIDDEN");
      return decodeURIComponent(value.slice(13));
    } catch {
      throw new IdentityError("FORBIDDEN");
    }
  };
  const setupAllowed = async (r: FastifyRequest, value: string) => {
    admission(r);
    if (typeof r.headers.origin !== "string") throw new IdentityError("FORBIDDEN");
    identity.assertBrowserOrigin(r.headers.origin);
    if (!setup || now().getTime() >= Date.parse(setup.expiresAt) || !Number.isFinite(Date.parse(setup.expiresAt)))
      throw new IdentityError("FORBIDDEN");
    const hash = (s: string) => createHash("sha256").update(s).digest();
    if (!timingSafeEqual(hash(value), hash(setup.token)) || !(await provision.available()))
      throw new IdentityError("FORBIDDEN");
  };
  server.get("/v1/admin/overview", (request, reply) =>
    safe(reply, async () => {
      await identity.requireStaffSession(token(request));
      const { hours } = z
        .object({ hours: z.coerce.number().int().min(1).max(168).default(24) })
        .strict()
        .parse(request.query);
      await identity.recordStaffObservation(token(request), request.id);
      return reader.overview(hours);
    }),
  );
  server.get("/v1/admin/kingdoms", (request, reply) =>
    safe(reply, async () => {
      await identity.requireStaffSession(token(request));
      const q = z
        .object({
          search: z.string().max(100).default(""),
          offset: z.coerce.number().int().min(0).max(100000).default(0),
        })
        .strict()
        .parse(request.query);
      await identity.recordStaffObservation(token(request), request.id);
      return reader.kingdoms(q.search, q.offset);
    }),
  );
  server.post("/v1/admin/login", (request, reply) =>
    safe(reply, async () => {
      admission(request);
      if (typeof request.headers.origin !== "string") throw new IdentityError("FORBIDDEN");
      identity.assertBrowserOrigin(request.headers.origin);
      const input = z
        .object({
          username: z.string().regex(/^[a-z][a-z0-9_-]{2,31}$/),
          password: z.string().max(1024),
        })
        .strict()
        .parse(request.body);
      const tokens = await identity.login({
        email: adminEmail(input.username),
        password: input.password,
        ip: request.ip,
        label: "PACT administration",
        requestId: request.id,
      });
      await identity.requireStaffSession(tokens.sessionToken);
      rememberBrowserAccount(request, reply, tokens);
      return { authenticated: true, csrfToken: tokens.csrfToken };
    }),
  );
  server.post("/v1/admin/setup/complete", (request, reply) =>
    safe(reply, async () => {
      const input = z
        .object({
          setupCode: z.string().length(43),
          username: z.string().max(32),
          password: z.string().max(1024),
        })
        .strict()
        .parse(request.body);
      await setupAllowed(request, input.setupCode);
      return provision.complete(input, now());
    }),
  );
}
