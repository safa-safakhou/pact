# PACT — Version 1.4 specification

**Decision baseline: Version 1.4, 1 October 2026. Status: specified; implementation evidence is tracked separately.**

**Current testing scope:** the [game-only Alpha](alpha.md), [generated web experience](experience.md) and [friends playtest](../implementation/friends-playtest.md) are implemented. The [backend population experiment](../implementation/reports/population-playtest-20261004.md) is complete. **24 production tasks remain deferred.** These testing results do not certify the broader release requirements below. Game mechanics and existing authority boundaries remain unchanged.

**Implementation work:** [130 dependency-ordered tickets](../implementation/README.md): 106 Done and 24 deferred. The handoff and completion reports own current execution status; the baseline specifications below retain their original later-release requirements.

PACT is a competitive, persistent kingdom game. You build your kingdom and set your priorities. Your Envoy negotiates with other players' Envoys, makes agreements within your authority, and brings consequential choices back to you. Everyone shares one world. Relationships are chosen by players; the engine enforces resources, ownership, deadlines, and signed actions.

## The decisions

| Subject | Full later-release decision (Alpha exceptions above) |
| --- | --- |
| Where people play | Web/PWA, native iOS/Android apps, Telegram Mini App and bot, and certified external assistant clients |
| Models in PACT | OpenAI, Anthropic, Google Gemini, xAI, and OpenRouter; one replaceable connection per active run |
| Connecting a model | Official provider authorization where available; otherwise a provider API key. OpenRouter supports both. Consumer chatbot subscriptions are not represented as API credentials |
| Chatbot access | Authenticated MCP with ChatGPT, Claude, and Gemini CLI certification, plus a Grok-powered external tool-client fixture; consumer-app support is labeled only after that host passes |
| Identity | A PACT email/password account owns the kingdom. Model credentials and MCP grants are separate, revocable connections |
| Agent execution | A player starts a bounded run. Notifications accumulate while no agent is running. The scheduler never starts model inference |
| Approval | One PACT approval inbox, usable on phone or desktop and linked from the chatbot. Only the authenticated human can approve an exception |
| Money | Gems and cosmetics exist. Purchases never improve progression, armies, resources, quotas, or presence |
| Privacy | Encrypted credentials, limited retention, account export/deletion, and explicit disclosure before sealable game correspondence |
| Release | Connection experiment → transactional rules prototype → social slice → Season One release |

## Read the document for the job

| Document | Purpose and authority |
| --- | --- |
| [Administrator operations](administration.md) | Independent staff dashboard, setup, observation and existing moderation management; no kingdom required |
| [Bounded generated web experience](experience.md) | Current presentation extension: frozen asset inventory, ambition and factual guidance; no economy/channel/authority changes |
| [Game-only Alpha scope](alpha.md) | Current private finish line, active 13 tickets, explicit deferrals and G01–G06 acceptance; overrides broader release/channel/pilot gates only |
| [Product brief](product.md) | Player promise, screens, first session, season, progression, and monetization |
| [Channels and reusable architecture](architecture.md) | Client coverage, shared modules, native/Telegram identity, cross-channel state, payments, and portability |
| [Account and connection specification](access.md) | Signup, model routes, MCP authentication, protocol compatibility, and onboarding |
| [Execution contract](runtime.md) | Who runs the Envoy, authority, approvals, notifications, API transactions, and hosting |
| [Game rulebook](rules.md) | All economic values, unit rules, contracts, combat, scoring, and time boundaries |
| [Identity, society, and evidence](social.md) | Handles, Articles, Courts, invitations, blocks, Seals, and combat randomness |
| [Privacy and conduct policy](privacy.md) | Data collection, retention, deletion, reporting, and account closure |
| [Build and acceptance checklist](delivery.md) | Ordered implementation milestones and observable pass/fail conditions |

Version 1.1 superseded the earlier PWA-only release scope. Version 1.2 replaced the AWS-specific hosting prescription with one reproducible EU-hosted VPS. Version 1.3 fixes the zero-cost MVP boundary: encrypted backups and captured transactional email stay on that VPS during private development, with the accepted risk that server loss destroys both live data and local backups; off-host disaster recovery and real outbound email return as production-hardening requirements. It also defers paid native signing, physical-device certification, and full native gameplay until Season One release work, after web and Telegram gameplay have been validated. The architecture document owns cross-channel extensions; access/runtime/privacy keep ownership of their base contracts. Each subject has one owner in this table. Other documents link to it instead of maintaining competing rules. Changes require a new specification version, affected acceptance checks, and a player-facing rules notice when gameplay changes. Historical documents 00–34 remain research history; they do not override this package.

This baseline fixes implementation decisions. Provider certification, security checks, economic playtests, and growth measurements are work to perform against it, not unanswered founder decisions or claims of results already obtained.

## Where the review gaps are closed

| Review item | Definitive location |
| --- | --- |
| Provider routes, human login, draft before activation | Account and connection specification |
| Waking, session limits, closed-browser approval, offline alerts | Execution contract |
| Monetization, progression, Gems | Product brief |
| Data retention, deletion, age, conduct, language | Privacy policy; access specification for signup |
| Articles, Courts, handles, invitations, block/mute | Identity, society, and evidence |
| Starting charges, regeneration, Home Guard, unit IDs, casualty groups | Game rulebook |
| Future outgoing authority reservations and settlement | Execution contract |
| Exact signatures, seed commitment, seed-to-dice derivation | Identity, society, and evidence, including a fixed randomness fixture |
| Database, scheduler, live updates, hosting, outage behavior | Execution contract |
| Tribute | Allegiance in the social specification plus ordinary supply contracts in the rulebook; no separate tax engine |
| Cost, intelligence trade, script performance, pride, stability, fairness | Measurable acceptance and playtest work in the build checklist |

## ChatGPT extension, 6 October 2026

[ChatGPT play and agent freedom](chatgpt.md) owns the founder-authorized personal plugin, private free-form notes and actual interaction view. It supersedes fixed ambition choices in the experience design.

[Hall of Stories and collections](collections.md) owns the versioned catalog and cosmetic-only extension, with separate implementation acceptance.

## Optional agent interfaces correction — 13 October 2026

PACT-168 adds optional A2A alongside API, MCP and tool calling with shared game rules/permissions. It is disabled by default and locally verified, not deployed. The dated architecture/access/runtime/privacy corrections own this additive interface; the baseline economy and historical external-client certification remain unchanged. See [setup](../api/a2a.md) and [completion evidence](../implementation/reports/optional-a2a-20261013.md). Existing agents, accounts, counters, grants, models and schedules are preserved.
