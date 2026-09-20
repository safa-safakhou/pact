# Database operations

PostgreSQL 17 is the authority for accounts, commands, jobs, inbox/outbox events, and later game state. Redis is not required for correctness.

Run `npm run db:migrate` with `DATABASE_URL` set. Migrations are ordered SQL files and run once under a PostgreSQL advisory lock. Each migration commits atomically and is recorded in `app_migrations`; never edit a migration that has run outside an expendable local database.

Application transactions retry serialization failures and deadlocks a bounded number of times. Multi-row writers call `stableLockOrder`/`lockRows` before mutation so concurrent commands request aggregate locks in the same ID order. Callers provide a stable command ID and reconcile uncertain results through command history.

Job workers use expiring PostgreSQL leases. Outbox consumers acquire an expiring per-consumer event lease, perform the external effect outside the producing transaction, and mark it delivered. A crash leaves a recoverable lease; a delivered row prevents repeat effects. The external adapter must still use the event ID as its idempotency key when supported.

For local recovery, stop the application, restore PostgreSQL, run migrations, then restart workers. Verify that committed receipts and undelivered outbox rows remain present before admitting writes. Production backup/restore procedures arrive with the operations milestone; the local Compose volume is not a backup.
