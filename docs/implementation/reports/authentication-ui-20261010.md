# PACT-144 — Persistent player access and focused navigation, 10 October 2026

The founder authorized implementing the authentication review, simplifying the Advanced UI, committing and releasing on the existing server. Guest access must survive same-browser returns and support another device without creating a second kingdom.

## Implemented

Generic human-session bootstrap restores stable session-bound CSRF in fresh tabs while retaining legacy tokens, HttpOnly cookies, seven-idle/30-absolute expiry and Origin checks. Guest save stages a verified email/password conversion in existing retained verification-token storage (migration 0055); confirmation converts the same account, disables its guest recovery key and preserves kingdom/history/OAuth grants. Pending credentials are cleared on use and follow existing token retention and cascading account erasure. Duplicate emails never merge owners; expired/replaced/replayed/conflicting claims fail closed. Verification retains the original recent-authentication clock. Local logout revokes only that session; sign-out-everywhere retains global revocation semantics.

Guest entry now offers registered sign-in, password recovery and existing-only guest restoration. Account exposes the private guest recovery code for storage on another device, verified conversion and session controls. Credentials remain private and out of URLs. Registered bootstrap and successful conversion clear obsolete browser guest keys. Existing-key automatic recovery fails closed rather than silently founding a replacement. Pending first-entry retries retain their original key.

Kingdom's large Advanced disclosure is replaced with **Overview / Buildings / Army / Economy** screens. Overview keeps scene, quick builds, builder status, supply summaries, threats and keepsakes. Buildings owns queue/cancel controls; Army owns troop/training/upkeep/threats; Economy owns detailed stocks, forecasts and shared action charges. Resource totals remain visible across sections. Account/privacy controls have their own screen, linked from game navigation and Envoy. The four cross-channel game tabs and all authoritative command handlers remain unchanged.

The deployed private email route is captured SMTP. The UI explicitly says codes come from the operator; guest recovery provides immediate device portability without email. This release does not configure or certify real outbound email, expand production scope, change agent authority or alter any continuous-player pacing/model/state.

## Local verification

Build, package build, web build, typecheck and lint pass (existing nonfatal Vite large-chunk warnings). All **319 unit tests pass**, including focused-screen visibility and retained construction/training behavior. Full integration run: **332 passed, one optional skipped**, with one migration-inventory assertion failing solely because it did not yet include 0055. After updating that inventory, the single smoke test passes; the unaffected 332 were not rerun. New integration coverage verifies concurrent single-use conversion, same original owner/kingdom/grant on second-device login, pre-verification denial, old-key refusal, expiry/replacement/email conflicts, independent-tab CSRF including legacy tokens, anonymous/cross-origin denial and session-only logout. No test uses real personal data or model inference.

## Release verification

Pending deployment and hosted/browser checks. Acceptance remains in progress until those observations are recorded. Preserve both terminal finite experiments and the original fifty-owner native checkpoint. Before deployment, that checkpoint still reports the same run and 50 actors with 4,801 lifetime attempts, Qwen 9B and hourly/60-second pacing; Windows task was already Ready (last result 0xC000013A), rather than actively Running. No claim of active continuous inference is made from the saved status alone.
