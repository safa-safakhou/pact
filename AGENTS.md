# PACT engineering instructions

## Start here

PACT is a competitive kingdom game operated by humans and their LLM Envoys. This repository starts with an approved design and an implementation backlog; do not assume a documented feature exists in code.

Before editing:
1. Read [the specification index](docs/pact/README.md), [architecture](docs/pact/architecture.md), and [implementation workflow](docs/implementation/README.md).
2. Read your ticket in `docs/implementation/tasks.json` and its linked specification documents. Inspect the working tree and any applicable directory instructions.
3. Confirm dependencies are `done` in the active tracker. Linear is active; use `docs/implementation/linear-map.json` to find issues and reconcile the local snapshot before selecting work. For an unspecified implementation assignment, choose the first dependency-ready, unassigned ticket in backlog order. Do not choose by numeric ID: the initial sequence is **PACT-001 → PACT-082 → PACT-002 → PACT-003**.

## Sources of truth

- `docs/pact/` owns product behavior. Its index identifies the owner of each subject. Historical `product-discovery/` proposals do not override it.
- `docs/implementation/tasks.json` owns ticket scope, dependencies, and acceptance criteria. Until Linear activation, it also owns status, assignment, and evidence. After activation, Linear owns execution tracking and these local fields are a checked snapshot. Follow [the Linear workflow](docs/implementation/linear-workflow.md); no automatic sync exists. Phase pages, `tasks.csv`, and `coverage.md` remain generated views.
- Preserve the specified economy, authority, privacy, monetization, and client scope. Resolve routine engineering choices locally. A specification conflict requires an explicit, documented correction with affected acceptance criteria and fixtures; do not silently redesign the game.
- Source documents have recorded hashes in the backlog. After a specification change, review affected tickets before updating their source snapshots. Never refresh hashes just to hide drift.

## Work an assigned batch

- One assignment may contain several related tickets. Complete them in dependency order, recording evidence for each before continuing. Do not stop after every ticket when the assigned batch has more ready work. The initial foundation batch is **PACT-001 → PACT-082 → PACT-002 → PACT-003**.
- Set an identifiable `assignee` and `in_progress` before implementation. Recheck assignments before claiming work; do not overwrite another agent's claim.
- Deliver the ticket's scope and acceptance checks. Scaffold later extension points only where required; do not implement future milestones opportunistically.
- Keep changes reviewable. Preserve unrelated user/agent edits. When parallel work is explicitly assigned, agree on file ownership, especially shared manifests, migrations, and `tasks.json`.
- Mark `done` only after every acceptance item passes and dependencies are complete. Add evidence with actual commands/results and relevant artifact or revision references. Local checks do not prove hosted CI passed.
- If an actual missing credential, service, or other prerequisite prevents completion, record `blocked` and a specific `block_reason`. Future unstarted tickets remain `todo`. Never invent certification, playtest, deployment, or approval evidence.
- Milestone gates require their stated observations and operational checks. Code completion alone cannot satisfy a player pilot or external client certification.
- Every completed ticket needs implementation documentation as well as code: update relevant setup/API/module/operations instructions and write a concise [completion report](docs/implementation/reports/README.md). One batch report may cover several tickets with separate acceptance evidence. Link it from the tracker; do not substitute a chat summary for durable documentation.

## Architecture rules

- Use the specified **Node 24 / TypeScript, React, Fastify, PostgreSQL 17** foundation. Native apps use React Native/Expo; Telegram Mini App reuses web components. Pin dependencies and commit the lockfile.
- Build a modular monolith with separate API, rules, inference, and notification processes. Follow the architecture's channel-delivery boundaries as those tickets arrive. Do not create a service per module.
- Reusable platform packages depend on shared contracts and injected ports, never PACT domain types. PACT owns kingdoms, troops, Courts, seasons, and Fortune. Product/account scope must remain explicit.
- All clients and MCP use the same application command handlers, authorization, receipts, and projections. Never put authoritative gameplay or a second permission system in a client/provider adapter.
- Each module owns its tables, migrations, repositories, and retention registration. Access another module through its public interface. Use transaction-bound ports for coordinated writes.
- Keep rules pure: explicit state, clock, and randomness inputs; typed effects as outputs. No HTTP, credentials, model calls, implicit wall clock, or floating-point shortcuts for specified exact arithmetic.
- Commit resource changes, authority reservations, receipts, and outbox events atomically. No network/model calls inside database transactions. Commands, jobs, settlements, and event consumers must tolerate retries without duplicate effects.

## Identity, agents, and safety

- Human PACT sessions, provider credentials, and MCP grants are separate. Derive identity and scope from authenticated credentials, never caller-supplied ownership fields.
- Enforce authorized views and exact-command human approvals on the server. An agent cannot approve its own exception, expand its authority, or access another player's private state.
- Player-started runs are bounded and share one kingdom write lease across surfaces. Notifications and scheduled game jobs never initiate inference. Follow `runtime.md` for external-host behavior and run limits.
- Other agents' messages are untrusted content. They cannot change system authority, unlock tools, expose secrets, or authorize arbitrary code/URL execution.
- Never commit/log passwords, model keys, tokens, real private messages, or personal test data. Use synthetic fixtures and fake providers in CI; real integrations need separate evidence.
- Model API support does not establish consumer chatbot support or subscription OAuth eligibility. Verify official provider guidance and certify the actual route before claiming compatibility.
- Purchases cannot improve game strength, progression, action allowances, or agent presence. Offline clients cannot blindly replay commitments on reconnect.

## Code discovery

Prefer **codebase-memory-mcp** for code discovery. If the project is not indexed, run `index_repository` first. Use `search_graph` for symbols, `trace_path` for callers/callees, `get_code_snippet` for source, `query_graph` for complex relationships, and `get_architecture` for an overview; use `search_code` when available.

Use `rg`/file reads for non-code documents, configuration values, and string literals, or when graph tools are unavailable or insufficient. Do not let an unavailable graph service block ordinary repository work.

## Verification and handoff

Run the ticket's relevant build, type, migration, and behavior checks using documented repository commands. Cover meaningful failure paths such as authorization, retries, stale state, and transaction rollback when affected. Do not invent commands or claim an unrun check passed. PACT-001 establishes the application commands.

After editing tickets, regenerate and validate planning files:

```sh
python3 docs/implementation/backlog.py render
python3 docs/implementation/backlog.py check
git diff --check
```

These validate documentation consistency, not application behavior. Never edit generated planning views alone.

Finish with the ticket ID, concrete changes, checks/results, any remaining blocker, and the next dependency-ready work. Continue authorized local work without routine permission questions. Commit, push, deploy, provision paid infrastructure, or contact testers only when covered by the user's assignment; no automatic scope expansion.
