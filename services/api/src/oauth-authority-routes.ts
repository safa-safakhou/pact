import { AuthorityError, type AuthorityService } from "@pact/authority";
import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import type { OAuthService } from "@pact/oauth";
import { OAuthError } from "@pact/oauth";
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

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function safe(reply: FastifyReply, operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof IdentityError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "RECENT_AUTH_REQUIRED" ? 401 : 400;
      return reply.code(status).send({ error: { code: error.code, message: "The request could not be completed." } });
    }
    if (error instanceof OAuthError) {
      const status = error.code === "FORBIDDEN" || error.code === "ACCESS_DENIED" ? 403 : 400;
      return reply.code(status).send({ error: error.code });
    }
    if (error instanceof AuthorityError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "RECENT_AUTH_REQUIRED"
            ? 401
            : error.code === "STALE_VERSION"
              ? 409
              : 400;
      return reply.code(status).send({ error: { code: error.code, message: "The request could not be completed." } });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "The request could not be completed." } });
    }
    throw error;
  }
}

export function registerOAuthRoutes(server: FastifyInstance, oauth: OAuthService, identity: IdentityService): void {
  server.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    const values: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(typeof body === "string" ? body : body.toString("utf8"))) {
      if (Object.hasOwn(values, key)) {
        done(Object.assign(new Error("Duplicate OAuth form parameter"), { statusCode: 400 }));
        return;
      }
      values[key] = value;
    }
    done(null, values);
  });
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/.well-known/") || request.url.startsWith("/oauth/")) {
      reply.header("cache-control", "no-store");
    }
    return payload;
  });

  server.get("/.well-known/oauth-authorization-server", async () => oauth.authorizationServerMetadata());
  server.get("/.well-known/oauth-protected-resource", async () => oauth.protectedResourceMetadata("mcp"));
  server.get("/.well-known/oauth-protected-resource/human", async () => oauth.protectedResourceMetadata("human"));

  server.get("/oauth/authorize", async (request, reply) =>
    safe(reply, async () => {
      const rawQuery = request.query as Record<string, unknown>;
      const requestedResource = rawQuery.resource;
      if (
        Array.isArray(requestedResource) &&
        (requestedResource.length === 0 ||
          requestedResource.some((value) => typeof value !== "string" || value !== requestedResource[0]))
      )
        throw new OAuthError("INVALID_REQUEST");
      const query = z
        .object({
          client_id: z.string().min(1),
          redirect_uri: z.url(),
          scope: z.string().min(1),
          code_challenge: z.string().min(43),
          code_challenge_method: z.literal("S256"),
          resource: z.string().min(1),
          state: z.string().min(16),
          audience: z.enum(["human", "mcp"]).default("mcp"),
          subject_label: z.string().min(1).max(200).default("Your PACT kingdom"),
          response_type: z.literal("code"),
        })
        .parse({ ...rawQuery, resource: Array.isArray(requestedResource) ? requestedResource[0] : requestedResource });
      const consent = await oauth.describeAuthorization({
        clientId: query.client_id,
        redirectUri: query.redirect_uri,
        scopes: query.scope,
        resource: query.resource,
        subjectLabel: query.subject_label,
        expectedAudience: query.audience,
      });
      const encoded = JSON.stringify(query).replaceAll("<", "\\u003c");
      const clientName = escapeHtml(consent.clientName);
      const scopes = escapeHtml(consent.scopes.join(", "));
      reply
        .header(
          "content-security-policy",
          "default-src 'none'; connect-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        )
        .header("referrer-policy", "no-referrer")
        .type("text/html; charset=utf-8");
      return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Authorize PACT connection</title><style>body{font:16px system-ui;max-width:28rem;margin:3rem auto;padding:1rem}label{display:block;margin:.8rem 0}input,button{box-sizing:border-box;width:100%;padding:.7rem}#error{color:#a00}</style><h1>Connect ${clientName} to PACT</h1><p>This client requests: ${scopes}. It can act only within your kingdom mandate. It cannot approve its own exceptions or change that mandate.</p><form id="login"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" required autocomplete="current-password"></label><button>Sign in and authorize</button></form><p id="status" role="status"></p><p id="error" role="alert"></p><script>
const q=${encoded};
document.getElementById('login').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const form=e.currentTarget;
  const button=form.querySelector('button');
  if(button.disabled)return;
  const error=document.getElementById('error');
  const status=document.getElementById('status');
  error.textContent='';
  status.textContent='Signing in…';
  button.disabled=true;
  try{
    const f=new FormData(form);
    const login=await fetch('../v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:f.get('email'),password:f.get('password'),label:'PACT connection'}),signal:AbortSignal.timeout(20000)});
    if(!login.ok){error.textContent='Sign-in failed. Check your email and password and make sure your account is verified.';return}
    const l=await login.json();
    status.textContent='Authorizing connection…';
    const auth=await fetch('authorize',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':l.csrfToken},body:JSON.stringify(q),signal:AbortSignal.timeout(20000)});
    if(!auth.ok){error.textContent='Authorization failed. Start a new connection attempt in your agent and try again.';return}
    const a=await auth.json();
    const u=new URL(q.redirect_uri);
    u.searchParams.set('code',a.code);
    u.searchParams.set('state',q.state);
    location.replace(u.toString());
  }catch{
    error.textContent='Could not connect to PACT. Check your connection and try again.';
  }finally{
    status.textContent='';
    button.disabled=false;
  }
});
</script></html>`;
    }),
  );

  server.post("/oauth/register", async (request, reply) =>
    safe(reply, async () => {
      const body = z
        .object({
          client_name: z.string().min(1).max(200),
          redirect_uris: z.array(z.string().url()).min(1).max(10),
          audience: z.enum(["human", "mcp"]).default("mcp"),
        })
        .parse(request.body);
      const client = await oauth.registerDynamic({
        displayName: body.client_name,
        audience: body.audience,
        redirectUris: body.redirect_uris,
      });
      return {
        client_id: client.clientId,
        client_name: client.displayName,
        redirect_uris: client.redirectUris,
        audience: client.audience,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      };
    }),
  );

  server.post("/oauth/authorize", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      const session = await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const body = z
        .object({
          client_id: z.string().min(1),
          redirect_uri: z.string().min(1),
          scope: z.string().min(1),
          code_challenge: z.string().min(43),
          code_challenge_method: z.literal("S256"),
          resource: z.string().min(1),
          subject_label: z.string().min(1).max(200),
          audience: z.enum(["human", "mcp"]),
        })
        .parse(request.body);
      const result = await oauth.beginAuthorization({
        clientId: body.client_id,
        redirectUri: body.redirect_uri,
        scopes: body.scope,
        codeChallenge: body.code_challenge,
        codeChallengeMethod: body.code_challenge_method,
        resource: body.resource,
        accountId: session.accountId,
        subjectLabel: body.subject_label,
        expectedAudience: body.audience,
      });
      return { code: result.code, consent: result.consent };
    }),
  );

  server.post("/oauth/token", async (request, reply) =>
    safe(reply, async () => {
      const body = z
        .object({
          grant_type: z.enum(["authorization_code", "refresh_token"]),
          client_id: z.string().min(1),
          code: z.string().optional(),
          redirect_uri: z.string().optional(),
          code_verifier: z.string().optional(),
          refresh_token: z.string().optional(),
          resource: z.string().optional(),
        })
        .parse(request.body);
      if (body.grant_type === "authorization_code") {
        if (!body.code || !body.redirect_uri || !body.code_verifier) throw new OAuthError("INVALID_REQUEST");
        const tokens = await oauth.exchangeAuthorizationCode({
          clientId: body.client_id,
          code: body.code,
          redirectUri: body.redirect_uri,
          codeVerifier: body.code_verifier,
          ...(body.resource ? { resource: body.resource } : {}),
        });
        return {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: tokens.tokenType,
          expires_in: tokens.expiresIn,
          scope: tokens.scope,
          audience: tokens.audience,
        };
      }
      if (!body.refresh_token) throw new OAuthError("INVALID_REQUEST");
      const tokens = await oauth.refresh({
        clientId: body.client_id,
        refreshToken: body.refresh_token,
        ...(body.resource ? { resource: body.resource } : {}),
      });
      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresIn,
        scope: tokens.scope,
        audience: tokens.audience,
      };
    }),
  );

  server.post("/oauth/revoke", async (request, reply) =>
    safe(reply, async () => {
      const body = z.object({ token: z.string().min(1) }).parse(request.body);
      await oauth.revoke(body.token);
      return reply.code(200).send({ revoked: true });
    }),
  );
}

export function registerAuthorityRoutes(
  server: FastifyInstance,
  identity: IdentityService,
  authority: AuthorityService,
): void {
  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/v1/mandate")) reply.header("cache-control", "no-store");
    return payload;
  });

  server.get("/v1/mandate", async (request, reply) =>
    safe(reply, async () => {
      const session = await identity.authenticate(sessionToken(request));
      return authority.ensureMandate(session.accountId);
    }),
  );

  server.post("/v1/mandate", async (request, reply) =>
    safe(reply, async () => {
      const context = writeContext(request);
      await identity.authorizeCookieWrite(context.sessionToken, context.csrfToken, context.origin);
      const body = z
        .object({
          allowedActions: z.array(z.string().min(1).max(64)).min(1).max(50),
          resourceLimits: z.record(z.string(), z.string().regex(/^(0|[1-9][0-9]{0,17})$/)),
          reserveFloors: z.record(z.string(), z.string().regex(/^(0|[1-9][0-9]{0,17})$/)).optional(),
          troopLimit: z.number().int().nonnegative().optional(),
          sessionLimit: z.number().int().nonnegative().optional(),
          expectedVersion: z.number().int().positive(),
        })
        .parse(request.body);
      return authority.raiseMandate(context.sessionToken, {
        allowedActions: body.allowedActions,
        resourceLimits: body.resourceLimits,
        expectedVersion: body.expectedVersion,
        ...(body.reserveFloors ? { reserveFloors: body.reserveFloors } : {}),
        ...(body.troopLimit !== undefined ? { troopLimit: body.troopLimit } : {}),
        ...(body.sessionLimit !== undefined ? { sessionLimit: body.sessionLimit } : {}),
      });
    }),
  );
}
