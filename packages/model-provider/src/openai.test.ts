import { describe, expect, it } from "vitest";
import { ProviderError, ProviderRouter } from "./index.js";
import { createOpenAiFixtureFetch, OPENAI_FIXTURE_MODELS, OPENAI_PROVIDER, OpenAiResponsesAdapter } from "./openai.js";

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

describe("OpenAI Responses adapter", () => {
  it("maps invalid key, quota, cancel, unsupported model, and tool continuation without leaking secrets", async () => {
    const secret = "sk-live-should-never-appear-in-errors";
    const adapter = new OpenAiResponsesAdapter({
      fixtureModels: OPENAI_FIXTURE_MODELS,
      fetch: createOpenAiFixtureFetch({
        responses: (init) => {
          const auth = String((init.headers as Record<string, string>).authorization ?? "");
          expect(auth).toContain("Bearer ");
          expect(auth).not.toContain("undefined");
          const body = JSON.parse(String(init.body));
          if (body.model === "missing-model") {
            return new Response("{}", { status: 404 });
          }
          if (auth.includes("bad-key")) return new Response("{}", { status: 401 });
          if (auth.includes("quota")) return new Response("{}", { status: 429 });
          return new Response(
            JSON.stringify({
              output: [
                {
                  type: "function_call",
                  call_id: "call_1",
                  name: "sandbox.echo",
                  arguments: JSON.stringify({ message: "from-openai" }),
                },
              ],
              usage: { input_tokens: 11, output_tokens: 5 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        },
      }),
    });

    const router = new ProviderRouter([adapter]);
    const model = OPENAI_FIXTURE_MODELS[0];
    if (!model) throw new Error("missing fixture model");
    const prepared = await router.prepare(
      { provider: OPENAI_PROVIDER, model: model.id, credentialId: "cred-1" },
      10,
      100,
      new AbortController().signal,
    );

    const ok = await router.run(prepared, {
      requestId: "req-1",
      messages: [{ role: "user", content: "read draft then write" }],
      tools: [tool],
      credential: Buffer.from(secret),
      signal: new AbortController().signal,
    });
    expect(ok.response.toolCalls[0]?.name).toBe("sandbox.echo");
    expect(JSON.stringify(ok)).not.toContain(secret);

    await expect(
      adapter.invoke({
        requestId: "req-bad",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("bad-key"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIAL" });

    await expect(
      adapter.invoke({
        requestId: "req-quota",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from("quota"),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "QUOTA_EXHAUSTED" });

    await expect(
      adapter.invoke({
        requestId: "req-model",
        model: "missing-model",
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from(secret),
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MODEL" });

    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      adapter.invoke({
        requestId: "req-cancel",
        model: model.id,
        messages: [],
        tools: [],
        maxOutputTokens: 10,
        credential: Buffer.from(secret),
        signal: cancelled.signal,
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("simulates draft read → sandbox write → final response via recorded Responses fixtures", async () => {
    let step = 0;
    const adapter = new OpenAiResponsesAdapter({
      fixtureModels: OPENAI_FIXTURE_MODELS,
      fetch: createOpenAiFixtureFetch({
        responses: async () => {
          step += 1;
          if (step === 1) {
            return new Response(
              JSON.stringify({
                output: [
                  {
                    type: "function_call",
                    call_id: "draft_read",
                    name: "sandbox.draft.read",
                    arguments: "{}",
                  },
                ],
                usage: { input_tokens: 20, output_tokens: 8 },
              }),
              { status: 200 },
            );
          }
          if (step === 2) {
            return new Response(
              JSON.stringify({
                output: [
                  {
                    type: "function_call",
                    call_id: "draft_write",
                    name: "sandbox.draft.write",
                    arguments: JSON.stringify({ note: "fixture-note" }),
                  },
                ],
                usage: { input_tokens: 24, output_tokens: 10 },
              }),
              { status: 200 },
            );
          }
          return new Response(
            JSON.stringify({
              output: [{ type: "message", content: [{ type: "output_text", text: "done with receipt" }] }],
              usage: { input_tokens: 30, output_tokens: 12 },
            }),
            { status: 200 },
          );
        },
      }),
    });
    const router = new ProviderRouter([adapter]);
    const model = OPENAI_FIXTURE_MODELS[0];
    if (!model) throw new Error("missing fixture model");
    const prepared = await router.prepare(
      { provider: OPENAI_PROVIDER, model: model.id, credentialId: "cred-1" },
      10,
      200,
      new AbortController().signal,
    );
    const first = await router.run(prepared, {
      requestId: "1",
      messages: [{ role: "user", content: "work the draft" }],
      tools: [
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
      ],
      credential: Buffer.from("sk-fixture"),
      signal: new AbortController().signal,
    });
    expect(first.response.toolCalls[0]?.name).toBe("sandbox.draft.read");
    const second = await router.run(prepared, {
      requestId: "2",
      messages: [
        { role: "user", content: "work the draft" },
        { role: "tool", content: JSON.stringify({ note: null }), toolCallId: "draft_read" },
      ],
      tools: [
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
      ],
      credential: Buffer.from("sk-fixture"),
      signal: new AbortController().signal,
    });
    expect(second.response.toolCalls[0]?.arguments).toMatchObject({ note: "fixture-note" });
    const final = await router.run(prepared, {
      requestId: "3",
      messages: [
        { role: "user", content: "work the draft" },
        { role: "tool", content: JSON.stringify({ code: "COMMITTED" }), toolCallId: "draft_write" },
      ],
      tools: [],
      credential: Buffer.from("sk-fixture"),
      signal: new AbortController().signal,
    });
    expect(final.response.text).toContain("done with receipt");
    expect(final.response.toolCalls).toEqual([]);
  });
});
