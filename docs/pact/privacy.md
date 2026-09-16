# Privacy and conduct policy

**Version 1.1 · Required from the first real account, including a private connection test.**

Native devices and Telegram are covered by the same policy. [Architecture](architecture.md) specifies their linking, token retention, channel disclosure, and store-payment behavior.

## Policy decision

PACT keeps the data needed to run the game, short-lived private conversation history, and a bounded competitive audit trail. It does not sell player data, use advertising trackers, or train models on player content. Model providers receive only the context needed for the run the player requested. Players can export their data, disconnect a model, revoke a chatbot, and delete their account from Settings.

These are adopted product requirements. The retention periods below are design choices, not periods prescribed universally by law. They follow the principles of purpose limitation, limited storage, and rights handling described by the European Data Protection Board. [Data protection basics](https://www.edpb.europa.eu/sme/learn-the-basics/data-protection-basics_en), [individual rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en).

## What people are told

Before connecting a model: **“Your selected provider receives your instructions and the game information needed for this run. Provider billing and data policies also apply. PACT never sends your email, password, or API keys as model context.”**

Before first game correspondence: **“These are private game messages between participants. Either participant can publish authentic excerpts as game evidence. Keep real-world personal or confidential information out of them. Your private instructions to your Envoy are separate.”**

Before a run: show the provider, model, allowances, and whether an upstream router is involved. Before publishing: show the exact selected contents and named participants. Exporting or deleting an account is a human setting, never an action obtained by persuading its Envoy.

## Data inventory and retention

All periods in this table use **real time**, unaffected by a world pause. Purge jobs run daily and have a one-day maximum processing tolerance; the deletion-request deadline below takes precedence.

| Data | Purpose | Retention and deletion rule |
| --- | --- | --- |
| Email, password hash, preferences, consent records | Account and recovery | While account exists; remove within 30 days of deletion, except narrowly required records below |
| Unverified account / unused kingdom draft | Complete setup | Seven days; verified account may remain after draft expires |
| Encrypted provider key and connection label | Player-requested inference | Until disconnect/replacement/account deletion; deny use immediately and remove live encrypted copy within 24 hours |
| Linked Telegram user/chat IDs and native push registrations | Authenticated channel access and optional delivery | While linked; disable immediately and purge live identifiers/tokens within 24 hours after unlink/deletion; backup and case-hold exceptions follow this table |
| Web sessions, native/channel sessions, OAuth grants, reset tokens | Authenticate access | Through their specified expiry; revoked immediately when requested, expired material purged within 24 hours |
| Private instructions, run summaries, model request/response content | Explain the player's own runs | 30 days; user can clear sooner. Store no hidden chain-of-thought and request no separate reasoning transcript |
| In-game private messages and declined/expired offer prose | Negotiation and recent context | 90 days from creation; a published excerpt is a separate public record |
| Active contracts, troop ownership, balances, current mandate and identity relations | Operate the current game | While active; close deterministically on retirement. Keep only necessary current state beyond normal event-history retention |
| Command receipts, closed contracts, economic/combat events, score samples | Reconcile disputes and competitive results | 180 days from event or closure; current ownership/balance checkpoints survive without old message prose |
| Published Seals, stories, Article versions, historical public events | Player-directed sharing and game evidence | Up to 180 days; author removal or moderation hides hosted content immediately. Active Articles/Court descriptions remain until replaced or removed |
| Earned cosmetic entitlements and final season honors | Preserve progression | While account exists, as compact entitlement records; no permanent raw transcript required |
| Raw IP/edge request metadata | Immediate abuse/security detection | Seven days; no browser fingerprinting for behavioral advertising |
| Authentication/security audit events | Investigate account compromise | 90 days, with IP removed after seven days unless attached to a specific active incident |
| Product event analytics | Measure setup, returns, and completed game actions | Pseudonymous events for 90 days; thereafter only aggregates without player IDs, small identifiable cohorts, or message content |
| Reported evidence and moderation case | Investigate a specific report and appeal | Through resolution and 180 days afterward, restricted to authorized staff |
| Export archive | Deliver requested copy | Seven days after generation, then delete |
| Backups | Disaster recovery | Rolling 35 days; restore must reapply deletion/revocation records before access resumes |

Use processor-hosted checkout on web, native store billing on iOS/Android, and Telegram Stars inside Telegram. The commerce adapters and origin-tagged paid balances are specified in [architecture](architecture.md). PACT stores receipt identifiers, entitlements, amount/currency, and refund state, never full card data. Financial record retention follows the merchant's applicable statutory schedule, recorded by jurisdiction in the deployment policy; do not retain unrelated conversations with a receipt. The first paid release requires that schedule and merchant identity to be configured. There is no paid checkout in the connection experiment or rules prototype.

A legal preservation requirement or an active security case can restrict deletion of specific relevant records. Record the basis, scope, access, and review date; review at least every 90 days and delete when it ends. “Might be useful someday” is not a retention basis. Pseudonymous kingdom identifiers can still be personal data; changing a name is not proof of anonymization.

## Provider disclosure and storage

PACT infrastructure is hosted in the EU region specified in [runtime](runtime.md). Telegram receives bot messages sent through its service, and Apple/Google receive the platform data needed for push and purchases. Their independent copies are outside PACT’s direct deletion control; disclose these routes and keep notification previews minimal. Raw Telegram updates are discarded after validation/normalization, with deduplication IDs retained for 24 hours. No contacts, phone numbers, or location permission is required. Model requests and external chatbot tool results may be processed in other regions under the selected provider's terms. Do not advertise end-to-end EU residency. Maintain a public subprocessor/provider list, current processing agreements, and applicable international-transfer safeguards before handling real accounts.

Each run receives only selected conversations, authorized records, the player's current objective, and mandate. Do not routinely send the entire account archive. Model credentials remain in a separate encrypted store. Disable provider-side request storage where the API supports that option, but do not claim this overrides the provider's own retention obligations or account settings. Disconnection stops new transfers; it does not delete data already held by an independent provider.

Administrative access is least-privilege and logged. Staff cannot casually browse private prompts. Support access to private content requires a specific report or user-granted support scope with an expiry. Logs and telemetry redact tokens, passwords, message bodies, and provider request payloads.

## Export

The human re-authenticates and requests an export. Within 24 hours, produce JSON plus a readable index containing their account settings, current kingdom, commitments, permitted history, messages they participated in, their private run records, and cosmetic entitlements. Exclude secrets, hidden counterpart information, internal abuse-detection signals, and other accounts' private instructions. The authenticated download link expires after seven days; email only says it is ready.

Privacy rights requests receive an acknowledgement within 72 hours and a substantive response within one month; any legally permitted extension is explained within that first month. Self-service controls handle ordinary requests without a support conversation. These operational targets supplement, rather than replace, applicable individual rights. [EDPB rights guidance](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en).

## Delete account and retire kingdom

Deletion is confirmed by the authenticated human after recent password verification. Show the effects on pending attacks, contracts, Court ownership, purchases, and irreversible account access. Offer export before final confirmation; do not force an export or require another player to release a contract.

1. **Immediately:** mark the kingdom `closing`, stop Envoys, revoke web/native/Telegram sessions, channel links, push subscriptions, MCP grants, and model use, remove public profile prose and unpublished/private run content from user access, revoke invitations, and reject new economic/military commitments involving the closing kingdom. Do not transfer its balance to another account. Disable reactivation; this is account deletion, not a tactical vacation mode.
2. **Existing engagements:** already-declared raids and scouts involving it keep their original deadlines and resolve normally. The kingdom cannot escape an accepted raid by deleting its account. No new raid/scout can target a closing kingdom. Stop supply contracts as owner-initiated default, distribute bonds under normal rules, and record the cause. Return visiting troops and recall lent troops immediately unless locked; locked units return after their already-locked engagements finish. A closing owner cannot seize or issue new orders.
3. **After the last accepted engagement:** retire the kingdom, discard remaining stocks and owned units, remove it from competitive reward eligibility, and close any ownerless Court as specified in [social](social.md). Returned units whose owner is also retired are removed, never granted to a third party. Exclude closing units from new defensive locks after an exit is queued. Normally the last accepted raid resolves within 21 game minutes; a world suspension freezes that game work but cannot extend the personal-data deletion deadline.
4. **Within 30 real days:** delete account email/hash, credentials, private content, analytics links, and hosted public prose attributable to the deleted account. Replace the public identity in retained necessary ledger events with **Retired kingdom**. Retain a minimal pseudonymous transaction tombstone only through the stated audit window, or as current state where necessary to reconcile another active player's assets. During a long world pause, those game records can settle later without retaining account identity or credentials.
5. **Backups:** old encrypted copies age out within 35 days after their last inclusion in a backup, at most 65 days after a deletion request for material removed on day 30. A restore applies the deletion registry before serving traffic. Restrict deletion-registry IDs to this recovery purpose and purge them after all affected backups expire.

Deletion cannot remove screenshots, exported Seals, or copies held by other participants or external providers. PACT removes hosted content where required and sends applicable downstream erasure notices; it does not promise to erase the internet. Current-player compact achievements can persist without exposing the deleted party's identity or conversation. A deleted account cannot preserve rank rewards by immediately founding again under another email.

## Competitive conduct

PACT permits deception about game intentions, broken bargains, tribute demands, selective authentic quotation, and attacks on former allies. **“Send 70 Silver or I will raid your kingdom”** concerns an allowed game action. Threatening real-world harm, exposing someone's address, or demanding external money does not.

Prohibit real-world threats, doxxing, sexual exploitation, hate-based harassment, identity impersonation, targeted personal abuse, evading a block through alternate accounts, credential theft, and account farming. A model producing the message does not exempt its owner. The interface marks player claims and agent assessments; it must not turn repeated allegations into a factual system badge.

Every message, public post, and profile has Report. Record the identified content and context already available to the reporter. A moderator can hide content, suspend messaging, suspend play, or close an account with an audit reason. Urgent threats/exposed personal data receive priority triage within 24 hours; ordinary reports within 72 hours. Appeals are accepted for 14 days and reviewed by a different staff member within seven days. Suspend recruitment if the pilot cannot staff that service.

The game is 18+, including testing with real players. No identity document is collected by default. Verified underage accounts are closed under the same privacy process. English is the interface, policy, and support language; reports on other-language player content use approved translation with the original retained in the case record.

## Publication requirements

Before any real signup, publish the controller's actual legal name, contact address, privacy contact, processor list, processing purposes/lawful bases, rights and complaint route, and terms version. Use contract necessity for core account/game operation, documented legitimate interests for proportionate security/abuse handling, optional consent for nonessential analytics/marketing, and the appropriate legal basis for statutory records. No advertising or marketing consent is required to play.

The controller identity, regional legal notices, and payment record schedule are deployment facts that cannot be invented in a design document. Missing values disable registration or checkout respectively. This package specifies the system behavior; it does not claim legal review or worldwide compliance has already happened.
