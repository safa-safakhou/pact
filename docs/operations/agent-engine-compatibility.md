# Agent engine compatibility and offline scenarios

17 October 2026 — PACT P3. This is source/offline evidence, not a live rollout or a new population run. Fleet and PACT retain independent releases.

| Surface / version | PACT capability | Fleet source profile | Acceptance boundary |
| --- | --- | --- | --- |
| Existing API/MCP observations and receipts | Existing owner/grant scope and exclusive write lease | legacy-loop@1, legacy-cognition@1 | Pinned legacy parity; current installed controllers unchanged |
| pact.agent-events.v1 | Optional polling metadata feed; PACT_AGENT_EVENTS_ENABLED=1 | reactive-basic@1 | Fake transport/host tests; explicit external-host wake enrollment, no inference from notifications |
| pact.agent-outlook.v1 | Optional owner outlook; PACT_AGENT_OUTLOOK_ENABLED=1 | reactive-cognition@1 | Grounding and synthetic rules outcomes; no proved motive/trust/survival score |
| Coordination/atomic expected revision | Not advertised by PACT | specialist-coordinator@1 | Unsupported before inference; no parallel-reasoning exception added |
| pact.scenario-outcome.v1 / pact.scenario-recording.v1 | Offline harness exports only | Optional external evaluator/report consumer | Versioned JSON; Fleet does not import PACT harness types or access this database |

Both new PACT endpoint flags remain absent/default off. Fleet's FLEET_PACT_EVENT_FEED_VERSION and FLEET_PACT_OUTLOOK_VERSION also remain unset by default; FLEET_LIVE_ENABLED must be explicitly enabled for execution. Source compatibility previews do not certify providers or authorize a run. Existing optional A2A is unchanged.

## Frozen scenario inputs

The authoritative synthetic fixture registry is tests/evaluation/design.json. All six added cases have three actors: Cedar (host), Birch (Hall III lender), Ash (optional threat), and the normal eight Home Guard each. Ordinary stocks, troop identities, legal Barracks capacity, permissions, clock and raid entropy inputs are explicit. Enemy threat uses40 Spearmen+40 Archers (the command schema permits at most40/type). Food pressure has32 visiting Spearmen and host/lender Barracks II; other help has8. Attacker Barracks III supplies ordinary capacity. These initial endowments are test fixtures, not changes to production economics.

| Scenario | Distinguishing input | Observable reference outcome with scripted choice |
| --- | --- | --- |
| threat-help | Large declared raid, affordable eight-unit help | Help admitted before lock; expiry fulfilled while defense lost |
| costly-help | Same threat,50 Silver host bond | 30,000 internal units locked; obligation/combat tracked separately; no invented payment supply contract |
| unneeded-help | No raid | Waiting creates no host obligation; no message required |
| early-recall | Lender exits at minute10 | Lender default recorded; motive remains unproved |
| food-pressure | Zero ordinary host Grain and32 visitors | Real production/upkeep produces shortage and host default; allowance is not visitor food |
| silence-valid | No raid or messaging requirement | Waiting/silence valid in this control; no communication reward |

All cases use the existing command dispatcher/handlers, committed receipts, outbox selectors and rules runtime. Scripted choices execute as explicitly synthetic human principals; the fixture mandates also declare relevant actions and headroom. This qualifies mechanics/plumbing, not real agent authorization, strategic quality, cognition or provider performance. No model is invoked. P3 adds no game incentive, destruction, private-memory exchange, faction bonus or compulsory reply.

## Time and outcome definitions

Jobs start at the next minute boundary. A raid declared at game time0 resolves at minute21:20 minutes after eligibility starts, with its lock five minutes before resolution at minute16. Both duration and declaration-to-resolution delay are exposed. Help accepted at minute1 is assigned immediately and expires at minute62 (the next minute plus one hour). The fixture advances62 normal committed ticks; buildings stay intact. A receipt confirms admission, not material delivery or battle victory.

readScenarioOutcome(world, actor) validates the actor belongs to that isolated world and reads a repeatable snapshot. It exports own defender battle casualties/ordinary loot; hosted casualties; recorded fully-funded/shortage minute counts; garrison obligations due/fulfilled/defaulted/pending; source IDs; rules version, seed, split and replica identity. Shortage is counted from actual minute checks, not the resetting consecutive-hunger counter. Garrison expiry without default counts fulfilled; early recall/default is separate. Supply obligations and all-cause losses are outside this evidence coverage. Opponent private state and peer message text are excluded. A wait control is not a universal policy for threats. No outcome establishes a motive, subjective experience, intelligence rank or causal engine benefit.

## Playback and optional comparisons

recordScenario exports strict pact.scenario-recording.v1 JSON containing the authoritative outcome and frozen-design digest. playbackRecordedScenario validates and reads it without database handles, models or writes. Imported JSON is recorded evidence, not independently certified or cryptographically attested truth. scenarioBranch requires the current design digest and a planned replica arm, and creates a separate loopback pact_test schema from the original frozen initial fixture. It is labeled fresh_fixture_branch; it does not restore an intermediate historical world or replay uncertain commands. A seed never guarantees identical LLM decisions.

Existing development seeds11/29 and held-out47/83 remain disjoint. The expanded registry has12 scenarios×4 seeds×14 original factor arms=672 planned isolated replicas. Registration is not evidence that all672 were played. Checks exercise paired initial-state isolation and scripted development-seed mechanics; no held-out model performance was inspected. Multiple kingdoms in one persistent interacting world are observations, not independent replicas. Independent replicas need distinct worlds and explicit metrics/denominators, configuration/caps and exposure coverage. More messages, signatures or actions are not automatic success.

The owner conversation's existing agreement tracks now provide an encoded link to the same already-authorized record. The route retains normal owner checks and never embeds peer text or inferred private facts in a report.

## Local verification and later release

Use Node24 and an isolated PostgreSQL17 loopback database named pact_test. This batch used the owned pact-phase2-test-db container at127.0.0.1:5438. Never use the installed Fleet database or a live PACT world.

```sh
npm run build
npm test
TEST_DATABASE_URL=postgres://pact:pact@127.0.0.1:5438/pact_test npm run test:integration -- --maxWorkers=2
npm run typecheck
npm run lint
npm run eval:offline
python3 docs/implementation/backlog.py check
git diff --check
```

Unrestricted test parallelism can exceed the migrator's global advisory-lock timeout; two workers passed the complete suite. Do not change production lock policy to hide a fixture-capacity failure.

F8 remains the next release-qualification package. It must pin both actual source commits, qualification evidence, selected accounts/routes, caps, deadlines, default-off flags and encrypted rollback at a quiescent boundary. Source rollback must retain newer databases/history and does not undo committed game actions. No installation, push, provider call, new account/run, recovery review or server Fleet access was performed or authorized here. See the [P3 completion report](../implementation/reports/agent-engine-scenarios-20261017.md).
