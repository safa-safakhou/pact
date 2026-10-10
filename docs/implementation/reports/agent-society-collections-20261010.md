# PACT-145 — Collection planning extension

10 October 2026. The founder requested collection-based achievements, cosmetics, rare items and memorable battle rewards, then explicitly selected **expand the plan first**. This completes that planning extension; it does not implement or release new gameplay.

The [single integrated plan](../agent-society-plan-20261010.md#collections-and-the-human-experience) now combines communication, authentication, decision models/memory, runners and human collection design. Research notes cite official Guild Wars 2 and Sea of Thieves design material, publisher information for Schell and Salen/Zimmerman, and a primary human-motivation review. Book scope is described honestly; full-book reading and PACT user-study results are not claimed.

Proposed first catalog: four sets, sixteen pieces incorporating all eight existing achievement ornaments, eight new cosmetic-only achievements and four set-completion trophies. Conditions recognize reciprocal contact, changed terms that actually deliver, trading breadth, Courts, seasonal participation, renewal and battle participation/recovery. Original achievement Gem awards stay intact. Raw message counts, approval clicks, permission expansion and paid models earn no new rewards.

The same plan includes private event keepsakes, story interpretation versus engine evidence, account-bound cosmetic equipment, source privacy, retention/backfill and explicit specification corrections. Guaranteed/deterministic delivery is proposed first. Optional random campaign finishes are separately PACT-165, with a concrete review table, earned-only eligibility, independent post-combat RNG and persistent protection; no random mechanic is activated.

## Verified planning evidence

| Check | Result |
| --- | --- |
| `python3 docs/implementation/backlog.py render` / `check` | PASS: 165 unique tickets, acyclic dependencies, all 37 criteria covered, source snapshots unchanged |
| Snapshot/status inspection | All 144 historical tasks and thirteen unrelated earlier proposals unchanged; original runtime metadata unchanged. PACT-146–165 remain todo/unassigned/proposed_not_started |
| Local artifact/source checks | Local plan links resolve; mockup DOM IDs and sixteen piece IDs are unique; four sets present; extracted script passes Node 24 `--check`; `git diff --check` passes |
| Desktop browser, 1,360×920 | Kingdom entry, set progress, owned/locked/unusual/empty filters, optional pin, disabled locked-piece controls, local display preview and sanitized public-card preview pass |
| Mobile browser, 390×844 | Piece/detail/back navigation, defeat/recovery story and return to active agreement pass; no horizontal content overflow; final screenshot visually inspected |
| Communication linkage | Private piece link and return-panel link open Harbor's invented conversation; agreement panel shows active delivery and distinguishes discussion of renewal |
| Error logs | Empty browser error log |
| Rare-finish arithmetic | Weights 7,500/2,000/400/100 sum to 10,000. Exact rational mean Mythic interval is 26.0300 eligible draws with thirtieth-draw protection; long-run frequency 3.8417%, distinct from 1% base odds |

[Interactive synthetic mockup](../design/agent-society-communication.html), [desktop collection preview](../design/agent-society-collection-desktop.jpg), [mobile collection preview](../design/agent-society-collection-mobile.jpg). All names, exchanges, items and outcomes shown are invented. Preview controls do not equip items, publish cards, call a model or mutate PACT. Temporary tab/server closed and viewport override reset after checks. Responsive testing is not physical-device certification. No app build or gameplay integration tests were run because this turn changes planning documents and a standalone synthetic prototype only.

## Handoff

The existing communication-first order remains: PACT-146 is the first proposed implementation under a covering assignment. PACT-160–164 add collection specification, event/progress, deterministic keepsake/equipment, UI and offline evaluation. PACT-165 is an optional later rare-finish branch. Collections need explicit product/rules/privacy/asset corrections before implementation; this turn preserves specification hashes. A communication-only mixed-model pilot need not wait for a collection-enabled arm, which has separate evaluation/authorization prerequisites.

The original 24 deferred production tasks and historical terminal experiments remain unchanged. No game players, runner tasks, schedules or deployment were started. Known Linear workspace issue-limit rejection is recorded in the master plan; no new external issue synchronization is claimed. Completed verified planning changes are committed locally.
