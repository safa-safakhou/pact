import { describe, expect, it } from "vitest";
import {
  ANTHROPIC_FIXTURE_MODELS,
  ANTHROPIC_PROVIDER,
  AnthropicMessagesAdapter,
  createAnthropicFixtureFetch,
  parseAnthropicCredential,
} from "./anthropic.js";
import {
  assertGeminiAuthKey,
  createGeminiFixtureFetch,
  GEMINI_FIXTURE_MODELS,
  GEMINI_PROVIDER,
  GeminiGenerateContentAdapter,
} from "./gemini.js";
import { ProviderError, ProviderRouter } from "./index.js";
import { createXaiFixtureFetch, XAI_FIXTURE_MODELS, XAI_PROVIDER, XaiChatCompletionsAdapter } from "./xai.js";

const draftTools = [
  {
    name: "sandbox.draft.read",
    description: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    parseArguments: () => ({}),
  },
  {
    name: "sandbox.draft.write",
    description: "write",
    inputSchema: {
      type: "object",
      properties: { note: { type: "string" } },
      required: ["note"],
      additionalProperties: false,
    },
    parseArguments: (input: unknown) => input,
  },
];

describe("Anthropic Messages adapter", () => {
  it("completes draft fixture and maps workspace/quota/cancel without fallback", async () => {
    expect(() => parseAnthropicCredential(Buffer.from(""))).toThrow(ProviderError);
    let step = 0;
    const adapter = new AnthropicMessagesAdapter({
      requireWorkspace: true,
      fixtureModels: ANTHROPIC_FIXTURE_MODELS,
      fetch: createAnthropicFixtureFetch({
        messages: (init) => {
          const headers = init.headers as Record<string, string>;
          expect(headers["anthropic-version"]).toBe("2023-06-01");
          expect(headers["x-api-key"]).toBeTruthy();
          expect(JSON.stringify(init)).not.toContain("sk-secret-value");
          if (!headers["anthropic-organization-id"]) {
            return new Response(
              JSON.stringify({ error: { type: "invalid_request_error", message: "workspace required" } }),
              { status: 400 },
            );
          }
          step += 1;
          if (step === 1) {
            return new Response(
              JSON.stringify({
                model: ANTHROPIC_FIXTURE_MODELS[0]?.id,
                content: [{ type: "tool_use", id: "toolu_read", name: "sandbox.draft.read", input: {} }],
                usage: { input_tokens: 12, output_tokens: 6 },
              }),
              { status: 200 },
            );
          }
          if (step === 2) {
            return new Response(
              JSON.stringify({
                model: ANTHROPIC_FIXTURE_MODELS[0]?.id,
                content: [
                  {
                    type: "tool_use",
                    id: "toolu_write",
                    name: "sandbox.draft.write",
                    input: { note: "anthropic-note" },
                  },
                ],
                usage: { input_tokens: 18, output_tokens: 8 },
              }),
              { status: 200 },
            );
          }
          return new Response(
            JSON.stringify({
              model: ANTHROPIC_FIXTURE_MODELS[0]?.id,
              content: [{ type: "text", text: "done" }],
              usage: { input_tokens: 20, output_tokens: 4 },
            }),
            { status: 200 },
          );
        },
      }),
    });
    const model = ANTHROPIC_FIXTURE_MODELS[0];
    if (!model) throw new Error("missing model");
    const router = new ProviderRouter([adapter]);
    const prepared = await router.prepare(
      { provider: ANTHROPIC_PROVIDER, model: model.id, credentialId: "c1" },
      10,
      100,
      new AbortController().signal,
    );
    const credential = Buffer.from(JSON.stringify({ apiKey: "sk-ant-fixture", workspaceId: "ws-1" }));
    const first = await router.run(prepared, {
      requestId: "1",
      messages: [{ role: "user", content: "work draft" }],
      tools: draftTools,
      credential,
      signal: new AbortController().signal,
    });
    expect(first.response.toolCalls[0]?.name).toBe("sandbox.draft.read");
    expect(adapter.lastSuccessfulModel).toBe(model.id);

    await expect(
      adapter.invoke({
        requestId: "no-ws",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("sk-ant-only"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIAL" });

    const quotaAdapter = new AnthropicMessagesAdapter({
      fixtureModels: ANTHROPIC_FIXTURE_MODELS,
      fetch: createAnthropicFixtureFetch({ messages: async () => new Response("{}", { status: 429 }) }),
    });
    await expect(
      quotaAdapter.invoke({
        requestId: "q",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("sk"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "QUOTA_EXHAUSTED" });

    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      adapter.invoke({
        requestId: "c",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential,
        signal: cancelled.signal,
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("Gemini generateContent adapter", () => {
  it("completes tool fixture and rejects legacy/unsupported credentials", async () => {
    expect(() => assertGeminiAuthKey(Buffer.from("legacy-key-material-xxxx"))).toThrow(ProviderError);
    expect(() => assertGeminiAuthKey(Buffer.from("short"))).toThrow(ProviderError);

    let step = 0;
    const adapter = new GeminiGenerateContentAdapter({
      fixtureModels: GEMINI_FIXTURE_MODELS,
      fetch: createGeminiFixtureFetch({
        generateContent: async (_url, init) => {
          const headers = init.headers as Record<string, string>;
          expect(headers["x-goog-api-key"]).toBeTruthy();
          expect(JSON.stringify(init)).not.toContain("gemini-secret-live");
          step += 1;
          if (step === 1) {
            return new Response(
              JSON.stringify({
                candidates: [{ content: { parts: [{ functionCall: { name: "sandbox.draft.read", args: {} } }] } }],
                usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 3 },
              }),
              { status: 200 },
            );
          }
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "fixture complete" }] } }],
              usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 4 },
            }),
            { status: 200 },
          );
        },
      }),
    });
    const model = GEMINI_FIXTURE_MODELS[0];
    if (!model) throw new Error("missing model");
    const router = new ProviderRouter([adapter]);
    const prepared = await router.prepare(
      { provider: GEMINI_PROVIDER, model: model.id, credentialId: "g1" },
      10,
      100,
      new AbortController().signal,
    );
    const first = await router.run(prepared, {
      requestId: "1",
      messages: [{ role: "user", content: "connect" }],
      tools: draftTools,
      credential: Buffer.from("AIzaSyFixtureAuthKeyValue99"),
      signal: new AbortController().signal,
    });
    expect(first.response.toolCalls[0]?.name).toBe("sandbox.draft.read");

    const blocked = new GeminiGenerateContentAdapter({
      fixtureModels: GEMINI_FIXTURE_MODELS,
      fetch: createGeminiFixtureFetch({
        generateContent: async () =>
          new Response(JSON.stringify({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }), {
            status: 200,
          }),
      }),
    });
    await expect(
      blocked.invoke({
        requestId: "b",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("AIzaSyFixtureAuthKeyValue99"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });

    const throttle = new GeminiGenerateContentAdapter({
      fixtureModels: GEMINI_FIXTURE_MODELS,
      fetch: createGeminiFixtureFetch({ generateContent: async () => new Response("{}", { status: 429 }) }),
    });
    await expect(
      throttle.invoke({
        requestId: "t",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("AIzaSyFixtureAuthKeyValue99"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "QUOTA_EXHAUSTED" });
  });
});

describe("xAI chat completions adapter", () => {
  it("passes connection fixture and rejects duplicate tool-call IDs / invalid keys", async () => {
    let step = 0;
    const adapter = new XaiChatCompletionsAdapter({
      fixtureModels: XAI_FIXTURE_MODELS,
      fetch: createXaiFixtureFetch({
        chatCompletions: (init) => {
          const auth = String((init.headers as Record<string, string>).authorization ?? "");
          expect(auth.startsWith("Bearer ")).toBe(true);
          expect(JSON.stringify(init)).not.toContain("xai-live-secret");
          step += 1;
          if (step === 1) {
            return new Response(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      tool_calls: [
                        {
                          id: "call_a",
                          type: "function",
                          function: { name: "sandbox.draft.read", arguments: "{}" },
                        },
                      ],
                    },
                  },
                ],
                usage: { prompt_tokens: 7, completion_tokens: 3 },
              }),
              { status: 200 },
            );
          }
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: "xai done" } }],
              usage: { prompt_tokens: 8, completion_tokens: 2 },
            }),
            { status: 200 },
          );
        },
      }),
    });
    const model = XAI_FIXTURE_MODELS[0];
    if (!model) throw new Error("missing model");
    const router = new ProviderRouter([adapter]);
    const prepared = await router.prepare(
      { provider: XAI_PROVIDER, model: model.id, credentialId: "x1" },
      10,
      100,
      new AbortController().signal,
    );
    const first = await router.run(prepared, {
      requestId: "1",
      messages: [{ role: "user", content: "run fixture" }],
      tools: draftTools,
      credential: Buffer.from("xai-fixture-key"),
      signal: new AbortController().signal,
    });
    expect(first.response.toolCalls[0]?.id).toBe("call_a");

    const dup = new XaiChatCompletionsAdapter({
      fixtureModels: XAI_FIXTURE_MODELS,
      fetch: createXaiFixtureFetch({
        chatCompletions: async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    tool_calls: [
                      { id: "dup", type: "function", function: { name: "sandbox.draft.read", arguments: "{}" } },
                      { id: "dup", type: "function", function: { name: "sandbox.draft.write", arguments: "{}" } },
                    ],
                  },
                },
              ],
            }),
            { status: 200 },
          ),
      }),
    });
    await expect(
      dup.invoke({
        requestId: "d",
        model: model.id,
        messages: [],
        tools: draftTools,
        maxOutputTokens: 10,
        credential: Buffer.from("k"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "MALFORMED_TOOL_CALL" });

    await expect(
      adapter.invoke({
        requestId: "bad",
        model: "not-a-model",
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("k"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MODEL" });

    const timeout = new XaiChatCompletionsAdapter({
      fixtureModels: XAI_FIXTURE_MODELS,
      fetch: createXaiFixtureFetch({ chatCompletions: async () => new Response("{}", { status: 504 }) }),
    });
    await expect(
      timeout.invoke({
        requestId: "to",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("k"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
