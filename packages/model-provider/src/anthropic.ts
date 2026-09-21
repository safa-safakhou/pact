import type { ModelProviderAdapter, ProviderModel, ProviderRequest, ProviderResponse } from "./types.js";
import { ProviderError } from "./types.js";

export const ANTHROPIC_PROVIDER = "anthropic";
export const ANTHROPIC_API_VERSION = "2023-06-01";

export const ANTHROPIC_FIXTURE_MODELS: readonly ProviderModel[] = [
  {
    id: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    contextWindowTokens: 200_000,
    maxOutputTokens: 8_192,
    capabilities: { structuredToolCalls: true, parallelToolCalls: true },
    pricing: {
      currency: "USD",
      inputMicrosPerMillionTokens: "3000000",
      outputMicrosPerMillionTokens: "15000000",
      effectiveAt: "2026-09-21T00:00:00.000Z",
    },
  },
];

export type AnthropicFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface AnthropicAdapterOptions {
  readonly baseUrl?: string;
  readonly fetch?: AnthropicFetch;
  readonly fixtureModels?: readonly ProviderModel[];
  /** When true, requests without a workspace identifier fail as INVALID_CREDENTIAL. */
  readonly requireWorkspace?: boolean;
}

export interface AnthropicCredential {
  readonly apiKey: string;
  readonly workspaceId?: string;
}

/** API keys only — never ChatGPT/Claude subscription session material. */
export function parseAnthropicCredential(raw: Uint8Array): AnthropicCredential {
  const text = Buffer.from(raw).toString("utf8").trim();
  if (!text) throw new ProviderError("INVALID_CREDENTIAL", false);
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as { apiKey?: unknown; workspaceId?: unknown };
      if (typeof parsed.apiKey !== "string" || !parsed.apiKey) throw new ProviderError("INVALID_CREDENTIAL", false);
      return {
        apiKey: parsed.apiKey,
        ...(typeof parsed.workspaceId === "string" && parsed.workspaceId ? { workspaceId: parsed.workspaceId } : {}),
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError("INVALID_CREDENTIAL", false);
    }
  }
  return { apiKey: text };
}

interface MessagesBody {
  readonly model?: string;
  readonly content?: readonly {
    readonly type?: string;
    readonly text?: string;
    readonly id?: string;
    readonly name?: string;
    readonly input?: unknown;
  }[];
  readonly usage?: { readonly input_tokens?: number; readonly output_tokens?: number };
  readonly error?: { readonly type?: string; readonly message?: string };
}

export class AnthropicMessagesAdapter implements ModelProviderAdapter {
  readonly provider = ANTHROPIC_PROVIDER;
  private readonly baseUrl: string;
  private readonly fetchImpl: AnthropicFetch;
  private readonly fixtureModels: readonly ProviderModel[] | undefined;
  private readonly requireWorkspace: boolean;
  lastSuccessfulModel: string | undefined;

  constructor(options: AnthropicAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.fixtureModels = options.fixtureModels;
    this.requireWorkspace = options.requireWorkspace ?? false;
  }

  async listModels(signal: AbortSignal): Promise<readonly ProviderModel[]> {
    if (signal.aborted) throw new ProviderError("CANCELLED", false);
    return this.fixtureModels ?? ANTHROPIC_FIXTURE_MODELS;
  }

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    if (request.signal.aborted) throw new ProviderError("CANCELLED", false);
    const models = await this.listModels(request.signal);
    if (!models.some((model) => model.id === request.model)) {
      throw new ProviderError("UNSUPPORTED_MODEL", false);
    }
    const credential = parseAnthropicCredential(request.credential);
    if (this.requireWorkspace && !credential.workspaceId) {
      throw new ProviderError("INVALID_CREDENTIAL", false);
    }

    const system = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n");
    const messages = [];
    for (const message of request.messages) {
      if (message.role === "system") continue;
      if (message.role === "tool") {
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: message.toolCallId ?? "unknown",
              content: message.content,
            },
          ],
        });
        continue;
      }
      messages.push({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      });
    }

    const tools = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": credential.apiKey,
          "anthropic-version": ANTHROPIC_API_VERSION,
          "content-type": "application/json",
          ...(credential.workspaceId ? { "anthropic-organization-id": credential.workspaceId } : {}),
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxOutputTokens,
          ...(system ? { system } : {}),
          messages,
          tools,
        }),
        signal: request.signal,
      });
    } catch (error) {
      if (request.signal.aborted) throw new ProviderError("CANCELLED", false);
      if (error instanceof DOMException && error.name === "AbortError") throw new ProviderError("CANCELLED", false);
      if (error instanceof ProviderError) throw error;
      throw new ProviderError("PROVIDER_UNAVAILABLE", true);
    }

    mapHttpStatus(response.status);
    const body = (await response.json()) as MessagesBody;
    if (body.error?.type === "invalid_request_error" && /workspace|organization/i.test(body.error.message ?? "")) {
      throw new ProviderError("INVALID_CREDENTIAL", false);
    }
    if (body.error) throw new ProviderError("PROVIDER_UNAVAILABLE", false);

    const toolCalls = [];
    const textParts: string[] = [];
    for (const block of body.content ?? []) {
      if (block.type === "text" && block.text) textParts.push(block.text);
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id ?? `anthropic-${toolCalls.length}`,
          name: block.name ?? "",
          arguments: block.input ?? {},
        });
      }
    }

    this.lastSuccessfulModel = body.model ?? request.model;
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

export function createAnthropicFixtureFetch(handlers: {
  messages?: (init: RequestInit) => Response | Promise<Response>;
}): AnthropicFetch {
  return async (url, init) => {
    if (url.endsWith("/messages") && handlers.messages) return handlers.messages(init);
    return new Response(JSON.stringify({ error: { message: "unhandled" } }), { status: 500 });
  };
}

function mapHttpStatus(status: number): void {
  if (status === 401 || status === 403) throw new ProviderError("INVALID_CREDENTIAL", false);
  if (status === 404) throw new ProviderError("UNSUPPORTED_MODEL", false);
  if (status === 429) throw new ProviderError("QUOTA_EXHAUSTED", false);
  if (status === 408 || status === 504) throw new ProviderError("TIMEOUT", true);
  if (status < 200 || status >= 300) throw new ProviderError("PROVIDER_UNAVAILABLE", status >= 500);
}
