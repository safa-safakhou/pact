# Phase 2 — Social slice

**20 tickets · 1 completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)

Dependencies are completion requirements. The approved Alpha track depends on the completed rules gate, not postponed production/pilot gates. Other phases retain their original gates. Only Alpha tickets are currently authorized. Owner roles are disciplines, not assigned people; size is not a time commitment.

<a id="pact-054"></a>
## PACT-054 — Implement public profiles and handle lifecycle

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053)

**Components:** identity profiles and handles.

**Specification:** [social](../pact/social.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** G01

**Implement / deliver**

- Expose exact, case-insensitive handle search and public kingdom profiles through shared HTTP/MCP reads so agents can find real players without UUIDs.
- Keep immutable kingdom identity, display-name validation and deletion tombstones. Alpha handles remain fixed; rename/history/redirect lifecycle is postponed.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [x] Exact-handle search resolves an active founded kingdom case-insensitively; unfounded, closing, deleted and unknown identities do not expose private records.
- [x] Public profiles return identity and committed public records only, never stocks, building levels, troops, private contracts or online state; HTTP and MCP return equivalent projections.

**Assignee:** Mohammad Safakhou

**Evidence**

- docs/implementation/reports/public-player-discovery.md
- 8d1a2f0: Node 24.19 build/typecheck/lint; 175 unit; 227 integration passed (one optional local-model skipped); exact public HTTP/MCP lookup parity and negative paths.

<a id="pact-055"></a>
## PACT-055 — Implement every invitation destination and redemption rule

**Status:** in_progress · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054)

**Components:** invitation service and landing pages.

**Specification:** [social](../pact/social.md), [access](../pact/access.md), [product](../pact/product.md), [alpha](../pact/alpha.md) · **Release checks:** G01

**Implement / deliver**

- Deliver simple contact and Court invitation links with explicit human acceptance, destination preservation, expiry, revoke and retry-safe redemption.
- Support truthful notice/story destinations as their records arrive; no referral programme, provider-specific onboarding extension or elaborate sharing campaign.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [ ] Opening a link changes no contact/membership; explicit acceptance grants only its stated destination, and duplicate acceptance consumes no extra use.
- [ ] Expired, revoked or full invitations show their real status; signup/login retains the intended destination and concurrent last-use redemption accepts only one new account.

**Assignee:** Mohammad Safakhou

**Evidence**

- docs/implementation/reports/invitations.md
- 1 Oct 2026: Alpha contact/Court invitation acceptance verified on Node 24.19 / npm 11.19 / disposable PostgreSQL 17. Build/typecheck/lint, 179 unit and 240 integration passed (one optional local-model skipped); 13 focused invitation tests; backlog render/check and diff check passed. Shared human dispatcher, actual Court membership redemption, final-use and three-Court races, draft destination retention, status/revoke/retry/block and owner lifecycle coverage. No new deployment or live model/Chrome observation.

<a id="pact-056"></a>
## PACT-056 — Implement Court membership, roles, and lifecycle

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-055](phase-2-social.md#pact-055)

**Components:** Court service.

**Specification:** [social](../pact/social.md), [runtime](../pact/runtime.md), [alpha](../pact/alpha.md) · **Release checks:** G01

**Implement / deliver**

- Implement Court community pages, separate handles, open/request/invite membership, paginated rosters, owner/moderator roles and pinned notices using shared commands.
- Implement consented ownership transfer, leave/removal and closure without creating shared resources, army control, enforced allegiance or automatic contract cancellation.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [ ] Create/join/leave, requests and invitations obey membership/ownership limits and role rules, including concurrent joins and consented transfer.
- [ ] Leaving or closing a Court preserves independent contacts, contracts, troops and allegiance; an invitation grants membership only.

<a id="pact-057"></a>
## PACT-057 — Implement Articles and mutual allegiance

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054)

**Components:** Articles and allegiance.

**Specification:** [social](../pact/social.md), [runtime](../pact/runtime.md), [alpha](../pact/alpha.md) · **Release checks:** G01

**Implement / deliver**

- Implement versioned human-published Articles with publish/replace/withdraw, three-active limit and publication quota.
- Implement mutual allegiance proposals, exact human signatures, expiry, one direct patron, cycle prevention, public graph reads and immediate termination.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [ ] Concurrent signatures or patron changes never create cycles or multiple direct patrons; edited/expired terms cannot use stale signatures.
- [ ] Articles and allegiance create no automatic tribute, asset transfer, military authority, free intelligence, immunity or cancellation of other contracts.

<a id="pact-058"></a>
## PACT-058 — Implement signed excerpts and the evidence viewer

**Status:** todo · **Role:** Security · **Size:** L · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-042](phase-1-rules.md#pact-042), [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054)

**Components:** evidence signing and viewer.

**Specification:** [social](../pact/social.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** G01

**Implement / deliver**

- Implement participant-selected signed message/scout/battle excerpts, source digests, valid UTF-8 ranges and omission labels; expose verification and a plain evidence viewer.
- Require human publication review and label authenticity separately from truth. Automated rotation, compromised-key operational certification and platform case tooling are postponed.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [ ] Participants can publish and agents can read/verify exact selected evidence; altered bytes, invalid ranges and nonparticipant originals fail.
- [ ] Complete and omitted excerpts have distinct context labels; private omitted content remains unavailable and a hidden/removed hosted source is not resurrected by the viewer.

<a id="pact-059"></a>
## PACT-059 — Implement Chronicle stories, notices, and public share pages

**Status:** todo · **Role:** Frontend · **Size:** L · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-055](phase-2-social.md#pact-055), [PACT-056](phase-2-social.md#pact-056), [PACT-057](phase-2-social.md#pact-057), [PACT-058](phase-2-social.md#pact-058)

**Components:** Chronicle and public pages.

**Specification:** [social](../pact/social.md), [product](../pact/product.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** G01, G03

**Implement / deliver**

- Deliver private chronological history, public notices/opportunities and deliberately published Chronicle stories with factual outcomes, selected evidence and author/Court filters.
- Provide simple preview/publish/remove and copyable public links. Elaborate share-card artwork, growth analytics and platform moderation workflows are postponed.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [ ] Agents discover actual notices/players and inspect deliberately published stories; a story link shows the recorded outcome and its real destination.
- [ ] Publication preview and reads distinguish engine facts from player commentary and never publish private objectives, live reserves, omitted evidence or entire transcripts by default.

<a id="pact-060"></a>
## PACT-060 — Deliver opt-in critical email and Web Push

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-022](phase-0-connections.md#pact-022), [PACT-053](phase-1-rules.md#pact-053), [PACT-055](phase-2-social.md#pact-055)

**Components:** notification worker and preferences.

**Specification:** [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [architecture](../pact/architecture.md), [alpha](../pact/alpha.md) · **Release checks:** S03

**Implement / deliver**

- Implement notification preferences, browser subscriptions, delivery jobs, deduplication, ten-minute grouping, unsubscribe/revocation, and privacy-safe authenticated deep links.
- Connect raid/default/starvation/approval events and routine completion/expiry events to their specified channel rules.
- Expose a channel-neutral delivery port; native and Telegram implementations are PACT-090, sharing the same inbox/category preferences.

**Acceptance**

- [ ] No push permission or email opt-in means no optional delivery; security mail remains transactional.
- [ ] Offline delivery failure changes no deadline and invokes no LLM; previews expose no amounts or message text and a stale link cannot approve an expired action.

<a id="pact-061"></a>
## PACT-061 — Complete the first-session and social interface

**Status:** todo · **Role:** Frontend · **Size:** L · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-055](phase-2-social.md#pact-055), [PACT-056](phase-2-social.md#pact-056), [PACT-057](phase-2-social.md#pact-057), [PACT-059](phase-2-social.md#pact-059)

**Components:** first-session and social UI.

**Specification:** [product](../pact/product.md), [access](../pact/access.md), [social](../pact/social.md), [alpha](../pact/alpha.md) · **Release checks:** G04

**Implement / deliver**

- Complete one simple web interface: Kingdom, Envoy, People and Chronicle, including profiles/Courts, notices, readable offers/contracts, inbox decisions and result cards.
- Show real founding-to-first-consequence onboarding, explicit objective/run start/stop and pending/approval/waiting states; use the existing in-game inbox without email/Web Push requirements.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [ ] A newcomer can found, build, meet/negotiate and inspect a real consequence or truthful pending outcome; invitation destination survives connection.
- [ ] The web view makes the next decision understandable, shows exact versioned contract effects and labels pending counterparties rather than fabricating replies or success.

<a id="pact-062"></a>
## PACT-062 — Improve Envoy context selection and result explanations

**Status:** todo · **Role:** Integrations · **Size:** M · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-049](phase-1-rules.md#pact-049), [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-056](phase-2-social.md#pact-056), [PACT-057](phase-2-social.md#pact-057), [PACT-058](phase-2-social.md#pact-058), [PACT-059](phase-2-social.md#pact-059)

**Components:** Envoy context and summaries.

**Specification:** [runtime](../pact/runtime.md), [product](../pact/product.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** G02, G03

**Implement / deliver**

- Build objective/mandate-first compact context from selected conversations, permitted social/evidence records and factual history within existing run allowances.
- Produce concise result explanations with supporting record IDs: committed, proposed, failed, waiting and approval-needed; separate agent assessments from engine facts and suggest a next step.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [ ] A negotiation report accurately separates committed actions, proposals, failures and human decisions and links their receipts/records; factual offline summaries invoke no model.
- [ ] Long/adversarial conversations remain bounded and cannot change identity/authority or expose withheld records; ordinary busy/stale action feedback supports replanning instead of pretending success.

<a id="pact-063"></a>
## PACT-063 — Build reporting, moderation, and appeals tools

**Status:** todo · **Role:** Backend · **Size:** L · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-056](phase-2-social.md#pact-056), [PACT-058](phase-2-social.md#pact-058), [PACT-059](phase-2-social.md#pact-059)

**Components:** reporting, moderation console.

**Specification:** [privacy](../pact/privacy.md), [social](../pact/social.md), [alpha](../pact/alpha.md) · **Release checks:** S05

**Implement / deliver**

- Implement report submission from messages/profiles/posts, relevant-evidence capture, case queues, priority deadlines, staff access logs, and English support tooling.
- Add hide/message-suspend/play-suspend/close actions, Court-versus-platform permissions, legal-hold scope, appeals, and deletion/retirement integration.

**Acceptance**

- [ ] A moderator sees only case-authorized private evidence and cannot use role powers to transfer game assets.
- [ ] Seeded doxxing and abuse cases can be hidden and appealed with audit reasons; a different reviewer handles the appeal and expired evidence is purged.

<a id="pact-064"></a>
## PACT-064 — Extend privacy workflows to the complete social world

**Status:** todo · **Role:** Security · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-050](phase-1-rules.md#pact-050), [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-055](phase-2-social.md#pact-055), [PACT-056](phase-2-social.md#pact-056), [PACT-057](phase-2-social.md#pact-057), [PACT-058](phase-2-social.md#pact-058), [PACT-059](phase-2-social.md#pact-059), [PACT-063](phase-2-social.md#pact-063)

**Components:** social retention and deletion.

**Specification:** [privacy](../pact/privacy.md), [social](../pact/social.md), [alpha](../pact/alpha.md) · **Release checks:** S05

**Implement / deliver**

- Register every new table/blob/cache/export with its retention class and add profile, handle history, Court, Article, Seal, story, invitation, and case cleanup.
- Implement hosted-content removal, restricted case holds, account-data export, deleted-owner Courts, and downstream erasure records where applicable.

**Acceptance**

- [ ] Deletion during combat plus Court ownership preserves only necessary economic state while removing identifying/private data within real-time deadlines.
- [ ] Restoring a backup or regenerating a share preview cannot resurrect removed content; exports never include a counterparty’s withheld private data.

<a id="pact-065"></a>
## PACT-065 — Implement privacy-bounded product measurement

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-061](phase-2-social.md#pact-061), [PACT-062](phase-2-social.md#pact-062), [PACT-064](phase-2-social.md#pact-064)

**Components:** product event pipeline and dashboards.

**Specification:** [delivery](../pact/delivery.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** S06, S07

**Implement / deliver**

- Instrument activation, meaningful actions, setup failures, shares/referrals, run use, and return windows using structured events and stable pseudonymous IDs.
- Add dashboards for the defined denominators and observation windows; distinguish API-metered cost, unknown pricing, and optional external-host self-report.

**Acceptance**

- [ ] Raw prompts/messages and provider secrets never enter analytics; events expire at 90 days before de-identified aggregation.
- [ ] Day-8–14 returns, referred-player windows, incomplete observation, and intelligence-sale labels can be reproduced from fixtures without counting opens as meaningful play.

<a id="pact-088"></a>
## PACT-088 — Deliver the complete Telegram Mini App

**Status:** todo · **Role:** Frontend · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-061](phase-2-social.md#pact-061), [PACT-083](phase-0-connections.md#pact-083), [PACT-085](phase-0-connections.md#pact-085)

**Components:** Telegram web shell, shared DOM features.

**Specification:** [architecture](../pact/architecture.md), [product](../pact/product.md), [alpha](../pact/alpha.md) · **Release checks:** S08

**Implement / deliver**

- Reuse web feature components in the Telegram shell with safe areas, themes, resize/back-navigation behavior, linking state, account controls, and invitation destinations.
- Implement dashboard/gameplay/Envoy/social flows and exact approvals; route sensitive credential entry through the secure PACT flow.

**Acceptance**

- [ ] The same user can start in web, inspect in Telegram, and approve the current exact offer without losing destination or duplicating effects.
- [ ] Telegram UI differences never change rules or expose private content; invalid/expired channel sessions reauthenticate before any write.

<a id="pact-089"></a>
## PACT-089 — Implement private-chat bot briefings and explicit run controls

**Status:** todo · **Role:** Integrations · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-049](phase-1-rules.md#pact-049), [PACT-053](phase-1-rules.md#pact-053), [PACT-055](phase-2-social.md#pact-055), [PACT-062](phase-2-social.md#pact-062), [PACT-085](phase-0-connections.md#pact-085)

**Components:** Telegram bot commands, explicit start confirmation.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** S08

**Implement / deliver**

- Implement /world, /inbox, /status, /stop, and objective previews for /run/free text; use deterministic state summaries unless the user explicitly starts inference.
- Bind Start run to one owner/objective/model/allowance and short-lived one-use callback. Link game approvals to authenticated visual sheets, never chat-only approval.

**Acceptance**

- [ ] Repeated/forwarded/expired buttons cannot start extra runs; a message or notification alone starts no inference.
- [ ] Groups, unlinked accounts, and agent-generated chat cannot invoke human approvals; /stop acts on the same global run and private summaries exclude credentials.

<a id="pact-090"></a>
## PACT-090 — Add Telegram notification delivery

**Status:** todo · **Role:** Backend / Mobile · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-060](phase-2-social.md#pact-060), [PACT-088](phase-2-social.md#pact-088), [PACT-089](phase-2-social.md#pact-089)

**Components:** Telegram delivery.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** S03, S08

**Implement / deliver**

- Extend the reusable dispatcher with bot delivery, account/category/channel preferences, grouping, endpoint invalidation, and audience-safe deep links. APNs/FCM delivery is deferred with native clients to PACT-087.
- Persist one inbox event regardless of how many devices subscribe; deduplicate each external delivery by event/group/channel/endpoint.

**Acceptance**

- [ ] A burst produces the specified grouped notifications without exposing sensitive amounts/text or waking inference.
- [ ] Revoked sessions, blocked bot, unlinked identity, and failed bot delivery never alter game deadlines or lose the durable inbox event.

**External prerequisites:** APNs and Firebase credentials; test-device push entitlement.

<a id="pact-091"></a>
## PACT-091 — Complete cross-channel session and privacy lifecycle

**Status:** todo · **Role:** Security · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-064](phase-2-social.md#pact-064), [PACT-088](phase-2-social.md#pact-088), [PACT-089](phase-2-social.md#pact-089), [PACT-090](phase-2-social.md#pact-090)

**Components:** channel lifecycle, bot subscription cleanup, scoped revocation.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** S05, S08

**Implement / deliver**

- Extend sign-out/reset/export/delete to linked Telegram identities, bot subscriptions, webhook metadata, and product-scoped connection records. Native sessions and push registrations are deferred to PACT-087.
- Process/discard raw Telegram payloads and purge deduplication IDs after 24 hours; remove live channel identifiers within 24 hours of unlink while respecting declared audit/backup rules.

**Acceptance**

- [ ] Account reset or deletion prevents new commands on every surface and records no keys or extra personal data in channel logs. Unlink also stops new work by runs initiated through the revoked channel without rolling back committed game actions.
- [ ] Restore cannot resurrect an unlinked bot/device token; exports include channel links but no third-party secrets or hidden counterpart information.

<a id="pact-092"></a>
## PACT-092 — Verify MVP cross-channel and assistant handoff end to end

**Status:** todo · **Role:** QA · **Size:** L · **Type:** verification

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-065](phase-2-social.md#pact-065), [PACT-086](phase-0-connections.md#pact-086), [PACT-088](phase-2-social.md#pact-088), [PACT-089](phase-2-social.md#pact-089), [PACT-090](phase-2-social.md#pact-090), [PACT-091](phase-2-social.md#pact-091)

**Components:** channel contract tests, race fixtures.

**Specification:** [architecture](../pact/architecture.md), [delivery](../pact/delivery.md), [alpha](../pact/alpha.md) · **Release checks:** S08

**Implement / deliver**

- Run the same account/objective/offer/approval/receipt sequence across web, Telegram, and certified assistant routes. Native handoff is deferred to PACT-097.
- Exercise concurrent approvals, one-write-lease takeover, stale app versions/cursors, lost responses, invitation handoff, offline state, and deletion during a pending action.

**Acceptance**

- [ ] All surfaces converge on one committed result and enforce the same limits without duplicated authority or purchases.
- [ ] A client-specific failure degrades that channel only; state resync and privacy-safe notifications work without automatic reasoning.

<a id="pact-066"></a>
## PACT-066 — Run the social integration and load suite

**Status:** todo · **Role:** QA · **Size:** L · **Type:** verification

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-055](phase-2-social.md#pact-055), [PACT-056](phase-2-social.md#pact-056), [PACT-057](phase-2-social.md#pact-057), [PACT-058](phase-2-social.md#pact-058), [PACT-059](phase-2-social.md#pact-059), [PACT-060](phase-2-social.md#pact-060), [PACT-061](phase-2-social.md#pact-061), [PACT-062](phase-2-social.md#pact-062), [PACT-063](phase-2-social.md#pact-063), [PACT-064](phase-2-social.md#pact-064), [PACT-065](phase-2-social.md#pact-065), [PACT-088](phase-2-social.md#pact-088), [PACT-089](phase-2-social.md#pact-089), [PACT-090](phase-2-social.md#pact-090), [PACT-091](phase-2-social.md#pact-091), [PACT-092](phase-2-social.md#pact-092)

**Components:** social/load validation.

**Specification:** [delivery](../pact/delivery.md), [runtime](../pact/runtime.md), [alpha](../pact/alpha.md) · **Release checks:** S01, S02, S03, S04, S05

**Implement / deliver**

- Run permission, invitation, evidence, notification, deletion, moderation, and agent-injection scenarios end to end.
- Load 50 kingdoms with 12 negotiations each, maximum active contracts, concurrent raids, disconnects, and provider failures; separate provider latency from service time.

**Acceptance**

- [ ] p95 authorized state reads are under 500 ms and command receipts under one second at the specified load, with no skipped or duplicate tick.
- [ ] S01–S05 have recorded passing evidence, including compromised key, removed evidence, blocked messaging, and a privacy restore drill.

<a id="pact-067"></a>
## PACT-067 — Run the three-week social pilot

**Status:** todo · **Role:** Operations · **Size:** L · **Type:** operations

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-066](phase-2-social.md#pact-066)

**Components:** pilot operation and observation.

**Specification:** [delivery](../pact/delivery.md), [privacy](../pact/privacy.md), [product](../pact/product.md), [architecture](../pact/architecture.md), [alpha](../pact/alpha.md) · **Release checks:** S06, S07

**Implement / deliver**

- Recruit 50 invited adults into one world only after technical/privacy checks pass; staff urgent/ordinary reports and appeals to the policy deadlines.
- Conduct ten agency interviews; collect voluntary sharing, referring-player activation, return windows, model expense, and political-outcome observations without referral rewards.
- Include web, native mobile, and Telegram users in the same pilot world; record channel-specific setup failures and handoffs without increasing gameplay quotas.

**Acceptance**

- [ ] Record at least 7/10 correct explanations of a consequential human decision; evaluate 20/50 meaningful returns in days 8–14, five voluntary sharers, and three referred returning players.
- [ ] Report full denominators, incomplete referral windows, staff coverage, incidents, and actual failures; do not mark criteria passed before each observation window closes.

**External prerequisites:** 50 consenting adult players and staffed support.

<a id="pact-068"></a>
## PACT-068 — Accept the social slice

**Status:** todo · **Role:** Release · **Size:** S · **Type:** gate

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-055](phase-2-social.md#pact-055), [PACT-056](phase-2-social.md#pact-056), [PACT-057](phase-2-social.md#pact-057), [PACT-058](phase-2-social.md#pact-058), [PACT-059](phase-2-social.md#pact-059), [PACT-060](phase-2-social.md#pact-060), [PACT-061](phase-2-social.md#pact-061), [PACT-062](phase-2-social.md#pact-062), [PACT-063](phase-2-social.md#pact-063), [PACT-064](phase-2-social.md#pact-064), [PACT-065](phase-2-social.md#pact-065), [PACT-066](phase-2-social.md#pact-066), [PACT-067](phase-2-social.md#pact-067), [PACT-088](phase-2-social.md#pact-088), [PACT-089](phase-2-social.md#pact-089), [PACT-090](phase-2-social.md#pact-090), [PACT-091](phase-2-social.md#pact-091), [PACT-092](phase-2-social.md#pact-092)

**Components:** social release gate.

**Specification:** [delivery](../pact/delivery.md), [alpha](../pact/alpha.md) · **Release checks:** S01, S02, S03, S04, S05, S06, S07, S08

**Implement / deliver**

- Compile S01–S08 evidence and the pilot release revision; distinguish technical checks from observed player behavior.
- Record whether the baseline advances or requires a versioned interaction revision and another pilot.

**Acceptance**

- [ ] All required technical and behavioral thresholds pass before phase 3 begins.
- [ ] If a behavioral threshold fails, retain measured results and block the next gate rather than silently changing the threshold or claiming growth.
