import {
  AnthropicMessagesAdapter,
  DeterministicFakeProvider,
  GeminiGenerateContentAdapter,
  OpenAiResponsesAdapter,
  OpenRouterChatCompletionsAdapter,
  ProviderRouter,
  XaiChatCompletionsAdapter,
} from "@pact/model-provider";

/** The default VPS worker cannot route to a network-backed model provider. */
export function createInferenceProviderRouter(
  liveProvidersEnabled: boolean,
  openRouterRoutingDisclosure?: string,
): ProviderRouter {
  return new ProviderRouter([
    new DeterministicFakeProvider({ scenario: "success" }),
    ...(liveProvidersEnabled
      ? [
          new OpenAiResponsesAdapter(),
          new AnthropicMessagesAdapter(),
          new GeminiGenerateContentAdapter(),
          new XaiChatCompletionsAdapter(),
          ...(openRouterRoutingDisclosure?.trim()
            ? [new OpenRouterChatCompletionsAdapter({ routingDisclosure: openRouterRoutingDisclosure })]
            : []),
        ]
      : []),
  ]);
}
