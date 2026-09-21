# Account, connection, and Envoy setup screens

Tickets: [PACT-023 / MNI-83](https://linear.app/mnim/issue/MNI-83/pact-023-build-account-connection-and-envoy-setup-screens)

Implementation revision/PR: uncommitted local work (explicitly not committed per assignment).

Verification environment: 21 September 2026; macOS arm64; Node.js 24; npm workspaces.

## Result

`@pact/ui-features` provides reusable DOM setup screens (`SetupFlow`) with injected callbacks, `pact-` prefixed responsive CSS, and truthful Working/Waiting/Stopped, pricing, and error copy. `@pact/client-sdk` adds platform-independent setup view-model helpers for native reuse. `apps/web` hosts the flow with invitation query preservation and a cookie/CSRF `createWebPactClient` shell. OpenRouter adapter work (PACT-015) was not modified.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-023 | Complete setup and a sandbox approval on phone and desktop using keyboard as well as touch | `packages/ui-features/src/setup-flow.test.tsx`; responsive CSS with `pact-touch-target` min sizes; form `type="button"`/`type="submit"` | Pass for UI contract via static markup tests. Interactive phone/desktop sandbox approval with live API remains for hosted certification (PACT-026). |
| PACT-023 | Closing/reopening shows server state; expired approval, revoked key, and unsupported host produce actionable messages without founding a live kingdom | `setup-view-models.test.ts`; `SetupFlow` `serverHydrated` notice and error alerts; copy asserts no live-kingdom claim | Pass for view-model and UI messaging. Full reopen against a live API session was not run in this batch. |

Supporting checks: `npx vitest run packages/client-sdk/src/setup-view-models.test.ts packages/ui-features/src/setup-flow.test.tsx` (9 passed); `npm run build --workspace @pact/client-sdk`; `npm run build --workspace @pact/ui-features`; `npm run build --workspace @pact/web`. Full-repo `npm run typecheck` / `npm run lint` currently fail on in-progress PACT-015 OpenRouter files owned by another agent; those packages were not modified for this ticket.

## Documentation

- [Setup UI hosting](../../api/setup-ui.md)
- [Client SDK setup view models](../../api/client-sdk.md)
- [Module boundaries](../../architecture/modules.md)

## Decisions and limitations

Features never call localhost directly. Demo web props hydrate the shell; production wiring should replace stubs with API projections. PACT-015 OpenRouter package was left untouched by assignment.

## Handoff

Next: wire live account/draft/credential/run/approval transports into the web shell once remaining connection routes are ready; PACT-084/085 can reuse `@pact/ui-features` and SDK setup helpers. Do not mark device certification complete from these unit tests alone.
