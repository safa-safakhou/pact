# Database operations

PostgreSQL 17 is the authority for accounts, commands, jobs, inbox/outbox events, and later game state. Redis is not required for correctness.

Run `npm run db:migrate` with `DATABASE_URL` set. Migrations are ordered, globally unique SQL filenames discovered from the shared database package and each owning module. They run once under a PostgreSQL advisory lock. Each migration commits atomically and is recorded in `app_migrations`; never edit a migration that has run outside an expendable local database.

Application transactions retry serialization failures and deadlocks a bounded number of times. Multi-row writers call `stableLockOrder`/`lockRows` before mutation so concurrent commands request aggregate locks in the same ID order. Callers provide a stable command ID and reconcile uncertain results through `CommandDispatcher.lookupReceipt` / `GET /v1/receipts/:commandId` (owner-scoped only).

Job workers use expiring PostgreSQL leases. Outbox consumers acquire an expiring per-consumer event lease, perform the external effect outside the producing transaction, and mark it delivered. A crash leaves a recoverable lease; a delivered row prevents repeat effects. The external adapter must still use the event ID as its idempotency key when supported.

Migration `0006_sandbox_dispatcher.sql` (owned by `@pact/application`) adds `command_receipts.account_id` plus sandbox counter/draft fixture tables used by the shared dispatcher. Migration `0007_oauth_authorization.sql` (`@pact/oauth`) adds OAuth clients, authorization codes, and refresh tokens. Migration `0008_mandates_authority.sql` (`@pact/authority`) adds versioned mandates and the immediate authority ledger.

Outbox rows store nullable request, command, run, and job UUIDs as diagnostic context. Supply them through `appendOutbox`; do not place prompts, messages, credentials, or provider responses in correlation fields. The command and request columns are indexed for incident tracing.

For local recovery, stop the application, restore PostgreSQL, run migrations, then restart workers. Verify that committed receipts and undelivered outbox rows remain present before admitting writes. Production backup/restore procedures arrive with the operations milestone; the local Compose volume is not a backup.
