# PACT-108 — fresh three-player follow-up retest

Completed 2 October 2026 after PACT-100–107 were freshly read as Done in Linear.
This report closes the assigned nine-ticket batch. Existing game economics,
authority, privacy and the normal hosted clock were preserved.

## Release and checks

Final hosted release: **alpha-20261002-7**, on the existing testing VPS at
[PACT](https://safa.dedyn.io/pact/). Base HEAD:
`48002bbe51a2c2c9014ebe5ef997121f2a833d21`; uncommitted source snapshot SHA-256:
`a8c3d6b4c8efec8f57277512f7359389692a3a45c0bc3dbfc4ed3a7763d6ba32`.
This identifies deployed files, not a Git commit. Pre-release encrypted backup
`67543392`; deployment and public verification passed. Migrations remain through
0044. Earlier snapshots and acceptance results are in the [batch report](alpha-playtest-fixes.md).

Final changed-code checks: `npm run build`, `npm run typecheck`, `npm run lint`,
`npm test` (**222 passed**) and `npm run test:integration` (**288 passed**, one
existing optional live-model test skipped). All 26 published schema fingerprints
remain unchanged. Lint retains two existing politics optional-chain warnings and
an existing run-context template info. These are local checks, not hosted CI.
Planning render/check and `git diff --check` were rerun after final tracker edits.

## Independent players and actual outcomes

Three entirely new accounts were created after the prerequisite fixes closed,
with separate owner sessions, DCR/PKCE grants and Codex MCP profiles. All used
Codex **0.159.0-alpha.12.1**, **gpt-6-luna**, low reasoning effort. Player agents
received ordinary objectives and their own connection, without repository access,
supplied record IDs, action JSON or pasted game rules. Models discovered public
notices through the game. Human decisions were performed through the normal web.

| Player | Observed result |
| --- | --- |
| Alder Harbor (`cedar_abe136`) | Farm II completed; Brook became an accepted contact. Proposed the real reciprocal offer and signed its exact version. Final current-only read showed an additional Mine II still pending, five game minutes remaining. |
| Brook Vale (`marsh_5f361b`) | Farm II and human-approved Mine II completed. Accepted Alder and Cinder's incoming contacts through People. Signed the same version-1 offer and observed actual delivery. |
| Cinder Fort (`flint_de4f87`) | Wall II completed; discovered Brook's notice and requested contact, accepted by Brook's human. Final report correctly showed no own supply contract or pending obligation. |

Offer `ba38da0e-e90a-4e21-8dd8-d15fe12f2341`, version 1, became contract
`b82ec435-2829-4725-9792-0386f5bdafdd`. **Alder sends one Iron/hour;
Brook sends one Grain/hour**, for one game hour. At Alder's last current-only
snapshot, eight installments had delivered **80 marked units in each direction**,
with zero failed installments and zero overflow; 53 game minutes remained.
600 marked units equal one whole resource. Earlier Brook and owner snapshots
show smaller delivered totals at earlier game times; they are dated evidence,
not contradictory current totals. Future installments and full contract completion
are not claimed. Stock and time were not injected or accelerated.

Human exact Mine II approval `b245123f-65ab-4f36-8934-68b78a0e5a0c` opened
from a fresh signed-out 390px browser at the correct `/pact` URL, required Brook's
sign-in, preselected the correct request, showed Preview before an explicit
keyboard approval, and produced COMMITTED. Mine II later completed normally.
Agent reports, owner world/activity and private Chronicle exposed completed
builds, accepted contacts and actual trade deliveries. Final current reports
distinguished these facts from pending construction and future delivery.

## Browser and revocation evidence

Keyboard Enter activated Envoy, People and Chronicle at 1280px and 390px. Document
width matched viewport width; no horizontal overflow was observed. Visible Envoy
made two automatic activity reads during each observation. Brook's disconnect
retained history with a stale indication; reconnect restored reads. Phone Envoy
was 2896px high, versus 6437px in the original test. People can still be long after
many public posts; no claim that every page became short. Phone Chronicle showed
private actual consequences before optional public publishing.

All **six** batch test accounts (three diagnostics plus three fresh final players)
had spending/action authority disabled, all grants and sessions revoked, and only
their own named local MCP profiles/credential entries removed. Every cleanup
proved MCP access **200 before**, then former session **403** and MCP token **401**.
Brook's actual phone Sign out everywhere control was activated by keyboard and
returned to the sign-in screen. Local readback found **zero** remaining owned
profiles or credential entries. Linux CLI logout could not use its keyring; the
fallback removed only the six owned credential-file entries. Test passwords and
OAuth output files were deleted, and both own browser daemons stopped. Synthetic
gameplay records and active normal-clock obligations remain reviewable.

## Assistance, failures and corrections

- Mandatory verification used private operator delivery from internal Mailpit;
  internet email is still unavailable. Supported CLI OAuth setup, same-owner
  reauthentication after cookie rotation, human mandates, public notices,
  recipient contact acceptance and exact approval were explicit assistance.
- SSH connections were temporarily refused while retrieving the third account's
  captured verification message, then recovered through ordinary retry. The
  cause was not established; verification was not bypassed.
- The notice helper initially used the wrong field label and failed; it was
  corrected and publication was verified. Ordinary cold-contact Silver was
  initially insufficient. At the specified production rate, two whole Silver
  require twelve game minutes from zero; no approval created stock.
- Alder initially invented a calendar deadline. Added snapshot-derived
  `remainingGameMinutes` to owner projections and agent guidance, deployed and
  retested. Brook initially described trade direction backward. Added owned
  `youSend`/`youReceive` fields and tested both perspectives/outsider privacy.
  Contact handoffs now identify this owner versus the counterparty owner.
- The harness originally appended a move-making instruction even to a read-only
  final objective. Alder therefore queued a permitted extra Mine II. This was
  an actual harness failure: removed the conflicting instruction, disabled
  write tools for read-only rounds, and repeated read-only/current-only checks
  with no additional commitments. The already queued Mine II was preserved.
- Earlier model prose also misstated an offer expiry estimate and classified
  generic historical contact failures as construction failures. Those sentences
  are retained, not certified as facts. The final current-only report avoided
  unsupported history and agreed with current authorized records. Improving
  projections does not guarantee all future Luna narration is accurate.
- During initial phone logout capture, navigation discarded the response body
  after the real logout. A fresh normal connection was created; the repeated
  capture checked response status/sign-in UI and former credential denial.
  All remaining cleanup was completed, followed by a final local readback.

## Usage and remaining friction

**15 Luna turns:** 4,222,487 input tokens, including 3,708,416 cached input;
18,365 output tokens; zero reported reasoning output and cache-write input.
These are Codex-reported totals including host context. No billing dollar total
was available. No PACT in-app paid provider or new infrastructure was enabled.

Players' visible assessments were mixed: completed upgrades and actual trade
felt meaningful, while founding versus ordinary stock, Grain reserves, marked
delivery units, authority gates and waiting were confusing. This is an assisted
synthetic playtest, not evidence of human enjoyment, independent human onboarding,
physical-device accessibility, all-feature provider certification or a completed
season. Captured-email assistance and early resource waits remain explicit Alpha
limits; production SMTP/pilot work remains Later (PACT-078/060 and original gates).
There is no remaining blocker for this assigned batch and no further authorized
dependency-ready Alpha follow-up. The 28 Later tickets remain postponed.

## Durable evidence

[Sanitized dated records](evidence/alpha-three-player-retest-20261002.json) contain
all fifteen visible model reports/tool statuses/usage, owner snapshots, browser
observations, human decisions and six-account cleanup. OAuth stderr, passwords,
tokens and hidden model reasoning are excluded. Screenshots:
[phone Envoy](evidence/alpha-retest-phone-envoy-20261002.png),
[phone Chronicle](evidence/alpha-retest-phone-chronicle-20261002.png),
[exact review](evidence/alpha-retest-exact-review-20261002.png), and
[revoked sign-in](evidence/alpha-retest-revoked-signin-20261002.png).
Harness commands were `node player.mjs PLAYER ROUND GOAL`, `node journey.mjs`,
`node approval-browser-check.mjs`, `node final-ui.mjs`, `node owner-check.mjs`,
and `node cleanup.mjs ROOT [PLAYERS]`, using the temporary own test roots.
Release checks used the existing production deployment/verification scripts.
No commit, push or PR has been made.
