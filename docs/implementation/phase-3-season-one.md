# Phase 3 — Season One release

**19 tickets · 0 completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)

Dependencies are completion requirements. Later phases also depend on the preceding gate. Owner roles are disciplines, not assigned people. Size is complexity, not a time commitment.

<a id="pact-084"></a>
## PACT-084 — Prove native iOS and Android login, linking, and approval

**Status:** todo · **Role:** Mobile · **Size:** L · **Type:** implementation

**Depends on:** [PACT-007](phase-0-connections.md#pact-007), [PACT-023](phase-0-connections.md#pact-023), [PACT-068](phase-2-social.md#pact-068), [PACT-083](phase-0-connections.md#pact-083)

**Components:** React Native Expo shell, native identity, secure storage.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [privacy](../pact/privacy.md) · **Release checks:** L06

**Implement / deliver**

- Create one native application with iOS/Android development builds, system-browser PACT PKCE login, verified app links, secure refresh storage, and in-memory access tokens.
- Complete private-draft read, sandbox command, exact human approval, reconnect, and revoke on both platforms; full gameplay comes in PACT-087.

**Acceptance**

- [ ] A malicious callback, wrong audience, stale approval, duplicate tap, and revoked session fail or return the original receipt correctly.
- [ ] Credentials do not appear in app preferences/logs/backups; backgrounding/reopening shows server state without a new run.

**External prerequisites:** Apple team ID, signed physical iOS development build, and iOS test device; Android SDK, signing-certificate fingerprint, signed development build, and Android test device; Hostname-root Apple and Android association files generated from the real signing identities.

**Block reason:** Deferred by the Version 1.3 MVP decision until web and Telegram gameplay have been played and validated. The existing native shell and simulator evidence are retained; paid signing and physical-device certification resume during Season One release work.

**Evidence**

- docs/implementation/reports/native-telegram-auth.md
- npm run lint; npm run typecheck; npm test; npm run test:integration; npm run smoke; npm run build
- apps/native/src/session-controller.test.ts; apps/native/src/native-api.test.ts; apps/native/app.json
- Xcode 26.4 iOS 26.4 simulator build and launch passed on 2026-09-22; system PKCE prompt opened https://safa.dedyn.io and cancellation returned cleanly

<a id="pact-087"></a>
## PACT-087 — Build complete native kingdom and Envoy screens

**Status:** todo · **Role:** Mobile · **Size:** L · **Type:** implementation

**Depends on:** [PACT-048](phase-1-rules.md#pact-048), [PACT-053](phase-1-rules.md#pact-053), [PACT-061](phase-2-social.md#pact-061), [PACT-068](phase-2-social.md#pact-068), [PACT-083](phase-0-connections.md#pact-083), [PACT-084](phase-3-season-one.md#pact-084)

**Components:** native gameplay screens, shared view models.

**Specification:** [architecture](../pact/architecture.md), [product](../pact/product.md), [runtime](../pact/runtime.md) · **Release checks:** L02, L06

**Implement / deliver**

- Implement the four screens using native accessible controls, shared client/view-model logic, assets, resource formatting, and existing application commands.
- Include build/train/contracts/scout/garrison/raid/report/social controls, account/security settings, run start/stop, approval handoff, APNs/FCM delivery, and native session/push privacy cleanup.

**Acceptance**

- [ ] A player completes the full core loop on each native platform and sees the same version/receipt on web.
- [ ] Offline state is visibly stale; reconnect cannot replay a signature/raid or start another Envoy; native approval cannot bypass expiry or reauthentication.

<a id="pact-069"></a>
## PACT-069 — Implement the complete six-week season lifecycle

**Status:** todo · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-068](phase-2-social.md#pact-068)

**Components:** season lifecycle and newcomer cohorts.

**Specification:** [rules](../pact/rules.md), [product](../pact/product.md) · **Release checks:** L01

**Implement / deliver**

- Extend the clock/score foundation with configured opening time, the published harvest schedule, pre-boundary closing snapshot, next-season baseline, and pinned in-flight rules.
- Add equal-age newcomer cohorts and persistent assets/contracts across seasons; expose current week and next transition in the UI/API.

**Acceptance**

- [ ] An accelerated six-week run applies exactly the specified multipliers and awards boundary-tick value to the correct season.
- [ ] A contract/raid crossing a season or world pause retains its correct terms/version; newcomer comparisons use age-seven-day snapshots without reset exploits.

<a id="pact-070"></a>
## PACT-070 — Implement seasonal honors and award review

**Status:** todo · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-063](phase-2-social.md#pact-063), [PACT-068](phase-2-social.md#pact-068), [PACT-069](phase-3-season-one.md#pact-069)

**Components:** award calculation and review.

**Specification:** [rules](../pact/rules.md), [product](../pact/product.md), [privacy](../pact/privacy.md) · **Release checks:** L01, L05

**Implement / deliver**

- Implement meaningful-day eligibility, minimum band population, exact percentile thresholds/ties, overall plaques, arrival/participation rewards, and seven-real-day provisional review.
- Build the audited disqualification/appeal and idempotent entitlement workflow, including updates to awards after a successful appeal.

**Acceptance**

- [ ] Small bands issue no false percentile award; ties expand honors as specified and only the highest border is granted.
- [ ] Closing/disqualified accounts are excluded; review retries or overturned decisions cannot duplicate rewards, delete legitimate gameplay stock, or silently change Fortune.

<a id="pact-071"></a>
## PACT-071 — Produce and integrate the illustrated kingdom and cosmetics

**Status:** todo · **Role:** Frontend / Art · **Size:** L · **Type:** implementation

**Depends on:** [PACT-068](phase-2-social.md#pact-068)

**Components:** art assets and kingdom scene.

**Specification:** [product](../pact/product.md) · **Release checks:** L02

**Implement / deliver**

- Create or commission the authored building silhouettes, Hall II/IV/VI evolution, portrait scenes, banners, achievement ornaments, scaffolds, and palette variants.
- Add optimized asset manifests, provenance/licenses, text alternatives, cosmetic placement, and responsive scene rendering; actual hidden defenses never determine public portraits.

**Acceptance**

- [ ] Every building state is readable at phone size and has an equivalent text entry; scene updates follow committed state rather than speculative success.
- [ ] Cosmetic changes affect only presentation; private building levels do not leak through public images or asset URLs.

**External prerequisites:** Approved/licensed visual assets or art production capacity.

<a id="pact-072"></a>
## PACT-072 — Integrate optional audio, motion, and notification feedback

**Status:** todo · **Role:** Frontend / Audio · **Size:** M · **Type:** implementation

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-071](phase-3-season-one.md#pact-071)

**Components:** audio and motion.

**Specification:** [product](../pact/product.md), [runtime](../pact/runtime.md) · **Release checks:** L02

**Implement / deliver**

- Produce/integrate the specified short sound cues and restrained ambience with per-channel controls, user-gesture activation, and message batching.
- Add short build/signature/result transitions and full reduced-motion equivalents; avoid continual tick sounds or autoplayed player speech.

**Acceptance**

- [ ] Muted and reduced-motion play retains every consequence and control.
- [ ] Reconnecting does not replay every historical sound; one grouped event generates one appropriate cue and preferences persist.

**External prerequisites:** Approved/licensed audio assets or audio production capacity.

<a id="pact-073"></a>
## PACT-073 — Finish responsive accessibility and PWA behavior

**Status:** todo · **Role:** Frontend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-061](phase-2-social.md#pact-061), [PACT-068](phase-2-social.md#pact-068), [PACT-071](phase-3-season-one.md#pact-071), [PACT-072](phase-3-season-one.md#pact-072)

**Components:** responsive UI, accessibility, PWA.

**Specification:** [product](../pact/product.md), [access](../pact/access.md) · **Release checks:** L02

**Implement / deliver**

- Complete installable PWA manifest/icons, responsive layouts, keyboard/focus paths, screen-reader labels, contrast, reflow, touch targets, and batched live announcements.
- Cache only safe static assets; show stale/offline state and require a live server commit for gameplay actions instead of queueing expired commands silently.

**Acceptance**

- [ ] Manual keyboard/screen-reader and phone/desktop audits cover signup, approvals, contracts, raids, reports, and privacy controls against the specified accessibility target.
- [ ] App install/update/offline recovery preserves server authority and never caches keys, private responses, or a reusable approval action.

<a id="pact-074"></a>
## PACT-074 — Implement the cosmetic catalog, wallet, and unlock flow

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-047](phase-1-rules.md#pact-047), [PACT-068](phase-2-social.md#pact-068), [PACT-071](phase-3-season-one.md#pact-071)

**Components:** cosmetic catalog and wallet.

**Specification:** [product](../pact/product.md), [rules](../pact/rules.md), [architecture](../pact/architecture.md) · **Release checks:** L03

**Implement / deliver**

- Extend the earned-Gem ledger with catalog definitions, price validation, account-bound inventory, cosmetic spending, and human-only purchase permissions.
- Separate achievement/rank items from sale items; model paid Gem lots and reversible entitlement provenance for later refunds.
- Support platform-origin paid Gem lots, globally shared earned Gems, and account-owned cosmetics; display available-here versus other-channel paid balances.

**Acceptance**

- [ ] Catalog purchases debit once and unlock once; an already-owned item cannot be charged again by a retry.
- [ ] Gems/skins are excluded from every economic, combat, score, queue, authority, and run-priority calculation; Envoys cannot initiate checkout.

<a id="pact-075"></a>
## PACT-075 — Integrate hosted payments and verified purchase receipts

**Status:** todo · **Role:** Backend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-007](phase-0-connections.md#pact-007), [PACT-064](phase-2-social.md#pact-064), [PACT-068](phase-2-social.md#pact-068), [PACT-074](phase-3-season-one.md#pact-074)

**Components:** checkout and payment receipts.

**Specification:** [product](../pact/product.md), [privacy](../pact/privacy.md), [architecture](../pact/architecture.md) · **Release checks:** L03, L04

**Implement / deliver**

- Integrate one processor-hosted checkout behind a payment adapter; map the two Gem packs to server-controlled product IDs and localized prices.
- Add signed webhook verification, durable event deduplication, settlement-before-credit, processor receipt references, and required merchant/legal-retention configuration.
- This ticket remains web checkout only; PACT-093/094 own store and Stars adapters feeding the same verified receipt/entitlement ledger.

**Acceptance**

- [ ] Forged, duplicate, reordered, or client-modified payment events cannot mint Gems; unsuccessful payments grant nothing.
- [ ] Missing merchant/price/retention configuration disables checkout; no full card data reaches PACT and all purchase controls require human authentication.

**External prerequisites:** Merchant/processor account, product prices, legal payment-record schedule.

<a id="pact-076"></a>
## PACT-076 — Implement refunds, reversals, and cosmetic reconciliation

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-075](phase-3-season-one.md#pact-075)

**Components:** refund reconciliation.

**Specification:** [product](../pact/product.md), [privacy](../pact/privacy.md), [architecture](../pact/architecture.md) · **Release checks:** L03

**Implement / deliver**

- Implement processor refund/chargeback handling using paid-lot and cosmetic provenance, including already-spent paid Gems and mixed earned/paid purchases.
- Record the deterministic reversal policy in the payment module contract before enabling checkout; reverse only attributable paid value/entitlements, preserving earned and unrelated purchases.

**Acceptance**

- [ ] Duplicate and out-of-order refund events cannot over-reverse, credit Gems, or affect ordinary game balances, Fortune, troops, buildings, or achievements.
- [ ] Full/partial refunds and mixed-funding fixtures reconcile to payment receipts with a human-readable explanation and support audit trail.
- [ ] Refund reconciliation retains original purchase-channel provenance and cannot debit another channel’s paid lot to hide an attribution error.

<a id="pact-077"></a>
## PACT-077 — Run the competitive abuse and moderation release review

**Status:** todo · **Role:** QA / Operations · **Size:** L · **Type:** verification

**Depends on:** [PACT-063](phase-2-social.md#pact-063), [PACT-065](phase-2-social.md#pact-065), [PACT-068](phase-2-social.md#pact-068), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070)

**Components:** competitive abuse validation.

**Specification:** [delivery](../pact/delivery.md), [rules](../pact/rules.md), [privacy](../pact/privacy.md) · **Release checks:** L05

**Implement / deliver**

- Execute scenarios for account farms, gift concentration, bond/default cycling, training/bond storage sheltering, indefinite owned-defender pinning, smear campaigns, and model-tier differences.
- Validate investigation evidence, review permissions, conduct notices, appeals, and alerting; preserve legitimate alliances and gifts instead of treating size or success as guilt.

**Acceptance**

- [ ] Every scenario has observed effects, a documented permitted/prohibited classification, and reproducible evidence.
- [ ] Release-blocking exploit or policy-enforcement failures receive fixes and reruns; model fairness and abuse resistance are not claimed from action caps alone.

<a id="pact-093"></a>
## PACT-093 — Implement StoreKit and Google Play cosmetic purchases

**Status:** todo · **Role:** Backend / Mobile · **Size:** L · **Type:** implementation

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-074](phase-3-season-one.md#pact-074), [PACT-075](phase-3-season-one.md#pact-075), [PACT-076](phase-3-season-one.md#pact-076), [PACT-087](phase-3-season-one.md#pact-087)

**Components:** native billing adapters, receipt verification.

**Specification:** [architecture](../pact/architecture.md), [product](../pact/product.md), [privacy](../pact/privacy.md) · **Release checks:** L03, L06

**Implement / deliver**

- Implement store products/price display, signed server receipt validation, entitlement reconciliation, refund/revoke notifications, and restore paths for iOS/Android.
- Maintain platform-origin paid Gem lots, shared earned Gems, and account-wide cosmetic ownership using the existing commerce interface.

**Acceptance**

- [ ] Replayed or cross-account receipts, pending/canceled purchases, out-of-order refunds, and reinstall cannot grant twice.
- [ ] Spent consumable packs are not re-credited by restore; origin-restricted balances display correctly and never affect game resources, score, or run limits.

**External prerequisites:** Apple/Google developer and merchant accounts; sandbox products and test users.

<a id="pact-094"></a>
## PACT-094 — Implement Telegram Stars cosmetic purchases

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-074](phase-3-season-one.md#pact-074), [PACT-075](phase-3-season-one.md#pact-075), [PACT-076](phase-3-season-one.md#pact-076), [PACT-088](phase-2-social.md#pact-088), [PACT-089](phase-2-social.md#pact-089)

**Components:** Stars billing adapter, cosmetic provenance.

**Specification:** [architecture](../pact/architecture.md), [product](../pact/product.md), [privacy](../pact/privacy.md) · **Release checks:** L03, L06

**Implement / deliver**

- Implement server-priced Stars invoices, bounded pre-checkout validation, verified successful-payment processing, deduplicated grants, support/refund handling, and source-tagged Gem lots.
- Keep web checkout out of Telegram purchase paths; cosmetic catalog and account entitlements use the same commerce service.

**Acceptance**

- [ ] Invoice creation or pre-checkout alone never grants Gems; duplicate updates/refunds and forwarded invoices cannot alter the wrong account.
- [ ] Purchases preserve origin restrictions and account-wide cosmetic ownership without changing gameplay; failed payment retains a clear recoverable state.

**External prerequisites:** Telegram bot with Stars test and production payment capability.

<a id="pact-078"></a>
## PACT-078 — Provision and rehearse production operations

**Status:** todo · **Role:** Platform · **Size:** L · **Type:** operations

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070), [PACT-073](phase-3-season-one.md#pact-073), [PACT-076](phase-3-season-one.md#pact-076), [PACT-093](phase-3-season-one.md#pact-093), [PACT-094](phase-3-season-one.md#pact-094)

**Components:** production infrastructure and operations.

**Specification:** [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [delivery](../pact/delivery.md) · **Release checks:** L04

**Implement / deliver**

- Promote and rehearse the phase-0 single-VPS stack for production with separate production database/secrets, encrypted off-host backup/restore, secrets/signing rotation, monitoring, status page, capacity alarms, migrations, and deployment rollback.
- Replace MVP-local backup and email capture with encrypted off-host backup/restore and real outbound SMTP, then configure support/moderation/privacy ownership, incident world suspension, delayed/failed notifications, provider outage handling, and retention/legal-hold operations.

**Acceptance**

- [ ] Rehearse a production-like restore, deletion suppression, outbox replay, signing-key rotation, credential incident, and world pause/resume before admitting players.
- [ ] Operators can diagnose and recover without manual unlogged balance edits; registration/checkout stay disabled when required operational configuration is missing.

**External prerequisites:** Production access to the project VPS, domain/DNS, encrypted off-host backup target, SMTP credentials, and operator coverage.

<a id="pact-079"></a>
## PACT-079 — Re-certify external clients and complete distribution

**Status:** todo · **Role:** Integrations · **Size:** L · **Type:** verification

**Depends on:** [PACT-049](phase-1-rules.md#pact-049), [PACT-062](phase-2-social.md#pact-062), [PACT-068](phase-2-social.md#pact-068), [PACT-073](phase-3-season-one.md#pact-073), [PACT-078](phase-3-season-one.md#pact-078)

**Components:** provider/client release certification.

**Specification:** [access](../pact/access.md), [delivery](../pact/delivery.md), [architecture](../pact/architecture.md) · **Release checks:** L04

**Implement / deliver**

- Repeat full real-game connection, read/write, authority approval, bounded run, revoke, and reconnect checks for all five adapters plus ChatGPT and Claude on the release candidate.
- Submit and complete required external-client distribution reviews; publish tested plans/platforms/models/dates and a generic MCP guide.
- Certify Gemini CLI and the Grok-powered external tool client as well; clearly separate API model support from consumer-chat installation availability.

**Acceptance**

- [ ] All required routes pass against production-like endpoints and the shipped schemas, not just phase-0 fixtures.
- [ ] Review acceptance and host availability are evidenced before advertising support; a private developer connection is not represented as universal installation.

**External prerequisites:** Eligible release host accounts and any required distribution approvals.

<a id="pact-095"></a>
## PACT-095 — Prepare and certify mobile-store and Telegram distribution

**Status:** todo · **Role:** Mobile / Operations · **Size:** L · **Type:** operations

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-073](phase-3-season-one.md#pact-073), [PACT-078](phase-3-season-one.md#pact-078), [PACT-087](phase-3-season-one.md#pact-087), [PACT-088](phase-2-social.md#pact-088), [PACT-090](phase-2-social.md#pact-090), [PACT-091](phase-2-social.md#pact-091), [PACT-093](phase-3-season-one.md#pact-093), [PACT-094](phase-3-season-one.md#pact-094)

**Components:** signed builds, store submissions, Telegram production configuration.

**Specification:** [architecture](../pact/architecture.md), [privacy](../pact/privacy.md), [delivery](../pact/delivery.md) · **Release checks:** L04, L06

**Implement / deliver**

- Prepare iOS/Android signed releases, privacy/data disclosures, account deletion access, report/block controls, review accounts, production app links/push, and supported-device testing.
- Complete required store reviews, Telegram Mini App/bot metadata/deep links, and each channel’s digital-purchase checks; record policy versions and acceptance evidence.

**Acceptance**

- [ ] Release artifacts are reproducible and the tested binaries match submitted builds; production links resolve to the correct account/destination.
- [ ] Required reviews/disclosures and purchase checks pass; web availability alone cannot mark native/Telegram distribution done.

**External prerequisites:** Apple/Google distribution approvals; production Telegram bot/domain configuration.

<a id="pact-097"></a>
## PACT-097 — Certify the full production channel matrix

**Status:** todo · **Role:** QA · **Size:** L · **Type:** verification

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-079](phase-3-season-one.md#pact-079), [PACT-092](phase-2-social.md#pact-092), [PACT-093](phase-3-season-one.md#pact-093), [PACT-094](phase-3-season-one.md#pact-094), [PACT-095](phase-3-season-one.md#pact-095), [PACT-096](phase-1-rules.md#pact-096)

**Components:** production-like cross-surface certification.

**Specification:** [architecture](../pact/architecture.md), [delivery](../pact/delivery.md) · **Release checks:** L04, L06

**Implement / deliver**

- Repeat handoff/approval/revoke/inbox/model-run fixtures across the production-like web, signed native apps, Telegram, and certified assistant clients.
- Rehearse channel outage, store/Stars refund replay, device reinstall, stale client API version, account deletion, and external-host feature unavailability.

**Acceptance**

- [ ] Each required surface has evidence tied to its build/client version and backend revision; advertised capability labels match actual supported routes.
- [ ] Cross-surface entitlements, run leases, event state, and privacy controls remain consistent; a blocked store review or failed required channel blocks release.

<a id="pact-080"></a>
## PACT-080 — Rehearse Season One end to end

**Status:** todo · **Role:** QA · **Size:** L · **Type:** verification

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070), [PACT-071](phase-3-season-one.md#pact-071), [PACT-072](phase-3-season-one.md#pact-072), [PACT-073](phase-3-season-one.md#pact-073), [PACT-074](phase-3-season-one.md#pact-074), [PACT-075](phase-3-season-one.md#pact-075), [PACT-076](phase-3-season-one.md#pact-076), [PACT-077](phase-3-season-one.md#pact-077), [PACT-078](phase-3-season-one.md#pact-078), [PACT-079](phase-3-season-one.md#pact-079), [PACT-095](phase-3-season-one.md#pact-095), [PACT-097](phase-3-season-one.md#pact-097)

**Components:** full-season release validation.

**Specification:** [delivery](../pact/delivery.md) · **Release checks:** L01, L02, L03, L04, L05

**Implement / deliver**

- Run an accelerated complete season against the release candidate, then validate signup/invitations, mixed-provider negotiations, scarcity, raids, privacy deletion, public evidence, purchases/refunds, and final honors.
- Execute final accessibility, load, security, provider-error, and recovery regressions at the planned release capacity and record the tested limit.

**Acceptance**

- [ ] L01–L06 have linked evidence; no asset/progression/receipt inconsistency appears across the season boundary or a restore.
- [ ] Critical defects are fixed and their affected scenarios rerun; a 50-player slice test is not mislabeled proof of unlimited global-world capacity.

<a id="pact-081"></a>
## PACT-081 — Accept and prepare the Season One release

**Status:** todo · **Role:** Release · **Size:** S · **Type:** gate

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070), [PACT-071](phase-3-season-one.md#pact-071), [PACT-072](phase-3-season-one.md#pact-072), [PACT-073](phase-3-season-one.md#pact-073), [PACT-074](phase-3-season-one.md#pact-074), [PACT-075](phase-3-season-one.md#pact-075), [PACT-076](phase-3-season-one.md#pact-076), [PACT-077](phase-3-season-one.md#pact-077), [PACT-078](phase-3-season-one.md#pact-078), [PACT-079](phase-3-season-one.md#pact-079), [PACT-080](phase-3-season-one.md#pact-080), [PACT-084](phase-3-season-one.md#pact-084), [PACT-087](phase-3-season-one.md#pact-087), [PACT-093](phase-3-season-one.md#pact-093), [PACT-094](phase-3-season-one.md#pact-094), [PACT-095](phase-3-season-one.md#pact-095), [PACT-097](phase-3-season-one.md#pact-097)

**Components:** Season One release gate.

**Specification:** [delivery](../pact/delivery.md), [product](../pact/product.md) · **Release checks:** L01, L02, L03, L04, L05, L06

**Implement / deliver**

- Assemble the release revision, schema/rules versions, supported-client matrix, migration plan, tested capacity, operator roster, rollback runbook, season configuration, and pass/fail register. Include native/Telegram builds, store approval evidence, and the tested client capability matrix.
- Prepare the deploy command and controlled signup enablement; actual release execution is a separate explicit operational action, not an effect of generating this backlog.

**Acceptance**

- [ ] Every L01–L06 criterion passes, including native/Telegram distribution, verified payments, and the complete channel matrix; all blocking defects/external reviews are closed.
- [ ] The release record names who can pause/recover the world and provides a reproducible go/no-go checklist; no task is marked completed merely because it is scheduled.
