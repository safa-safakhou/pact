import type { ProviderError } from "@pact/model-provider";
import { describe, expect, it } from "vitest";
import { createInferenceProviderRouter } from "../../workers/inference/src/provider-runtime.js";

describe("inference provider registration", () => {
  it("keeps network providers unregistered by default", async () => {
    const router = createInferenceProviderRouter(false);
    await expect(
      router.prepare(
        { provider: "openai", model: "gpt-4.1-mini", credentialId: "fixture" },
        10,
        100,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN_PROVIDER" } satisfies Partial<ProviderError>);
  });

  it("registers the pinned adapter catalog only after explicit enablement", async () => {
    const router = createInferenceProviderRouter(true);
    await expect(
      router.prepare(
        { provider: "openai", model: "gpt-4.1-mini", credentialId: "fixture" },
        10,
        100,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ route: { provider: "openai", model: "gpt-4.1-mini" } });
    await expect(
      router.prepare(
        { provider: "openrouter", model: "openrouter/auto", credentialId: "fixture" },
        10,
        100,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN_PROVIDER" });
    const disclosed = createInferenceProviderRouter(true, "Operator-reviewed upstream route disclosure");
    await expect(
      disclosed.prepare(
        { provider: "openrouter", model: "openrouter/auto", credentialId: "fixture" },
        10,
        100,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ route: { provider: "openrouter" } });
  });
});
