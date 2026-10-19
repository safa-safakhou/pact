# PACT

Read the [PACT and Fleet project guide](docs/project/README.md) for the technical architecture, development journey, evidence and remaining gaps, with links to the independent Fleet handbook. Source verification, installation and actual gameplay acceptance are distinct; this guide does not change the canonical game specifications or enable execution.

PACT is a persistent competitive kingdom game operated by humans and their LLM Envoys. This repository is a TypeScript modular monolith: every channel reaches the same application commands and PostgreSQL authority.

## Requirements

- Node.js 24 (the exact verified version is in `.nvmrc` and `.node-version`)
- npm 11
- Docker with Compose, or PostgreSQL 17 reachable through `DATABASE_URL`

No provider key is needed for the foundation workspace.

## Fresh checkout

```sh
cp .env.example .env
npm ci
npm run db:up
npm run db:migrate
npm run dev:api
```

In another terminal, `npm run dev:web` starts the React client. The API exposes `GET /health` for process health, `GET /ready` for database readiness, `GET /metrics` for content-free Prometheus metrics, and `GET /v1/capabilities` for version/capability negotiation.

The database scripts detect either the Docker Compose plugin or the standalone `docker-compose` command. `npm run db:down` stops the local database without deleting its volume.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm test
npm run test:integration
python3 docs/implementation/backlog.py check
```

Integration tests create an isolated PostgreSQL schema per test file, migrate it, and remove it afterward. They require `TEST_DATABASE_URL` or use the safe local value from `.env.example`.

## Workspace

- `apps/web`: React web/PWA shell
- `services/api`: Fastify HTTP process
- `workers/*`: rules, inference, notification, and channel-delivery entry points
- `packages/contracts`: versioned command, receipt, event, cursor, and tool schemas
- `packages/client-sdk`: platform-independent command retry, receipt/inbox projections, subscriptions, and capability negotiation
- `packages/platform`: reusable scoped principals, actions, events, transaction ports, and unit-of-work fixture
- `packages/domain`: PACT-owned rules catalog, exact arithmetic, and domain types
- `packages/world`: PostgreSQL-backed authoritative game clock, worker lease, and atomic tick coordinator
- `packages/ledger`: exact resource balances, provenance, storage caps, and production/expiry hooks
- `packages/application`: composition root, shared command dispatcher, and sandbox-only command handlers
- `packages/telemetry`: correlation, redaction, retention classes, safe errors, and operational metrics
- `packages/identity`: email/password accounts, sessions, recovery, recent authentication, MFA, and revocation
- `packages/onboarding`: private resumable kingdom drafts and sandbox activation validation
- `packages/oauth`: PACT OAuth authorization server (PKCE, clients, refresh rotation)
- `packages/authority`: versioned mandates and immediate spend ledger
- `packages/credential-vault`: envelope-encrypted provider credentials, revoke admission, and audit/use ledgers
- `packages/model-provider`: provider-neutral discovery, explicit routing, tool validation, pricing/usage, errors, and CI harness
- `packages/db`: PostgreSQL migrations, transactions, job leases, inbox/outbox, and test database support

Authenticated clients submit commands to `POST /v1/commands` and reconcile uncertain writes with `GET /v1/receipts/:commandId`. The write requires the session cookie plus exact Origin/CSRF proof; both routes derive the account server-side and set `Cache-Control: no-store`.

See [architecture](docs/architecture/modules.md), [client SDK](docs/api/client-sdk.md), [model credentials](docs/api/model-credentials.md), [provider adapters](docs/api/provider-adapters.md), [identity operations](docs/operations/identity.md), [OAuth API](docs/api/oauth.md), [authority API](docs/api/authority.md), [database operations](docs/operations/database.md), and [telemetry operations](docs/operations/telemetry.md) for ownership, privacy, and recovery boundaries.
