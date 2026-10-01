# Source-backed Seals and evidence viewer

Ticket: [PACT-058 / MNI-123](https://linear.app/mnim/issue/MNI-123/pact-058-implement-signed-excerpts-and-the-evidence-viewer).
Revision: implementation commit pending. Verified 1 October 2026, Node 24.19 / npm 11.19 / disposable PostgreSQL 17 schemas, synthetic accounts/messages/typed report fixtures, no live inference.

## Acceptance evidence

1. **Exact participant evidence and agent verification:** seven PostgreSQL tests in `tests/integration/seals.test.ts` use the shared human dispatcher, real source tables and original Scout/Raid participant readers. Message participants publish exact UTF-8 bytes; outsider access and shared-report recipient/buyer sealing fail. Scout/battle selected fields and actual observation timestamps are signed, while unselected values stay absent. Altered preview contents, invalid boundaries/order/overlap and tampered signed bytes fail. Human-cookie/Origin/CSRF preview is enforced; agent publication is denied. Same-ID replay consumes no extra quota; Articles/Court pins/Seals share six publications/game-day. Two signer initializations create one key; a wrong wrapping key leaves pending state, two concurrent signers publish once with one factual outbox event. Public JWKs have no private component. Generic crypto unit tests cover RFC 8032 test 1, domain-bound tamper detection, canonical UTF-16 key ordering, exact Unicode and invalid/non-JSON/unsafe numbers.
2. **Honest context and no resurrection:** complete/selective excerpts have distinct context labels with every leading/middle/trailing omission. HTTP and authenticated MCP return identical actual verification and only selected contents. There is no original-download API. Only creators can remove their publication; source tombstones hide another issuer's existing and queued copies and deny new previews. Participant erasure scrubs another creator's hosted excerpts. Message source expiry, own export and 180-day hosted pruning pass. Compromised status hides payload without rewriting signed copies. The UI labels authenticity as distinct from truth, previews named kingdoms, requires explicit review, clears review after selection changes, shows signing as pending, and permits reading shared Seals without logging in.

## Checks

- `npm run build` and `npm run typecheck`: passed.
- `npm test`: 188 passed / 59 files, including three generic evidence tests and two viewer control checks.
- `npm run test:integration`: 269 passed, one optional local-model skipped / 43 files.
- `npm run lint`: passed after correcting an array-index UI key and restricting the private-capability check to source files rather than generated declarations. Boundaries/build order pass; 22 immutable schemas pinned, previous 20 unchanged. Three non-blocking warnings, no errors.
- `sh -n infra/production/container-entrypoint.sh infra/production/bin/deploy.sh infra/production/bin/rollback.sh`: passed.
- `docker-compose --env-file infra/production/vps-connection-test.env -f infra/production/compose.yaml config --quiet`: passed. This local Docker installation lacks the `docker compose` plugin; the standalone executable validated the configuration. No containers/images deployed by that check.
- Planning render/check and diff check are recorded in tracker reconciliation.

## Documentation and limitations

[Module/API/player/signing instructions](../../architecture/seals.md), [VPS runbook](../../operations/vps-deployment.md) and [handoff](../HANDOFF.md) record source authorization, exact selection/digests, strict commands, durable pending/retry behavior, public keys, worker-only encrypted private capability, removal/retention and deployment recovery. `@pact/evidence` has no PACT-domain dependencies; its build order, lockfile, source typecheck and forbidden-domain boundary are registered.

This is the second ticket in the PACT-057/058 batch; PACT-057 committed at `03b5a62`. Seals queue only selected evidence; signing uses a separate process on the same existing VPS and no external/model call. The checked-in deployment creates a missing host-only wrapping secret without logging/overwriting it and starts the worker; rollback tolerates older images without it. These scripts are not a hosted deployment/restore observation.

No automated key rotation, compromised-key operational certification, platform moderation-case tooling, Chrome/user observation, comprehensive accessibility, production or enjoyment claim. Report authorization fixtures are real typed database records, not a newly observed scout/battle playthrough. PACT-061 owns browser/social rehearsal, PACT-099 richer agent proposal/activity, and PACT-080 independently observed agents and final playable Alpha. No push/deployment: hosted remains `alpha-20260929-4` / `2143d92`; future rollout needs migrations 0036–0040 and the shared-edge root key route. Next dependency-ready ticket is PACT-059, Chronicle stories/notices/public pages. Twenty-eight Later tickets remain postponed.
