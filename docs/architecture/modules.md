# Module boundaries

PACT begins as one deployable TypeScript workspace with separately runnable processes. Packages are ownership boundaries, not network services.

PACT-049 integration note (in progress): the earlier sandbox-only description below is historical. The shared dispatcher admits social, construction, troop, contract, scout, garrison, and raid commands through a transaction-bound world-clock port. Authenticated HTTP/MCP adapters expose authorized world/report reads. `GameCommandHandler` is PACT-owned in `@pact/application`; both API and inference compositions use it. The inference worker exposes the generated game-command tool, durable result handoff, default-off real-provider adapters, and a bounded owner-world context selector. Inbox/conversation context and full cross-route certification remain incomplete.

The `@pact/domain` [rules catalog and arithmetic contract](rules-catalog.md) defines Season One numeric units and exact JSON encoding for later authoritative handlers.
The `@pact/world` [clock and tick coordinator](world-clock.md) owns the world lease, pause/resume, transaction-bound phase publication, and gameplay command-admission port.
The `@pact/ledger` [resource ledger](resource-ledger.md) owns ordinary/restricted/locked balances, movement provenance, storage caps, and production/expiry phase hooks.
The `@pact/kingdom` [founding service](kingdom-founding.md) owns ranked kingdom identity, initial buildings/builders/troops/charges, activation timing, and owner-scoped reads.
Its [building engine](building-queues.md) owns target-level prerequisites, two-slot instruction state, and tick-bound completion; the transaction-bound authority adapter is composed in the rules worker.
Its [troop service](troop-training.md) owns living unit identities, one training batch, capacity reservations, placement commitments, and battle eligibility references.
Its [upkeep service](upkeep.md) owns per-payer hunger and recovery state, attrition, and durable host-garrison default hooks.
Its [garrison service](garrison.md) owns signed lending offers, live detachments, bonds, return/default settlement, and human-permitted seizure.
Its [scouting service](scouting.md) owns timed two-Spearman observations, post-battle report sampling, target notices, and private report sharing.
Its [raid lifecycle](raids.md) owns declarations, contributors, five-minute identity locks, chronological settlement, loot, and audience-specific battle reports.
Its [world-view projection](world-views.md) derives owner, participant, contact, and public reads from one committed snapshot and labels conditional forecasts; PACT-049 will expose it through authenticated transport adapters.
Its [Fortune service](fortune.md) derives exact marked wealth from the ledger, provenance, and surviving owned units, writes hourly samples, and serves provisional Hall-band standings without issuing prizes.
Its [achievement engine](achievements.md) consumes trusted rule events, verifies mechanical triggers, and atomically grants one cosmetic ornament and 25 earned Gems per achievement without touching gameplay balances.
Its [action-limit service](action-limits.md) owns raid/scout charge clocks and successful-action rolling windows shared across gameplay surfaces.
Its [social service](social.md) owns contacts, private messages, direct invitations, blocks/mutes, and one-off transfers.
Its [supply-offer service](supply-offers.md) owns typed terms, versions, signatures, bond admission, atomic activation, minute delivery, and default settlement.
Its [raid seed store and pure combat calculator](raid-randomness-and-combat.md) own encrypted commitment/reveal evidence and deterministic, exact battle traces; PACT-044 integrates them into raid state and authorization.

`@pact/contracts` owns versioned wire schemas. `@pact/client-sdk` owns the host-neutral request, retry, capability, cursor, error, and view-model contract; injected adapters own browser/native/Telegram/Node runtime APIs and authentication. `@pact/ui-features` owns reusable DOM setup and connection screens that accept injected callbacks so web and Telegram hosts can share presentation without embedding transport. `@pact/platform` owns product-neutral identity, action, event, transaction, clock, randomness, and outbox interfaces. It cannot import `@pact/domain`; `npm run check:boundaries` enforces this direction. `@pact/domain` owns kingdom-specific state and rules. `@pact/application` owns the shared dispatcher and PACT-specific game handler; process composition supplies its transaction-bound domain services and lease checks. `@pact/oauth` owns PACT OAuth clients, PKCE grants, and audience-bound tokens. `@pact/authority` owns versioned mandates and the immediate authority ledger. `@pact/mcp` owns the Streamable HTTP MCP transport and tool registry. `@pact/approvals` owns immutable exact-command human approval requests. `@pact/inbox` owns durable audience-filtered inbox events, acknowledgements, and SSE delivery. `@pact/credential-vault` owns product-neutral envelope encryption, model-connection persistence, audit/use ledgers, and revoke admission. Its API composition receives only a public wrapping capability; its private unwrapping adapter is composed only under `workers/inference`. `@pact/model-provider` owns model discovery, explicit provider/model/credential routing, token and price metadata, cancellation, sanitized errors, structured tool validation, the deterministic adapter contract harness, and the OpenAI, Anthropic, Gemini, xAI, and OpenRouter adapters with injectable HTTP transport. It has no PACT-domain identity types and never selects a fallback route. `@pact/openrouter` owns OpenRouter PKCE authorization flows (session-bound state, exact callback, single use, ten-minute expiry) and never performs network exchange inside a database transaction. `@pact/runs` owns bounded Envoy run lifecycle, exclusive write leases, allowance reservations, and durable `envoy.run.tick` jobs for the inference worker. `@pact/telemetry` owns product-neutral correlation, redaction, retention metadata, metrics, and trace reporting. `@pact/identity` owns human accounts, authentication, sessions, MFA, and access revocation. `@pact/onboarding` owns private setup drafts; it cannot create a real kingdom. `@pact/privacy` owns phase-0 export archives, retention orchestration, legal-hold metadata, deletion tombstones, and the pre-traffic restore replay gate; its export queries are explicit allowlists and its deletion transaction coordinates the existing module-owned account foreign-key graph. `@pact/db` supplies shared PostgreSQL transactions and discovers the ordered migrations owned by these modules.

The API, MCP transport, provider adapters, web, native, and Telegram clients must call the same application command handlers. Clients never calculate authoritative resources or approvals.

`@pact/privacy` also invokes the product-owned [kingdom retirement hook](retirement.md) within account deletion. It does not import kingdom types. The rules worker finishes accepted engagements and asset disposal on game time, while privacy erases identifying data on real time even during a world pause.

`@pact/authority` also owns [future exposure accounting and exact human permits](authority-exposure.md); the kingdom adapters translate supply, construction, training, and transfer effects into that product-neutral ledger.

## Transaction boundary

A command opens one database transaction and receives transaction-bound repositories. Domain stock changes, future-spend authority reservations, the command receipt, and outbox events commit or roll back together. Notifications are outbox effects delivered after commit. Network and model calls stay outside the transaction.

Every persisted platform row carries `product_scope`; product-neutral packages operate on opaque subject references. PACT-specific names and rules stay out of platform packages. Each module owns its migrations and tables and exposes repository interfaces instead of arbitrary cross-module SQL.

Human sessions, future agent sessions, and OAuth grants are separate credentials. `@pact/identity` derives the account from a hashed opaque session token and rejects non-human audiences at human-only gates. HTTP adapters add origin/CSRF enforcement and hardened cookies; onboarding receives the authenticated account ID from that adapter instead of request payloads. Password reset and sign-out-everywhere write revocations, active-run cancellation events, and security-email requests in one transaction.

Request, command, run, job, and outbox IDs are the only cross-process diagnostic context. Outbox events persist those IDs beside the payload so a worker can continue the trace without copying private text into telemetry. Transactions and worker helpers accept an injected trace reporter; database packages do not choose a logging backend.

## Contract evolution

Wire objects carry a literal schema version. Additive compatible changes retain the version; breaking changes require a new schema version and explicit migration/compatibility handling. JSON Schema and TypeScript types are derived from the same Zod definitions in `@pact/contracts`.

The API capability document reports those versions separately from host features. The SDK boundary check rejects DOM, React Native, Telegram, Expo, and Node runtime imports so one package can be reused by every client adapter.

The same boundary check rejects imports of credential unwrapping capabilities in every service and worker except inference. The API may encrypt a newly supplied key with public material, but it cannot decrypt stored credentials even if its database access is compromised.
