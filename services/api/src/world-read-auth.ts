import { IdentityError, type IdentityService } from "@pact/identity";
import type { OAuthService } from "@pact/oauth";
import type { FastifyRequest } from "fastify";

function sessionToken(request: FastifyRequest): string {
  const match = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("pact_session="));
  if (!match) throw new IdentityError("FORBIDDEN");
  return decodeURIComponent(match.slice("pact_session=".length));
}

/** Both world and record reads derive a viewer from the same first-party/scoped credentials. */
export async function authenticatedWorldViewer(
  request: FastifyRequest,
  identity: IdentityService,
  oauth?: OAuthService,
): Promise<string> {
  const bearer = request.headers.authorization;
  if (bearer) {
    if (!bearer.startsWith("Bearer ") || !oauth) throw new IdentityError("FORBIDDEN");
    const grant = await oauth.introspectAccessToken(bearer.slice(7));
    if (!grant?.scopes.includes("world:read")) throw new IdentityError("FORBIDDEN");
    return grant.accountId;
  }
  return (await identity.authenticate(sessionToken(request))).accountId;
}
