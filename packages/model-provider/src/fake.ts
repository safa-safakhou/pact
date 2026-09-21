import type {
  FakeProviderScenario,
  ModelProviderAdapter,
  ProviderModel,
  ProviderRequest,
  ProviderResponse,
} from "./types.js";
import { ProviderError } from "./types.js";

export interface DeterministicFakeProviderOptions {
  readonly provider?: string;
  readonly scenario: FakeProviderScenario;
  readonly toolName?: string;
  readonly toolArguments?: unknown;
}

const pricedModel: ProviderModel = {
  id: "fixture-tools-v1",
  displayName: "Fixture Tools",
  contextWindowTokens: 16_384,
  maxOutputTokens: 2_048,
  capabilities: { structuredToolCalls: true, parallelToolCalls: false },
  pricing: {
    currency: "USD",
    inputMicrosPerMillionTokens: "2000000",
    outputMicrosPerMillionTokens: "8000000",
    effectiveAt: "2026-09-21T00:00:00.000Z",
  },
};

export class DeterministicFakeProvider implements ModelProviderAdapter {
  readonly provider: string;

  constructor(private readonly options: DeterministicFakeProviderOptions) {
    this.provider = options.provider ?? "fixture";
  }

  async listModels(signal: AbortSignal): Promise<readonly ProviderModel[]> {
    if (signal.aborted) throw new ProviderError("CANCELLED", false);
    if (this.options.scenario === "unknown-pricing") {
      const { pricing: _pricing, ...unknownPrice } = pricedModel;
      return [unknownPrice];
    }
    return [pricedModel];
  }

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    if (request.signal.aborted) throw new ProviderError("CANCELLED", false);
    if (request.model !== pricedModel.id) throw new ProviderError("UNSUPPORTED_MODEL", false);
    if (this.options.scenario === "timeout") throw new ProviderError("TIMEOUT", true);
    if (this.options.scenario === "quota-exhausted") throw new ProviderError("QUOTA_EXHAUSTED", false);
    const toolCalls =
      this.options.scenario === "malformed-tool"
        ? [{ id: "fixture-call", name: "not-an-allowed-tool", arguments: {} }]
        : this.options.toolName
          ? [{ id: "fixture-call", name: this.options.toolName, arguments: this.options.toolArguments ?? {} }]
          : [];
    return {
      stopReason: toolCalls.length > 0 ? "tool_calls" : "completed",
      ...(toolCalls.length > 0 ? {} : { text: "fixture-response" }),
      toolCalls,
      ...(this.options.scenario === "absent-usage" ? {} : { usage: { inputTokens: 12, outputTokens: 7 } }),
    };
  }
}

export const fakeProviderModel = pricedModel;
