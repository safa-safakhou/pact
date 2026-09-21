import { describe, expect, it } from "vitest";
import { ProviderError, ProviderRouter } from "./index.js";
import {
  createOpenRouterFixtureFetch,
  OPENROUTER_FIXTURE_MODELS,
  OPENROUTER_PROVIDER,
  OpenRouterChatCompletionsAdapter,
} from "./openrouter.js";

const tool = {
  name: "sandbox.echo",
  description: "Echo",
  inputSchema: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
    additionalProperties: false,
  },
  parseArguments: (input: unknown) => {
    if (!input || typeof input !== "object" || !("message" in input)) throw new Error("bad");
    return input;
  },
};

describe("OpenRouter chat completions adapter", () => {
  it("requires routing disclosure, maps tools/usage, and refuses silent fallback", async () => {
    const secret = "sk-or-live-never-leak";
    const model = OPENROUTER_FIXTURE_MODELS[0];
    if (!model) throw new Error("missing model");

    await expect(
      new OpenRouterChatCompletionsAdapter({
        fixtureModels: OPENROUTER_FIXTURE_MODELS,
        fetch: createOpenRouterFixtureFetch({
          chatCompletions: async () => new Response("{}", { status: 200 }),
        }),
      }).invoke({
        requestId: "1",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from(secret),
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(ProviderError);

    const adapter = new OpenRouterChatCompletionsAdapter({
      routingDisclosure: "OpenRouter upstream routing for the selected model; allow_fallbacks=false.",
      fixtureModels: OPENROUTER_FIXTURE_MODELS,
      fetch: createOpenRouterFixtureFetch({
        chatCompletions: async (init) => {
          const headers = init.headers as Record<string, string>;
          const auth = String(headers.authorization ?? "");
          expect(auth.startsWith("Bearer ")).toBe(true);
          const body = JSON.parse(String(init.body));
          expect(body.provider.allow_fallbacks).toBe(false);
          if (auth.includes("bad")) return new Response("{}", { status: 401 });
          if (auth.includes("quota")) return new Response("{}", { status: 429 });
          return new Response(
            JSON.stringify({
              model: "openrouter/auto",
              choices: [
                {
                  message: {
                    tool_calls: [
                      {
                        id: "call_1",
                        function: { name: "sandbox.echo", arguments: JSON.stringify({ message: "or" }) },
                      },
                    ],
                  },
                },
              ],
              usage: { prompt_tokens: 9, completion_tokens: 3 },
            }),
            { status: 200 },
          );
        },
      }),
    });

    const router = new ProviderRouter([adapter]);
    const prepared = await router.prepare(
      { provider: OPENROUTER_PROVIDER, model: model.id, credentialId: "c1" },
      10,
      50,
      new AbortController().signal,
    );
    const ok = await router.run(prepared, {
      requestId: "r1",
      messages: [{ role: "user", content: "go" }],
      tools: [tool],
      credential: Buffer.from(secret),
      signal: new AbortController().signal,
    });
    expect(ok.response.toolCalls[0]?.name).toBe("sandbox.echo");
    expect(ok.response.usage).toEqual({ inputTokens: 9, outputTokens: 3 });
    expect(adapter.lastRoutedModel).toBe("openrouter/auto");
    expect(JSON.stringify(ok)).not.toContain(secret);

    await expect(
      adapter.invoke({
        requestId: "bad",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("bad"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIAL" });

    await expect(
      adapter.invoke({
        requestId: "quota",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("quota"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "QUOTA_EXHAUSTED" });
  });
});
