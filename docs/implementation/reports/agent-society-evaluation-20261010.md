# PACT-157 — Offline decision and communication acceptance

Implemented under the continuing founder assignment, after PACT-152/153/154. A deterministic offline harness separates development versus held-out scenario families and hides synthetic outcome trajectories from policies. Ten held-out families (twenty snapshots) cover bluffing, selective disclosure, competing proposals, costly obligations, peer prompt injection, stale signatures, passive peers, revocation, uncertain host work and an allowed owner-selected attack. Shared action schemas and exact six-hour supply authority exposure are reused. No default cooperation/aggression/reply directive or live game policy was added.

Scoring records valid versus empty plans, denial, hook failure, repetition, explicit-goal outcome, justified waiting, changed terms, activation, delivery/default and supplied token counters separately. Game threats/bluffing text is accepted as content; unsupported authority/URL actions cannot execute. Failing replay error text is excluded. No hidden reasoning, credential or real private conversation is included in the fixture artifact. The dataset is frozen at SHA-256 **b1059d26d4298a9268368e07f9bf9b78d971c24f34d53844e701362eab8dacca**; [full synthetic artifact](assets/agent-society-offline-20261010.json).

| Synthetic policy control | Valid | Empty | Denied | Useful outcomes | Justified wait | Changed / activated / delivered | Defaults |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Calculated choice | 20 | 0 | 0 | 16 | 4 | 4 / 4 / 4 | 0 |
| Candidate baseline | 20 | 0 | 0 | 14 | 4 | 4 / 4 / 4 | 2 |
| Reference script fixture | 20 | 0 | 6 | 10 | 4 | 2 / 2 / 2 | 0 |
| Model response fixture | 20 | 18 | 2 | 0 | 0 | 0 / 0 / 0 | 0 |

These are authored synthetic controls and trajectories, **not current-model performance or actual new contracts/attacks**. The model response control demonstrates twenty valid responses with zero useful outcome; it is not Luna/Astra/Qwen. Goal values are declared scenario assumptions. The harness dispatches zero models; supplied replay token counters are not independently verified billing. No price, intelligence or GPU-capacity claim is made. Actual model benchmark remains under its external compute/route prerequisite, not satisfied by this engineering acceptance.

Database acceptance uses 20/50/100 accepted relationships, three messages and one private note each, plus 85 full 4,096-code-point messages in one pair. Full-body and stable history/memory paging returns every ID once. Social summaries and both-owner named observer reads leave bodies unread; actual participant delivery acknowledges exactly its 88 returned pair messages. Foreign users/one-sided consent see no exchange; owner revocation immediately removes observer access. Real privacy retention removes old message bodies while current owned notes remain; observer memory stays empty.

| Isolated fixture | Measured reads | p95 ms | Maximum ms |
| --- | ---: | ---: | ---: |
| 20 relationships | 60 | 5.198 | 11.318 |
| 50 relationships | 62 | 4.818 | 7.867 |
| 100 relationships | 65 | 4.769 | 8.144 |

These full-suite samples are local PostgreSQL service reads, sequential fixture work on one machine, with no live inference. They do not certify one hundred simultaneous model accounts, GPU throughput or production p95. Initial fixture inserts had conflicting PostgreSQL parameter inference; explicit UUID casts repaired the fixture, then all checks passed. No production account, task, provider call, protected population state or actual gameplay rule was changed.

Checks: typecheck, lint/boundaries/build-order and 26 published v1 fingerprints pass. Full unit **344 passed** and integration **360 passed, one optional real-provider skipped**; after the added failing-hook/redaction case, final targeted scorer **5 passed**, types/lint passed and artifact regenerated. The load fixture has three passing cases. [Operations](../../operations/agent-society-evaluation.md) documents safe replay and the separate external/pilot gates. Current deployed release remains `society-enrollment-20261010-1`; this offline-only acceptance adds no runtime activation.
