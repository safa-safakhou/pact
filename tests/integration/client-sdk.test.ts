import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "@pact/application";
import { ApprovalService } from "@pact/approvals";
import { AuthorityService } from "@pact/authority";
import { type ClientRequest, type ClientResponse, type ClientTransport, PactClient } from "@pact/client-sdk";
import { ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { InboxService } from "@pact/inbox";
import { OAuthService } from "@pact/oauth";
import { OnboardingService } from "@pact/onboarding";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWebPactClient } from "../../apps/web/src/pact-client.js";
import { buildServer } from "../../services/api/src/server.js";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const origin = "https://pact.example";
const password = "A long test password 123!";
const now = new Date("2026-09-20T21:10:00.000Z");
let admin: Pool;
let pool: Pool;
let schema: string;
let identity: IdentityService;
let oauth: OAuthService;
let secretBox: AesGcmSecretBox;
let server: ReturnType<typeof buildServer>;
let sessionToken: string;
let csrfToken: string;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "client_sdk");
  pool = createSchemaPool(connectionString, schema);
  secretBox = new AesGcmSecretBox(Buffer.alloc(32, 23));
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set([origin]),
    clock: { now: () => now },
    digester: new TokenDigester(Buffer.alloc(32, 29)),
    secretBox,
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
  const onboarding = new OnboardingService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    now: () => now,
  });
  const dispatcher = new CommandDispatcher({
    pool,
    clock: { now: () => now },
    productScope: ProductScopeSchema.parse("pact"),
  });
  oauth = new OAuthService(pool, {
    productScope: "pact",
    issuer: origin,
    mcpResource: `${origin}/mcp`,
    humanResource: `${origin}/native`,
    clock: { now: () => now },
  });
  const authority = new AuthorityService(pool, { productScope: "pact", identity, now: () => now });
  const approvals = new ApprovalService(pool, {
    productScope: "pact",
    identity,
    dispatcher,
    clock: { now: () => now },
    origin,
  });
  const inbox = new InboxService(pool, { productScope: "pact", clock: { now: () => now } });
  server = buildServer(pool, false, undefined, {
    identity,
    onboarding,
    dispatcher,
    oauth,
    authority,
    approvals,
    inbox,
    origin,
  });

  await identity.signup({
    email: "sdk@example.com",
    password,
    age18Declared: true,
    acceptedTermsVersion: "terms-v1",
  });
  const event = await pool.query<{ payload: { sealedToken: string } }>(
    `SELECT payload FROM outbox_events
     WHERE type = 'security.email.requested.v1' AND payload->>'template' = 'verify_email'
     ORDER BY id DESC LIMIT 1`,
  );
  const sealedToken = event.rows[0]?.payload.sealedToken;
  if (!sealedToken) throw new Error("verification fixture missing");
  await identity.verifyEmail(Buffer.from(secretBox.open(sealedToken)).toString("utf8"));
  const tokens = await identity.login({ email: "sdk@example.com", password, ip: "127.0.0.1" });
  sessionToken = tokens.sessionToken;
  csrfToken = tokens.csrfToken;
});

afterAll(async () => {
  if (server) await server.close();
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

function authenticatedHeaders(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
  return {
    cookie: `pact_session=${encodeURIComponent(sessionToken)}`,
    origin,
    "x-csrf-token": csrfToken,
    ...extra,
  };
}

class InjectTransport implements ClientTransport {
  async send(request: ClientRequest): Promise<ClientResponse> {
    const response = await server.inject({
      method: request.method as "GET" | "POST",
      url: request.path,
      headers: authenticatedHeaders(request.headers),
      ...(request.body === undefined ? {} : { payload: JSON.stringify(request.body) ?? "null" }),
    });
    return { status: response.statusCode, body: response.json() };
  }
}

describe("shared client SDK", () => {
  it("renders a validated MCP authorization page for a dynamically registered Codex client", async () => {
    const registered = await server.inject({
      method: "POST",
      url: "/oauth/register",
      payload: {
        client_name: "Codex Playtest <script>",
        redirect_uris: ["http://127.0.0.1:43123/callback"],
      },
    });
    expect(registered.statusCode).toBe(200);
    const clientId = registered.json<{ client_id: string }>().client_id;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: "http://127.0.0.1:43123/callback",
      response_type: "code",
      scope: "world:read messages:write game:act",
      code_challenge: "a".repeat(43),
      code_challenge_method: "S256",
      resource: `${origin}/mcp`,
      state: "test-state-12345678",
    });
    const page = await server.inject({ method: "GET", url: `/oauth/authorize?${params}` });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain("Codex Playtest &lt;script&gt;");
    expect(page.body).not.toContain("Codex Playtest <script>");
    expect(page.body).toContain("game:act");
    params.set("redirect_uri", "https://evil.example/callback");
    const rejected = await server.inject({ method: "GET", url: `/oauth/authorize?${params}` });
    expect(rejected.statusCode).toBe(400);
  });

  it("reuses one command across web and non-browser clients after a lost response", async () => {
    let loseFirstCommandResponse = true;
    const browserFetch: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      const response = await server.inject({
        method: (init?.method ?? "GET") as "GET" | "POST",
        url: `${url.pathname}${url.search}`,
        headers: authenticatedHeaders(headers),
        ...(typeof init?.body === "string" ? { payload: init.body } : {}),
      });
      if (url.pathname === "/v1/commands" && loseFirstCommandResponse) {
        loseFirstCommandResponse = false;
        throw new Error("simulated response loss after commit");
      }
      return new Response(response.body, {
        status: response.statusCode,
        headers: { "content-type": response.headers["content-type"] ?? "application/json" },
      });
    };

    const web = createWebPactClient({
      apiOrigin: origin,
      csrfToken: () => csrfToken,
      fetch: browserFetch,
      randomUuid: () => "00000000-0000-4000-8000-000000000083",
      now: () => now,
    });
    const nonBrowser = new PactClient({
      audience: "human",
      transport: new InjectTransport(),
      commandIds: { create: randomUUID },
      clock: { now: () => now },
    });
    const command = web.prepareCommand({ kind: "sandbox.counter.increment", counterId: "cross-client", amount: 1 });

    await expect(web.submitCommand(command)).rejects.toMatchObject({ code: "NETWORK_UNCERTAIN" });
    const retry = await nonBrowser.retryCommand(command);
    const reconciled = await web.reconcileReceipt(command.commandId);

    expect(retry.code).toBe("COMMITTED");
    expect(reconciled).toEqual(retry);
    const row = await pool.query<{ value: number }>(
      "SELECT value FROM sandbox_counters WHERE counter_id = 'cross-client'",
    );
    expect(row.rows).toEqual([{ value: 1 }]);
  });

  it("publishes audience-specific capabilities and rejects unsupported API versions", async () => {
    const human = new PactClient({
      audience: "human",
      transport: new InjectTransport(),
      commandIds: { create: randomUUID },
      clock: { now: () => now },
    });
    const capabilities = await human.capabilities();
    expect(capabilities.capabilities).toContain("approval.commit");
    expect(capabilities.capabilities).not.toContain("mcp.tools");

    const unsupported = await server.inject({
      method: "GET",
      url: "/v1/capabilities?audience=agent",
      headers: { "x-pact-api-version": "pact.api.v0" },
    });
    expect(unsupported.statusCode).toBe(426);
    expect(unsupported.json()).toMatchObject({ error: { code: "UNSUPPORTED_API_VERSION" } });
  });

  it("rejects every new cookie-authenticated write without origin and CSRF proof", async () => {
    const cookie = { cookie: `pact_session=${encodeURIComponent(sessionToken)}` };
    const requests = [
      {
        url: "/v1/commands",
        payload: {
          schemaVersion: "pact.command.v1",
          commandId: randomUUID(),
          actor: {
            principalId: "server-derived",
            productScope: "pact",
            audience: "human",
            subject: { type: "account", id: "server-derived" },
          },
          action: { kind: "sandbox.echo", message: "must not commit" },
          submittedAt: now.toISOString(),
        },
      },
      { url: "/oauth/authorize", payload: {} },
      { url: "/v1/mandate", payload: {} },
      { url: `/v1/approvals/${randomUUID()}/approve`, payload: {} },
      { url: "/v1/inbox/ack", payload: { cursor: "1" } },
    ];
    for (const request of requests) {
      const response = await server.inject({ method: "POST", headers: cookie, ...request });
      expect(response.statusCode, request.url).toBe(403);
    }
  });
});
