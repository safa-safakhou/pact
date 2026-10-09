# Local-player reliability and negotiation verification — 9 October 2026

PACT-137 completes the founder's explicit follow-up to investigate, fix and verify the finished local-model experiment. Backend fixes are deployed as **`local-reliability-20261009-1`** at https://pact.tinyagenttools.com; deployment verification passed and the API, PostgreSQL and workers are healthy. The previous runtime was `council-20261008-2`. The local runner changes apply to subsequent authorized runs. No finished population run was restarted, extended or given a replacement budget. The October 4 capped experiment and 24 Later tasks remain untouched. Linear's known free issue limit remains unresolved; this report and PACT-137 are the local execution record.

## What the overnight run actually demonstrated

The original 50-owner run ended at **08:00 Berlin / 06:00 UTC**, with 2,969 model dispatch attempts, 2,867 successful turns and 4,164 committed commands. Three owners stopped after consecutive truncated responses; the other 47 remained eligible. These are historical observations, not corrected retrospectively. [Original final investigation](local-population-final-20261009.md).

All **272 contracts** created by that run have naturally expired, with **32,640 installments and zero settlement failures**. Due and delivered internal resource units match: iron 505,200, grain 492,600 and silver 82,200. This verifies funded, one-hour, no-bond reciprocal supply. It does not certify every game mechanic or a more strategic model.

## Negotiation, measured from receipts and server records

[Per-offer analysis and aggregates](evidence/local-reliability-20261009-negotiations.json) deduplicate committed command IDs and join offer IDs to authoritative contract creation. A genuinely changed counter compares canonical terms, including resource direction and rates; JSON field order does not count as a change.

| Observation | Count |
| --- | ---: |
| Offers created | 751 |
| Offers activated into contracts | 272 (36.2%) |
| Offers expired without activation | 479 |
| Counter commands / distinct countered offers | 91 / 67 |
| Counter commands that changed terms / distinct affected offers | 19 / 17 |
| Counter commands that left terms unchanged | 72 |
| Activated contracts with any counter | 32 |
| Activated contracts with a genuinely changed counter | **6** |
| Signature commands / repeated same-owner, same-version signatures | 1,077 / 73 |

Negotiation duration here means **wall time from initial offer creation to contract activation**, excluding offers that never activated. It does not mean contract duration, nor time spent reasoning. Five-minute polling establishes much of the observed delay.

| Activated group | Samples | Median | p95 | Maximum |
| --- | ---: | --- | --- | --- |
| All agreements | 272 | **5m 30s** | **14m 31s** | **30m 55s** |
| Any counter command | 32 | 13m 46s | 25m 30s | 30m 55s |
| Genuinely changed counter | 6 | **14m 26s** | 25m 30s | 25m 30s |
| No counters | 240 | 5m 12s | 11m 07s | 14m 31s |

All activated contracts last **one hour of game time**. A counter refreshes the offer's fifteen-minute expiry, so a negotiation can exceed fifteen minutes without violating expiry rules. There is no measured completion latency for the 479 unactivated offers.

Example `511b9511-cc4e-46bb-8bfd-ffb790b14632`: created 01:20:33.960 UTC, activated 01:46:04.008 UTC after **25m 30s**, final version 4. Terms moved from two grain for two iron per hour to three for three. There were three counter commands but only one changed terms, five versioned signatures and four messages between the pair during that interval. Message proximity alone does not prove the messages negotiated that particular offer; concurrent offers can overlap.

Example `1112924f-388b-42ea-a961-8a546e4abcc1`: activated after **5m 36s**, with a version-2 change swapping grain/iron directions at three per hour, two signatures and no messages between that pair in the measured interval.

The model made agreements, but substantive bargaining was sparse: only **6 of 272** agreements followed changed counterterms. No-op counters and redundant signatures inflated activity. The corrected runner prevents unchanged counters and signing a version already signed by that owner; it does not force unnecessary bargaining or imply that the resulting trade is economically optimal.

## Diagnoses and repairs

1. **Truncated model output:** 99 overnight responses hit the 600-token output ceiling; three owners eventually blocked. New-run default is 1,000 tokens, with short bounded planning text, reasons and messages. Partial JSON remains inadmissible. Failures retain safe token counts, completion reason and response length for diagnosis, without logging partial text or credentials. Existing saved configurations remain immutable.
2. **Quota/inbox repetition:** 320 rate-limit and 190 queue-full denials were legitimate server enforcement. Persisted client history now paces contact, supply and message groups, backs off saturated recipients and suppresses repeated messages. Conversation polling rotates across all contacts. Cooldowns use game time and survive reload. A rate-limit denial conservatively backs off for a game day because prior runs can have consumed quota; this may underuse available quota. Client estimates never grant server authority or claim exact remaining quota.
3. **Construction dead ends:** 16 cohort queues were waiting: **13 had missing Hall prerequisites**, while **three Hall-II queues were legally queued but lacked stock**. Stock affordability alone had admitted prerequisite-blocked choices. Both schema generation and fresh validation now call the domain's `checkUpgrade`; the server's lawful waiting-queue behavior and economy are preserved.
4. **Six generic signature errors:** reconstructed active-contract intervals show that five occurred with a participant already at the **eight-contract cap**. The sixth offer closed at 04:50:56.724 UTC between the read/request and the denial at 04:50:59.747 UTC. Expiry used to fall through to generic closed-offer handling after the worker marked it expired. The backend now consistently returns `EXPIRED`; capacity and other closed-offer failures carry restricted recovery details. Fresh runner checks suppress expired/own-signed offers and known local saturation, and denial backoff handles counterpart capacity that the actor cannot privately inspect. [Reconstruction](evidence/local-reliability-20261009-signature-diagnosis.json).
5. **Misleading turn counters:** historical `turns` includes failed attempts. Status/audit now distinguish scheduled attempts, successful turns and failed turns, preserving old counts and deriving missing counters from recorded events for nonterminal recovery.
6. **One Ollama HTTP 500:** the local log identifies a transient `/tokenize` connection failure at 01:36:23 UTC; the next inference succeeded two seconds later. This was not an approval blocker. Failed calls consume their reserved request allowance and no action is admitted from a failed response.

Under this new repair authorization, the operator canceled the **13 prerequisite-blocked synthetic queues** through normal authenticated human commands: no stock was charged or minted. A tick-pending response was recovered using the same command ID and payload within the original two-minute/16-cancel bound. [Cleanup receipts](evidence/local-reliability-20261009-repair.json).

The original run's exact 125 building IDs now comprise **119 completed and six canceled**. The other seven canceled queues came from earlier capacity/pilot activity. Across the retained cohort, three legitimate stock-waiting queues remain; cancellation is cleanup, not completed progression. [Exact run state](evidence/local-reliability-20261009-run-buildings.json), [whole-cohort state](evidence/local-reliability-20261009-post-repair.json). The original final report's earlier snapshot remains historically correct.

## Verification and coverage

Three inference-only replays each used the same 48 recorded synthetic prompts: the largest 16 and 32 spread across the successful overnight results. They use the original Qwen3.5 4B Q4_K_M digest, 16,384 context and 1,000 output tokens. They import no game client, create no accounts, perform no approvals and dispatch no game actions. Total verification inference: **144 attempts**, separate from the closed experiment.

- Initial compact replay: **44/48** valid, zero truncations; four unchanged counters exposed a grammar weakness.
- Restricted counter grammar replay: **48/48**, zero truncations; inspection then found it unnecessarily restricted changes to one flow.
- Final grammar allows both reciprocal flows to change: **47/48**, zero truncations, mean inference **3.536s**, p95 **5.154s**. One plan invented an unobserved offer ID; the fresh validator rejected it before any write. This remains a model-quality limitation, with an effective fail-closed safeguard.

[All replay samples, stage configurations and results](evidence/local-reliability-20261009-replays.json). These samples exclude failed overnight payloads, which were not retained, and do not repeat a five-hour load test or establish a new 50-owner capacity estimate at the larger token ceiling.

A zero-inference public-interface probe created two new synthetic owners, bounded to two minutes and 40 direct dispatch attempts. It finished with **19 checks**, 13 direct attempts and two separate bounded owner decisions. It verified changed counterterms, invalidated old signatures, an agent authority denial, an exact human signature approval, same-ID receipt recovery, queue-full rejection/backoff, reads freeing inbox capacity and a separate exact human Farm-II approval. The restricted mandate remained unchanged. [Live probe](evidence/local-reliability-20261009-live-probe.json).

At **08:23:51 UTC**, that Farm-II upgrade was completed and the ordinary one-hour probe contract was active with **42 installments, zero failures and zero live write leases**. It will finish through normal game jobs; no model loop remains active. [Follow-up server observation](evidence/local-reliability-20261009-probe-health.json). A separate post-deployment read/sign probe returned `EXPIRED` without creating a receipt or commitment. [Deployed expiry verification](evidence/local-reliability-20261009-expiry-probe.json).

| Path | Overnight evidence | Additional verification / remaining limit |
| --- | --- | --- |
| Building queue, progress and completion | 125 queues, 119 completed | Legal dependency ladder through VI, free waiting cancellation/refunds tested; live prerequisite cleanup and Farm-II completion |
| Cold contacts and acceptance | 239 requests, 238 owner answers | New live owner invitation/acceptance; resource/quota/ownership regression checks |
| Messages, full inbox, reads | 1,643 messages, 190 queue denials | Live four-message saturation, fifth denial and read freeing capacity; persisted recipient backoff and rotation tests |
| Offer, counter, versioned signatures, activation | 751 offers, 91 counters, 272 contracts | New live changed counter and stale-signature rejection; version/race/atomic bond activation tests |
| Expiry and eight-contract cap | Five capacity denials and one expiry race | Live deployed `EXPIRED`; exact-expiry and ninth-acceptance rollback tests |
| Stock, spend floors, quotas and private ownership | Normal denials enforced | Shared allowance/floors, rollback, cross-owner rejection and no incoming-credit recycling tested; no grants or stock minted |
| Owner exceptions and approval proposal | No overnight exception approvals | New real exact supply and building decisions through separate human sessions; authority never expanded by agents |
| Settlement and natural expiry | All 272 contracts, 32,640 installments, zero failures | New probe installments; six-hour 360-installment/default/bond/refusal/notice/mutual-release tests |
| Crash, retries, response uncertainty, deadline | Controlled pause/resume and deadline stop | Harness idempotent reconciliation/locks/bounds tested; cleanup recovered tick-pending same ID; no new production crash/chaos exercise |
| Model shape and unavailable actions | 99 truncations, local action rejections | Compact schemas and 144 replay attempts; remaining invented-ID plan rejected; no promise of perfect model decisions |
| Garrison, raids/combat, Courts, Seals, ranking and long-duration strategies | Outside this peaceful local-model scope | Not certified by this run or this follow-up. Missing live exposure is a coverage gap, not evidence that it is broken |
| Consumer-host compatibility, adversarial multi-day play and human enjoyment | Not measured | Remain unverified; deferred roadmap scope is not reopened |

Commands and actual results:

```sh
node --test scripts/local-population/*.test.mjs scripts/population/*.test.mjs
# 43 passed; 8 new reliability cases also passed under native Windows Node 24.
npx vitest run --config vitest.config.ts packages/application/src/admission-errors.test.ts
# 11 passed.
npx vitest run --config vitest.integration.config.ts \
  tests/integration/supply-offers.test.ts tests/integration/authority.test.ts \
  tests/integration/social.test.ts tests/integration/authority-exposure.test.ts \
  tests/integration/buildings.test.ts tests/integration/supply-settlement.test.ts \
  tests/integration/game-command-social.test.ts tests/integration/mcp-approval-inbox.test.ts
# 87 passed across 8 files, 13.66 seconds, final rerun.
npm run typecheck
npm run build:packages
# Both passed. Full production release build/migration/privacy replay and verify.sh passed.
```

The first integration pass caught an outdated assertion expecting the old generic closed-offer error. It was changed to the intended `OFFER_EXPIRED` contract and the full targeted suite reran successfully. Targeted Biome checked 30 files without changes. Planning render/check passed for 137 unique tickets with acyclic dependencies, matching source snapshots and all 37 release criteria covered; `git diff --check` passed. PACT-137 explicitly depends on the completed PACT-053 rules gate and PACT-135/136. No hosted CI result is claimed.

Production source archive SHA-256: `022ad7d361086290ac6d52a89b5b1c8b50785f263e8e08c0cf9704b993fbf656`. The immutable backend release contains the deployed server changes; later local replay/operator/report refinements are included in the repository follow-up. Production `verify.sh` passed again after the probes. The founder subsequently requested local commits for all completed changes; this report is included in that checkpoint. No push was performed. Earlier evidence records preserve their pre-commit observation state.

## Operational outcome

The observed runner weaknesses have tested safeguards, the actual backend expiry defect is deployed, and blocked synthetic construction has been cleaned up. Useful negotiation occurred, but deeper bargaining and strategic coverage remain weak. The completed 50-owner task remains terminal and no new population experiment is active. A further endurance/strategy experiment would be a new explicitly bounded assignment; there is no automatically selected next ticket or automatic budget rollover. Credentials and latest refreshed sessions stay only in owner-protected native state, never in these evidence files.
