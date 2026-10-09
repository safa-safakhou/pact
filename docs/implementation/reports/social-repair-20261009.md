# Social workflow repair — PACT-141, 9 October 2026

The founder authorized fixing the diagnosed communication problems and a short live verification. This repairs Council read acknowledgment and the full-game synthetic controller without changing the economy, message caps, game ownership or human-only command authorization.

## Implemented behavior

Council thread delivery now acknowledges only authenticated incoming rows in the returned forty-message page. The forty-first lookahead, omitted older rows, outgoing messages and unrelated pairs are untouched. Repeated reads preserve the first acknowledgment time. A queue-full pair can send again after its recipient actually reads the backlog.

Before every model decision, the full-game controller reads the normal authorized Council view, saves incoming message work in its protected checkpoint and presents a compact social priority queue outside general observation paging. Incoming requests include exact accept/reject actions; outgoing requests are explicitly waiting on another owner. Failed replies retain pending work. Committed replies resolve it. A committed contact/message/offer mutation refreshes social facts before the next action in the same plan. Guards reject fabricated/outgoing acceptances, messaging noncontacts, duplicate committed messages and unchanged denied social actions with recovery guidance. Safe server recovery text is retained. The synthetic-only prompt explains the already-authorized exact owner bridge; normal guides and server permissions remain intact.

## Verification completed before deployment

- Kingdom build and repository typecheck passed.
- Fifty-nine integration tests passed across Council, social, game-command-social and MCP approval/inbox suites. Coverage includes ownership, pagination, idempotency, queue recovery and exact human authority/replay behavior.
- Sixty-two Node runner/client tests passed; seven targeted tests also passed under native Windows Node.
- Biome, planning validation and whitespace checks passed.

## Production and live observation

Release `social-repair-20261009-1` deployed successfully; production verification passed at approximately 16:17 UTC. No schema or economic changes were introduced.

The existing `PACT Full Game 50 Continuous` worker was interrupted and reloaded from its existing protected checkpoint. Its run ID and all fifty kingdom IDs matched the before snapshot. Requests increased from 3,692 to 3,704 rather than resetting; no command was pending at the before/after snapshots. At 16:19:53 UTC, eleven post-reload completed turns had committed nine messages and six correct contact acceptances. These are actual receipts, not statements of intent. A scoped database snapshot at 16:19:03 UTC found 175 unread messages versus 201 in the earlier diagnostic snapshot; intervening activity means this difference alone cannot all be attributed to the fix.

A separate two-player Qwen3.5 9B run started at **16:17:33.361 UTC**, with a persisted deadline of **16:37:33.361 UTC**, sixty attempts maximum and sixty-second minimum spacing. Protected state: `C:/Users/ENDORFY/pact-social-verification-2-20261009`. It uses two new normal kingdoms, ordinary earned resources and model-selected actions; no contacts, stock or successful dialogue were seeded. The completed twenty-five-player comparison remains terminal and untouched. The original fifty-player worker remains independently continuous.

**Final observation:** the verification finished at **16:37:33.397 UTC**, 36 milliseconds after its persisted deadline. It consumed 36 of sixty attempts, completed 35 valid model turns and produced fifteen empty plans. The last inference failed at 16:37:33.365 with the generic recorded `TRANSPORT_OR_RESULT_ERROR`, immediately at the deadline; no pending command remained. This timing is consistent with the bounded inference abort, rather than evidence of an earlier operational outage. The worker exited and removed its lock. The terminal checkpoint will not be resumed.

The pair committed one introduction at 16:35:50.618 and the correct recipient acceptance at 16:36:30.852: **40.234 seconds** from request to acceptance. The database confirms one accepted contact. It sent **zero messages**. Contact was established only in the final minute, limiting the fresh-pair dialogue observation.

It committed four supply offers and six signatures, activating three one-hour game-time contracts. All three repeated the same 20 Iron/hour for 22 Grain/hour terms; none was countered or negotiated through messages. Offer-to-activation wall times were **67.970, 456.610 and 101.483 seconds**. Activation therefore proves bilateral command execution, not substantive bargaining. The fourth offer remained open.

Earlier snapshots had active contracts and no installment failures. **The final database snapshot supersedes that preliminary health assessment:** all three contracts had defaulted, with six `insufficient_stock` failures among 38 installment records. Aggregate delivered marked units were 3,960 Grain and 3,600 Iron; due amounts were 4,180 and 3,800 respectively, with zero overflow. Repeated obligations outgrew available stock. The models still fail to manage cumulative commitments reliably; successful JSON and signatures do not make them dependable traders. The controller did not forgive or seed these obligations.

Local guards rejected one fabricated/nonincoming acceptance, three premature messages and five exact previously denied signatures. The engine additionally rejected three signatures and one offer. Model-selected development, Court and military actions were absent in this deliberately social verification. Their availability and authority regression coverage are separate from exercised live coverage.

The 50-player controller, sampled at 16:37:54 UTC, completed **125 post-reload turns across all fifty owners**, with **144 committed messages from 37 owners**, eleven correct contact acceptances and four successful signatures. Thirty-eight plans were empty. There were no post-reload failed turns, current failures or pending commands at this snapshot. Requests reached 3,820 with the original run, owners, Qwen3.5 4B model and continuous authorization preserved. Wrong-request, duplicate-message, stale/expired signature and unchanged-denial guards/refusals remained active. Two proposed counters returned `INVALID_COMMAND`; another was suppressed as a repeated denial. No successful counter is established by this observation.

At 16:37:56 UTC the original cohort had **54 unread messages and three full directional queues**, versus 201 and 22 in the earlier diagnosis. Its 264 internal contacts compare with 263 earlier. Messages continued arriving during measurement; these are changing snapshots, not a controlled attribution of every read to one route. Together with actual receipts, they establish restored servicing and communication without removing anti-spam limits.

Message review found concrete rates, refusals and contract-status discussion alongside repeated confirmations and claims not established by associated receipts. There were 124 distinct texts among 144 committed messages. Text uniqueness is not a quality score; accurate negotiation remains a limitation. The repaired workflow gives models the relevant facts and preserves unread work, but does not guarantee factual reasoning.

Qwen 9B inference p50/p95 was **7.605/10.228 seconds**; full-turn p95 was **11.763 seconds**. The concurrent original 4B worker had **7.987/12.441 seconds** inference p50/p95 and **13.819 seconds** full-turn p95. They shared the GPU. The 9B initial load reached 8.480 seconds; subsequent load p95 was 18.397 milliseconds. No isolated control was run, so shared GPU contention cannot be quantified separately from these observed latencies.

During the active verification, a follow-up corrected reply bookkeeping: only incoming IDs explicitly placed in the priority prompt can be marked responded. Omitted messages and messages received during same-turn refresh remain pending. Sixteen targeted tests passed on both Linux and native Windows, including this failure case. Both controllers reloaded with identities/counters intact; the verification's original deadline and attempt ceiling were verified unchanged. Implementation commits: `b439754` and `a4dc043`. [Sanitized final evidence](evidence/social-repair-20261009.json).

## Operational boundaries

Private state, tokens and message bodies stay in the owner-only native directory. Published evidence uses receipt counts and scoped database aggregates. The short verification cannot reset a terminal checkpoint or extend its deadline. Its accelerated interval applies only to these two new accounts. See [operations](../../operations/local-population.md) and the [diagnosis](communication-diagnosis-20261009.md).

PACT-141 is complete for the implemented repair and its bounded observation/reporting criteria. The remaining model reasoning, repeated obligations and bargaining failures are explicitly unverified quality improvements, not a claim that autonomous gameplay is solved. No new model comparison or economy adjustment is authorized by this result. No deferred production task is resumed. Hosted Linear tracking remains subject to the previously observed workspace issue limit; the local ticket is the durable execution record.
