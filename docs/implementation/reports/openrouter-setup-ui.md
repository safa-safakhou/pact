# OpenRouter authorization and setup UI

Tickets: [PACT-015 / MNI-75](https://linear.app/mnim/issue/MNI-75/pact-015-implement-openrouter-authorization-and-model-adapter), [PACT-023 / MNI-83](https://linear.app/mnim/issue/MNI-83/pact-023-build-account-connection-and-envoy-setup-screens)

Implementation revision/PR: uncommitted local work on `master` at completion time (commit follows this report).

Verification environment: 21 September 2026; macOS arm64; Node.js 24; npm 11; PostgreSQL 17 via local Compose.

## Result

`@pact/openrouter` implements session-bound OpenRouter PKCE with exact callback validation, single-use claim, and ten-minute expiry; code exchange runs outside the database transaction. `OpenRouterChatCompletionsAdapter` requires routing disclosure, sets `allow_fallbacks: false`, and maps tools/usage through the shared provider contract. Manual key entry remains `POST /v1/model-connections` with `provider: "openrouter"`. API routes `POST /v1/openrouter/authorize` and `/callback` require Origin/CSRF.

`@pact/ui-features` hosts reusable `SetupFlow` screens; `@pact/client-sdk` adds setup view models; `apps/web` shells the flow with invitation destination preservation.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-015 | Both key entry and authorization complete the common real-provider fixture | `tests/integration/openrouter.test.ts`; `packages/model-provider/src/openrouter.test.ts` | Pass. Manual key and OAuth-derived keys both invoke the fixture adapter with tool calls. |
| PACT-015 | Swapped state/verifier, replayed callback, expired flow, or an undisclosed routing fallback cannot attach a credential or run a model | same tests | Pass. Callback mismatch, replay, expiry, and missing routing disclosure fail closed. |
| PACT-023 | Complete setup and a sandbox approval on phone and desktop using keyboard as well as touch | `packages/ui-features/src/setup-flow.test.tsx`; responsive `pact-touch-target` CSS | Pass for UI contract via static markup. Live phone/desktop certification remains PACT-026. |
| PACT-023 | Closing/reopening shows server state; expired approval, revoked key, and unsupported host produce actionable messages without founding a live kingdom | `packages/client-sdk/src/setup-view-models.test.ts`; SetupFlow serverHydrated/error alerts | Pass for view-model and messaging. |

Supporting checks: `npm run lint`; `npm run typecheck`; `npm test` (40); `npm run test:integration` (29); `npm run build`.

## Documentation

- [OpenRouter API](../../api/openrouter.md)
- [Setup UI](../../api/setup-ui.md)
- [Client SDK setup view models](../../api/client-sdk.md)
- [Module boundaries](../../architecture/modules.md)
- [Database operations](../../operations/database.md)

## Decisions and limitations

OpenRouter live account/key certification is an external prerequisite and was not run. UI uses injected callbacks and demo hydration in the web shell; production hosts should replace stubs with live projections. No live kingdom founding path is exposed.

## Handoff

Next dependency-ready work after this batch includes PACT-084/085 (wait on 023) and remaining connection gate tickets. Reconcile Linear MNI-75 and MNI-83 to Done with this report linked.
