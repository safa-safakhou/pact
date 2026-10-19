# Fleet P1 implementation — 13 October 2026

Subsequent checkpoint: the founder explicitly approved [deployment and same-owner resumption](fleet-p1-deployment-20261013.md). Both releases are live; accounts/counters/schedule are preserved and the cancelled execution was reviewed with its full allocation and historical unknown marker retained. The implementation and pending-rollout notes below record the earlier checkpoint.

Founder assignment: implement fresh reads, memory retention, permissions and recovery from the [investigation plan](../fleet-agent-investigation-plan-20261013.md), preserving existing agents, accounts and counters. Assignee: Codex. Status: verified local implementation; no deployment or population restart. This assignment has no invented Linear ID and does not activate deferred roadmap tickets.

## Implementation boundary

Fleet commit `3407e5a` implements the controller, retention, permission matrix, recovery inspection and synthetic/cross-repository acceptance. Read [its full report](https://github.com/safa-safakhou/fleet/blob/master/docs/p1-controller-20261013.md) for checks, compatibility, complete-row production hashes and the pending rollout proposal.

PACT changes only the owned world projection in `packages/kingdom/src/world-views.ts`:

- `nextUpgradeChecks` describes each building's next target using the existing pure `checkUpgrade`, including exact missing prerequisites.
- Waiting non-Hall jobs blocked by `hall_limit` now expose their missing Hall level, as waiting Hall jobs already exposed their farm/barracks/storehouse requirements.
- Public/outsider views return before either private field is assembled. No private queue or upgrade check is added to public projections.

No queue rule, cancellation rule, price, stock, mandate, OAuth scope, write lease, human-only boundary, command schema or game clock behavior changes. No migration is required. Existing valid waiting queues remain valid; the controller now avoids creating new prerequisite deadlocks and gives the actual owner exact recovery instructions for existing ones.

Fleet retains a selected read independently of optional cache. Requests on a turn's final decision survive restart until the next eligible decision consumes their dated feedback. Eight encrypted entries persist instead of three; expiry/fencing and lifetime accounting remain enforced. Actual read validation failures produce sanitized evidence and may be corrected inside the original decision limit. All six human-only game actions remain excluded absent a pre-existing concrete owner exception; server enforcement is unchanged.

## Actual acceptance

| Check | Result |
| --- | --- |
| PACT full `npm run build` | Passed; existing web bundle-size warnings |
| PACT `npm run typecheck` and `npm run lint` | Passed, including architecture boundaries, build order and 26 unchanged published v1 schemas |
| World views, buildings, game-command-fault integration suites against separate PostgreSQL 17 at loopback 5438 | 53 passed |
| `packages/domain/src/rules-catalog.test.ts` | 7 passed |
| Fleet Node 24.21.0 Linux unit / integration suites | 47 / 104 passed, no skips |
| Fleet opt-in PACT handler acceptance | 6 passed |
| Both `git diff --check` | Passed |

**217 tests passed.** PACT/Fleet acceptance uses actual built PACT public packages, `GameCommandHandler`, `CommandDispatcher`, lease and exposure services, owned projections and PostgreSQL transactions. It checks all six human-only refusals under a real fixture lease, scope/lease/mandate restrictions, manual contact delegation, three permitted Hall/non-Hall deadlock reconstructions, prevention before submission, exact owner cancellation and outsider privacy. It makes no live model or real-account game calls.

Fleet's production audit has no findings. PACT's unchanged existing dependency tree reports 23 findings (7 moderate, 16 high), principally the Expo/Metro tooling chain and braces/node-forge/uuid. No dependency updates or forced downgrade were performed. This pre-existing audit issue remains separately actionable; it is not a passed audit or a P1 runtime regression.

No browser/device certification or beneficial negotiation success is claimed by these controller/handler tests. The small Fleet inspector change is compiled and shows the consented recovery event's exact instruction IDs and prerequisites; it becomes visible for subsequent observed turns after deployment.

## Preservation and rollout

The production 50-owner Luna group remains paused: 49 ready, one `CODEX_CANCELLED` owner requiring review, 1,362 turns, 2,122 calls and 218 commits. One unknown compute reservation is preserved. Complete before/after row hashes match for every agent, turn, compute entry and cohort, including historical groups. Account/kingdom IDs, encrypted grants, budgets, schedules, counters and pending fields are unchanged. Pilot remains finished; the learning draft remains unconfigured. No old population or terminal experiment restarted, no model selection changed, no extra inference or new account was created.

Deployment remains pending the plan's concrete execution approval. Release PACT's owned projection before the Fleet controller, keep the existing group paused, retain all PostgreSQL/vault/state mounts and previous images, verify health and repeat complete-row preservation checks. Review unknown provider usage separately before any covered resume decision. Deployment does not authorize cancelling owners' live queues or expanding their mandates. P2 optimization/incentive work remains deferred; the 24 historical Later tasks remain deferred.
