# Redacted operational telemetry and failure correlation

Tickets: PACT-005 · [MNI-65](https://linear.app/mnim/issue/MNI-65/pact-005-add-redacted-operational-telemetry-and-failure-correlation)
Implementation revision/PR: this telemetry commit, based on foundation `b0bc03d`; no PR.
Verification date/environment: 2026-09-20; macOS, Node 24.21.0, npm 11.19.0, PostgreSQL 17.11 in Docker/Colima.

## Result

PACT now has reusable structured telemetry with validated correlation UUIDs, recursive redaction, sanitized client failures, content-free Prometheus metrics, and explicit retention metadata. API requests return their request ID. Transactions and outbox writes emit stages through an injected reporter; outbox rows preserve request, command, run, and job IDs so a worker can continue the trace. No model or network call occurs in a transaction.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-005 | Seed secrets and private text into failed requests and confirm none appear in application logs or client error payloads. | `services/api/src/telemetry.test.ts`; `packages/telemetry/src/telemetry.test.ts`; `npm test` | Pass: credential, authorization header, email, prompt, message body, nested payload, provider detail, and raw error text are absent from captured logs, telemetry, metrics, and the generic client response. |
| PACT-005 | A failed command can be traced through API, transaction, outbox, and worker using IDs without transcript logging. | `tests/unit/command-trace.test.ts`; `tests/integration/persistence.test.ts`; `npm test`; `npm run test:integration` | Pass: one request/command/run/job context produces ordered API, transaction, outbox, and worker events; PostgreSQL preserves the correlation IDs; the worker failure exposes only `PROVIDER_FAILED`. |

Supporting checks: `npm run lint`, `npm run typecheck`, `npm run build`, two idempotent `npm run db:migrate` executions, `python3 docs/implementation/backlog.py render`, `python3 docs/implementation/backlog.py check`, and `git diff --check` pass locally.

## Documentation

- `docs/operations/telemetry.md` defines safe fields, metrics, lifecycle classes, and incident use.
- `docs/operations/database.md` documents persisted outbox correlation.
- `docs/architecture/modules.md` records the package and injection boundary.
- `README.md` lists the package and `/metrics` probe.

## Decisions and limitations

Correlation values are UUID-only to prevent caller-controlled log content. Metrics reject free-form labels. Operational traces have a 30-day maximum and contain no IP or message content; the privacy policy's seven-day IP and 90-day security rules remain explicit registry classes. The deployment lifecycle and centralized log backend arrive with PACT-004, so this ticket supplies enforceable metadata and application behavior but does not claim hosted retention verification.

## Handoff

PACT-006 becomes dependency-ready. Its authentication and security events must use the security retention class and must never pass email, authorization material, reset tokens, or password-check responses as telemetry attributes. The later Version 1.2 planning correction replaces the AWS deployment with the project single-VPS contract; PACT-004 now requires VPS, DNS, off-host backup, and SMTP inputs for completion.
