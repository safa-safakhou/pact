import type {
  ModelProviderAdapter,
  PreparedProviderRun,
  PriceEstimate,
  ProviderModel,
  ProviderRequest,
  ProviderResponse,
  ProviderRoute,
  ProviderRunResult,
  ProviderToolCall,
  ProviderToolDefinition,
} from "./types.js";
import { ProviderError } from "./types.js";

const integerString = /^(0|[1-9][0-9]*)$/;

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function parseRate(value: string): bigint {
  if (!integerString.test(value)) throw new ProviderError("PROVIDER_UNAVAILABLE", false);
  return BigInt(value);
}

function ceilDivide(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
}

export function estimateMaximumPrice(
  model: ProviderModel,
  inputTokens: number,
  maximumOutputTokens: number,
): PriceEstimate {
  if (!model.pricing) return { status: "unknown", display: "Provider price unavailable" };
  if (!Number.isSafeInteger(inputTokens) || inputTokens < 0 || !positiveInteger(maximumOutputTokens)) {
    throw new ProviderError("PROVIDER_UNAVAILABLE", false);
  }
  const million = 1_000_000n;
  const input = ceilDivide(BigInt(inputTokens) * parseRate(model.pricing.inputMicrosPerMillionTokens), million);
  const output = ceilDivide(
    BigInt(maximumOutputTokens) * parseRate(model.pricing.outputMicrosPerMillionTokens),
    million,
  );
  return { status: "known", currency: model.pricing.currency, maximumMicros: (input + output).toString() };
}

function validateModel(model: ProviderModel): void {
  if (
    !model.id ||
    !model.displayName ||
    !positiveInteger(model.contextWindowTokens) ||
    !positiveInteger(model.maxOutputTokens)
  ) {
    throw new ProviderError("PROVIDER_UNAVAILABLE", false);
  }
}

function validateToolCalls(
  calls: readonly ProviderToolCall[],
  definitions: readonly ProviderToolDefinition[],
): readonly ProviderToolCall[] {
  if (calls.length > 64) throw new ProviderError("MALFORMED_TOOL_CALL", false);
  const tools = new Map(definitions.map((definition) => [definition.name, definition]));
  const ids = new Set<string>();
  return calls.map((call) => {
    const definition = tools.get(call.name);
    if (!call.id || ids.has(call.id) || !definition) throw new ProviderError("MALFORMED_TOOL_CALL", false);
    ids.add(call.id);
    try {
      return { ...call, arguments: definition.parseArguments(call.arguments) };
    } catch {
      throw new ProviderError("MALFORMED_TOOL_CALL", false);
    }
  });
}

function sanitizeFailure(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return new ProviderError("CANCELLED", false);
  return new ProviderError("PROVIDER_UNAVAILABLE", true);
}

export class ProviderRouter {
  readonly #adapters: ReadonlyMap<string, ModelProviderAdapter>;

  constructor(adapters: readonly ModelProviderAdapter[]) {
    const mapped = new Map<string, ModelProviderAdapter>();
    for (const adapter of adapters) {
      if (!adapter.provider || mapped.has(adapter.provider))
        throw new Error("Provider adapter identifiers must be unique");
      mapped.set(adapter.provider, adapter);
    }
    this.#adapters = mapped;
  }

  async prepare(
    route: ProviderRoute,
    inputTokens: number,
    tokenAllowance: number,
    signal: AbortSignal,
  ): Promise<PreparedProviderRun> {
    const adapter = this.#adapters.get(route.provider);
    if (!adapter) throw new ProviderError("UNKNOWN_PROVIDER", false);
    if (signal.aborted) throw new ProviderError("CANCELLED", false);
    let models: readonly ProviderModel[];
    try {
      models = await adapter.listModels(signal);
    } catch (error) {
      throw sanitizeFailure(error);
    }
    for (const model of models) validateModel(model);
    const model = models.find((candidate) => candidate.id === route.model);
    if (
      !model?.capabilities.structuredToolCalls ||
      !positiveInteger(tokenAllowance) ||
      tokenAllowance > model.maxOutputTokens ||
      !Number.isSafeInteger(inputTokens) ||
      inputTokens < 0 ||
      inputTokens + tokenAllowance > model.contextWindowTokens
    ) {
      throw new ProviderError("UNSUPPORTED_MODEL", false);
    }
    return {
      route,
      model,
      tokenAllowance,
      priceEstimate: estimateMaximumPrice(model, inputTokens, tokenAllowance),
    };
  }

  async run(
    prepared: PreparedProviderRun,
    request: Omit<ProviderRequest, "model" | "maxOutputTokens">,
  ): Promise<ProviderRunResult> {
    const adapter = this.#adapters.get(prepared.route.provider);
    if (!adapter) throw new ProviderError("UNKNOWN_PROVIDER", false);
    if (request.signal.aborted) throw new ProviderError("CANCELLED", false);
    let response: ProviderResponse;
    try {
      response = await adapter.invoke({
        ...request,
        model: prepared.route.model,
        maxOutputTokens: prepared.tokenAllowance,
      });
    } catch (error) {
      throw sanitizeFailure(error);
    }
    const toolCalls = validateToolCalls(response.toolCalls, request.tools);
    const usage = response.usage ?? { status: "unavailable" as const };
    if (
      "inputTokens" in usage &&
      (!Number.isSafeInteger(usage.inputTokens) ||
        usage.inputTokens < 0 ||
        !Number.isSafeInteger(usage.outputTokens) ||
        usage.outputTokens < 0)
    ) {
      throw new ProviderError("PROVIDER_UNAVAILABLE", false);
    }
    return { route: prepared.route, response: { ...response, toolCalls }, usage };
  }
}
