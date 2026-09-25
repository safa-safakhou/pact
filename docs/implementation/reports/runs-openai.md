# Bounded runs and OpenAI adapter

Tickets: [PACT-021 / MNI-81](https://linear.app/mnim/issue/MNI-81/pact-021-implement-bounded-envoy-runs-and-exclusive-write-leases), [PACT-011 / MNI-71](https://linear.app/mnim/issue/MNI-71/pact-011-implement-the-openai-model-adapter)

Implementation revision/PR: local commit after this report (see git log); no PR.

Verification environment: 21 September 2026; macOS arm64; Node.js 24.21.0; npm 11.19.0; PostgreSQL 17 via Colima Compose.

## Result

`@pact/runs` persists exclusive `write_leases` and `envoy_runs`, exposes human start/stop/wait/resume HTTP routes, MCP lease acquisition without inference, token/call reservations before each model step, and durable `envoy.run.tick` jobs. The inference worker processes those jobs with the shared provider router. Ambiguous provider failures fail the run once without an unbounded retry/billing loop. Idle inbox publication does not invoke a provider.

`OpenAiResponsesAdapter` implements the Responses API mapping with injectable HTTP. Recorded fixtures cover draft-read → sandbox-write → final response and sanitized failure codes.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-021 | A fake-provider run stops at each limit, preserves allowance on resume, and cannot be extended by repeated callbacks | `tests/integration/runs.test.ts` | Pass |
| PACT-021 | Close the browser during a real run and observe bounded completion; inject an inbox event while idle and observe zero model calls. Ambiguous provider-call crashes are surfaced without an unbounded retry/billing loop | Same file (disconnect continuation, inbox idle, ambiguous crash → `failed`) | Pass |
| PACT-011 | A real supported model reads the draft, proposes a valid sandbox write, and consumes its tool receipt in a final response | `packages/model-provider/src/openai.test.ts` recorded Responses fixtures | Pass (fixture transport; no live OpenAI key) |
| PACT-011 | Invalid key, tool error, cancellation, unavailable model, and quota failure produce the shared adapter result without leaking credentials | Same file | Pass |

Supporting checks: `npm run lint`, `npm run typecheck`, `npm test` (27), `npm run test:integration` including runs (28 total when full suite run), `npm run build:packages`, `@pact/api` and `@pact/inference-worker` builds.

Live operator OpenAI key smoke was not run; connection certification remains separate.

## Documentation

- [Runs API](../../api/runs.md)
- [Provider adapters](../../api/provider-adapters.md)
- [Module boundaries](../../architecture/modules.md)
- [Database operations](../../operations/database.md)

## Decisions and limitations

Write leases are keyed by `(product_scope, subject_id)` with account ID as the phase-0 subject until live kingdoms exist. Provider `PROVIDER_UNAVAILABLE` during an in-flight call is treated as an ambiguous crash (no auto-retry). MCP `openMcpLease` never enqueues inference jobs.

## Handoff

PACT-023 and PACT-024 still wait on remaining deps (015/084/085 for some). PACT-012–015 remain ready for other provider adapters. PACT-004 remains blocked on AWS/VPS credentials.

## Run-ceiling regression — 25 Sep 2026

A later audit found that `POST /v1/runs` allowed 100 calls and 200 000 tokens, and an internal caller could request a duration beyond 15 minutes, contrary to the Version 1 execution contract. The run service now rejects any invalid or over-ceiling duration, call, token, conversation, or message limit before acquiring a lease or queuing a job; the HTTP schema enforces 20 calls and 40 000 tokens. A PostgreSQL fixture exercises over-ceiling, zero, fractional, and non-finite inputs, confirms no run, lease, or inference job, and admits the exact Version 1 maxima. This corrects a bounded-run defect; it does not change the external MCP host's separate 15-minute lease. Local Node 24 build/typecheck/lint, 115 unit tests, and 160 PostgreSQL integration tests pass. No live provider or VPS deployment was exercised.
