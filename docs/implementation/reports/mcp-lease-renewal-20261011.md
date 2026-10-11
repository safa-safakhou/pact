# PACT-021 — explicit MCP lease renewal, 11 October 2026

The founder supplied a scheduled-chatbot update saying its write session was rejected by safety checks and the host automation was disabled. Protected read-only inspection found the affected active kingdom already had the expanded delegable gameplay mandate, session capacity one, and an expired historical MCP lease. The current connected profile was verified against that kingdom. No credentials or correspondence were collected. The update omitted the exact error code and failure time; it does not prove a particular server error caused the original scheduled failure.

Two actual authenticated `run.open` calls reproduced a server defect: opening succeeded, but calling it again on the same connection returned `RUN_ALREADY_ACTIVE`, with misleading recovery text claiming another holder existed. No gameplay command or provider inference was executed. The existing runtime and ChatGPT specifications explicitly require renewal; this repairs implementation to that behavior without a specification change.

`RunService.openMcpLease` now requests same-holder renewal. The shared lease transaction requires both holder kind and holder ID to match before renewing, retaining the lease ID and acquired timestamp and setting expiry to the call clock plus fifteen minutes. Different live MCP connections, scripts and PACT runs remain exclusive. Released/expired leases can be acquired anew. Renewal creates no run, inference job or authority allowance. The tool description and API/operations instructions now explain explicit renewal and temporary collision recovery. OAuth reconnect alone still does not renew.

## Local verification

- The new PostgreSQL regression failed against the previous built package with `RUN_ALREADY_ACTIVE` on same-holder renewal, then passed after rebuilding.
- `npm run build:packages`, `npm run typecheck` and `npm run lint` pass (existing nonfatal lint advisories remain).
- `npm run test:integration -- tests/integration/runs.test.ts tests/integration/mcp-approval-inbox.test.ts tests/integration/run-process-death.test.ts`: 26 checks pass, covering bounded run limits, same-holder renewal/expiry, competing and cross-kind holders, wrong-holder close, OAuth reconnect/grant isolation, approvals and process-death behavior.
- Planning render/check and diff validation are required before committing this correction.

## Release and limitations

Implementation is verified locally; hosted deployment and post-release renewal results are pending. The pre-release production backup is being checked. This correction does not alter mandates, create players, enable schedules, make gameplay commitments or restart any terminal experiment. The consumer host owns the stopped hourly automation; server lease success does not establish that its scheduler is enabled or certify actual scheduled execution. If the host rejects a call before sending it to PACT, that separate failure requires its exact error. Do not permanently disable a scheduler solely because another valid holder temporarily owns the lease.
