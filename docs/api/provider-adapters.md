# Model provider adapter contract

`@pact/model-provider` is the provider-neutral boundary used by the inference process. It contains no account, kingdom, mandate, or game types. A run receives one explicit route `{ provider, model, credentialId }`; the router never searches for a fallback provider or credential after failure.

## Discovery and preparation

Every adapter implements:

- `listModels(signal)` with stable model IDs, context/output limits, structured/parallel tool-call capabilities, and optional pricing.
- `invoke(request)` with the selected model, byte credential, messages, typed tool definitions, output-token limit, and `AbortSignal`.

Call `ProviderRouter.prepare` before admitting a run. Preparation rejects an unknown provider, undiscovered model, model without structured tool calls, or allowance above the model limit. The resulting immutable prepared route is passed to `run`; it cannot change providers or credential IDs.

Pricing uses integer micro-US-dollars per million tokens and ceiling division—never floating point. `estimateMaximumPrice` returns either a known maximum or the explicit unknown state with display text **Provider price unavailable**. Unknown pricing is not represented by zero. Token usage is either exact nonnegative input/output integers or `{ status: "unavailable" }`.

## Tool and error boundary

Adapters return provider-neutral tool calls. The router checks the tool name, unique nonempty call ID, maximum call count, and the tool definition's argument parser before application code sees a call. Provider tool arguments can then enter the existing shared command validator without changing command schemas or authenticated actor identity.

Only the following sanitized codes cross the adapter boundary: `CANCELLED`, `INVALID_CREDENTIAL`, `MALFORMED_TOOL_CALL`, `PROVIDER_UNAVAILABLE`, `QUOTA_EXHAUSTED`, `TIMEOUT`, `UNSUPPORTED_MODEL`, and `UNKNOWN_PROVIDER`. Arbitrary SDK/network errors become `PROVIDER_UNAVAILABLE`; their message, response body, headers, credential, and bearer data are not copied into the public error.

## Contract harness

`DeterministicFakeProvider` supplies CI scenarios for success, unknown pricing, absent usage, malformed tools, timeout, and quota exhaustion. Adapter packages expose a fixture factory to `exerciseProviderContract`; the shared harness checks the required observations without making a network request or requiring a real key.

`OpenAiResponsesAdapter` translates the OpenAI Responses API (`POST /v1/responses`) through an injectable `fetch`. Unit tests use `createOpenAiFixtureFetch` recorded fixtures for draft-read → sandbox-write → final text, plus invalid key, quota, cancel, and unsupported-model mapping without copying bearer secrets into errors.

`AnthropicMessagesAdapter` uses Messages API with `anthropic-version: 2023-06-01`, optional workspace header, and API-key credentials only (no subscription login). `GeminiGenerateContentAdapter` uses `generateContent` with AI Studio auth keys and rejects legacy credential placeholders. `XaiChatCompletionsAdapter` uses bearer chat-completions tool calls and is labeled as xAI model API access — not a Grok consumer-chat MCP claim. Duplicate tool-call IDs fail as `MALFORMED_TOOL_CALL`.

Provider-specific tickets must additionally use a fake HTTP transport to verify request/response translation. Real-provider certification remains a separate acceptance gate and cannot be inferred from this harness.
