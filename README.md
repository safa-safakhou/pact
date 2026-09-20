# PACT

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

In another terminal, `npm run dev:web` starts the React client. The API exposes `GET /health` for process health, `GET /ready` for database readiness, and `GET /metrics` for content-free Prometheus metrics.

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
- `packages/platform`: reusable scoped principals, actions, events, transaction ports, and unit-of-work fixture
- `packages/domain`: PACT-owned domain types
- `packages/application`: composition root, shared command dispatcher, and sandbox-only command handlers
- `packages/telemetry`: correlation, redaction, retention classes, safe errors, and operational metrics
- `packages/identity`: email/password accounts, sessions, recovery, recent authentication, MFA, and revocation
- `packages/onboarding`: private resumable kingdom drafts and sandbox activation validation
- `packages/oauth`: PACT OAuth authorization server (PKCE, clients, refresh rotation)
- `packages/authority`: versioned mandates and immediate spend ledger
- `packages/db`: PostgreSQL migrations, transactions, job leases, inbox/outbox, and test database support

Authenticated clients submit commands to `POST /v1/commands` and reconcile uncertain writes with `GET /v1/receipts/:commandId`. Both routes derive the account from the session cookie and set `Cache-Control: no-store`.

See [architecture](docs/architecture/modules.md), [identity operations](docs/operations/identity.md), [OAuth API](docs/api/oauth.md), [authority API](docs/api/authority.md), [database operations](docs/operations/database.md), and [telemetry operations](docs/operations/telemetry.md) for ownership, privacy, and recovery boundaries.
