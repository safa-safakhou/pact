export type ProviderErrorCode =
  | "CANCELLED"
  | "INVALID_CREDENTIAL"
  | "MALFORMED_TOOL_CALL"
  | "PROVIDER_UNAVAILABLE"
  | "QUOTA_EXHAUSTED"
  | "TIMEOUT"
  | "UNSUPPORTED_MODEL"
  | "UNKNOWN_PROVIDER";

const SAFE_MESSAGES: Readonly<Record<ProviderErrorCode, string>> = {
  CANCELLED: "The provider request was cancelled.",
  INVALID_CREDENTIAL: "The provider rejected this model connection.",
  MALFORMED_TOOL_CALL: "The provider returned an invalid tool call.",
  PROVIDER_UNAVAILABLE: "The provider is temporarily unavailable.",
  QUOTA_EXHAUSTED: "The provider quota is exhausted.",
  TIMEOUT: "The provider request timed out.",
  UNSUPPORTED_MODEL: "The selected model is not supported.",
  UNKNOWN_PROVIDER: "The selected provider is not configured.",
};

export class ProviderError extends Error {
  readonly safeMessage: string;

  constructor(
    readonly code: ProviderErrorCode,
    readonly retryable: boolean,
    readonly finalUsage?: { inputTokens: number; outputTokens: number },
  ) {
    super(code);
    this.name = "ProviderError";
    this.safeMessage = SAFE_MESSAGES[code];
  }
}

export interface ProviderPricing {
  readonly currency: "USD";
  readonly inputMicrosPerMillionTokens: string;
  readonly outputMicrosPerMillionTokens: string;
  readonly effectiveAt: string;
}

export interface ProviderModel {
  readonly id: string;
  readonly displayName: string;
  readonly contextWindowTokens: number;
  readonly maxOutputTokens: number;
  readonly capabilities: {
    readonly structuredToolCalls: boolean;
    readonly parallelToolCalls: boolean;
  };
  readonly pricing?: ProviderPricing;
}

export interface ProviderRoute {
  readonly provider: string;
  readonly model: string;
  readonly credentialId: string;
}

export interface ProviderMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly toolCallId?: string;
}

export interface ProviderToolDefinition<T = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly parseArguments: (input: unknown) => T;
}

export interface ProviderToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: unknown;
}

export interface ProviderUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface ProviderRequest {
  readonly requestId: string;
  readonly model: string;
  readonly messages: readonly ProviderMessage[];
  readonly tools: readonly ProviderToolDefinition[];
  readonly maxOutputTokens: number;
  readonly credential: Uint8Array;
  readonly signal: AbortSignal;
}

export interface ProviderResponse {
  readonly stopReason: "completed" | "tool_calls" | "token_limit";
  readonly text?: string;
  readonly toolCalls: readonly ProviderToolCall[];
  readonly usage?: ProviderUsage;
}

export interface ModelProviderAdapter {
  readonly provider: string;
  listModels(signal: AbortSignal): Promise<readonly ProviderModel[]>;
  invoke(request: ProviderRequest): Promise<ProviderResponse>;
}

export type PriceEstimate =
  | { readonly status: "known"; readonly currency: "USD"; readonly maximumMicros: string }
  | { readonly status: "unknown"; readonly display: "Provider price unavailable" };

export interface PreparedProviderRun {
  readonly route: ProviderRoute;
  readonly model: ProviderModel;
  readonly tokenAllowance: number;
  readonly priceEstimate: PriceEstimate;
}

export interface ProviderRunResult {
  readonly route: ProviderRoute;
  readonly response: ProviderResponse;
  readonly usage: ProviderUsage | { readonly status: "unavailable" };
}

export type FakeProviderScenario =
  | "success"
  | "unknown-pricing"
  | "absent-usage"
  | "malformed-tool"
  | "timeout"
  | "quota-exhausted";
