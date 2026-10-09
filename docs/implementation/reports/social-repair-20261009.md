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

**Observation in progress:** both verification owners completed initial real model turns. One fabricated incoming request ID and proposed messaging before contact; both actions were rejected locally. A supply offer was committed. These early results do not yet establish successful introduction, dialogue or contract activation. Final metrics and limitations will be appended after the fixed observation ends.

## Operational boundaries

Private state, tokens and message bodies stay in the owner-only native directory. Published evidence uses receipt counts and scoped database aggregates. The short verification cannot reset a terminal checkpoint or extend its deadline. Its accelerated interval applies only to these two new accounts. See [operations](../../operations/local-population.md) and the [diagnosis](communication-diagnosis-20261009.md).

PACT-141 remains in progress pending final short-run observation. No deferred production task is resumed. Hosted Linear tracking remains subject to the previously observed workspace issue limit; the local ticket is the durable execution record.
