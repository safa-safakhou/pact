import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import {
  createOpenRouterFixtureFetch,
  OPENROUTER_FIXTURE_MODELS,
  OPENROUTER_PROVIDER,
  OpenRouterChatCompletionsAdapter,
  ProviderRouter,
} from "@pact/model-provider";
import { OpenRouterAuthError, OpenRouterAuthService } from "@pact/openrouter";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const password = "A long test password 123!";
let admin: Pool;
let pool: Pool;
let schema: string;
let identity: IdentityService;
let secretBox: AesGcmSecretBox;
let clockNow: Date;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "openrouter");
  pool = createSchemaPool(connectionString, schema);
  clockNow = new Date("2026-09-21T12:00:00.000Z");
  secretBox = new AesGcmSecretBox(Buffer.alloc(32, 7));
  identity = new IdentityService(pool, {
    productScope: "pact",
    currentTermsVersion: "terms-v1",
    allowedOrigins: new Set(["https://pact.example"]),
    clock: { now: () => clockNow },
    digester: new TokenDigester(Buffer.alloc(32, 19)),
    secretBox,
    compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
  });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function verifiedSession(email: string): Promise<{ accountId: string; sessionId: string }> {
  await identity.signup({ email, password, age18Declared: true, acceptedTermsVersion: "terms-v1" });
  const event = await pool.query<{ payload: { accountId: string; sealedToken: string } }>(
    `SELECT payload FROM outbox_events WHERE type = 'security.email.requested.v1' AND payload->>'template' = 'verify_email' ORDER BY id DESC LIMIT 1`,
  );
  const payload = event.rows[0]?.payload;
  if (!payload) throw new Error("missing verification");
  await identity.verifyEmail(Buffer.from(secretBox.open(payload.sealedToken)).toString("utf8"));
  const tokens = await identity.login({ email, password, ip: "127.0.0.1" });
  const session = await identity.authenticate(tokens.sessionToken);
  return { accountId: payload.accountId, sessionId: session.sessionId };
}

async function invokeFixture(credential: string): Promise<string | undefined> {
  const model = OPENROUTER_FIXTURE_MODELS[0];
  if (!model) throw new Error("missing model");
  const adapter = new OpenRouterChatCompletionsAdapter({
    routingDisclosure: "Upstream routing chosen by OpenRouter for the selected model; no silent fallback.",
    fixtureModels: OPENROUTER_FIXTURE_MODELS,
    fetch: createOpenRouterFixtureFetch({
      chatCompletions: async (init) => {
        const body = JSON.parse(String(init.body));
        expect(body.provider.allow_fallbacks).toBe(false);
        return new Response(
          JSON.stringify({
            model: "openrouter/auto",
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_1",
                      function: { name: "sandbox.draft.read", arguments: "{}" },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 5, completion_tokens: 2 },
          }),
          { status: 200 },
        );
      },
    }),
  });
  const router = new ProviderRouter([adapter]);
  const prepared = await router.prepare(
    { provider: OPENROUTER_PROVIDER, model: model.id, credentialId: "c" },
    10,
    50,
    new AbortController().signal,
  );
  const result = await router.run(prepared, {
    requestId: "r",
    messages: [{ role: "user", content: "fixture" }],
    tools: [
      {
        name: "sandbox.draft.read",
        description: "read",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        parseArguments: () => ({}),
      },
    ],
    credential: Buffer.from(credential),
    signal: new AbortController().signal,
  });
  expect(result.response.toolCalls[0]?.name).toBe("sandbox.draft.read");
  return adapter.lastRoutedModel;
}

describe("PACT-015 OpenRouter authorization and adapter", () => {
  it("completes key entry and PKCE exchange fixtures; rejects swapped state, replay, expiry, and undisclosed routing", async () => {
    const session = await verifiedSession(`or-${randomUUID()}@example.com`);
    const callbackUrl = "https://pact.example/oauth/openrouter/callback";
    let exchanged = false;
    const auth = new OpenRouterAuthService(pool, {
      productScope: "pact",
      clock: { now: () => clockNow },
      fetch: async (_url, init) => {
        exchanged = true;
        const body = JSON.parse(String(init.body));
        expect(body.code_verifier).toBeTruthy();
        expect(body.code_challenge_method).toBe("S256");
        return new Response(JSON.stringify({ key: "sk-or-fixture-oauth", label: "OpenRouter Fixture" }), {
          status: 200,
        });
      },
    });

    // Manual key entry path uses the same adapter fixture as OAuth-derived keys.
    expect(await invokeFixture("sk-or-manual-entry")).toBe("openrouter/auto");

    const started = await auth.begin({
      accountId: session.accountId,
      sessionId: session.sessionId,
      callbackUrl,
    });
    expect(started.authorizeUrl).toContain("code_challenge=");
    expect(started.authorizeUrl).toContain("code_challenge_method=S256");

    const completed = await auth.complete({
      accountId: session.accountId,
      sessionId: session.sessionId,
      state: started.state,
      code: "auth-code",
      callbackUrl,
    });
    expect(completed.apiKey).toBe("sk-or-fixture-oauth");
    expect(exchanged).toBe(true);
    expect(await invokeFixture(completed.apiKey)).toBe("openrouter/auto");

    await expect(
      auth.complete({
        accountId: session.accountId,
        sessionId: session.sessionId,
        state: started.state,
        code: "auth-code",
        callbackUrl,
      }),
    ).rejects.toMatchObject({ code: "REPLAY" });

    const other = await auth.begin({
      accountId: session.accountId,
      sessionId: session.sessionId,
      callbackUrl,
    });
    await expect(
      auth.complete({
        accountId: session.accountId,
        sessionId: session.sessionId,
        state: other.state,
        code: "x",
        callbackUrl: "https://evil.example/cb",
      }),
    ).rejects.toBeInstanceOf(OpenRouterAuthError);

    const expired = await auth.begin({
      accountId: session.accountId,
      sessionId: session.sessionId,
      callbackUrl,
    });
    clockNow = new Date("2026-09-21T12:20:00.000Z");
    await expect(
      auth.complete({
        accountId: session.accountId,
        sessionId: session.sessionId,
        state: expired.state,
        code: "late",
        callbackUrl,
      }),
    ).rejects.toMatchObject({ code: "EXPIRED" });

    const model = OPENROUTER_FIXTURE_MODELS[0];
    if (!model) throw new Error("missing model");
    await expect(
      new OpenRouterChatCompletionsAdapter({
        fixtureModels: OPENROUTER_FIXTURE_MODELS,
        fetch: createOpenRouterFixtureFetch({
          chatCompletions: async () =>
            new Response(JSON.stringify({ choices: [{ message: { content: "x" } }] }), { status: 200 }),
        }),
      }).invoke({
        requestId: "1",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("sk"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});
