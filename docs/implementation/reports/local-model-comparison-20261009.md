# Five local-model comparison — 9 October 2026

PACT-139, founder-authorized downloads and five fresh accounts per recommended model, followed by a couple-hour observation. Interpreted as **five candidates, 25 new kingdoms, two hours of gameplay after provisioning**. This is an additional bounded run; the existing fifty-player continuous controller remains active and its counters/identities/deadline-free authorization were not reset.

## Final observation — completed at the original deadline

**PACT-139 is complete.** Run `model-comparison-mv0yortl-1a273d13` finished at **14:48:51.209 UTC / 16:48:51.209 Berlin**, 62 milliseconds after its persisted two-hour deadline. The last completed turn was at 14:48:49.996 UTC; the terminal journal exit is at 14:48:51.210 UTC, with no later journal gameplay. There were **555 reserved attempts, 553 accepted plans/completed turns, 38 committed actions and no pending commands**. The 1,000-attempt ceiling was not reached. The comparison Windows task is Ready, and its worker exited. Its identities, deadline, counters and terminal checkpoint remain preserved; it was not restarted or extended.

The original `PACT Full Game 50 Continuous` task remains Running with the same run ID and all fifty owners. Its continuing counters and deadline-free authorization were not changed. The comparison monitor is disabled after the committed final report. [Credential-free final metrics and scoped database observations](evidence/local-model-comparison-20261009-final.json).

### Observed game quality

| Model | Attempts / completed turns | Empty action plans | Committed actions | Owners with a commitment | Actual commitments |
| --- | ---: | ---: | ---: | ---: | --- |
| Gemma 4 12B | 115 / 113 | 54 (47.8%) | 6 | 3 / 5 | Four builds, one Court join, one contact request |
| Qwen 3.5 9B | 110 / 110 | 86 (78.2%) | 15 | 4 / 5 | Twelve builds, one Court join, two training batches |
| Granite 4.2 8B | 110 / 110 | 0 | 1 | 1 / 5 | One contact request |
| Ornith 1.5 9B | 110 / 110 | 39 (35.5%) | 10 | 5 / 5 | Ten contact requests |
| LFM2.5 8B | 110 / 110 | 22 (20.0%) | 6 | 3 / 5 | Two builds, three training batches, one contact request |

These are accepted plans and ordinary committed game commands, not proof of intelligence or completed strategic objectives. Of 389 action outcomes, 351 were unsuccessful. Empty action plans often requested additional reads: Gemma 53, Qwen 85, Ornith 38 and LFM one. Waiting can be legitimate, but no tested model demonstrated autonomous end-to-end negotiation. Nine owners made no commitment during the observation.

A read-only database snapshot at **15:04:05 UTC**, after the controller stop, confirmed all twenty-five kingdoms. It found thirteen completed building instructions and five waiting: Gemma two completed/two waiting, Qwen ten/two, LFM one/one. Waiting instructions include Hall II with unmet prerequisites and Mine/Farm III with Hall I. Normal engine settlement continues after the player controller stops; this snapshot does not timestamp every completion inside the experiment. Qwen's two and LFM's three training batches were completed, producing five ordinary Spearmen in total. Neither Granite nor Ornith started construction or training.

### Negotiation and communication

**There was no activated trade, changed counteroffer, direct-message dialogue, or completed negotiation to time.** Both supply and garrison contract counts are zero for any party in this cohort. There are no supply offers, installments, outgoing direct messages or incoming direct messages involving these owners in the scoped snapshot. Consequently negotiation duration is **not applicable**, rather than zero minutes or a fabricated average.

Thirteen normal cold-contact requests were committed: ten Ornith and one each Gemma, Granite and LFM. All thirteen remained pending at 15:05:42 UTC; there were no established contact edges. Eleven targeted another comparison owner and two targeted outside this comparison. The oldest request began at 13:02:59 UTC and the newest at 14:03:19 UTC, leaving approximately **45–106 minutes of unanswered outreach before the experimental deadline**. That measures waiting for contact acceptance, not a bilateral negotiation. Requests are subject to normal game expiry; stopping the controller does not cancel them.

The models proposed trade-related words and signatures without establishing the required exchange:

- Qwen proposed one supply offer, but it was denied and no offer row exists. It did not complete a contact or trade.
- Granite proposed 45 supply signatures. One owner repeatedly used the observed Court ID as an offer ID; another repeated a fabricated offer ID for all 22 turns. Both patterns failed instead of producing a contract.
- LFM repeated the placeholder-looking offer ID `0a1b2c3d-4e5f-6789-abcd-ef0123456789` for 22 signature proposals: twenty `INVALID_COMMAND` outcomes and two tick-pending outcomes.
- Ornith wrote more specific outreach, including a short trade trial and a grain-buffer idea, but repeated pending contact requests instead of progressing to accepted contacts, messages or executable terms. Its final notes claimed completed scouting/building and an already accepted peer; the journal and database show no such Ornith effects. Rich prose therefore did not establish reliable communication.

The initial contact cost caused stock denials, then some later requests succeeded as ordinary resources accumulated. Repeating `REQUEST_EXISTS` did not create another accepted edge or a dialogue. Correction after the communication diagnosis: the automatic start guide refreshes contacts and pending requests, with IDs/directions, every turn. Actual incoming message content requires selected Council/conversation reads; those extra reads arrive next turn. Missing acceptance is a model/social-workflow finding, not proof that requests were unavailable or the game cannot accept them. The run did not manufacture contacts or responses to guarantee a successful negotiation.

### Court, military and denial coverage

Gemma and Qwen each joined the existing open `qwen_mv0r3xnz` Court as an ordinary member. There were no cohort-created Courts, Articles or Chronicle publications. Court audit aggregates show two `court.join` rows for each joining owner because the current service records the internal join and outer command; the roster and committed receipts show **one membership per owner**, not four joins. Gemma later attempted `court.request` against this open Court four times and received `FORBIDDEN`.

There were **zero scout operations and zero cohort-led raids** in the database. Gemma proposed 24 scouts, Qwen nine and Ornith nine; all failed. Gemma repeatedly supplied duplicate/non-unit identifiers. Training success is separate from scouting/raid success, and the additional garrison, allegiance and publication paths were not exercised successfully. All 58 implemented command kinds remained available; no experiment setting disabled these mechanics.

Repeated mistakes were substantial:

- Gemma repeated one duplicate-unit scouting action fifteen times, another invalid selection six times and a blocked Mine III build eleven times. Its trader tried accepting its own real outgoing request eleven times (ten invalid outcomes, one tick-pending), rather than the recipient accepting it.
- Qwen repeated one unsuccessful scout request eight times and two busy construction requests twice each.
- Granite had 89 `INVALID_COMMAND` and nineteen `REQUEST_EXISTS` outcomes. It repeatedly confused a Court, an offer and a kingdom, and repeated a fabricated disband target 22 times.
- Ornith had 58 `REQUEST_EXISTS` outcomes, thirteen `INVALID_COMMAND` outcomes and eleven stock denials. A single identical trade-contact note hit `REQUEST_EXISTS` eleven times.
- LFM repeated an already invalid Farm II level fifteen times, one unaffordable training request nineteen times and an existing contact request eighteen times.

`INVALID_COMMAND` is a broad admission code: the server maps several missing-target, ownership/selection and business-rule errors into it. These counts must not be mislabeled as malformed JSON. More precise authorized denial details would help diagnose recovery; changing that interface mid-run would change the experiment and was not done. The synthetic owner path recorded 152 exact owner decisions and successfully committed protected actions; manual approval was not the cause of the widespread failures. Stock, prerequisites and ordinary authority checks remained enforced.

### Latency and shared GPU load

| Model | Median / p95 call wall time | Median / p95 model-load time | Median prompt / generation time | Median / p95 revisit gap |
| --- | ---: | ---: | ---: | ---: |
| Gemma | 8.33 / 23.69 s | 0.003 / 15.24 s | 5.55 / 1.96 s | 324.1 / 328.5 s |
| Qwen | 6.29 / 16.84 s | 0.003 / 12.96 s | 3.65 / 1.54 s | 323.6 / 331.3 s |
| Granite | 14.45 / 19.99 s | 10.59 / 14.32 s | 1.84 / 1.92 s | 324.7 / 333.1 s |
| Ornith | 7.95 / 19.48 s | 0.003 / 15.62 s | 4.33 / 2.30 s | 326.2 / 335.0 s |
| LFM | 2.26 / 12.23 s | 0.003 / 9.83 s | 1.08 / 0.91 s | 325.7 / 333.7 s |

These are separate percentiles of recorded call phases; they are not additive percentiles or pure token-generation benchmarks. Median input sizes ranged from 9,316 to 13,287 tokens. Granite's median load dominates its observed wall time. Other candidates also show substantial upper-tail loading, while warm calls have millisecond load times. The original fifty-owner worker shared the same GPU/Ollama throughout; independent worker calls can contend. No per-call GPU-residency/offload measurement was captured, so load timing demonstrates switching overhead but cannot quantify an isolated GPU contention penalty. All owners received roughly 22 turns; Gemma began a 23rd round, so raw attempt totals are unequal.

Gemma had one recovered `LOCAL_HTTP_500` at 12:54:57 UTC and a generic transport/result error at 14:48:51.168 UTC as the fixed deadline arrived. The latter is consistent with the runner's inference timeout being bounded by the remaining run time, but the journal does not preserve a more specific exception. It is not evidence of an extra post-deadline retry. Other candidates had no failed turns. No operational recovery, settings change, candidate substitution or restart was necessary.

See the subsequent [communication diagnosis](communication-diagnosis-20261009.md) for the request-direction trace, fresh-request correction and original-cohort unread backlog.

### Selection and limits

**Qwen 3.5 9B is the strongest candidate for another bounded gameplay evaluation in this tested configuration:** it produced the most actual construction, trained troops and joined a Court. Its 78.2% empty-action rate, busy-state loops and absent negotiations still prevent calling it a capable autonomous full-game player. LFM is the fastest measured candidate and produced some inexpensive effects, but its repeated placeholder signatures and stale-level requests make it an inadequate replacement on this evidence. Gemma made a few useful commitments but did not justify its larger hardware footprint here. Ornith's outreach language needs factual grounding and acceptance-state recovery. Granite's persistent ID confusion makes it the weakest tested player despite nonempty plans.

No automatic replacement of the continuous 4B model or new experiment is part of this report. A future founder-assigned evaluation should test fresh social/inbox reads, factual outcome grounding and recovery from specific denials, then compare reasoning settings with a preserved independent budget. This two-hour, five-role, non-thinking test establishes behavior under shared load; it does not rank the models' general capabilities or their best possible configurations. Missing military/publication/negotiation coverage remains a finding, not certification. PACT-139's downloads, stable identities, startup and final observation are complete; the 24 deferred production tasks remain deferred. Known Linear issue-limit means completion is recorded locally, with real evidence rather than a fabricated hosted tracker update.


## Historical startup and setup evidence

### Live startup verified — 12:55 UTC / 14:55 Berlin

All five downloads completed and all **25 distinct new kingdoms/accounts** are now playing in run **`model-comparison-mv0yortl-1a273d13`**. The persisted start is **12:48:51.147 UTC / 14:48:51.147 Berlin** and the unchanged stop is **14:48:51.147 UTC / 16:48:51.147 Berlin**. All twenty-five owners completed their first valid model turn by **12:53:30.165 UTC**, with no turn failure in the first pass. The startup status snapshot reported no pending command or currently failing owner. All five local weight digests and the five-by-five kingdom/model/role assignments are recorded in the [credential-free startup evidence](evidence/local-model-comparison-20261009-startup.json). A separate read-only VPS query at 12:55:07 UTC confirmed 25 existing kingdoms with 25 distinct account IDs from that manifest.

First-pass results, **not a model ranking**:

| Model | Valid first turns | Empty plans | Committed actions | Median inference, including load |
| --- | ---: | ---: | --- | ---: |
| Gemma 4 12B | 5 | 5 | None | 7.29 seconds |
| Qwen 3.5 9B | 5 | 2 | Three builds, one Court join | 5.69 seconds |
| Granite 4.2 8B | 5 | 0 | None | 14.85 seconds |
| Ornith 1.5 9B | 5 | 0 | None | 6.17 seconds |
| LFM2.5 8B | 5 | 1 | One build | 2.71 seconds |

Proposed training/contact actions encountered ordinary stock denials; other signatures, contacts, scouting and disband proposals were rejected as `INVALID_COMMAND`. Those are unsuccessful game decisions despite valid model plans. Granite's first-pass median model-load time was 10.87 seconds, demonstrating why shared-GPU loading must be separated from generation performance. The Qwen Court join is an actual model-selected committed command, unlike the earlier operator adapter probes.

Both Windows tasks remained Running. The original controller retained run `full-game-1791537512736-10b87b6c`, all fifty identities and its ongoing counters, with no currently failing owner in the startup evidence snapshot. Ollama at 12:54 UTC showed the original Qwen 4B and comparison LFM2.5 both GPU resident with 32K context; this snapshot does not establish every candidate's residency throughout the run.

No implementation fix, restart, setting change or deadline extension was needed during this startup observation. PACT-139 remains In Progress while the actual two-hour comparison is observed. Final comparative-quality evidence is pending. Earlier setup-only statements below record their original observations and are superseded by this live startup for current status.

At **11:38:10 UTC / 13:38:10 Berlin**, Windows task **`PACT Local Model Comparison 25 20261009`** was Running, with protected preparation state reporting Gemma download progress: 2,598,193,059 of 7,381,383,680 bytes for its main layer. This is a transfer observation, not completion of that model or all weights. Downloads, provisioning and live first-turn verification were **still pending** at that observation. No comparison kingdoms or game results are claimed by this setup report.

Task startup was verified through `preparation.json`, not inferred from registration alone. The hidden native Windows launcher calls `comparison.mjs --prepare-and-run`, supplies the founder authorization marker and native state directory, prevents idle system sleep and records errors privately. It is a limited current-user task, with login trigger, five failure restarts at one-minute intervals, one instance and no OS execution limit. The application supplies the finite gameplay deadline. The machine, logged-in account, WSL checkout and Ollama must remain available.

[Credential-free setup snapshot](evidence/local-model-comparison-20261009-setup.json) records later download progress and confirms that the original run still has the same run ID, fifty successful owners and no currently failing owners. It deliberately records no new comparison kingdoms or gameplay before provisioning.

The automatic pipeline:

1. Download missing local weights for `gemma4:12b`, `qwen3.5:9b`, `granite4.2:8b`, `ornith-1.5:9b`, `lfm2.5:8b`. Runtime-generated progress is credential-free. Each transfer is bounded to sixty minutes per attempt; ordinary Ollama partial downloads can resume on retry. All five weights must pass local preflight before provisioning.
2. Persist twenty-five random entry keys before any guest join. Provision five distinct normal kingdoms per model using the normal public guest/OAuth routes. A partial provisioning retry reuses its saved keys/kingdoms, without replacing failed identities. Pin every installed model's digest in the checkpoint/manifest. No stock, rules, game time or existing account data is changed for setup.
3. Once all identities are provisioned, persist `startedAt` and `endsAt = startedAt + 120 minutes` exactly once. A ready checkpoint cannot be reinitialized. The 1,000-attempt ceiling counts requests before inference, including failures; at five-minute minimum revisits the nominal twenty-four rounds need approximately 600 calls, with the extra ceiling providing a finite safety bound. Restart never resets the deadline or counters.
4. Run the existing full-game adapter over one serial comparison worker, routing each actor to its pinned model. Deadline/request-cap/STOP checks gate further inference and gameplay dispatch; inference timeout is bounded by the remaining run time. Uncertain commands retain their exact payload/ID and reconcile before further writes. The separate opted-in synthetic owner controller handles normal human-only gameplay decisions under founder consent, without changing mandates or bypassing stock, quotas, ownership or prerequisites.
5. Stop gameplay automatically at the original deadline or cap; retain the checkpoints and daily journals for analysis. Issued game obligations continue under ordinary engine rules after the client stops; the deadline stops the experimental player controller, not server settlement.

## Matched comparison and limitations

Every model receives the same five role instructions: production/prerequisite recovery, completed supply negotiation, Court coordination/publication, affordable troop/scouting strategy, and diplomacy/contact/error recovery. All 58 implemented game command kinds and authorized reads remain available. Fresh owners preserve default server mandates; exact exceptions use the existing normal owner path. No contacts, signatures, Courts or useful actions are manufactured as model successes. Players establish their own relationships. Peers include the 25 comparison kingdoms, so interactions across model groups are possible and must be identified in final analysis.

The first comparison deliberately holds inference settings constant: **32K context, 2,400 output tokens, `think:false`, temperature zero, ninety-second call limit and minimum five-minute revisit**. This compares deployed non-thinking player configurations; it does not test the candidates' best possible reasoning settings. Actual JSON/schema support, inference fit and first successful turns remain live observations to verify after downloads. Package availability alone is not integration certification.

The original 50-player worker shares the same GPU/Ollama and network. This is an operational comparison with background load, not a controlled hardware benchmark or 75 concurrent resident models. Loading/switching, context caching, CPU offload and turn-duration differences can affect throughput. Record per-model load/warm timing and actual revisit gaps. Unequal completed-turn counts must not be mistaken for unequal intelligence. Fresh starting states, role matching and broad mechanic availability improve comparability but do not guarantee enough two-hour samples of every mechanic.

Final analysis must separate valid JSON/turn success from useful committed actions, changed counterterms, bilateral contract activation, truthful messages, deadlock/expiry recovery, Court/publication/military effects, no-op loops and denied repeated commands. Read-only cohort database evidence should verify actual effects; avoid attributing the older finite adapter probes or overnight contracts to this experiment.

## Observation and operations

Protected state: **`C:/Users/ENDORFY/pact-model-comparison-25-20261009`**. Do not commit/copy `private-state.json`, cookies, entry keys, OAuth tokens, one-time invitation tokens or complete private journal content. `preparation.json`, later `manifest.json` and `status.json` are credential-free. `worker.log` is private diagnostics. Runtime accounts/digests/deadline are recorded in the manifest once provisioned.

```powershell
Get-ScheduledTask -TaskName 'PACT Local Model Comparison 25 20261009'
Get-Content 'C:\Users\ENDORFY\pact-model-comparison-25-20261009\preparation.json'
Get-Content 'C:\Users\ENDORFY\pact-model-comparison-25-20261009\status.json'
# Explicit permanent stop; do not remove STOP and resume this finite experiment.
New-Item -ItemType File 'C:\Users\ENDORFY\pact-model-comparison-25-20261009\STOP'
```

Thread heartbeat **`pact-five-model-comparison-observation`**, every fifteen minutes, was successfully created ACTIVE. It observes preparation/startup, handles actual failures within this assignment, records the first successful turn for all 25 owners, and produces/commits a final model-quality report after the real deadline. It stays quiet on unchanged/non-actionable state and disables/deletes itself after the final report. The worker owns the deadline independently; a delayed heartbeat cannot extend gameplay. No separate account or time limit was changed by the monitoring automation.

## Verification completed for setup

- **58 Node tests passed** across local/population harness suites, including new finite deadline/cap behavior, matched candidate roles, required authorization, partial-provisioning retry with the same 25 keys/identities, exact two-hour deadline, and refusal to reinitialize a ready checkpoint.
- **Seven targeted tests passed under native Windows Node 24**, covering comparison setup/recovery and existing continuous session/identity recovery.
- `npm run typecheck` passed. Biome checked the three changed/new runner files; subsequent final checks are recorded in the commit. Existing server gameplay implementation is reused; no backend deployment or engine-rule modification occurred, and gameplay integration suites were not rerun for this client-only setup.
- The existing 50-player run remains untouched. This ticket remains **In Progress** until actual local weights, 25 live owners and model startup are verified; comparative quality and the full two-hour observation remain pending. Known Linear free-issue-limit means local task/report tracking is used rather than inventing a hosted issue.

Next required evidence: all five pinned downloads, 25 distinct kingdom IDs with five model assignments, persisted actual start/deadline, first successful model turns, and the real completion report. Do not mark observation complete merely because the runner exists or the task is Running.
