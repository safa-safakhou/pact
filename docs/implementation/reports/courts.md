# Court community management

Ticket: [PACT-056 / MNI-121](https://linear.app/mnim/issue/MNI-121/pact-056-implement-court-membership-roles-and-lifecycle).
Revision: `490f304`. Linear Done and both Alpha checks read back; completion comment `b70c7e50-9b0b-4305-9a22-cc193d6832be`. Original acceptance remains unchecked for later review.
Verified 1 October 2026: Node 24.19.0 / npm 11.19.0 / local PostgreSQL 17, disposable schemas and synthetic accounts.

## Acceptance evidence

1. **Membership/ownership/roles:** create/edit with separate handles; open/request/invitation admission, cancellation/rejection, one-owned/three-active limits, 50-member pages, ten moderators, role/removal audit, two-human transfer and three Court-local pins. Thirteen Court integration tests cover strict payloads, agent denial, retry/conflict, handle and mixed invitation/direct join races, pending request capacity rollback, role restrictions, replaced/removed proposals, target-only consent and ownership limits, stale edits/pin validation, transaction fault rollback, archive/retention and HTTP/MCP projection parity/private redaction. Existing 13 invitation tests pass after consolidation onto the shared Court service.

2. **Independent assets/agreements:** a real contact, ledgers, owned troop and typed active supply contract retain exact rows across leave, removal and closure. Subsequent real settlement delivers 80 internal Silver units and leaves the contract active. Invitation acceptance adds only membership. CourtService has no ledger/troop/contract/allegiance dependency and writes only Court tables. Allegiance arrives in PACT-057; actual existing-edge verification is handed off there, not invented here.

## Checks

- `npm run build`: all workspaces passed.
- `npm run typecheck`: passed, including tests.
- `npm test`: 181 passed / 56 files, including two new Court control tests.
- `npm run test:integration`: 253 passed, one optional local-model skipped / 41 files.
- Focused Court/invitation suite: 26 passed before the final full regression.
- `npm run lint`: passed, including boundaries/build order and 18 pinned schemas; previous 16 are unchanged. One non-blocking CSS specificity warning, no lint errors.
- `python3 docs/implementation/backlog.py render` and `check`: passed, 99 unique tickets, acyclic dependencies, 37 criteria and matching source hashes; six views generated/checked. `git diff --check`: passed.

Initial checks found fixture table/count errors, an obsolete guide assertion and a Date-versus-JSON projection mismatch. Corrected and rerun; event timestamps now match over HTTP/MCP rather than weakening the parity assertion.

## Documentation and boundaries

[Court module/API/player guide](../../architecture/courts.md), [invitation instructions](../../architecture/invitations.md) and [handoff](../HANDOFF.md) record commands, migration/lifecycle, exact consent, independent assets and recovery. Server guide teaches Court discovery and People handoff. Web has labeled forms, retry IDs, explicit close confirmation and ownership consent. No new Chrome/player/provider observation, full accessibility, load, native/Telegram, production or enjoyment claim. No paid infrastructure or inference used.

Not pushed/deployed. Hosted release remains `alpha-20260929-4` / `2143d92`; new UI/tools require migrations 0036–0038 and deployment. Chronicle notices/stories remain PACT-059; Court-local prose is not those records. Agent proposal/activity completion remains PACT-099. Next dependency-ready task: PACT-057, Articles/mutual allegiance. Twenty-eight Later tickets remain postponed.
