# Fresh player experience review - 3 October 2026

PACT-126 completes the approved PACT-109-126 batch. The game now shows a real build's wait, completion, production change, scene change and retained keepsake. The synthetic review remains mixed: personality improved, but onboarding assistance, a long phone page and sparse social discovery still limit the experience.

## Actual session and bounds

One fresh synthetic account, @turnip_b20a66 / Turnip Research Annex, kingdom 60acfdd6-6f9d-4975-bfce-2c0b261197b4, in the ordinary existing testing world. No game clocks, resources or authoritative gameplay records were edited by the operator. One connected external GPT-6 Luna Envoy used Windows Codex CLI 0.159.0-alpha.12.1 and existing ChatGPT authentication, with shell/multi-agent disabled.

The first visit conservatively includes21:22:00-21:38:55UTC, including signup, recovery, founding, agent setup and the first browser review. The second visit21:48:19-21:49:54UTC includes its browser review and cleanup. Allowing four additional active minutes for administrative attempts gives a conservative upper bound of23 active minutes, below 30. Construction ran normally between visits. No provider requests during the wait.

A loopback operator proxy forwarded the client's authenticated Responses traffic without logging credentials or bodies. It counted exactly 8 provider POST requests, all HTTP200, and would reject any ninth request; request/stream retries and websockets were disabled. No over-budget request occurred. Usage:165448 input tokens,136448 cached input,668 output,0 reasoning output. Billed dollars are unknown under the existing Codex subscription. These are actual provider requests, not a count of Codex turns or game tool calls.

Signup and verification used the actual web UI. Captured Mailpit email required operator code retrieval. The original harness failed before saving login credentials; the same account was recovered by the normal reset/login routes. No second account was created. The human selected the farmer ambition and enabled bounded playtest authority in UI. DCR/PKCE used normal registration and owner-consent endpoints; this was operator-assisted setup, not proof a novice completed unaided Codex installation.

## Five observed game-design checkpoints

| Checkpoint | Actual observation |
| --- | --- |
| Ambition | Farmer persisted on both owner projections. It describes a dependable food supply; it grants no economic bonus. |
| Before/after | Farm I remained level1 during construction. Farm II then completed on the ordinary game clock, appeared as level2 in the scene and earned the retained build keepsake. Gross grain30 to45/hour; upkeep8/hour unchanged; net22 to37/hour. |
| Next decision | Builder2 remained idle. Luna suggested storage but did not queue it. The UI's existing catalog presents next building costs/prerequisites; deciding how to use the free builders remains a real next choice. |
| Social state | The current public notice feed and Chronicle were empty. Exact-handle lookup found self only. There was no discovered independent recipient, contact request, acceptance or trade. This does not establish that every world player is absent. |
| Reason to return | See the farm's visible improvement, confirm the grain-rate increase and first keepsake, then select the next building. This was observed on the second visit rather than inferred from a timer. |

Actual queue receipt:5fe502ae-a616-4d04-8582-86601d97d6ca; external activity journal80. First visit owner game time1791060060000 showed active construction with nine game minutes remaining. Due and actual settled game time1791060600000. Second visit showed completed, both builders free and the same receipt in the Hall. Game time includes normal historical pauses; its timestamp is not interpreted as an unadjusted wall-clock deadline.

The agent's final report accurately distinguished committed construction from finished construction, admitted its unused second builder and failed social discovery, and suggested returning after construction. Its preceding intention to use storage was not an accomplishment. Eight requests for one commitment remains a real efficiency limit.

## Media, readability and feel

Actual Chrome 154.0.8037.93 loaded the live authenticated game, without mocked API data, at390x844 and1440x900. Both visits covered Kingdom, Envoy, People and Chronicle:16 screen/viewport checks and18 saved screenshots including quiet-mode comparisons. No horizontal overflow or browser errors were observed. Every encountered source/receipt link returnedHTTP200, including the Hall's completed-build link.

Opt-in music and ambience played as exactly two error-free media instances. Master mute paused both; static motion and humour-off retained the factual outcome card and removed visible cosmetic flavour. A completed historical event loaded quietly on return, consistent with the no-replay policy. The model did not hear the live audio and did not audition all seven game events as real gameplay outcomes.

Founder listening evidence is separate: proof fanfare "Sounds clean"; seven effects accepted as clean but requested in context; subsequent contextual/music preview "I think it should be okay". This is tentative acceptance of that preview, not enthusiastic enjoyment or evidence of human attachment.

The small court cast and optional goose give the page a recognizable personality. Matching Farm II art, its actual rate change and earned Hall entry make progress easier to understand. However, the phone Kingdom page is long, opening Hall cards are mostly empty, and detailed choice/catalog prose competes for attention. The empty discovery surface provides little interpersonal tension or surprise. The review did not establish that the new jokes/music make someone want to keep playing for hours.

## Defects found, fixed and rerun

1. Outcome/Hall/legacy milestone links pointed at an unregistered /v1/world/owner endpoint. All now use the existing authorized /v1/world/kingdoms/:kingdomId route. Two affected suites passed12 tests including exact-route assertions. Actual live links passed both visits and the completed Hall step.
2. Identity emits reset_password, verify_new_email and email_changed_notice, while notification recognized different names. Actual reset email appeared as a generic account notice. The renderer now recognizes emitted names, keeps legacy aliases and describes completed address changes in the past tense. Five targeted tests passed and the final server build contains the corrected renderer. Previously sent messages retain their historical subjects; no claim that a new reset email was delivered after the correction.

Exact-label selector mistakes and the original harness's invalid read were corrected as test tooling. The remaining sparse social discovery, long page and unfulfilled second-builder plan are subjective/design findings, not covered by an unlimited redesign.

## Release, checks and cleanup

Existing VPS and shared AgenticWorld routing preserved. Encrypted backup passed before release1. Base source archive SHA256 9d43c3be12fca65da46b39dcb042923fe5fca4d6321dab00d152a9023eecf64b, with source-backed corrective releases; final testing release experience-20261003-4, migration0045, public verification passed. First live browser visit used release3, verified21:38:25UTC; second used release4, verified21:45:29UTC. No new server, paid in-app inference, commit/push or hosted CI claim.

Full local build/types/lint and269 units passed; the preceding full PostgreSQL run passed294 integrations with one optional live-provider skip. Subsequent email wording refinement passed its five affected tests and the standard release4 full build/public verification. Asset verification retains58 logical entries,47 identically regenerated physical media,61 public files totaling3265067 bytes and measured initial transfer328465 bytes.

Normal reauthentication, mandate reduction, OAuth revocation and sign-out-everywhere succeeded. Connection inventory then had0 grants. Former sessionHTTP403, bearerHTTP401, refreshHTTP400. Captured reset codes had expired, so the founder-authorized operator cleanup changed exactly this one synthetic account's password hash/timestamps using the existing password hasher and discarded the random replacement on the server. Former test-password loginHTTP400. No game state was altered. Local credential JSON was deleted and secret values were checked absent from saved evidence. Synthetic kingdom records remain for inspection; no test password is handed out.

This completes the revised gate with valid negative findings. All 18 experience tickets can be Done; the 28 Later tasks remain postponed. It does not close production, native/mobile, payment or independent-player enjoyment gates.

## Evidence

- [Public-state evidence, timings, usage, comparisons and revocation](evidence/experience-fresh-player-20261003.json)
- [Phone first visit](evidence/experience-fresh-first-390-Kingdom.png) and [phone return](evidence/experience-fresh-second-390-Kingdom.png)
- [Desktop return](evidence/experience-fresh-second-1440-Kingdom.png) and [quiet return](evidence/experience-fresh-second-quiet.png)
- Provider/browser/cleanup harnesses saved as credential-free text alongside evidence.
- [Per-ticket batch report](game-experience-implementation.md), [asset generation index](../../../assets/experience/README.md), [experience API](../../api/kingdom-experience.md).

The useful next product discussion is how to reduce setup/friction and give the opening a denser social reason to act. Those findings are recorded for the founder to prioritize; no additional backlog scope was silently activated.
