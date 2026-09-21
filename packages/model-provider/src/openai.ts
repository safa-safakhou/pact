import type { ModelProviderAdapter, ProviderModel, ProviderRequest, ProviderResponse } from "./types.js";
import { ProviderError } from "./types.js";

export const OPENAI_PROVIDER = "openai";

/** Documented Season One fixture models; real discovery still comes from the API when live. */
export const OPENAI_FIXTURE_MODELS: readonly ProviderModel[] = [
  {
    id: "gpt-4.1-mini",
    displayName: "GPT-4.1 mini",
    contextWindowTokens: 128_000,
    maxOutputTokens: 16_384,
    capabilities: { structuredToolCalls: true, parallelToolCalls: true },
    pricing: {
      currency: "USD",
      inputMicrosPerMillionTokens: "400000",
      outputMicrosPerMillionTokens: "1600000",
      effectiveAt: "2026-09-21T00:00:00.000Z",
    },
  },
];

export type OpenAiFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface OpenAiAdapterOptions {
  readonly baseUrl?: string;
  readonly fetch?: OpenAiFetch;
  /** When set, listModels returns these without network (CI / recorded fixtures). */
  readonly fixtureModels?: readonly ProviderModel[];
}

interface ResponsesBody {
  readonly id?: string;
  readonly status?: string;
  readonly error?: { readonly code?: string; readonly message?: string };
  readonly output?: readonly {
    readonly type?: string;
    readonly content?: readonly { readonly type?: string; readonly text?: string }[];
    readonly name?: string;
    readonly arguments?: string | Record<string, unknown>;
    readonly call_id?: string;
    readonly id?: string;
  }[];
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly total_tokens?: number;
  };
}

export class OpenAiResponsesAdapter implements ModelProviderAdapter {
  readonly provider = OPENAI_PROVIDER;
  private readonly baseUrl: string;
  private readonly fetchImpl: OpenAiFetch;
  private readonly fixtureModels: readonly ProviderModel[] | undefined;

  constructor(options: OpenAiAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.fixtureModels = options.fixtureModels;
  }

  async listModels(signal: AbortSignal): Promise<readonly ProviderModel[]> {
    if (signal.aborted) throw new ProviderError("CANCELLED", false);
    if (this.fixtureModels) return this.fixtureModels;
    // Live discovery is deferred to certification; adapters always expose the fixture catalog
    // plus any models the operator pins. Network list is intentionally not required for CI.
    return OPENAI_FIXTURE_MODELS;
  }

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    if (request.signal.aborted) throw new ProviderError("CANCELLED", false);
    const models = await this.listModels(request.signal);
    if (!models.some((model) => model.id === request.model)) {
      throw new ProviderError("UNSUPPORTED_MODEL", false);
    }
    const apiKey = Buffer.from(request.credential).toString("utf8");
    if (!apiKey) throw new ProviderError("INVALID_CREDENTIAL", false);

    const tools = request.tools.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      strict: false,
    }));

    const input = request.messages.map((message) => {
      if (message.role === "tool") {
        return {
          type: "function_call_output",
          call_id: message.toolCallId ?? "unknown",
          output: message.content,
        };
      }
      return {
        role: message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user",
        content: message.content,
      };
    });

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          input,
          tools,
          max_output_tokens: request.maxOutputTokens,
          store: false,
        }),
        signal: request.signal,
      });
    } catch (error) {
      if (request.signal.aborted) throw new ProviderError("CANCELLED", false);
      if (error instanceof DOMException && error.name === "AbortError") throw new ProviderError("CANCELLED", false);
      if (error instanceof ProviderError) throw error;
      throw new ProviderError("PROVIDER_UNAVAILABLE", true);
    }

    if (response.status === 401 || response.status === 403) throw new ProviderError("INVALID_CREDENTIAL", false);
    if (response.status === 404) throw new ProviderError("UNSUPPORTED_MODEL", false);
    if (response.status === 429) throw new ProviderError("QUOTA_EXHAUSTED", false);
    if (response.status === 408 || response.status === 504) throw new ProviderError("TIMEOUT", true);
    if (!response.ok) throw new ProviderError("PROVIDER_UNAVAILABLE", response.status >= 500);

    const body = (await response.json()) as ResponsesBody;
    if (body.error?.code === "unsupported_model") throw new ProviderError("UNSUPPORTED_MODEL", false);
    if (body.error) throw new ProviderError("PROVIDER_UNAVAILABLE", false);

    const toolCalls = [];
    const textParts: string[] = [];
    for (const item of body.output ?? []) {
      if (item.type === "message") {
        for (const part of item.content ?? []) {
          if (part.type === "output_text" && part.text) textParts.push(part.text);
        }
      }
      if (item.type === "function_call") {
        let args: unknown = {};
        if (typeof item.arguments === "string") {
          try {
            args = JSON.parse(item.arguments);
          } catch {
            throw new ProviderError("MALFORMED_TOOL_CALL", false);
          }
        } else if (item.arguments && typeof item.arguments === "object") {
          args = item.arguments;
        }
        toolCalls.push({
          id: item.call_id ?? item.id ?? `openai-${toolCalls.length}`,
          name: item.name ?? "",
          arguments: args,
        });
      }
    }

    const usage =
      body.usage && Number.isSafeInteger(body.usage.input_tokens) && Number.isSafeInteger(body.usage.output_tokens)
        ? { inputTokens: body.usage.input_tokens ?? 0, outputTokens: body.usage.output_tokens ?? 0 }
        : undefined;

    return {
      stopReason: toolCalls.length > 0 ? "tool_calls" : "completed",
      ...(textParts.length > 0 ? { text: textParts.join("\n") } : {}),
      toolCalls,
      ...(usage ? { usage } : {}),
    };
  }
}

/** Fake HTTP transport for recorded OpenAI Responses fixtures — no network. */
export function createOpenAiFixtureFetch(handlers: {
  responses?: (init: RequestInit) => Response | Promise<Response>;
}): OpenAiFetch {
  return async (url, init) => {
    if (url.endsWith("/responses") && handlers.responses) return handlers.responses(init);
    return new Response(JSON.stringify({ error: { message: "unhandled fixture route" } }), { status: 500 });
  };
}
