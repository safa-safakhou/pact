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
      const issuerEncoded = JSON.stringify(oauth.authorizationServerMetadata().issuer).replaceAll("<", "\\u003c");
      const clientName = escapeHtml(consent.clientName);
      const scopes = escapeHtml(consent.scopes.join(", "));
      reply
        .header(
          "content-security-policy",
          "default-src 'none'; connect-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        )
        .header("referrer-policy", "no-referrer")
        .type("text/html; charset=utf-8");
      const guestCookie = request.headers.cookie?.split(";").find((part) => part.trim().startsWith("pact_session="));
      const guestToken = guestCookie ? decodeURIComponent(guestCookie.trim().slice("pact_session=".length)) : "";
      const guest = identity.guestPlayEnabled ? await identity.guestSession(guestToken).catch(() => null) : null;
      if (guest)
        return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect your agent</title><style>body{font:18px system-ui;max-width:30rem;margin:3rem auto;padding:1rem}button{font:inherit;padding:1rem}p{line-height:1.5}</style><h1>Connect your agent</h1><p id="kingdom">Your current guest kingdom</p><p>Connect ${clientName}. Requested permissions: ${scopes}. Actions still obey your current kingdom permissions. You can review them in <a href="../" target="_blank" rel="noopener">PACT</a>.</p><label><input id="enable-play" type="checkbox"> Enable agent game actions: up to 500 whole units of each ordinary resource per 24 game hours, 40 troops, and raids. Game rules and stock still apply; keep 20 Grain in reserve. Leave unchecked to keep current permissions.</label><p></p><button id="connect">Connect to my kingdom</button><p id="status" role="status"></p><script>
const q=${encoded},csrf=${JSON.stringify(guest.csrfToken)};
fetch('../v1/kingdom/me').then(r=>r.json()).then(k=>{document.getElementById('kingdom').textContent=k.handle?'Playing as @'+k.handle:'Your current guest kingdom'});
document.getElementById('connect').onclick=async()=>{
const button=document.getElementById('connect'),status=document.getElementById('status');button.disabled=true;status.textContent='Connecting...';
try{if(document.getElementById('enable-play').checked){const m=await fetch('../v1/mandate');if(!m.ok)throw Error('Cannot read current permissions');const mandate=await m.json();const granted=await fetch('../v1/mandate',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({allowedActions:['world.read','inbox.read','message.send.contact','contact.request','transfer','training.queue','building.queue','scout.start','supply.sign','supply.break','garrison.sign','garrison.break','raid.commit'],resourceLimits:{iron:'300000',silver:'300000',grain:'300000'},reserveFloors:{grain:'12000'},troopLimit:40,sessionLimit:1,expectedVersion:mandate.version})});if(!granted.ok)throw Error('Gameplay permissions were not updated. Review them in PACT.')}const r=await fetch('authorize',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify(q)});const result=await r.json();if(!r.ok)throw Error(result.error?.code||'Connection failed');const target=new URL(q.redirect_uri);target.searchParams.set("code",result.code);target.searchParams.set("state",q.state);target.searchParams.set("iss",${issuerEncoded});window.location.assign(target.toString());}
catch(e){status.textContent=String(e);button.disabled=false}};
</script></html>`;
      if (identity.guestPlayEnabled && query.audience === "mcp")
        return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Enter PACT</title><style>body{font:18px system-ui;max-width:32rem;margin:3rem auto;padding:1rem;background:#102326;color:#eee}input,button{font:inherit;padding:.8rem;box-sizing:border-box;width:100%;margin:.5rem 0}button{background:#d9c38d;border:0;border-radius:8px}a{color:#d9c38d}p{line-height:1.6}</style><h1>Enter PACT</h1><p>Create a kingdom with a nickname. No email or model API key is needed. After entry, you will review ${clientName}'s connection permissions.</p><p>Already have a kingdom? <a href="../" target="_blank" rel="noopener">Open PACT</a> in this browser to resume it, then reload this page. Guest kingdoms belong to this browser session; do not clear its saved entry key.</p><form id="join"><label>Nickname<input name="nickname" maxlength="40" required autocomplete="nickname"></label><button>Enter my kingdom</button></form><p id="status" role="status"></p><script>
document.getElementById('join').onsubmit=async(e)=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;const status=document.getElementById('status');status.textContent='Opening your kingdom…';try{let key=localStorage.getItem('pact_guest_entry');if(!key){key=crypto.randomUUID();localStorage.setItem('pact_guest_entry',key)}const r=await fetch('../v1/play/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entryKey:key,nickname:new FormData(e.currentTarget).get('nickname')}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Kingdom entry failed. Try again.');location.reload()}catch(e){status.textContent=e.message;b.disabled=false}};
</script></html>`;
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
    u.searchParams.set('iss',${issuerEncoded});
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
          client_name: z.string().min(1).max(200).default("PACT connected agent"),
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
