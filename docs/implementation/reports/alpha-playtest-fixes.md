# Alpha playtest fixes — implementation batch

Tickets: PACT-100–108 (MNI-159–167). Assigned to Mohammad Safakhou / Codex on 2 October 2026.
Implementation: uncommitted working-tree changes; no push/PR or hosted CI claimed.

**Final: all nine tickets verified.** Hosted snapshot **alpha-20261002-7**, SHA-256
`a8c3d6b4c8efec8f57277512f7359389692a3a45c0bc3dbfc4ed3a7763d6ba32`.
Final checks: 222 unit, 288 integration passed (one optional skipped), build/type/lint passed.
See [fresh final retest](alpha-three-player-retest-20261002.md) for actual gameplay,
15 Luna turns, browser checks, recorded failures and complete six-account cleanup.
First hosted snapshot: `alpha-20261002-1`, base HEAD `48002bbe51a2c2c9014ebe5ef997121f2a833d21`, source manifest SHA-256 `7220952cb30fb6eeb3437a39f420a0540f810b7076d70526ef6a2ec60752cdaa`. This digest identifies a source snapshot, not a Git commit.

## Verified initial fixes

| Ticket | Acceptance evidence | Actual result |
| --- | --- | --- |
| PACT-100 | `review-link.test.ts`; shared approval/command integration tests; hosted MCP proposal + status and new unauthenticated Playwright context | Root and `/pact` link construction passes. Both hosted tools returned `/pact/?approval=59fa5807-6bd5-4f7a-a689-f54a9955c172`. Fresh browser required owner sign-in, preserved the query, preselected the exact ID, required Preview and explicit Approve, and committed Farm II once with command `4c1547c2-353a-4516-b27d-bdddddf514ae`. Wrong-owner, expiry, agent authority, replay and rollback checks pass locally; no hosted expiry fabrication. The immediate first-frame screenshot/text preceded React rendering, so login evidence is the awaited successful Email/Password interaction. |
| PACT-102 | Agent read contract tests, world-view integration ownership tests, MCP bad-field/forecast tests, receipt ownership/replay tests, Luna diagnostic turns | `{}` selects the authenticated owner; target-based contact/public views retain boundaries and no private balances/builders. HTTP target-required published schema is unchanged. Invalid ownership/field text is not echoed, 1–60 forecast bounds have safe corrections, unfounded owner returns no view. Missing receipts explicitly explain deterministic rejection versus uncertain same-ID recovery. Across three hosted Luna turns, all five world reads completed without supplied UUIDs/coaching. |
| PACT-103 | Pure rules affordability/ledger tests; owner guide unit checks; shared game integration tests; Juniper second and Willow first live turns | Farm II and Mine II committed using restricted construction allowance. Both agents distinguished that stock from ordinary Silver needed for contacts. Willow received INSUFFICIENT_STOCK on contact and stopped without asking for a resource-creating approval. No extra approval was requested for either permitted build. Start lessons explain Grain supply reserve safety and upkeep-only food; proposals reserve nothing, signing reserves authorized exposure, and two same-version signatures activate. Incoming acceptance remains human-only. |

Evidence: [initial hosted diagnostic](evidence/alpha-followup-initial-20261002.json). These are assisted checks of the first fixes, not the final PACT-108 journey or human enjoyment research.

## Checks

`npm run build`, `npm run typecheck`, `npm test` (217 passed), `npm run test:integration` (285 passed, one existing skipped) and `npm run lint` passed on the initial implementation. All 26 published v1 schema fingerprints remain unchanged. Focused checks include self identity, owner/public boundaries, bad input, exact review, retry and rollback. `python3 docs/implementation/backlog.py render/check` passed; rerun after tracker edits.

The existing VPS encrypted backup completed (`91116b5a`) before deployment. `deploy.sh ... alpha-20261002-1` and `verify.sh infra/production/vps-connection-test.env https://safa.dedyn.io/pact` passed. An initial verify invocation omitted its required URL and returned usage; the corrected invocation passed. Browser checks encountered transient HTTP 502 during container replacement; subsequent normal reads recovered. No database reset, stock injection, artificial hosted time acceleration, paid infrastructure or tester contact occurred.

## Setup and usage observations

Three new synthetic owners (Juniper Reach, Willow Crossing, Slate Hill) used mandatory captured-email verification with internal operator delivery, separate PKCE/DCR grants and normal human authority controls. Codex `mcp add` starts OAuth immediately; its DCR flag must be supplied there too. OAuth login rotates the browser cookie; an existing PACT tab must use Switch test player and sign in again before writing with a fresh CSRF token. These recoveries were exercised and are being incorporated into PACT-101 documentation/UI before its closure. No secrets are included in evidence.

The three diagnostic turns used 786,288 input tokens, 694,272 cached input and 3,594 output (Codex-reported, including host context). The prior 12-turn test used 4,227,937 input / 3,834,368 cached / 18,407 output. Different goals and turn counts prevent a causal cost comparison; no dollar saving is claimed. Some Luna narrative units/rates remain imprecise even though server projections and arithmetic are correct; capture this in the final checkpoint.

## Documentation and remaining batch

Updated [MCP API](../../api/mcp.md), [private Alpha setup](../../operations/alpha-start.md), [Codex playtest](../../operations/codex-playtest.md) and [active plan](../alpha-playtest-fixes.md).

PACT-101 is verified in the corrected setup-panel deployment. PACT-106 has local committed-clock tests and awaits hosted desktop/phone observations. PACT-104 is verified: completed builds and actual delivery are visible through normal owner/agent views. PACT-105 then reconciles external activity; PACT-107 reorganizes the phone flow; PACT-108 repeats the full fresh journey after all fixes. These remain incomplete until their own acceptance evidence is recorded.

## PACT-101 verification

All three fresh synthetic owners completed captured-email verification and DCR/PKCE consent with separate accounts. Codex add (with DCR and canonical resource) exited 0 for each. After normal same-owner browser reauthentication, authority presets saved and permitted agent writes committed. Release `alpha-20261002-2` shows each authenticated handle and external grant status, canonical copyable commands including immediate-login DCR, unsupported-version guidance, and revoke/reconnect/recent-auth instructions without requiring a saved model key. Secret values remain only in mode-0600 temporary operator files and OAuth’s normal local credential store. Internal Mailpit was read through authenticated SSH; no public access or verification bypass was added. The original 0.144.4 failure remains documented; no other host/client/SMTP route is certified. All five acceptance items pass with the explicit private operator/browser assistance described above.

Second test release source snapshot: SHA-256 `b775ff14109dcad3d048e892277e7acea7f19e1ef24b9b6ade42bab536f1d357`, same base HEAD, uncommitted. Backup `a3a4fd7d`; deploy and public verification passed. PACT-104 focused tests passed 47; full integration now 286 passed / one existing skipped. Unit display tests now 219 pass, including one-hour game offset, completed build, no invented deliveries, exact amounts/overflow/default display. Type and lint pass.

## PACT-104 verification

All five acceptance items pass. On alpha-20261002-2, normal owner world reads and Luna agree that Juniper’s Farm II and Willow’s Mine II completed. Willow discovered Juniper’s real public notice and sent a stock-funded contact request; Juniper’s human accepted in People. Their agents negotiated an unsigned 1 Grain/h for 1 Iron/h offer (ID `8c79b233-3d49-41a9-9bef-1a8947d99dae`, version 1), signed separately and activated contract `d6954217-6014-48f5-9498-d97a94625ab4`. Normal owner projections showed two signatures, active status and the first actual 10 marked units delivered in each direction, no failure or overflow. Luna’s current read reported those same quantities and finished Farm II; no database access was needed. Unsigned offers never appeared in the contract/delivery list.

The repeatable-read projection sums existing installments without persisting new state. Tests cover a completed build, exact due 100 / delivered 50 / overflow 10, partial failure, repeat reads and private owner/outsider boundaries. Existing settlement/replay/rollback tests continue passing. The history’s empty inbox message now labels notification history separately from build/contact/trade evidence. Existing module export/erasure/retention remains responsible for the authoritative tables; no additional view cache or retention category exists. [World-view module docs](../../architecture/world-views.md) describe units, overflow, bounds and privacy.

Evidence: [owner and agent consequences](evidence/alpha-followup-consequences-20261002.json). These diagnostic players precede the final PACT-108 fresh journey. No completed contract duration or human enjoyment is inferred from these first deliveries.

## PACT-106 — remaining game time

Replaced wall-date deadlines for builders, training, supply/garrison contracts,
scouts and raid resolution/locks with one helper using the projection's committed
game time. Historical and forecast absolute dates are explicitly labeled game
time. Active readings say “as of last refresh”; paused readings hold their clock;
offline projections retain the existing stale banner. Rendering cannot mutate time.

Acceptance: hosted alpha-20261002-2 desktop and 390px phone both showed **59m game
time remaining** for the new one-hour Juniper/Willow contract while the world was
about 57 minutes behind wall time. The recorded People text and geometry are in
`evidence/alpha-followup-timing-20261002.json`; phone width equaled document width
390, desktop 1280. The phone screenshot confirms the owner consequence section;
this is viewport emulation, not physical-device certification. Offset, paused,
reached-boundary and missing-clock unit cases passed in `game-time.test.ts`.
Pause/resume display semantics were checked locally; the live world was not paused
for testing. Tests at this stage: 221 unit tests, 287 integration tests passed,
one integration skipped. Operations instructions updated.

## PACT-105 — activity ordering and current state (verification underway)

Numeric bigint ordering now selects the latest 50 IDs before presenting history
chronologically. Current facts separately reconcile owned builds, human contact
requests, supply offers/contracts and exact approval status. Completed/resolved
records stop advising the owner to wait for signatures or approvals. Unsupported
record kinds remain unknown; reconciliation failures preserve history as stale.
The reusable run package receives an injected resolver and knows no PACT types.
Owner states use transaction-bound game time and never expose message bodies or
another owner's private records. Existing retention continues to cover history.

Visible Envoy reads poll serially every ten seconds and stop on hide/unmount.
Network failures keep displayed history marked stale, and refresh cannot start
inference. Meaningful checks passed: numeric IDs 9/10/99/100 on PostgreSQL, current
completed/active records with outsider denied, resolved approval removes its
review link, and fake-clock hide/resume/dispose/no-overlap behavior. Build, types,
lint and 221 unit / 287 integration tests passed (one existing integration skipped).
Hosted acceptance is recorded below after alpha-20261002-3 verification.

Hosted acceptance passed on **alpha-20261002-3**, source SHA-256
`a9cc1b4c569f7867269467bb39020aa3da938d22f15b545662459252d45e167e`
(uncommitted, same base HEAD). Backup `dbbd9910`, deploy/public verification
passed. Normal owner activity showed Juniper's completed Farm II, Willow's
completed Mine II and accepted contact, the active signed offer/contract, and
Slate's approved exact request without a remaining review link. Three automatic
reads per observed Envoy session occurred without clicking refresh. Phone offline
simulation retained history marked stale; reconnect cleared the stale state.
`evidence/alpha-followup-activity-20261002.json` contains the normal owner responses
and browser text. An additional PostgreSQL accepted-contact/outsider check passed
(11 focused world-view tests). These reads made no model calls. PACT-105 is Done.

## PACT-107 — primary player flow (verified)

Envoy now starts with the owner's external connection, compact next decision,
expandable authority/exact-review/account controls, then latest activity. Optional
in-app provider forms and older history/raw references are expandable. People
starts with contacts/negotiation and owner consequences; Courts/allegiance/invites
remain available afterward. Chronicle starts with private actual consequences;
public/evidence publishing remains available separately. Deep-linked advanced
features open their containing section. Exact decisions use readable outcomes,
with full references accessible separately. Account now exposes Sign out everywhere.

On alpha-20261002-4, keyboard Enter activated all three tabs and the setup summary
at desktop 1280px and phone 390px. Both document widths equaled viewport widths.
Phone Envoy height fell from the original 6437px to 2632px; connection began at
495px, next decision 890px, activity 1233px (original activity 2601px, instructions
5082px). Contacts precede advanced society; private consequences precede public
publishing. Exact link from a signed-out fresh browser preselected the correct
request and showed its effects. Human Reject produced a readable rejected status,
without a persistent JSON notice; actions were then disabled. Activity reconciliation
can lag up to ten seconds; its checked time is now displayed explicitly.

The measured phone screenshot revealed that expired access tokens were incorrectly
reported as absent connections despite valid refresh credentials. Corrected through
an injected OAuth-owned metadata port; no cross-module token query or secret is
returned. PostgreSQL checks cover owner separation, expired access with valid refresh
and used-refresh exclusion. Final hosted recheck follows on alpha-20261002-5.

One extra diagnostic Luna turn queued a permitted Wall II when asked to request
approval, then falsely described approval to “keep” it. The queue was real and
permitted; its later sentence was not a server-issued approval. This model error
remains visible in evidence. The real exact-review UI was independently checked
with an issued Wall III proposal and human rejection. Models remain untrusted.

Final PACT-107 acceptance passed on **alpha-20261002-5**, source SHA-256
`00a0b5e4fc1a69d1f2104a15cd2cbcd743768f48b7a3d990970c7d92fe3b222f`
(uncommitted, base HEAD unchanged). Backup `f9abaf4a`, deploy/public verification
passed. Rechecked both sizes: external grants correctly remain visible as one
revocable connection despite expired access. Final phone Envoy height **2848px**,
connection **495px**, next decision **1018px**, activity **1361px**. No unrelated
provider/raw forms precede progress. The increased metadata height versus release
-4 is recorded, not hidden. All tab/summary Enter checks and width checks passed.
Owner exact rejection is readable and the resolved request reconciles on the next
bounded read. `evidence/alpha-followup-layout-final-20261002.json` and the final
phone screenshot preserve observations. Full build/types/lint, 221 unit and 288
integration tests passed, one optional integration skipped; final changed-web
build/type/unit checks also passed. PACT-107 is Done. PACT-108 was subsequently completed as recorded below.

### Timing correction found during PACT-108

The fresh Alder model correctly reported a pending Farm II but misstated its UTC
calendar deadline (17:59 instead of the owner projection's 17:09). Brook's 17:10
was correct. Added explicit `remainingGameMinutes` to authorized owner builders
and build/supply consequences, using the same snapshot game clock. MCP/lessons
now direct agents to these durations rather than invented calendar conversions.
Waiting unknown deadlines remain null; zero is not proof of settlement. PostgreSQL
one-hour future/current-completed checks passed (11 world-view tests), plus full
build/type/lint and 221 unit tests. This acceptance correction is deployed and
retested within PACT-108; no economics, stock, authority or clock mutation changed.

### Direction and decision-owner correction found during PACT-108

Brook signed the genuine version-1 offer but described its direction backward:
Alder sends Iron and Brook sends Grain. Added exact owned `youSend`/`youReceive`
fields to social/world/consequence projections and owner lessons. Also labeled
incoming/outgoing contact acceptance as this owner/counterparty owner. Initial
Cinder/Alder handoff wording wrongly asked the requester to accept the recipient's
incoming request; the actual UI already correctly limited Accept to the recipient.
Server authority was never bypassed. Unit checks cover both perspectives and an
absent flow; PostgreSQL checks cover reciprocal private views and outsider privacy.
Build/type/lint, 222 unit and 288 integration tests passed (one existing skipped).
These reporting failures are corrected/retested before PACT-108 closure.

## PACT-108 — completed fresh journey

All prerequisites were Done before claiming the checkpoint. Three new independent
Luna owners completed upgrades, used human contact acceptance/exact review,
and activated the same-version reciprocal contract with actual delivery. Final
current reports agree with authorized owner records; timing/direction/handoff
corrections above were deployed and retested. Phone/keyboard, offline recovery
and active-before/revoked-after checks passed. Six test accounts were cleaned
without deleting gameplay evidence. [Full dated report](alpha-three-player-retest-20261002.md)
and [sanitized observations](evidence/alpha-three-player-retest-20261002.json)
record assistance, model/harness errors, usage and limits. No human enjoyment,
production gate or Later completion is implied. No remaining assigned ticket.
