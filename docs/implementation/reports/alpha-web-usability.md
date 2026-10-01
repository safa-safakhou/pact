# Alpha web usability and live-only decisions

Ticket: [PACT-073 / MNI-144](https://linear.app/mnim/issue/MNI-144/pact-073-finish-responsive-accessibility-and-pwa-behavior)
Implementation revision: recorded in the ticket evidence after commit.
Verification: 1 October 2026, Node 24, local PostgreSQL 17, actual Chrome extension browser session.

## Result

Readable phone/desktop controls, keyboard navigation/confirmation, truthful connection state and one live-write guard for both SDK commands and ordinary web handlers. Offline/failing connections clear game confirmations and exact approval previews, reset run confirmation, and require fresh state before another decision. No automatic commitment replay. No PWA/cache, native, paid model or hosted release changes.

## Acceptance evidence

| Alpha acceptance | Actual observation/check | Result |
| --- | --- | --- |
| Desktop/phone and keyboard cover founding, objectives/runs, contracts, troops, raids, social views and reports without unreachable controls | Isolated `scripts/rehearse-alpha-web.ts` API on 3017 and Vite proxy on 5174; Chrome at 390×844, 320×740 and 1280×900. Keyboard email/password → Tab → Enter; verified draft → handle → Tab → Enter founded an actual kingdom. Owner Kingdom, Envoy, People and Chronicle measured `documentWidth === viewportWidth` with no input/select/textarea/button extending beyond the viewport. Objective → Tab focused model selector. Skip link focused Game areas. Raid count → Tab reached Raid ID while unavailable raid buttons correctly stayed disabled for Home Guard-only armies. Desktop button measurements found none shorter than 44 CSS pixels. | Pass for scoped Alpha usability, not a complete WCAG/screen-reader or physical-device certification. |
| Exact contract and troop decisions remain understandable | Amber queued Farm II and eight ordinary Spearmen with keyboard controls: receipts `768975f9-f515-41f1-b3f2-e86162b6f608` and `ff60bc6c-63df-4bae-aa15-ad129e741a93`. UI showed active/pending build and 0/8 ready, not completed outcomes. Found Birch by handle; previewed 1 Grain/h for 1 Silver/h for one hour. Confirmation received focus; Escape returned it to Offer supply terms. Reopened and used Tab → Enter to commit an offer and sign exact version 1: `c5515671-da6a-4658-a72f-c23ca8bf2b01`, `f1f115d3-cdf0-4652-bbab-79959169c21c`. One signature stayed pending, not an active contract. | Pass; no battle, two-signature settlement or elapsed training completion claimed. |
| Reports and agent controls communicate actual state without color/sound dependency | Missing report `00000000-0000-4000-8000-000000000099` read by keyboard; displayed unavailable/pending/missing/inaccessible ambiguity rather than fabricated results. Labels, text outcomes, focus outlines and disabled prerequisite explanations inspected in Chrome. Envoy objective/model/token controls reachable; Start disabled with explicit no-model/no-call notice. No provider key saved or inference started. | Pass for UI controls/readability. Stateful run/approval behavior additionally covered by existing integration suite; no new live provider run claimed. |
| Disconnect/reconnect is truthful and does not blindly replay signatures, raids or approvals | With an uncommitted supply confirmation open, paused only the exact local rehearsal API process using SIGSTOP (PID verified against its listening port and command), then requested a read-only refresh. After the 10-second deadline Chrome showed “Live refresh required”, removed confirmation and disabled supply/allegiance writes. SIGCONT restored that process; the normal read poll recovered last-owner-refresh status. No open offers/contracts appeared and no confirmation returned. Only a new deliberate decision created the later offer. No source edits/reloads occurred during this final outage sequence. | Pass for actual server-disconnect recovery. Browser offline/online transitions, older-refresh rejection, 503, SDK/approval/run write blocking and zero queued submissions are also covered by five dedicated unit tests. |

Disposable schema: `test_web_rehearsal_d156ee6fe3be4f839628ae662c085ecb`. Synthetic records only; not the VPS. Screenshot of narrow-phone focused confirmation: `/tmp/pact-alpha-phone-confirmation.jpg` (ephemeral local artifact, not a durable dependency). Viewport override reset after checks. An earlier HMR reload interrupted a preliminary outage check; it is not used as confirmation-clearance evidence.

## Automated checks

Full `npm run build`, `npm run typecheck`, `npm run test`, `npm run lint`; 210 unit tests pass. `npm run test:integration`: 282 PostgreSQL tests pass, one pre-existing optional live-model skip. The integration run used no real provider calls. Planning render/check and `git diff --check` recorded in ticket evidence. No hosted CI claim.

## Documentation and boundaries

[Alpha web operations](../../operations/alpha-web.md) describes recovery, uncertain-command receipt reconciliation and fixture setup. Host remains `alpha-20260929-4` / `2143d92`; this and the preceding social/season work need a matching release later. Original postponed PWA/install, privacy/full-screen-reader audit, audio, art and production gates remain untouched. Next dependency-ready Alpha work is PACT-099, followed by final observed rehearsal PACT-080; implementation/usability observations are not evidence that independent players found the game fun.
