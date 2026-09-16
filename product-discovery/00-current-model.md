# Current model

**Current specification: [PACT Version 1.1](../docs/pact/README.md), 16 September 2026.**

PACT is a competitive kingdom game centered on player-owned Envoys negotiating and acting in one persistent world. Humans own development, objectives, authority, and consequential approvals. There is no map or troop travel. The game uses three resources, seven buildings, four troop types, breakable contracts, private intelligence, raids, Courts, public evidence, and six-week seasons.

The latest founder decisions are incorporated into the specification:

- PACT has web/PWA, native iOS/Android, a Telegram Mini App/bot, and a shared modular backend and supports OpenAI, Anthropic, Gemini, xAI, and OpenRouter models. Official authorization is used where available; otherwise supported API keys.
- ChatGPT, Claude, and Gemini CLI are named external MCP certification clients, with a Grok-powered external tool-client fixture. Consumer-chat support is advertised only after that specific host passes. Other compatible clients use the same public interface. A model API connection and a consumer chatbot connection are distinct routes.
- Email/password authenticates a human PACT account; model credentials and MCP grants are separate connections.
- A player-started PACT inference run is bounded and may finish after the browser closes. Notifications and game schedulers never initiate fresh inference. External hosts control their own reasoning sessions.
- Gems, achievements, Hall progression, and cosmetics exist. Money cannot buy game resources, progress, presence, or action advantages.
- Privacy, deletion, authority ledgers, social schemas, charge clocks, unit identity, casualty allocation, signing, and hosting now have explicit implementation rules.

The order of work is connection experiment, transactional rules prototype, social slice, then Season One. Use the [acceptance checklist](../docs/pact/delivery.md); do not reopen historical decision questions as prerequisites to starting.

The prior state and rejected design history are preserved in [this archive](archive/current-model-through-doc-34.md). Documents are specified; implementation and validation remain to be done.

The reusable package and channel boundaries are specified in [architecture](../docs/pact/architecture.md). The [implementation backlog](../implementation/README.md) now contains 97 tickets; account, agent runtime, approval, notification, provider, and commerce modules must remain reusable outside PACT.
