# Phase-0 account privacy lifecycle

Ticket: [PACT-024 / MNI-87](https://linear.app/mnim/issue/MNI-87/pact-024-implement-first-account-retention-export-and-deletion)

Implementation revision/PR: `581add8`

Verification date/environment: 23 September 2026; macOS arm64 with Node.js 24 and PostgreSQL 17; single EU VPS release `mvp-20260922-7` at `https://safa.dedyn.io/pact`.

## Result

Phase-0 accounts now have password/MFA-reauthenticated JSON export and account closure controls. Exports use explicit owned-data allowlists, include a readable index, require the rotated human session for download, store only a digest of the download token, and expire after seven days. Closure atomically marks the account closing, revokes access and provider credentials, stops active runs, releases leases, removes Telegram/OpenRouter links, and records the 30-day live purge and 65-day backup-suppression deadlines.

The API runs daily retention for account/draft/key/session/run/inbox/export and Telegram bootstrap data. Reviewed, scoped legal-hold metadata can defer a due purge. The web shell exposes Privacy and account data controls. Gameplay retirement and social/public content remain explicitly deferred to their owning later tickets.

The deletion registry has two layers: a PostgreSQL projection for transactional processing and a separately mounted, fsynced append-only file containing only opaque IDs and deadlines. Production Compose gates every API/worker start on migration and registry replay. This prevents a pre-deletion PostgreSQL restore from resurrecting sessions, encrypted credentials, Telegram links, or account access.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-024 | Export excludes credentials and other players' data; delete disables access immediately and meets live-store deadlines | `tests/integration/privacy.test.ts`; `services/api/src/privacy-routes.test.ts`; live synthetic API walkthrough on `mvp-20260922-7` | Pass. Cross-account inbox content, password hashes, and ciphertext are absent; downloads require the owning session; closure immediately revoked sessions, stopped the run, cleared encrypted model material, and removed Telegram links. |
| PACT-024 | Restore a pre-deletion backup and replay deletion/revocation before traffic; removed data cannot reappear | `packages/privacy/src/file-registry.test.ts`; production `privacy-replay` gate; isolated VPS PostgreSQL dump/restore drill | Pass. A real pre-deletion custom-format dump containing an active session, encrypted credential fixture, and Telegram link was restored into `pact_privacy_drill`. External-registry replay returned `1 closed, 0 purged`; the restored account became `closing`, with `0` active sessions, `0` live ciphertexts, `0` Telegram links, and `1` imported registry row before the drill database was removed. |

Repository verification passed: `npm test` (24 files, 66 tests), `npm run test:integration` (13 files, 34 tests), `npm run smoke` (1), `npm run build`, `npm run lint`, `npm run typecheck`, backlog render/check, and `git diff --check`.

Deployment verification passed after migration `0016_account_privacy.sql`: all runtime containers use `mvp-20260922-7`, API readiness and public health/web/Telegram checks passed, `privacy-replay` exited `0`, the registry directory is mode `0700`, and PostgreSQL remains private.

## Documentation

- [Account privacy API](../../api/privacy.md)
- [Database recovery order](../../operations/database.md)
- [Single-VPS deployment and registry location](../../operations/vps-deployment.md)
- [Module ownership](../../architecture/modules.md)

## Decisions and limitations

The zero-cost MVP uses no AWS or additional server. The opaque registry is deliberately outside PostgreSQL backup volumes but remains on the same VPS, so total server/disk loss can still lose both live state and the registry; PACT-078 owns off-host production hardening. The self-service export is generated synchronously because current phase-0 data is bounded; its contract still satisfies the within-24-hour requirement.

Only synthetic test data was used. The restore-drill database and dump were removed afterward. Its live source fixture remains in normal `closing` state so the deployed 30/65-day lifecycle and tombstone retention remain observable.

## Handoff

PACT-024 is complete and ready for Linear closure. PACT-025 is the next dependency-ready connection gate; it still requires the real-account legal/operator preflight before any tester is invited.
