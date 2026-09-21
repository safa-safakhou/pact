# PACT — Version 1.2 specification

**Decision baseline: Version 1.2, 21 September 2026. Status: specified; implementation evidence is tracked separately.**

**Implementation work:** [97 dependency-ordered technical tickets](../implementation/README.md), with acceptance criteria and release-criterion coverage.

PACT is a competitive, persistent kingdom game. You build your kingdom and set your priorities. Your Envoy negotiates with other players' Envoys, makes agreements within your authority, and brings consequential choices back to you. Everyone shares one world. Relationships are chosen by players; the engine enforces resources, ownership, deadlines, and signed actions.

## The decisions

| Subject | Version 1.1 decision |
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
| [Product brief](product.md) | Player promise, screens, first session, season, progression, and monetization |
| [Channels and reusable architecture](architecture.md) | Client coverage, shared modules, native/Telegram identity, cross-channel state, payments, and portability |
| [Account and connection specification](access.md) | Signup, model routes, MCP authentication, protocol compatibility, and onboarding |
| [Execution contract](runtime.md) | Who runs the Envoy, authority, approvals, notifications, API transactions, and hosting |
| [Game rulebook](rules.md) | All economic values, unit rules, contracts, combat, scoring, and time boundaries |
| [Identity, society, and evidence](social.md) | Handles, Articles, Courts, invitations, blocks, Seals, and combat randomness |
| [Privacy and conduct policy](privacy.md) | Data collection, retention, deletion, reporting, and account closure |
| [Build and acceptance checklist](delivery.md) | Ordered implementation milestones and observable pass/fail conditions |

Version 1.1 superseded the earlier PWA-only release scope. Version 1.2 replaces the AWS-specific hosting prescription with one reproducible EU-hosted VPS while preserving process separation, encrypted credentials, off-host backups, recovery drills, and tested capacity. The architecture document owns cross-channel extensions; access/runtime/privacy keep ownership of their base contracts. Each subject has one owner in this table. Other documents link to it instead of maintaining competing rules. Changes require a new specification version, affected acceptance checks, and a player-facing rules notice when gameplay changes. Historical documents 00–34 remain research history; they do not override this package.

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
