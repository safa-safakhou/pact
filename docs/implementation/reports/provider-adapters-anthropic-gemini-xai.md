# Anthropic, Gemini, and xAI adapters

Tickets: [PACT-012 / MNI-72](https://linear.app/mnim/issue/MNI-72/pact-012-implement-the-anthropic-model-adapter), [PACT-013 / MNI-73](https://linear.app/mnim/issue/MNI-73/pact-013-implement-the-gemini-model-adapter), [PACT-014 / MNI-74](https://linear.app/mnim/issue/MNI-74/pact-014-implement-the-xai-model-adapter)

Implementation revision/PR: local commit after this report (see git log); no PR.

Verification environment: 21 September 2026; macOS arm64; Node.js 24.21.0; npm 11.19.0.

## Result

Three injectable HTTP adapters land in `@pact/model-provider`:

- Anthropic Messages (`anthropic-version: 2023-06-01`) with optional workspace header and recorded successful model id
- Gemini `generateContent` with AI Studio auth-key validation (rejects legacy placeholders)
- xAI chat completions tool calls, labeled as xAI model API access (not Grok consumer MCP)

Shared router sanitization and no fallback routing are unchanged.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-012 | Same draft-read/sandbox-write/tool-result fixture as other adapters | `packages/model-provider/src/provider-adapters.test.ts` | Pass (recorded Messages fixtures; no live Anthropic key) |
| PACT-012 | Required workspace errors, malformed tools, quota failure, and cancellation map to shared results without fallback | Same file | Pass |
| PACT-013 | Common connection fixture on a tool-capable model | Same file | Pass (recorded generateContent fixtures; no live Gemini key) |
| PACT-013 | Unsupported credentials/models, blocked responses, missing usage, and throttles stop/report correctly | Same file (legacy key reject, SAFETY block, 429) | Pass |
| PACT-014 | Common connection fixture | Same file | Pass (recorded chat-completions fixtures; no live xAI key) |
| PACT-014 | Invalid key, model mismatch, repeated tool-call IDs, and timeouts cannot cause duplicate sandbox actions | Same file (duplicate IDs → `MALFORMED_TOOL_CALL`, timeout 504) | Pass |

Supporting checks: `npm run build --workspace @pact/model-provider`; `npm test -- packages/model-provider` (9). Live operator keys were not used.

## Documentation

- [Provider adapters](../../api/provider-adapters.md)

## Decisions and limitations

Live provider certification remains PACT-026 / connection gate work. OpenRouter (PACT-015) still needs authorization + adapter.

## Handoff

Next ready adapter work: PACT-015 (OpenRouter). PACT-023 still waits on 015 among other deps.
