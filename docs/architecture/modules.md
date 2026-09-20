# Module boundaries

PACT begins as one deployable TypeScript workspace with separately runnable processes. Packages are ownership boundaries, not network services.

`@pact/contracts` owns versioned wire schemas. `@pact/platform` owns product-neutral identity, action, event, transaction, clock, randomness, and outbox interfaces. It cannot import `@pact/domain`; `npm run check:boundaries` enforces this direction. `@pact/domain` owns kingdom-specific state and rules. `@pact/application` is the composition root where platform ports and PACT behavior meet. `@pact/telemetry` owns product-neutral correlation, redaction, retention metadata, metrics, and trace reporting. `@pact/db` implements the transaction and delivery infrastructure and persists the correlation fields needed by later consumers.

The API, MCP transport, provider adapters, web, native, and Telegram clients must call the same application command handlers. Clients never calculate authoritative resources or approvals.

## Transaction boundary

A command opens one database transaction and receives transaction-bound repositories. Domain stock changes, future-spend authority reservations, the command receipt, and outbox events commit or roll back together. Notifications are outbox effects delivered after commit. Network and model calls stay outside the transaction.

Every persisted platform row carries `product_scope`; product-neutral packages operate on opaque subject references. PACT-specific names and rules stay out of platform packages. Each module owns its migrations and tables and exposes repository interfaces instead of arbitrary cross-module SQL.

Request, command, run, job, and outbox IDs are the only cross-process diagnostic context. Outbox events persist those IDs beside the payload so a worker can continue the trace without copying private text into telemetry. Transactions and worker helpers accept an injected trace reporter; database packages do not choose a logging backend.

## Contract evolution

Wire objects carry a literal schema version. Additive compatible changes retain the version; breaking changes require a new schema version and explicit migration/compatibility handling. JSON Schema and TypeScript types are derived from the same Zod definitions in `@pact/contracts`.
