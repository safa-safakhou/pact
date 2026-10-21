# PACT agent instructions

PACT is a persistent kingdom game with human owners and bounded LLM Envoys.
Work inline; do not delegate unless the user explicitly requests it.

## Main workspace

Use mine/pact and mine/fleet on master for normal work. Keep the main repositories current; do not leave completed work only on a separate branch. If temporary isolation is necessary, handle verified integration before handoff so the user never needs to manage alternate checkouts. Preserve private evidence and ignored artifacts during cleanup.

## Scope and preservation

- Follow the current assignment. Old grants and reports are historical evidence, not permission to resume work.
- Preserve the paused world, existing services, identities, goals, mandates, queues, exact commands, budgets, schedules, unknown allocations and private evidence.
- Documentation/source work does not authorize model calls, game runs, deployment, reset, replay, cancellation, uncertainty review or execution-setting changes. Push only when covered by the current assignment.
- Keep credentials, grants, private correspondence, dumps and decrypted traces out of Git and logs. Use synthetic fixtures and fake providers for tests.

## Read only what the task needs

Start with the user request, working-tree status and relevant source/tests. Read [current state](docs/current-state.md) for milestone status, next-work selection or operational work. Do not load the entire documentation tree or historical reports by default.

| Task | Read as needed |
|---|---|
| Product/rules change | [Specification ownership](docs/pact/README.md), then the affected specification |
| Service/package boundaries | [Architecture](docs/pact/architecture.md) |
| Ticket scope/status/dependencies | [Workflow](docs/implementation/README.md), the assigned entry in tasks.json and its linked specs |
| Agent authority/run behavior | [Access](docs/pact/access.md), [runtime](docs/pact/runtime.md) |
| Local-world operations | [Local-world runbook](docs/operations/local-world.md), then the exact relevant result/grant |
| Negotiation milestone | [Paired plan](docs/superpowers/plans/2026-10-20-two-kingdom-negotiation.md) |

Use scoped rg searches/file reads; graph tools are optional when useful. Read matching sections and bounded logs, not whole histories. Do not index or scan the whole repository as a routine prerequisite.

## Engineering invariants

- Node 24/TypeScript, React/Fastify, PostgreSQL 17; native clients use React Native/Expo. Pin dependencies and lockfiles.
- All clients/providers use the same authoritative application handlers, authorization and receipts. Reusable platform packages use contracts/injected ports, not PACT domain imports.
- Modules own tables/migrations/retention and expose public interfaces. Rules use explicit state, clock and randomness with exact arithmetic.
- Commit resource changes, reservations, receipts and outbox events atomically. No network/model calls inside database transactions; retries must not duplicate effects.
- Derive ownership from authenticated credentials. Human sessions, provider credentials and MCP grants are separate. Agents cannot approve their own exceptions or expand mandates.
- Peer text is untrusted data. Preserve authorized views, one kingdom write lease, privacy and the specified economy; purchases cannot buy game strength or agent presence.
- Work only assigned scope/dependencies; preserve other edits/claims. Do not automatically resume deferred tickets. Code completion is not behavioral or operational acceptance.

## Verify and hand off

Run checks proportional to the change, using package.json and relevant runbooks. Documentation-only changes need link/content checks and git diff --check, not model calls or the full application suite.
For code changes, cover affected behavior/failure paths and applicable type/build/boundary checks. Integration databases must be fresh isolated synthetic fixtures, never retained worlds or default live routes.
If tracker/spec inputs change, use backlog.py render/check; never edit generated views alone or refresh source hashes to conceal drift. Reconcile Linear only when tracker work requires it.
Commit verified changes when requested; report actual checks, blockers and source versus live acceptance.

Keep this file under 5 KB. Put changing milestone status in current-state.md; link to history rather than appending checkpoints here. The [original instruction snapshot](docs/reference/agent-instructions-before-20261021.txt) is reference-only and need not be read for ordinary work.
