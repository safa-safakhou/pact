# Local four-architecture world preparation — 19 October 2026

Founder authorized preparing the local environment with a one-hour observation as the sole experiment budget and waiting for an explicit launch instruction. Codex implements locally without delegation. The earlier equal-compute proposal is superseded; no total model/token/helper quota or experiment reserve floor is installed.

## Prepared result

A separate loopback PACT instance and independent native Fleet deployment are prepared on this Mac in private state `local-four-20261019-ef5d29eb`. All twelve original new identities/bindings authenticate; four profiles have three ready agents each. The game is paused, cohorts are draft, window start/end are null, and turns/executions/unknowns are zero. No new Fleet worker or model/helper inference was started. Existing Mac/server/historical populations and credentials were not modified or reviewed.

PACT is reachable at3400, Fleet at8830; database ports5451/5452 are independent of existing listeners. Native Ollama0.40.3 has the pinned Nemotron4B weights; the existing certified local Laya0.4.6 metadata/certificate matched without generation. Source lives in the separate `codex/local-world-preparation` branches/worktrees; no main/master merge, push or public deployment is part of this preparation.

Run-window guards wrap both model paths, helper selection and game submissions, fail closed while disarmed and recheck at actual dispatch. Continuous accounting records all usage without an aggregate quota; the operator-owned one-hour window provides the stopping condition. Original responses are not cancelled just to make a deadline look clean, and original receipts remain available after cutoff. The observer records per-group outcomes, usage and coverage, with preserved state for later explicitly authorized continuation.

[Operator instructions](../../operations/local-world.md) contain the exact control commands and privacy/recovery boundaries.

## Verification

- Run-window tests were red on the absent module, then5 passed. Cases cover prepared/missing/malformed/closed files, exact one-hour cutoff,2000 repeated admissions without a count ceiling, pre-dispatch refusal, late response accounting, receipt recovery and unchanged ordinary runtime behavior.
- Gateway test was red on the missing module, then passed actual loopback HTTP/API/static and dotfile refusal checks.
- PACT native build/typecheck/lint/backport/boundary/contracts and405 unit tests passed;26 published schemas remain unchanged. Existing warnings remain.
- Fleet native type/style/build passed with existing warnings;224 unit tests passed and18 Linux-only cases skipped. Linux Node24 verification passed242 unit tests,393 serial integration tests and12 paired PACT/Fleet acceptance tests against disposable fixture databases.
- Actual prepared verification:12 agents ready,12 bindings,4 compatible profiles, unsupported specialist refused,12 authenticated account/world readbacks, web/API/feed/outlook advertisement and helper metadata checked;0 model requests, turns or executions.
- Encrypted snapshot authentication and a network-disabled restore matched complete rows in10 core PACT tables and39 Fleet tables. Private hash proofs and keys stay outside Git; the temporary clone and its own anonymous volume were removed.

Setup failures remain documented: the initial private parent directory was missing; first binding preparation ran before the cohort's remaining accounts existed; a status reader used incorrect column names; and restore readiness initially hit PostgreSQL's temporary initialization socket. These were corrected and verification rerun. Enrollment recovered the same persisted entry keys/identities; no replacement population or inference was used. Linux test setup initially attempted npm workspace cleanup through a read-only source mount; clean tracked-source exports replaced that setup, without changing application assertions. Missing qualification/paired fixture port aliases and the exported rules build were corrected in the disposable test environment; the full integration and paired suites then passed.

No added disk reserve is enforced for this experiment (FLEET_MIN_FREE_BYTES=0); existing supported maximum per-call/context/output/turn fields remain engine structure rather than a lifetime quota. The observer records cutoff and post-drain observations separately; original receipt/commit timestamps are required when assessing effects near the boundary.

The hour remains unstarted. Exact final source/artifact hashes are stored privately after verified commits; launch refuses drift. No strategic quality, clean hosted CI for these new branches or independent review is claimed.
