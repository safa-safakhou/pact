import { ProviderRouter } from "./router.js";
import type { FakeProviderScenario, ModelProviderAdapter, ProviderRoute, ProviderToolDefinition } from "./types.js";

export interface ProviderContractFixture {
  readonly modelId: string;
  readonly create: (scenario: FakeProviderScenario) => ModelProviderAdapter;
}

export interface ProviderContractObservations {
  readonly unknownPrice: "unknown";
  readonly absentUsage: "unavailable";
  readonly malformedTool: "MALFORMED_TOOL_CALL";
  readonly timeout: "TIMEOUT";
  readonly quota: "QUOTA_EXHAUSTED";
}

async function errorCode(operation: () => Promise<unknown>): Promise<string> {
  try {
    await operation();
    return "NO_ERROR";
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "UNSAFE_ERROR";
  }
}

function requireObservation<T extends string>(actual: string, expected: T): T {
  if (actual !== expected) throw new Error(`Provider contract expected ${expected}, received ${actual}`);
  return expected;
}

/** Shared deterministic checks used by every provider adapter's fixture transport. */
export async function exerciseProviderContract(
  fixture: ProviderContractFixture,
  tool: ProviderToolDefinition,
): Promise<ProviderContractObservations> {
  const controller = new AbortController();
  const credential = Buffer.from("synthetic-provider-credential");
  const route = (adapter: ModelProviderAdapter): ProviderRoute => ({
    provider: adapter.provider,
    model: fixture.modelId,
    credentialId: "00000000-0000-4000-8000-000000000001",
  });
  const prepare = async (scenario: FakeProviderScenario) => {
    const adapter = fixture.create(scenario);
    const router = new ProviderRouter([adapter]);
    const prepared = await router.prepare(route(adapter), 20, 100, controller.signal);
    return { router, prepared };
  };
  const request = {
    requestId: "00000000-0000-4000-8000-000000000002",
    messages: [{ role: "user" as const, content: "fixture" }],
    tools: [tool],
    credential,
    signal: controller.signal,
  };

  const unknown = await prepare("unknown-pricing");
  const absent = await prepare("absent-usage");
  const absentResult = await absent.router.run(absent.prepared, request);
  const malformed = await prepare("malformed-tool");
  const timeout = await prepare("timeout");
  const quota = await prepare("quota-exhausted");

  const absentUsage = "status" in absentResult.usage ? absentResult.usage.status : "available";
  return {
    unknownPrice: requireObservation(unknown.prepared.priceEstimate.status, "unknown"),
    absentUsage: requireObservation(absentUsage, "unavailable"),
    malformedTool: requireObservation(
      await errorCode(() => malformed.router.run(malformed.prepared, request)),
      "MALFORMED_TOOL_CALL",
    ),
    timeout: requireObservation(await errorCode(() => timeout.router.run(timeout.prepared, request)), "TIMEOUT"),
    quota: requireObservation(await errorCode(() => quota.router.run(quota.prepared, request)), "QUOTA_EXHAUSTED"),
  };
}
