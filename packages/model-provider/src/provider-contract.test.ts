import { randomUUID } from "node:crypto";
import { SCHEMA_VERSION, validateProviderToolCommand } from "@pact/contracts";
import { describe, expect, it } from "vitest";
import {
  DeterministicFakeProvider,
  exerciseProviderContract,
  fakeProviderModel,
  ProviderError,
  ProviderRouter,
  type ProviderToolDefinition,
} from "./index.js";

const actor = {
  principalId: "account-fixture",
  productScope: "pact" as const,
  audience: "agent" as const,
  subject: { type: "kingdom" as const, id: "kingdom-fixture" },
};
const command = {
  schemaVersion: SCHEMA_VERSION,
  commandId: randomUUID(),
  actor,
  action: { kind: "sandbox.echo" as const, message: "same command" },
  submittedAt: "2026-09-21T10:00:00.000Z",
};
const tool: ProviderToolDefinition = {
  name: "submit_command",
  description: "Submit one typed command",
  inputSchema: { type: "object" },
  parseArguments: validateProviderToolCommand,
};

function request() {
  return {
    requestId: randomUUID(),
    messages: [{ role: "user" as const, content: "Act once" }],
    tools: [tool],
    credential: Buffer.from("synthetic-secret"),
    signal: new AbortController().signal,
  };
}

describe("provider adapter contract", () => {
  it("swaps explicit routes without changing command schema or kingdom identity", async () => {
    for (const provider of ["fixture-a", "fixture-b"]) {
      const adapter = new DeterministicFakeProvider({
        provider,
        scenario: "success",
        toolName: tool.name,
        toolArguments: command,
      });
      const router = new ProviderRouter([adapter]);
      const route = { provider, model: fakeProviderModel.id, credentialId: `${provider}-credential` };
      const prepared = await router.prepare(route, 100, 200, request().signal);
      const result = await router.run(prepared, request());
      expect(result.route).toEqual(route);
      expect(result.response.toolCalls[0]?.arguments).toEqual(command);
      const argumentsValue = result.response.toolCalls[0]?.arguments as typeof command | undefined;
      expect(argumentsValue?.actor).toEqual(actor);
    }
  });

  it("rejects unsupported models before invocation and never falls back to another route", async () => {
    const selected = new DeterministicFakeProvider({ provider: "selected", scenario: "quota-exhausted" });
    const fallback = new DeterministicFakeProvider({ provider: "fallback", scenario: "success" });
    const router = new ProviderRouter([selected, fallback]);
    await expect(
      router.prepare(
        { provider: "selected", model: "unsupported", credentialId: "selected-credential" },
        10,
        100,
        request().signal,
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MODEL" });
    const prepared = await router.prepare(
      { provider: "selected", model: fakeProviderModel.id, credentialId: "selected-credential" },
      10,
      100,
      request().signal,
    );
    await expect(router.run(prepared, request())).rejects.toMatchObject({ code: "QUOTA_EXHAUSTED" });
  });

  it("covers unknown pricing, absent usage, malformed tools, timeout, and exhausted quota", async () => {
    const observations = await exerciseProviderContract(
      {
        modelId: fakeProviderModel.id,
        create: (scenario) =>
          new DeterministicFakeProvider({
            scenario,
            toolName: tool.name,
            toolArguments: command,
          }),
      },
      tool,
    );
    expect(observations).toEqual({
      unknownPrice: "unknown",
      absentUsage: "unavailable",
      malformedTool: "MALFORMED_TOOL_CALL",
      timeout: "TIMEOUT",
      quota: "QUOTA_EXHAUSTED",
    });
  });

  it("sanitizes arbitrary adapter failures and honors cancellation", async () => {
    const unsafe = {
      provider: "unsafe",
      async listModels() {
        return [fakeProviderModel];
      },
      async invoke() {
        throw new Error("upstream leaked a bearer token: secret-value");
      },
    };
    const router = new ProviderRouter([unsafe]);
    const prepared = await router.prepare(
      { provider: "unsafe", model: fakeProviderModel.id, credentialId: "unsafe-credential" },
      10,
      100,
      request().signal,
    );
    const failure = await router.run(prepared, request()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ProviderError);
    expect(failure).toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      safeMessage: "The provider is temporarily unavailable.",
    });
    expect(JSON.stringify(failure)).not.toContain("secret-value");

    const controller = new AbortController();
    controller.abort();
    await expect(
      router.prepare(
        { provider: "unsafe", model: fakeProviderModel.id, credentialId: "unsafe-credential" },
        10,
        100,
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });
});
