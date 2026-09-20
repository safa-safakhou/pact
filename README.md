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
- `packages/application`: composition root and application-facing wiring
- `packages/telemetry`: correlation, redaction, retention classes, safe errors, and operational metrics
- `packages/db`: PostgreSQL migrations, transactions, job leases, inbox/outbox, and test database support

See [architecture](docs/architecture/modules.md), [database operations](docs/operations/database.md), and [telemetry operations](docs/operations/telemetry.md) for ownership, privacy, and recovery boundaries.
