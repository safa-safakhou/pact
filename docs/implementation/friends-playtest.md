# Friends playtest - agreed scope, 4 October 2026

Goal: open one shared URL, pick a nickname, enter a remembered guest kingdom, connect your own agent, and play with a couple of friends.

Founder explicitly rejected PACT signup, passwords, email, verification and individual admission links for this testing phase. Use an internal per-browser guest identity so commands and agent access still belong to the correct kingdom. Provider/client authorization remains in the player-owned agent connection; no automatic paid hosted agent is added.

Four tickets are complete in Active - Friends playtest: join, connect and play. Implemented and verified on testing release friends-play-20261004-3; see reports/friends-playtest-20261004.md. All 24 original Later tickets stay deferred; they are not dependencies of this batch. Reuse existing generated art/audio, rules, receipts, contact commands and shared views. Existing account-based production flows need not be removed to add this testing entry.

New browser or cleared guest storage starts fresh; cross-device recovery is outside this small test. Nickname collisions use a visible distinct handle without an email/account step. Do not fabricate verified email ownership.

## PACT-127 - Join from one shared link and connect your own agent

[MNI-221](https://linear.app/mnim/issue/MNI-221/pact-127-join-from-one-shared-link-and-connect-your-own-agent) - Done. Dependencies: PACT-053, PACT-099, PACT-108.

Scope:

- Provide a testing-mode shared URL: enter a nickname, automatically create a guest kingdom with the normal starting rules, and enter the game. No PACT account form, email, password, verification, operator code retrieval or per-person admission link.
- Persist the browser's guest identity so refresh/return resumes the same kingdom. Reuse internal ownership/session machinery; joining does not give control over another guest. A new browser or cleared browser data starts fresh; cross-device recovery is outside this task.
- Present Connect your agent in the entry flow with copyable instructions, the existing own-agent authorization route, a connection check and a ready-to-copy first mission. The agent runs in the player's own client, not an automatically purchased in-game model. Adapt existing guest-incompatible verified-email/reauth checks to the explicit testing identity, not invented email verification.

Acceptance:

- [x] Two separate browser profiles use the same URL and only choose nicknames; each reaches its own kingdom without signup/email/password/verification. Reload and return preserve the same kingdom without duplicate founding.
- [x] A guest connects their own supported Codex route without PACT login prompts or manually retrieving server tokens, and its first read identifies that exact kingdom. Existing explicit agent authorization and human decisions remain available in the guest session.
- [x] Copy/check/reconnect states show actionable success or failure. No model starts merely from joining or connecting. Record the tested client version and an end-to-end first-mission result; use the cheapest available supported model with a small explicit call cap if live inference is exercised.

## PACT-128 - Make the opening kingdom screen short and actionable

[MNI-222](https://linear.app/mnim/issue/MNI-222/pact-128-make-the-opening-kingdom-screen-short-and-actionable) - Done. Dependencies: PACT-053, PACT-126.

Scope:

- Reorder the existing Kingdom screen: scene, compact resource summary, active/free builders and one current next action first.
- Collapse detailed forecasts, advanced controls and records. Replace the empty keepsake collection with a compact hint until the first keepsake is earned; keep full collection reachable afterward.
- Reuse existing art, cast and factual next-decision logic. Do not add assets, tutorials, game rules or an additional dashboard.

Acceptance:

- [x] At 390x844 and 1440x900 the next-action card appears in the initial viewport after kingdom entry, with no horizontal overflow; builders and progress are directly adjacent rather than behind empty collections.
- [x] Keyboard users can reveal details, and existing actions/receipts remain reachable. Fresh, building, completed-build and pending-approval fixtures show the corresponding truthful next action.

## PACT-129 - Show useful upgrade choices and use the free builder

[MNI-223](https://linear.app/mnim/issue/MNI-223/pact-129-show-useful-upgrade-choices-and-use-the-free-builder) - Done. Dependencies: PACT-053, PACT-126.

Scope:

- Show up to three deterministic upgrade cards using existing rules/catalog calculations, current resources and ambition. Each states exact benefit, costs, duration and a specific known blocker; keep all other choices available under All buildings.
- Select an available builder automatically; show both slots clearly and do not overwrite a busy slot. Refresh/revalidate through the existing command path before a commitment.
- Provide a copyable Ask my agent instruction for each choice; clicking it alone does not purchase inference or queue a build. Reuse existing character flavour sparingly around a genuinely idle builder.

Acceptance:

- [x] Fixtures with zero, one and two available builders select only a free slot or explain that both are busy. Already queued/max-level upgrades are not suggested as immediately actionable.
- [x] Each shown card's numbers match the shared catalog; unaffordable/prerequisite-blocked options explain why. Human submission or an authorized agent uses the existing game command/receipt without duplicate effects.
- [x] After completing one upgrade, the choices and slot display update from fresh state; a free second builder remains visibly actionable while the first is busy.

## PACT-130 - Find friends in the shared world and start a conversation

[MNI-224](https://linear.app/mnim/issue/MNI-224/pact-130-find-friends-in-the-shared-world-and-start-a-conversation) - Done. Dependencies: PACT-053, PACT-127, PACT-128, PACT-129.

Scope:

- Put a compact list of actual public guest kingdoms from this testing world at the top of People: nickname/handle, public kingdom identity and contact action. Show up to 20 per page; exclude self/retired/hidden profiles and expose no private balances/messages.
- Add Copy game link for the same common guest-entry URL. Do not require individual invitations, exact-handle lookup or pasted kingdom IDs; reuse existing explicit contact request/acceptance and messaging.
- After contact acceptance, open the conversation with Say hello and Discuss a trade drafts; drafts are not sent automatically and trade discussion does not sign a contract.
- Finish with a small integrated two-browser guest playthrough of joining, connecting an agent, seeing building progress, finding each other and messaging. Record actual results and deployment evidence without inventing human enjoyment.

Acceptance:

- [x] Two guests using the same shared URL can discover each other, request/accept contact and exchange a message without UUID entry or email verification. Each sees only permitted public/own information.
- [x] Copy game link returns the common entry URL. Empty and loading/error lists distinguish no players from unavailable data; no fake players, online indicators or invented trade success.
- [x] Discuss a trade opens an editable conversation draft; sending, acceptance and any later financial agreement remain explicit. The integrated phone/desktop walkthrough records the tested release, outcomes and any remaining friction.

## Completion evidence

Each ticket needs its own checks and report entry. The final friend-discovery ticket includes the combined two-browser walkthrough. Record actual client/deployment version and any operator assistance; distinguish synthetic verification from independent human enjoyment. No new art generation, paid infrastructure or production certification is required.
