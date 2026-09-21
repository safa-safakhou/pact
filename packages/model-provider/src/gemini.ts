import type { ModelProviderAdapter, ProviderModel, ProviderRequest, ProviderResponse } from "./types.js";
import { ProviderError } from "./types.js";

export const GEMINI_PROVIDER = "gemini";

export const GEMINI_FIXTURE_MODELS: readonly ProviderModel[] = [
  {
    id: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 8_192,
    capabilities: { structuredToolCalls: true, parallelToolCalls: true },
    pricing: {
      currency: "USD",
      inputMicrosPerMillionTokens: "100000",
      outputMicrosPerMillionTokens: "400000",
      effectiveAt: "2026-09-21T00:00:00.000Z",
    },
  },
];

export type GeminiFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface GeminiAdapterOptions {
  readonly baseUrl?: string;
  readonly fetch?: GeminiFetch;
  readonly fixtureModels?: readonly ProviderModel[];
}

/** Reject empty and clearly legacy placeholder credentials; require AI Studio auth-key shape. */
export function assertGeminiAuthKey(raw: Uint8Array): string {
  const key = Buffer.from(raw).toString("utf8").trim();
  if (!key) throw new ProviderError("INVALID_CREDENTIAL", false);
  if (/^(legacy-|cookie-|session-)/i.test(key)) throw new ProviderError("INVALID_CREDENTIAL", false);
  if (key.length < 20) throw new ProviderError("INVALID_CREDENTIAL", false);
  return key;
}

interface GeminiBody {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly {
        readonly text?: string;
        readonly functionCall?: { readonly name?: string; readonly args?: unknown };
        readonly functionResponse?: unknown;
      }[];
    };
    readonly finishReason?: string;
  }[];
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
  };
  readonly error?: { readonly code?: number; readonly message?: string; readonly status?: string };
}

export class GeminiGenerateContentAdapter implements ModelProviderAdapter {
  readonly provider = GEMINI_PROVIDER;
  private readonly baseUrl: string;
  private readonly fetchImpl: GeminiFetch;
  private readonly fixtureModels: readonly ProviderModel[] | undefined;

  constructor(options: GeminiAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.fixtureModels = options.fixtureModels;
  }

  async listModels(signal: AbortSignal): Promise<readonly ProviderModel[]> {
    if (signal.aborted) throw new ProviderError("CANCELLED", false);
    return this.fixtureModels ?? GEMINI_FIXTURE_MODELS;
  }

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    if (request.signal.aborted) throw new ProviderError("CANCELLED", false);
    const models = await this.listModels(request.signal);
    if (!models.some((model) => model.id === request.model)) {
      throw new ProviderError("UNSUPPORTED_MODEL", false);
    }
    const apiKey = assertGeminiAuthKey(request.credential);

    const contents = [];
    for (const message of request.messages) {
      if (message.role === "system") continue;
      if (message.role === "tool") {
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: message.toolCallId ?? "tool",
                response: safeJson(message.content),
              },
            },
          ],
        });
        continue;
      }
      contents.push({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      });
    }

    const systemInstruction = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n");

    const url = `${this.baseUrl}/models/${encodeURIComponent(request.model)}:generateContent`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents,
          ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
          tools: [
            {
              functionDeclarations: request.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              })),
            },
          ],
          generationConfig: { maxOutputTokens: request.maxOutputTokens },
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

    const body = (await response.json()) as GeminiBody;
    if (body.error?.status === "RESOURCE_EXHAUSTED") throw new ProviderError("QUOTA_EXHAUSTED", false);
    if (body.error) throw new ProviderError("PROVIDER_UNAVAILABLE", false);

    const candidate = body.candidates?.[0];
    if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "BLOCKLIST") {
      throw new ProviderError("PROVIDER_UNAVAILABLE", false);
    }

    const toolCalls = [];
    const textParts: string[] = [];
    for (const part of candidate?.content?.parts ?? []) {
      if (part.text) textParts.push(part.text);
      if (part.functionCall) {
        toolCalls.push({
          id: `gemini-${toolCalls.length}`,
          name: part.functionCall.name ?? "",
          arguments: part.functionCall.args ?? {},
        });
      }
    }

    const usage =
      body.usageMetadata &&
      Number.isSafeInteger(body.usageMetadata.promptTokenCount) &&
      Number.isSafeInteger(body.usageMetadata.candidatesTokenCount)
        ? {
            inputTokens: body.usageMetadata.promptTokenCount ?? 0,
            outputTokens: body.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined;

    return {
      stopReason: toolCalls.length > 0 ? "tool_calls" : "completed",
      ...(textParts.length > 0 ? { text: textParts.join("\n") } : {}),
      toolCalls,
      ...(usage ? { usage } : {}),
    };
  }
}

export function createGeminiFixtureFetch(handlers: {
  generateContent?: (url: string, init: RequestInit) => Response | Promise<Response>;
}): GeminiFetch {
  return async (url, init) => {
    if (url.includes(":generateContent") && handlers.generateContent) {
      return handlers.generateContent(url, init);
    }
    return new Response(JSON.stringify({ error: { message: "unhandled" } }), { status: 500 });
  };
}

function safeJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return { result: content };
  }
}
