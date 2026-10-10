import { EnrollmentCommandSchema, EnrollmentQuerySchema } from "@pact/contracts";
import { IdentityError, type IdentityService } from "@pact/identity";
import { EnrollmentError, type PersistentPlayService } from "@pact/runs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

function token(request: FastifyRequest) {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("pact_session="));
  if (!cookie || request.headers.authorization) throw new IdentityError("FORBIDDEN");
  try {
    return decodeURIComponent(cookie.slice(13));
  } catch {
    throw new IdentityError("FORBIDDEN");
  }
}
async function safe(reply: FastifyReply, run: () => Promise<unknown>) {
  reply.header("cache-control", "no-store");
  try {
    return await run();
  } catch (error) {
    if (error instanceof IdentityError || (error instanceof EnrollmentError && error.code === "FORBIDDEN"))
      return reply.code(403).send({ error: { code: "FORBIDDEN" } });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT" } });
    if (error instanceof EnrollmentError) return reply.code(409).send({ error: { code: error.code } });
    throw error;
  }
}
export function registerEnrollmentRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  enrollment: PersistentPlayService,
) {
  server.get("/v1/runs/enrollment", (request, reply) =>
    safe(reply, async () => {
      return enrollment.read(
        (await identity.authenticate(token(request))).accountId,
        EnrollmentQuerySchema.parse(request.query),
      );
    }),
  );
  server.post("/v1/runs/enrollment", (request, reply) =>
    safe(reply, async () => {
      const csrf = request.headers["x-csrf-token"],
        origin = request.headers.origin;
      if (typeof csrf !== "string" || typeof origin !== "string") throw new IdentityError("FORBIDDEN");
      const owner = await identity.authorizeCookieWrite(token(request), csrf, origin);
      return enrollment.command(owner.accountId, EnrollmentCommandSchema.parse(request.body));
    }),
  );
}
