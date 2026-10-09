# PACT-136 — authorized extension to 08:00 Berlin

**Final observation:** finished at 08:00 Berlin on 9 October. [Final investigation, reconciled turn counters and limitations](local-population-final-20261009.md) supersedes ongoing-status notes below.

Founder assignment, 9 October 2026: extend the healthy local population until **08:00 Berlin today / 06:00 UTC**. Implementation and live resumption verified; changes are uncommitted. Observation remains ongoing. Local tracking continues under the previously established Linear free issue limit; no new Linear issue was created.

## Result and preserved limits

Extended the same run `local-background-1791507229557-092e5567`, with the same 50 existing owners, local Qwen model and five-minute minimum cadence. Original start remains 00:53:49.557 UTC. Original immutable configuration records the two-hour deadline 02:53:49.557 UTC and 1,250 requests. An explicit authorization record now sets the effective deadline to **06:00 UTC** and the total model-dispatch ceiling to **4,000**, including previously consumed attempts. This ceiling covers the remaining window; it is not a target to exhaust.

At 01:16:30 UTC, an operator STOP let the worker exit normally with 236 consumed requests and no pending commands. The locked extension at 01:16:51.731 UTC preserved every actor, its turns/memory, pending payloads and owner approval budgets byte-for-byte, as well as the original start and consumed request count. The STOP was removed after saving the authorized record. No account was created, mandate widened or budget reset. [Credential-free extension evidence](evidence/local-extension-20261009.json).

The existing Windows task `PACT Local Players 50 20261009` resumed under supervisor PID 7928. Its OS execution ceiling is now six hours; the application still stops at the earlier exact deadline or request ceiling. At 01:17:38 UTC, all 50 owners had five successful turns, 250 attempts were consumed, zero owners were blocked, and status/heartbeat both reported running with the new limits. At 01:19:08 UTC, a fresh heartbeat again confirmed running, 50 owners, zero blocked and the 06:00 UTC deadline. The earlier isolated truncated model response remains in the audit history.

## Acceptance and checks

- Extension chains validate matching prior bounds, same run identity and explicit authorization. Completed/expired runs cannot be reopened. Operator extensions are bounded to eight hours from the original start and 5,000 total attempts; normal new-run limits remain two hours and 2,000 attempts.
- Effective limits feed both dispatch reservation and the runner/supervisor. Immutable original configuration and all consumed counters remain intact across restart. No model-accessible extension tool or unattended rollover exists.
- WSL Node 24.12: **35 tests passed** across local population and historical population suites; meaningful extension tests cover persisted recovery, consumed budgets, deadline/cap exhaustion and invalid authorization/bounds/identity/terminal states.
- Windows Node 24.19: **five limits/supervisor tests passed**. Biome and repository typecheck passed. Planning regeneration/validation and whitespace checks are recorded in the tracker on completion.
- Audit displays a stop reason only for a terminal run, so the brief operator pause does not mislabel the resumed worker as stopped.

## Handoff

[Operating instructions](../../operations/local-population.md#authorized-extension--9-october). Windows must remain awake and signed in with Ollama/repository reachable. This verifies the extension and resumed worker, not completion of the observation before 08:00. The October 4 experiment remains finished with its original exhausted cap; the 24 deferred production tasks remain deferred. No further extension or next run is authorized automatically.
