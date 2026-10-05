# Execution complete - 3 October 2026

All18 PACT-109-126 Done, verified in Linear; project98 Done/28 Later Backlog. Final testing release experience-20261003-4 after backup/public verification. [Fresh-player review](reports/experience-fresh-player-20261003.md): ordinary-clock FarmII payoff, eight Luna requests, conservative23 active minutes, temporary access cleanup. Negative design findings remain recorded; no additional Later scope activated.

---

# Reviewed current goal and bounded work — 3 October 2026

Make a small web kingdom game where a human chooses an objective, their connected agent acts within granted authority, and the human can follow real changes, pending decisions and consequences. A small generated comedy layer makes the place memorable. This batch improves observable clarity and presentation; human attachment and retention remain hypotheses, not guaranteed deliverables.

## Whole-backlog review

Reviewed all 126 local task scopes/acceptance/dependencies against the product and Alpha goals and reconciled Linear execution states. At the scope-review checkpoint: **80 historical Done, 18 active Todo, 28 postponed Backlog.** Historical Done is preserved evidence, not a fresh implementation audit. The Later entries are roadmap packages, not current executable tickets: the review below names missing decisions/external evidence instead of falsely calling every future task fully specified.

## Current scope limits

* One owner-only ambition choice: farmer/trader/defender; no motto publishing or new banner editor.
* One next-decision card and shared canonical quantity formatting.
* Seven static buildings plus Farm II and Mine II alternate states, one texture and one banner.
* Four cosmetic characters × three poses and sixteen short lines.
* Three short event animations plus one optional manual goose gag.
* One 30-second music loop, one 15-second ambience loop, one two-second flourish.
* Six short event effects plus one synthesized honk; no speech/TTS or soundtrack variants.
* Seven factual in-app event cards/icons, three private keepsakes and three harvest overlays.
* Silent first load; independent music/effects/ambience/notification controls; humour on/off and reduced motion.
* Existing four screens, Chromium at 390×844 and 1440×900, at most 3 MiB initial / 8 MiB total generated media.
* One fresh-player session, at most 30 active minutes over two normal-clock visits and eight provider requests. Missing social replies remain pending; no forced happy outcome.

These are new-batch limits, not changes to postponed production acceptance. Additional packs, seasonal music, customizers, autonomous characters, new channels, commerce and analytics are outside this batch. No open-ended 'make it fun/perfect' acceptance. Negative design findings are reportable; factual/accessibility defects require correction. Source specifications are reconciled explicitly by PACT-109 before implementation, not silently overwritten during this review.

## Production contract

All designs, textures, characters, icons, animation, copy, sounds and music are created by Codex, with no founder uploads, recordings or new production accounts. Use callable raster generation, authored SVG/CSS and Python procedural WAV. Four proof samples establish usable tooling, not a generation framework. Preserve sources, approved outputs and one shared manifest; preview every shipped image and audition every shipped sound. New raster generations are stochastic. Missing tooling or unacceptable quality is incomplete work. Music permits two refinement passes before a scoped quality failure is reported. No perfect-generation promise.

Feature tickets own their feature integration and tests; PACT-124 checks only seams and budgets; 125 audits/package instructions. No duplicated redesign or new deployment project. PACT-120 is dependency-ready after the proof and uses sample media so controls need not wait for all art/audio. PACT-113 waits for persisted ambition. The final checkpoint still depends on all seventeen preceding tasks.

## Revised experience tickets - all Done

<a id="pact-109"></a>

### [PACT-109 / MNI-203 — Freeze the small web-experience scope and asset list](https://linear.app/mnim/issue/MNI-203/pact-109-define-the-game-experience-brief-and-asset-production)

Size S; dependencies: PACT-053, PACT-099, PACT-108.

- Write one brief with the existing five palette colours, four character silhouettes, the exact asset counts in PACT-114–119, and one table linking each cue to an existing authorized event.
- Record presentation scope correction and affected-specification review before implementation. Preserve the economy, human decisions, receipts and the 28 Later tasks.

**Done when:**

- [x] Brief contains an inventory with filename/format/producer/event/owner/privacy/fallback for every bounded asset; no 'and more' deliverable or extra channel is included.
- [x] Every asset is Codex-generated through image generation, authored SVG/CSS or procedural WAV; no founder files, recording, new account or paid service is a prerequisite.
- [x] Affected specification/ticket review is recorded, with any necessary source changes explicitly versioned; historical acceptance evidence remains tied to its original revision.

<a id="pact-110"></a>

### [PACT-110 / MNI-204 — Prove image, motion and audio generation with four samples](https://linear.app/mnim/issue/MNI-204/pact-110-prove-a-reproducible-generation-pipeline-for-all-original)

Size S; dependencies: PACT-053, PACT-099, PACT-108, PACT-109.

- Produce exactly four disposable proof samples: one transparent character image, one parchment texture, one 200 ms SVG/CSS transition and one two-second procedural WAV.
- Save a small manifest and generation instructions; production tickets own their final asset exports. Use one shared manifest format, not a generator platform.

**Done when:**

- [x] All four samples are actually generated and previewed; the WAV is auditioned, finite and unclipped, and dimensions/duration are recorded.
- [x] Scripted outputs reproduce from saved code/seed; image prompt/reference/output are preserved without promising identical new model generations.
- [x] Missing image tooling is reported explicitly rather than counted as proven. Optional TTS/video/music services and encoding tools are not prerequisites.

<a id="pact-111"></a>

### [PACT-111 / MNI-205 — Persist one private ambition choice for the human and Envoy](https://linear.app/mnim/issue/MNI-205/pact-111-give-players-a-personal-ambition-and-a-recognizable-kingdom)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-109.

- Add one owner-only optional ambition: farmer, trader or defender, with neutral default and one-sentence descriptions. Persist through the existing identity/domain boundary and expose the same enum to owner HTTP/MCP context.
- Show the choice and an explicit human edit control on Kingdom; each ambition changes guidance only. Reuse the existing kingdom name and banner rather than adding motto, publication or banner-customizer features.

**Done when:**

- [x] All three choices and neutral default round-trip through owner reads, survive reload/reconnect and can only be changed by the authenticated human; another owner or agent cannot edit.
- [x] The selected ambition appears in Envoy context; human editing does not start a run or change game permissions, resource costs or production.
- [x] Missing/deleted ambition uses neutral guidance; no public projection reveals it and existing account export/deletion covers the new field.

<a id="pact-112"></a>

### [PACT-112 / MNI-207 — Show one truthful next-decision card throughout the first session](https://linear.app/mnim/issue/MNI-207/pact-112-make-the-first-session-and-waiting-periods-lead-to-meaningful)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-111, PACT-113.

- Use one deterministic card with priority: required human approval, failed action needing attention, pending recipient response, active build, available next choice. Keep source-record links.
- Explain Farm II before/after and Mine/Market/Wall second-builder tradeoffs using existing catalog and snapshot facts. During waits link existing notices or allow leaving with a return expectation.

**Done when:**

- [x] Fixtures cover unfounded, affordable/unaffordable Farm II, queued/active/completed/paused/stale build, outgoing pending/accepted/declined contact and expired approval; the card selects the documented priority.
- [x] Construction allowance is labeled separately from ordinary Silver; costs and durations come from canonical facts and no balance/rule is changed.
- [x] Sending a request changes guidance to waiting for its recipient. Countdown expiry or a historical success cannot imply a completed build or received response.

<a id="pact-113"></a>

### [PACT-113 / MNI-206 — Correct rate units and show a factual Envoy result summary](https://linear.app/mnim/issue/MNI-206/pact-113-make-envoy-briefings-trustworthy-and-tied-to-the-players)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-109, PACT-111.

- Create a deterministic summary of latest recorded result, current pending decision, selected ambition and next permitted step using existing authorized records. Keep free-form agent interpretation separately labeled.
- Use one shared formatting path for whole-unit costs, gross production, upkeep, net rate and forecasts in web/HTTP/MCP. Preserve the existing bounded run and approval contracts.

**Done when:**

- [x] A fixed fixture renders Grain 0.75/min = 45/hour, distinguishes ending stock from net increase and labels forecast assumptions; all three routes agree.
- [x] Fixtures for committed/proposed/failed/waiting/approval-needed/unknown results link actual receipts and distinguish agent supply.sign authority from human-only decisions.
- [x] One bounded cheap-model run of at most eight provider requests records the model and any disagreement. Deterministic facts remain correct even when model prose is wrong; no event-triggered inference is added.

<a id="pact-114"></a>

### [PACT-114 / MNI-208 — Generate a small kingdom scene with two visible upgrade changes](https://linear.app/mnim/issue/MNI-208/pact-114-generate-and-integrate-an-evolving-illustrated-kingdom-and)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-110.

- Generate seven static building silhouettes in one owner-only scene, plus alternate Farm II and Mine II artwork: nine building states total. Include one parchment texture and one cloth banner; no Hall II/IV/VI evolution pack or new scene editor.
- Integrate these into Kingdom using authoritative levels and one reusable static scaffold overlay for an active build. Preserve readable native resource values and controls.

**Done when:**

- [x] Manifest contains exactly nine building states, one texture and one banner, with approved originals/export hashes and generation sources.
- [x] Farm II and Mine II visibly change only after committed completion; scaffolding appears for active work and disappears on completion/cancel. Unknown higher levels retain text labels without fabricated variant art.
- [x] At 390 and 1440 CSS px the scene fits without hiding controls; art failure retains text, reduced motion is static, and public projections/URLs do not expose private state.

<a id="pact-115"></a>

### [PACT-115 / MNI-209 — Generate four court characters with three poses each](https://linear.app/mnim/issue/MNI-209/pact-115-generate-the-original-silly-court-character-cast-and-reusable)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-110.

- Generate Sir Honk, Pebble, Moth and Professor Bean, each with idle, pleased and concerned poses: exactly twelve exports, maximum 256×256 pixels each. Use the approved palette and character references.
- Write sixteen original flavour lines, four per character, each at most 80 characters. Keep factual status outside the joke; no dialogue generation, conversation engine or comedy-mode library.

**Done when:**

- [x] All twelve exports and sixteen lines are present, inspected for consistent silhouettes, transparency, scale and readable fallback, and listed in the manifest.
- [x] Characters only present existing facts; they cannot negotiate, sign, create contacts or act as counterparties.
- [x] Flavour may be disabled without losing status text. No further poses, cast members or joke variants are required for this ticket.

<a id="pact-116"></a>

### [PACT-116 / MNI-210 — Add three short milestone animations and one optional goose gag](https://linear.app/mnim/issue/MNI-210/pact-116-animate-real-milestones-and-optional-harmless-court)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-112, PACT-114, PACT-115, PACT-120.

- Author three 150–250 ms reveals for confirmed build completion, accepted contact and first actual trade delivery. Add one optional clickable goose honk pose lasting at most one second; no separate raid/signature/banner/helmet/quill motion pack.
- Use existing event IDs to deduplicate reveals across reload/reconnect, and obey the preferences from PACT-120. Animation changes presentation only.

**Done when:**

- [x] Fixtures for queue success, local timer expiry, rejected action and pending contact produce no celebration; each confirmed mapped event produces one reveal.
- [x] Refreshing/reconnecting or replaying the same event does not repeat the reveal, and routine settlement ticks stay quiet.
- [x] All four motions are previewed at 390/1440 px with keyboard focus intact; reduced motion uses an immediate static state and no input is blocked.

<a id="pact-117"></a>

### [PACT-117 / MNI-211 — Generate one music loop, one ambience loop and one flourish](https://linear.app/mnim/issue/MNI-211/pact-117-generate-original-music-and-ambient-sound-loops)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-110.

- Compose and synthesize one 30-second settlement music loop, one 15-second quiet wind/cloth ambience loop and one two-second achievement flourish. Save score/code/seed and original WAVs; no diplomacy/threat/season soundtrack variants.
- Produce browser-playable mono assets at 22050 Hz or a documented smaller compatible export. These are outputs for the shared audio controls, not a new audio engine.

**Done when:**

- [x] Exactly three generated assets play and are auditioned; durations, hashes, measured peaks and regeneration command are recorded.
- [x] Music and ambience have no audible join click; all samples are finite with peak at or below -3 dBFS and a documented fade if seamless synthesis fails.
- [x] Two refinement passes are the production allowance; an unacceptable result is recorded as incomplete and scoped explicitly, rather than opening unlimited generation work. No founder production account is required.

<a id="pact-118"></a>

### [PACT-118 / MNI-212 — Generate six short event sounds and one synthesized goose honk](https://linear.app/mnim/issue/MNI-212/pact-118-generate-original-event-effects-and-silly-synthesized-vocal)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-110, PACT-115.

- Generate six effects: build clack/trumpet, paper flutter, signature seal, first-delivery bell, raid drums and default snapped cord. Add one optional nonverbal goose honk. Each is at most two seconds; no speech/TTS or extra variants.
- Save procedural source/seed, WAV/export, duration and gain in the shared manifest. PACT-119 owns event mapping; PACT-120 owns playback controls.

**Done when:**

- [x] Exactly seven original finite assets are generated and auditioned with peaks at or below -3 dBFS; no clipping or copied recording is used.
- [x] Honk is at most one second and no louder than the build cue; an original caption accompanies the manual gag.
- [x] Critical warnings remain readable without audio; no resource tick or repeated denied command receives an audio cue.

<a id="pact-119"></a>

### [PACT-119 / MNI-213 — Add seven factual in-app event cards with generated icons](https://linear.app/mnim/issue/MNI-213/pact-119-add-generated-in-app-notification-cards-and-truthful-comic)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-112, PACT-115, PACT-118.

- Define exactly seven card templates: build complete, contact accepted, first delivery, signature, raid warning, default and waiting. Generate seven simple SVG icons and one optional flavour line per template.
- Reuse existing authorized history/inbox/receipt IDs. Map the six PACT-118 effects to the six corresponding non-waiting events; honk is manual only. Reuse the PACT-116 animations when present.

**Done when:**

- [x] Each template has a fixture for authorized data and missing/stale data, factual outcome text and a record link; waiting never celebrates or plays a sound.
- [x] Duplicate/reconnected delivery of an event yields one card/cue; first delivery is once per contract, other settlement installments are silent.
- [x] This extends existing in-app rendering only: no new inbox store, outbound email/push, or provider call. Errors/defaults retain exact consequence text when humour is disabled.

<a id="pact-120"></a>

### [PACT-120 / MNI-214 — Add silent-by-default audio controls and a reduced-motion option](https://linear.app/mnim/issue/MNI-214/pact-120-add-opt-in-audio-controls-and-accessible-calm-and-reduced)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-110.

- Provide Enable sound, master mute and separate music/effects/ambience/notifications sliders using one small shared playback helper. Honour OS reduced motion and expose an explicit motion override; add one Humour on/off choice instead of calm/dry/chaotic modes.
- Persist preferences in owner-scoped browser storage, clear them on sign-out, pause audio in hidden tabs and release active audio on unmount. Implement controls using temporary proof assets; final assets are checked in PACT-124.

**Done when:**

- [x] First load is silent until user gesture; mute/sliders, disabled notifications, humour-off and reduced-motion combinations are tested with keyboard labels and saved preferences.
- [x] Global event cue cooldown is at least three seconds, manual honk cooldown ten seconds, and only one instance of each loop plays. Reconnect/hidden-tab return cannot replay an audio backlog.
- [x] Humour-off removes flavour/manual gag while retaining every fact; motion-off replaces reveals with static output. No setting changes game allowance or triggers inference.

<a id="pact-121"></a>

### [PACT-121 / MNI-215 — Show notice freshness and actual contact waiting states](https://linear.app/mnim/issue/MNI-215/pact-121-make-social-opportunities-and-response-expectations-honest)

Size S; dependencies: PACT-053, PACT-099, PACT-108, PACT-112.

- Display created/expiry times on existing public notices; label missing dates as unknown and expired notices as expired.
- For the current owner's outgoing contact request show pending/accepted/declined/expired and existing no-cost introduction/invitation routes; use explicit 'response time unknown' instead of presence or response-window prediction.

**Done when:**

- [x] Fixtures cover fresh/expired/undated notices, all four request states and no notices/contacts; all use existing authoritative fields.
- [x] Pending/expired requests cannot appear accepted; another owner's inbox, online state, stock and troops remain absent from public views.
- [x] No new fee, free Silver, automatic retry, tester recruitment, scheduling field or NPC is introduced. Empty-state text permits leaving and returning.

<a id="pact-122"></a>

### [PACT-122 / MNI-216 — Show three private milestone keepsakes in the Hall](https://linear.app/mnim/issue/MNI-216/pact-122-create-a-private-hall-scrapbook-of-real-accomplishments)

Size S; dependencies: PACT-053, PACT-099, PACT-108, PACT-111, PACT-119.

- Add three read-only Hall cards for first completed build, first accepted contact and first delivered trade. Generate three small SVG keepsake designs, including the agriculture plaque.
- Derive first occurrences from existing retained authorized records and link their dated results; use the existing history view when none exists. No new collection database, pinning, export format or public sharing flow.

**Done when:**

- [x] Exactly three templates use real first-occurrence IDs; reload/replay changes neither counts nor occurrence dates and queued/proposed events produce no keepsake.
- [x] Missing/purged history is explicitly unavailable, not reconstructed as a false accomplishment. Cross-owner access remains denied.
- [x] All three SVGs/texts are generated and saved; no Gems, purchases or catalog entitlement is awarded or consumed.

<a id="pact-123"></a>

### [PACT-123 / MNI-217 — Show harvest conditions with three generated field overlays](https://linear.app/mnim/issue/MNI-217/pact-123-make-the-existing-harvest-season-visible-through-scenery-and)

Size S; dependencies: PACT-053, PACT-099, PACT-108, PACT-114.

- Generate three static SVG field overlays for 100%, 90% and 80% public harvest multipliers, using the same scene style. Map six existing weeks to these three images; show exact multiplier and published schedule in text.
- Reuse the single music/ambience loop unchanged. No weather simulation, private hunger mood, seasonal soundtrack or additional planning system.

**Done when:**

- [x] Fixtures for all six weeks map 100/100/90/80/80/100 correctly, with paused and unavailable clock states visibly labeled.
- [x] Exactly three overlays are saved; asset failure or silent/reduced-motion mode retains the complete textual schedule.
- [x] Scenery uses public season data only; no production multiplier, clock, scoring or private public-portrait data changes.

<a id="pact-124"></a>

### [PACT-124 / MNI-218 — Check the four-screen experience and enforce media budgets](https://linear.app/mnim/issue/MNI-218/pact-124-integrate-the-generated-experience-across-the-four-web)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-112, PACT-113, PACT-114, PACT-115, PACT-116, PACT-117, PACT-118, PACT-119, PACT-120, PACT-121, PACT-122, PACT-123.

- Review the integrated Kingdom/Envoy/People/Chronicle flow; feature tickets own integration and acceptance. Fix only seams between completed features, not a second redesign.
- Check Chromium at 390×844 and 1440×900, keyboard-only use, silent/reduced-motion mode, asset failures and reconnect. Measure generated-media transfer bytes and audio instances.

**Done when:**

- [x] All four screens retain readable contracts/exact approvals, no horizontal overflow at the two sizes, visible keyboard focus and minimum 44 CSS px primary touch targets.
- [x] Generated media is at most 3 MiB initially transferred and 8 MiB total shipped, excluding existing app assets. Lazy loading or procedural compression meets the budget; record measured bytes rather than a performance claim.
- [x] Asset failure leaves text, reconnect preserves stale labels and does not repeat commands/cues, hidden tabs stop audio, and relevant build/type/lint/behavior checks pass with recorded results.

<a id="pact-125"></a>

### [PACT-125 / MNI-219 — Verify the bounded asset bundle and regeneration instructions](https://linear.app/mnim/issue/MNI-219/pact-125-package-all-generated-assets-and-document-reproducible)

Size S; dependencies: PACT-053, PACT-099, PACT-108, PACT-110, PACT-124.

- Check only the PACT-114–119/122/123 inventory against the shared manifest: source/prompt, approved export, hash, event/placement, dimensions/duration and generation method.
- Write one regeneration/readme command index and existing-build packaging notes. Feature reports already own their implementation evidence; no additional publishing, server or deployment project.

**Done when:**

- [x] Every bounded final asset and template has a source and export entry, no placeholders; procedural generation works from saved inputs and approved raster exports remain preserved.
- [x] Inventory counts agree with revised tickets, generated bundle budget from PACT-124 passes, and no founder files or production account is needed.
- [x] Document generated-tool use/cost where available and unknown where unavailable; no secret or copied stock media is packaged. No deployment is performed by this planning task.

<a id="pact-126"></a>

### [PACT-126 / MNI-220 — Run one fresh-player session and record clarity and enjoyment limits](https://linear.app/mnim/issue/MNI-220/pact-126-replay-the-fresh-single-player-experience-and-assess)

Size M; dependencies: PACT-053, PACT-099, PACT-108, PACT-109, PACT-110, PACT-111, PACT-112, PACT-113, PACT-114, PACT-115, PACT-116, PACT-117, PACT-118, PACT-119, PACT-120, PACT-121, PACT-122, PACT-123, PACT-124, PACT-125.

- Use one fresh account in the testing world with normal clocks/resources and one connected cheap agent; allow at most 30 active minutes across two visits, with the second after the normal Farm II deadline. Observe founding, Farm II, a second-builder choice and a real available social opportunity; no model calls while waiting.
- Compare default versus silent/reduced-motion/humour-off, record actual build effects, waiting states, rate units, connection assistance and media. Social acceptance is conditional on an independent reply; no operated counterparty is required.

**Done when:**

- [x] All seventeen preceding tickets are Done with their revised evidence. Record five observations: stated ambition, actual before/after, next decision, actual recipient wait/empty community and a reason to return; negative findings are valid recorded results.
- [x] Any observed violation of factual/accessibility criteria is fixed and the affected step rerun before completion; unresolved subjective enjoyment concerns are reported without unlimited redesign.
- [x] Screenshots/receipts identify release/browser/model, calls and cost if available. At most eight provider requests and 30 active minutes across two visits; a still-pending progression is reported as not observed, with no clock acceleration.
- [x] Temporary sessions/grants/credentials are revoked. This is a synthetic design review, not measured human attachment, a mandatory successful trade, a production certification or a forced positive fun score.

## Postponed roadmap review — remains Backlog

* [PACT-084 / MNI-85](https://linear.app/mnim/issue/MNI-85/pact-084-prove-native-ios-and-android-login-linking-and-approval) — Parked external certification: one iOS and one Android login/approval fixture. Requires real signing identities/devices. Do not describe this as generator-only work.
* [PACT-060 / MNI-125](https://linear.app/mnim/issue/MNI-125/pact-060-deliver-opt-in-critical-email-and-web-push) — Parked delivery package: separate preferences/subscriptions, dispatcher grouping and provider delivery checks before activation; name one SMTP and one Web Push route and explicit event matrix first.
* [PACT-063 / MNI-128](https://linear.app/mnim/issue/MNI-128/pact-063-build-reporting-moderation-and-appeals-tools) — Parked operations package: split report/evidence capture, role-limited case actions and independent appeals. Needs a named staffing model and policy fixture list before assignment.
* [PACT-064 / MNI-129](https://linear.app/mnim/issue/MNI-129/pact-064-extend-privacy-workflows-to-the-complete-social-world) — Parked cleanup package: enumerate affected tables, retention classes and one restore/export/deletion matrix before selection. Existing minimal cleanup remains required for current new data.
* [PACT-065 / MNI-130](https://linear.app/mnim/issue/MNI-130/pact-065-implement-privacy-bounded-product-measurement) — Parked measurement package: fix event names, denominators and six existing observation windows before implementation; do not create a general analytics product.
* [PACT-087 / MNI-131](https://linear.app/mnim/issue/MNI-131/pact-087-build-complete-native-kingdom-and-envoy-screens) — Oversized future package: separate shared four-screen rendering, native session lifecycle and APNs/FCM delivery. Requires both signed platforms and dependencies, not one small task.
* [PACT-088 / MNI-132](https://linear.app/mnim/issue/MNI-132/pact-088-deliver-the-complete-telegram-mini-app) — Parked shell integration: reuse web feature components; define Telegram host version and safe-area/back/link/auth checks before selection, not another game client backend.
* [PACT-089 / MNI-133](https://linear.app/mnim/issue/MNI-133/pact-089-implement-private-chat-bot-briefings-and-explicit-run) — Bounded command set already explicit: /world,/inbox,/status,/stop and explicit /run. Later activation needs fixture/account details; no conversational bot expansion.
* [PACT-090 / MNI-134](https://linear.app/mnim/issue/MNI-134/pact-090-add-telegram-notification-delivery) — Mismatch: title/scope are Telegram-only but external prerequisites name APNs/Firebase. Correct this before activation; bot delivery needs the Telegram bot. Native push belongs to 087.
* [PACT-091 / MNI-135](https://linear.app/mnim/issue/MNI-135/pact-091-complete-cross-channel-session-and-privacy-lifecycle) — Parked lifecycle package: enumerate channel stores and unlink/reset/delete/restore outcomes; native lifecycle stays with 087. Do not turn this into new retention infrastructure.
* [PACT-092 / MNI-136](https://linear.app/mnim/issue/MNI-136/pact-092-verify-mvp-cross-channel-and-assistant-handoff-end-to-end) — Parked finite matrix: web/Telegram/certified assistant only, with seven listed handoff/race scenarios. Fix exact client versions and supported routes before selection.
* [PACT-066 / MNI-137](https://linear.app/mnim/issue/MNI-137/pact-066-run-the-social-integration-and-load-suite) — Large future test package: split functional scenarios from the specified 50-kingdom load harness. Retain historical thresholds; fix environment/model-free fixtures and measurement method before activation.
* [PACT-067 / MNI-138](https://linear.app/mnim/issue/MNI-138/pact-067-run-the-three-week-social-pilot) — Disproportionate to current test phase: 50 adults, three weeks, staffing and interviews remain a future research package. Native participants create a sequencing conflict with phase-3 native tasks gated by 068; resolve the pilot channel requirement before activation. Do not recruit or silently lower original behavioral thresholds.
* [PACT-068 / MNI-139](https://linear.app/mnim/issue/MNI-139/pact-068-accept-the-social-slice) — Historical social gate: original observed-pilot thresholds cannot be satisfied by synthetic accounts. Resolve 067 channel sequencing before reactivating the gate.
* [PACT-071 / MNI-142](https://linear.app/mnim/issue/MNI-142/pact-071-produce-and-integrate-the-illustrated-kingdom-and-cosmetics) — Overlaps current narrow scene work but covers a larger production/cosmetics asset pack. Keep parked; adopt Codex-generated sources if assigned and enumerate every level/cosmetic export then. No commissioned-asset requirement for current work.
* [PACT-072 / MNI-143](https://linear.app/mnim/issue/MNI-143/pact-072-integrate-optional-audio-motion-and-notification-feedback) — Overlaps current narrow audio/motion; retain full channel scope parked. Reuse current generated media when available; enumerate additional channel controls and cues before assignment.
* [PACT-074 / MNI-145](https://linear.app/mnim/issue/MNI-145/pact-074-implement-the-cosmetic-catalog-wallet-and-unlock-flow) — Paid/catalog entitlement package is outside the current keepsakes. Existing price catalog is explicit; before activation specify the transaction/idempotency fixtures and paid-lot display cases.
* [PACT-075 / MNI-146](https://linear.app/mnim/issue/MNI-146/pact-075-integrate-hosted-payments-and-verified-purchase-receipts) — External commerce package: one hosted web processor, two packs and exact receipt/event fixtures. Actual merchant identity, processor and prices are unresolved external prerequisites; never invent them.
* [PACT-076 / MNI-147](https://linear.app/mnim/issue/MNI-147/pact-076-implement-refunds-reversals-and-cosmetic-reconciliation) — Partial/mixed-funding refund policy needs an exact versioned decision table before implementation. Keep original no-gameplay-impact invariants; not generator-only work.
* [PACT-077 / MNI-148](https://linear.app/mnim/issue/MNI-148/pact-077-run-the-competitive-abuse-and-moderation-release-review) — Parked review with seven listed abuse categories. Freeze one fixture and permitted/prohibited outcome per category plus policy ownership; no open-ended promise to eliminate all abuse.
* [PACT-093 / MNI-149](https://linear.app/mnim/issue/MNI-149/pact-093-implement-storekit-and-google-play-cosmetic-purchases) — Two external store adapters in one large package; split iOS and Android receipt/revoke/restore evidence before activation. Developer/merchant accounts and signed builds are real prerequisites.
* [PACT-094 / MNI-150](https://linear.app/mnim/issue/MNI-150/pact-094-implement-telegram-stars-cosmetic-purchases) — One Stars adapter with a finite invoice/payment/refund matrix. Needs actual bot capability and declared products before activation; no substitute generated payment approval.
* [PACT-078 / MNI-151](https://linear.app/mnim/issue/MNI-151/pact-078-provision-and-rehearse-production-operations) — Oversized future operations package: separate backup restore, credential rotation and deployment/incident rehearsal. Freeze backup target, operator roster and recovery limits before assignment; current VPS testing does not satisfy these.
* [PACT-079 / MNI-152](https://linear.app/mnim/issue/MNI-152/pact-079-re-certify-external-clients-and-complete-distribution) — Broad external certification programme: freeze eligible advertised routes first, then one fixture per host and a separately scheduled human setup study. Distribution reviews and subscriptions cannot be generated.
* [PACT-095 / MNI-153](https://linear.app/mnim/issue/MNI-153/pact-095-prepare-and-certify-mobile-store-and-telegram-distribution) — External distribution package: separate Apple, Google and Telegram submissions; freeze exact binaries and checklist versions when assigned. No guarantee of approval or delivery date.
* [PACT-097 / MNI-154](https://linear.app/mnim/issue/MNI-154/pact-097-certify-the-full-production-channel-matrix) — Production matrix gate, not a feature: freeze supported client/build/version matrix before execution and rely on preceding adapter evidence. No universal host certification claim.
* [PACT-098 / MNI-157](https://linear.app/mnim/issue/MNI-157/pact-098-replace-mvp-operator-placeholders-with-reviewed-production) — Actual operator/legal/processor facts are external inputs, not generated fictional deliverables. Name missing entries and reviewer before activation; no synthetic production identity.
* [PACT-081 / MNI-156](https://linear.app/mnim/issue/MNI-156/pact-081-accept-and-prepare-the-season-one-release) — Production go/no-go gate stays separate. Includes uncompleted native/payments/pilot/external approvals; no implication that the current 18-task experience batch closes it.

All original 28 Later ticket states, milestones, labels, scope and acceptance remain preserved. Oversized future packages must be decomposed and external choices resolved when separately assigned; this review does not create extra tickets or recruit testers. In particular, native-required pilot sequencing and Telegram/native push ownership are actual planning conflicts, not current-game blockers.

## Review evidence and sources

Reviewed docs/pact/product.md, alpha.md, architecture.md, the specification ownership index and all 126 tasks.json records; Linear full issue list and the eighteen detailed active records. Original completion claims were not rerun. New task sizes are relative, not invented dates or effort promises. Local scope retains scope_review_previous for every edited task. Source hashes remain unchanged. Full earlier concept is inspiration; this reviewed inventory is the current commitment. Local report: docs/implementation/reports/game-experience-scope-review-20261003.md.
