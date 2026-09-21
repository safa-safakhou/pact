import type { ModelProviderAdapter, ProviderModel, ProviderRequest, ProviderResponse } from "./types.js";
import { ProviderError } from "./types.js";

export const XAI_PROVIDER = "xai";

/** xAI model API access — not a Grok consumer-chat MCP claim. */
export const XAI_FIXTURE_MODELS: readonly ProviderModel[] = [
  {
    id: "grok-2-latest",
    displayName: "Grok 2 (xAI API)",
    contextWindowTokens: 131_072,
    maxOutputTokens: 8_192,
    capabilities: { structuredToolCalls: true, parallelToolCalls: false },
    pricing: {
      currency: "USD",
      inputMicrosPerMillionTokens: "2000000",
      outputMicrosPerMillionTokens: "10000000",
      effectiveAt: "2026-09-21T00:00:00.000Z",
    },
  },
];

export type XaiFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface XaiAdapterOptions {
  readonly baseUrl?: string;
  readonly fetch?: XaiFetch;
  readonly fixtureModels?: readonly ProviderModel[];
}

interface ChatCompletionsBody {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string | null;
      readonly tool_calls?: readonly {
        readonly id?: string;
        readonly type?: string;
        readonly function?: { readonly name?: string; readonly arguments?: string };
      }[];
    };
  }[];
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
  readonly error?: { readonly message?: string; readonly code?: string };
}

export class XaiChatCompletionsAdapter implements ModelProviderAdapter {
  readonly provider = XAI_PROVIDER;
  private readonly baseUrl: string;
  private readonly fetchImpl: XaiFetch;
  private readonly fixtureModels: readonly ProviderModel[] | undefined;

  constructor(options: XaiAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.x.ai/v1").replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.fixtureModels = options.fixtureModels;
  }

  async listModels(signal: AbortSignal): Promise<readonly ProviderModel[]> {
    if (signal.aborted) throw new ProviderError("CANCELLED", false);
    return this.fixtureModels ?? XAI_FIXTURE_MODELS;
  }

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    if (request.signal.aborted) throw new ProviderError("CANCELLED", false);
    const models = await this.listModels(request.signal);
    if (!models.some((model) => model.id === request.model)) {
      throw new ProviderError("UNSUPPORTED_MODEL", false);
    }
    const apiKey = Buffer.from(request.credential).toString("utf8");
    if (!apiKey) throw new ProviderError("INVALID_CREDENTIAL", false);

    const messages = request.messages.map((message) => {
      if (message.role === "tool") {
        return {
          role: "tool",
          tool_call_id: message.toolCallId ?? "unknown",
          content: message.content,
        };
      }
      return { role: message.role, content: message.content };
    });

    const tools = request.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages,
          tools,
          max_tokens: request.maxOutputTokens,
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

    const body = (await response.json()) as ChatCompletionsBody;
    if (body.error) throw new ProviderError("PROVIDER_UNAVAILABLE", false);

    const message = body.choices?.[0]?.message;
    const toolCalls = [];
    const seenIds = new Set<string>();
    for (const call of message?.tool_calls ?? []) {
      const id = call.id ?? "";
      if (!id || seenIds.has(id)) throw new ProviderError("MALFORMED_TOOL_CALL", false);
      seenIds.add(id);
      let args: unknown = {};
      try {
        args = JSON.parse(call.function?.arguments ?? "{}");
      } catch {
        throw new ProviderError("MALFORMED_TOOL_CALL", false);
      }
      toolCalls.push({ id, name: call.function?.name ?? "", arguments: args });
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

export function createXaiFixtureFetch(handlers: {
  chatCompletions?: (init: RequestInit) => Response | Promise<Response>;
}): XaiFetch {
  return async (url, init) => {
    if (url.endsWith("/chat/completions") && handlers.chatCompletions) {
      return handlers.chatCompletions(init);
    }
    return new Response(JSON.stringify({ error: { message: "unhandled" } }), { status: 500 });
  };
}
