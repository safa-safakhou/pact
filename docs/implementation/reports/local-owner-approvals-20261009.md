# PACT-134 — bounded synthetic-owner approvals

Founder assignment: 9 October 2026, automate approvals for local simulated players. Operator: `codex-local-population`. Status: **complete, uncommitted**. This follows PACT-133; no completed experiment was restarted or extended. Linear's previously verified free issue limit remains unresolved; this local ticket/report records the assignment, not a claim of a newly created Linear issue.

## Result and boundary

The local runner now separates the Envoy's normal mandate from a deterministic synthetic-owner controller. The model never receives owner cookies or an approval tool. Only exact runner-generated building/contact/small reciprocal supply actions can be escalated after an authority denial, using the original command ID. Initial guest/mandate/OAuth setup and incoming contact acceptance were already automatic; none of the PACT-133 live turns required an exception approval. This assignment adds the missing exception path.

New runs default to bounded automatic owner decisions: 20 per owner, 500 whole units each of iron/silver/grain as a separate exception ceiling, charged durably before network work. Failed/uncertain decisions consume the ceiling; restarts cannot reset it. Construction uses full displayed cost, contact uses two silver, and supply signing uses the entire outgoing hour. Cohort membership, exact keys, observed offer/version/parties, reciprocal 1–12/hour flows, one-hour duration, null bonds and zero notice are checked before owner decisions. Other actions and owners remain excluded.

Building/contact use the existing proposal → authenticated owner review → authenticated owner approval POST. Supply is not supported by frozen approval-proposal v1; its approved owner decision uses the normal human command handler with the exact original ID/payload. No API schema, game rule, backend authentication or production service changed. Owner decisions do not raise mandates. Resource/rule/tick/quota denials do not enter this path. Unknown pending approval requests are never swept or auto-approved.

Pending owner decisions persist separately from pending agent writes. Recovery first reads the original receipt; absent receipt permits only the identical owner proposal/command. Uncertain decisions halt further writes. Receipt audit labels automatic owner commands separately from Envoy and ordinary simulated-human contact answers. Recovery reports whether it acquired a lease so the rest of that turn does not open the same lease again.

## Verification

- WSL Node 24.12: `node --test scripts/local-population/*.test.mjs scripts/population/*.test.mjs` — **30 passed**: 11 local baseline, six owner-controller tests, 13 existing population tests.
- Windows Node 24.19: six owner tests passed independently.
- Biome selected-script check and repository typecheck passed. Planning generation/validation and diff whitespace checks are recorded on completion.
- Failure paths cover unknown/changed command reviews, expired/invalid expiry, stop, outsider/action restrictions, unsafe contract terms, persisted count/resource exhaustion, lost response receipt recovery and uncommitted recovery with exactly one lease/proposal and no new decision.

### Actual live approval

A single fresh synthetic owner was created in an isolated native-Windows, owner-only state directory. Its mandate was deliberately restricted to `world.read`/`inbox.read`, zero resource limits and a 20-Grain reserve. Farm II was attempted through the agent MCP route and returned `FORBIDDEN`.

The first owner attempt exposed a duplicate `run.open` (`RUN_ALREADY_ACTIVE`), before an approval request or gameplay commit. The client was corrected to reuse the current lease and open a lease only for an uncommitted recovery. Recovery retained the original two-minute deadline, original command and one already-reserved decision; it did not create another actor, reset a budget or invoke a model.

At 00:45:22 UTC the exact owner approval completed for command `c2b83ef0-db3a-4311-92e2-50cde7b239be`, kingdom `501cf80f-733d-476e-bacc-9709f250df40`. Receipt: **COMMITTED**, 24,000 marked iron (40 whole) and 12,000 marked silver (20 whole). Mandate remained version 3 with only `world.read`/`inbox.read`; pending approval count was zero. A separate read-only server query confirmed that exact approval row as **approved**. MCP session closed and the probe stopped. Zero model requests were made. The synthetic kingdom retains its ordinary queued construction.

[Credential-free live proof](evidence/local-owner-approvals-20261009-live.json). Full private state/events remain outside Git at `C:/Users/ENDORFY/pact-local-owner-probe-20261009`. No credentials were published. Automatic supply owner decisions have unit evidence; this probe did not claim a live contract/settlement or recertify 48-account capacity with exception traffic.

## Handoff

[Runbook and environment settings](../../operations/local-population.md#automatic-simulated-owner-decisions). New runs enable the bounded controller automatically; `PACT_LOCAL_OWNER_APPROVALS=off` disables it. Completed PACT-133 accounts/run state were not mutated or resumed. No production deployment is necessary because the existing human approval/command routes serve this operator client. All 24 deferred production tasks remain deferred; no next roadmap work is automatically selected.
