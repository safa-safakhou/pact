import type { ModelProviderAdapter, ProviderModel, ProviderRequest, ProviderResponse } from "./types.js";
import { ProviderError } from "./types.js";

export const OPENROUTER_PROVIDER = "openrouter";

export const OPENROUTER_FIXTURE_MODELS: readonly ProviderModel[] = [
  {
    id: "openrouter/auto",
    displayName: "OpenRouter Auto",
    contextWindowTokens: 128_000,
    maxOutputTokens: 8_192,
    capabilities: { structuredToolCalls: true, parallelToolCalls: false },
    pricing: {
      currency: "USD",
      inputMicrosPerMillionTokens: "0",
      outputMicrosPerMillionTokens: "0",
      effectiveAt: "2026-09-21T00:00:00.000Z",
    },
  },
];

export type OpenRouterFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface OpenRouterAdapterOptions {
  readonly baseUrl?: string;
  readonly fetch?: OpenRouterFetch;
  readonly fixtureModels?: readonly ProviderModel[];
  /** Required disclosure of upstream routing; missing disclosure refuses the call. */
  readonly routingDisclosure?: string;
}

interface ChatBody {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string | null;
      readonly tool_calls?: readonly {
        readonly id?: string;
        readonly function?: { readonly name?: string; readonly arguments?: string };
      }[];
    };
  }[];
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
  readonly model?: string;
  readonly error?: { readonly message?: string };
}

export class OpenRouterChatCompletionsAdapter implements ModelProviderAdapter {
  readonly provider = OPENROUTER_PROVIDER;
  private readonly baseUrl: string;
  private readonly fetchImpl: OpenRouterFetch;
  private readonly fixtureModels: readonly ProviderModel[] | undefined;
  private readonly routingDisclosure: string | undefined;
  lastRoutedModel: string | undefined;

  constructor(options: OpenRouterAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.fixtureModels = options.fixtureModels;
    this.routingDisclosure = options.routingDisclosure;
  }

  async listModels(signal: AbortSignal): Promise<readonly ProviderModel[]> {
    if (signal.aborted) throw new ProviderError("CANCELLED", false);
    return this.fixtureModels ?? OPENROUTER_FIXTURE_MODELS;
  }

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    if (request.signal.aborted) throw new ProviderError("CANCELLED", false);
    if (!this.routingDisclosure) throw new ProviderError("PROVIDER_UNAVAILABLE", false);
    const models = await this.listModels(request.signal);
    if (!models.some((model) => model.id === request.model)) {
      throw new ProviderError("UNSUPPORTED_MODEL", false);
    }
    const apiKey = Buffer.from(request.credential).toString("utf8");
    if (!apiKey) throw new ProviderError("INVALID_CREDENTIAL", false);

    const messages = request.messages.map((message) => {
      if (message.role === "tool") {
        return { role: "tool", tool_call_id: message.toolCallId ?? "unknown", content: message.content };
      }
      return { role: message.role, content: message.content };
    });
    const tools = request.tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
    }));

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "x-pact-routing-disclosure": this.routingDisclosure,
        },
        body: JSON.stringify({
          model: request.model,
          messages,
          tools,
          max_tokens: request.maxOutputTokens,
          // Explicit; never silent cross-provider fallback.
          provider: { allow_fallbacks: false },
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

    const body = (await response.json()) as ChatBody;
    if (body.error) throw new ProviderError("PROVIDER_UNAVAILABLE", false);
    this.lastRoutedModel = body.model ?? request.model;

    const message = body.choices?.[0]?.message;
    const toolCalls = [];
    for (const call of message?.tool_calls ?? []) {
      let args: unknown = {};
      try {
        args = JSON.parse(call.function?.arguments ?? "{}");
      } catch {
        throw new ProviderError("MALFORMED_TOOL_CALL", false);
      }
      toolCalls.push({ id: call.id ?? `or-${toolCalls.length}`, name: call.function?.name ?? "", arguments: args });
    }
    const usage =
      body.usage && Number.isSafeInteger(body.usage.prompt_tokens) && Number.isSafeInteger(body.usage.completion_tokens)
        ? { inputTokens: body.usage.prompt_tokens ?? 0, outputTokens: body.usage.completion_tokens ?? 0 }
        : undefined;

    return {
      stopReason: toolCalls.length > 0 ? "tool_calls" : "completed",
      ...(message?.content ? { text: message.content } : {}),
      toolCalls,
      ...(usage ? { usage } : {}),
    };
  }
}

export function createOpenRouterFixtureFetch(handlers: {
  chatCompletions?: (init: RequestInit) => Response | Promise<Response>;
}): OpenRouterFetch {
  return async (url, init) => {
    if (url.endsWith("/chat/completions") && handlers.chatCompletions) return handlers.chatCompletions(init);
    return new Response(JSON.stringify({ error: { message: "unhandled" } }), { status: 500 });
  };
}
