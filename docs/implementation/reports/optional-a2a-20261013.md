# PACT-168 — optional A2A interface

The founder authorized an optional A2A interface alongside HTTP API, MCP and tool calling, sharing game rules and permissions and preserving all existing agents/accounts/counters/schedules. Codex implemented and verified this locally without delegation. **Default off, not deployed.** No Fleet/runtime credential, real account, live command, schedule or inference run was changed.

## Delivered behavior

- API-composed A2A 1.0 JSON-RPC gateway using pinned official `@a2a-js/sdk` 1.3.0. Service Agent Card, resource metadata, scoped operation-schema catalogue and extended authenticated card; unsupported versions, prose/file/URL instructions, streaming, push and callback delivery fail explicitly. `GET /v2/interfaces` reports availability without altering existing v1 schemas. Production Compose propagates the opt-in flag; Caddy forwards `/a2a*` and additive `/v2/*` to the API.
- MCP operation execution is extracted into the application-owned `AgentOperationService`, retaining existing behavior; MCP keeps authentication/session/resource/UI presentation and activity observation. A2A injects the same domain ports and uses the same canonical schemas/dispatcher/owner projections, mandates, social delegation, human-only boundaries, version/stock/quota checks and receipt accounting. The A2A envelope never overrides a principal, mandate or scope.
- Separately resource-bound `a2a` OAuth audience with existing PKCE/account chooser, exact redirects, access/rotating refresh lifecycle and human-only boundaries. Its bearer admission checks current audience, resource, account status, revocation and expiry; MCP and native/human authentication behavior is retained. Refresh preserves grant/lease identity; new consent does not steal another connection. Disabling A2A removes its routes/new registration, without rebinding or deleting grants.
- A2A uses the same exclusive kingdom write-lease table with an explicit holder kind and server-derived grant holder. Fifteen-minute open/renew/close operations do not create inference, scheduler enrollment or game work. Competing MCP/in-app leases remain exclusive; only the same matching grant's lease may be released.
- Tasks/artifacts are read projections of owner canonical receipts, including commands submitted through other interfaces. A task completes command processing, not construction, negotiation or settlement. Exact retries produce one effect; conflicting payloads, fresh scope/validation denial and unknown transport outcomes cannot be concealed by an old receipt. Known canonical reason/detail/retry information and recovery advice are retained; unknown infrastructure messages are sanitized. Owner-only retrieval/listing survives process restart without a new task ledger/history. Task cancellation cannot undo processed gameplay.

No gameplay formula, resource amount, publication permission, mandate, inference allowance, foreign contact visibility or existing capability fingerprint changes. A2A availability does not claim that every kingdom hosts an A2A agent or that Fleet has migrated providers/interfaces. The separate peer capability registry/host enrollment and autonomous negotiation are not implemented by this gateway.

## Verification and preservation

All tests use synthetic identities and a disposable PostgreSQL 17.9 database on localhost **5440**, with isolated schemas. No test connects to the running local Fleet's 5439 database, production game/Fleet databases or real model providers. The disposable `pact-a2a-test-db` container and its volumes were removed after verification; unrelated database containers were preserved.

| Verification | Actual result |
| --- | --- |
| Full `npm run build` | Passed; existing web chunk-size warning retained |
| Final changed API rebuild + `npm run typecheck` | Passed |
| Full `npm test` | **360 passed** |
| Full `TEST_DATABASE_URL=…:5440/pact_test npm run test:integration` | **405 passed**, one existing optional local-model test skipped; 59 files |
| Final focused A2A suite after recovery-detail/timestamp hardening | **11 passed** |
| `npm run lint` | Passed with existing warnings; package boundaries, forbidden fixture, build order and **26 unchanged published v1 schemas** passed |
| `npm run check:non-game` | Independent identity → bounded fake inference → exact human approval → receipt/notification/revoke and dependency-isolation fixture passed |
| `docker-compose --env-file infra/production/deploy.env.example -f infra/production/compose.yaml config --quiet` | Passed without secrets or launching application services |
| Caddy 2.10.2 `validate --adapter caddyfile` in disposable bounded container | Valid configuration; existing formatting warning |
| Documented discovery request against canonical schema | Passed |
| Production dependency audit | **23 existing Expo/Metro findings: 7 moderate, 16 high**; zero A2A/jose findings. Not a passing security audit or authority for a breaking dependency migration |
| Backlog render/check, whitespace and historical-record comparison | Checked before local commit |

The official SDK reads the card and executes structured reads, a real canonical contact command, `GetTask` and `ListTasks`. HTTP tests exercise dynamic A2A registration, browser authorization page, same-account human consent with CSRF, rejection of forged selected ownership, PKCE token exchange, and rejection of A2A tokens by the existing MCP route. The exact A2A receipt is recovered through the real cookie-authenticated HTTP receipt route and existing MCP operation. Concurrent identical commands create exactly one contact request; an altered payload fails idempotency. Scope, mandate, human-only action, media, unsupported protocol/features, origin, revocation, token expiry, account closing, foreign task/context, restart, cancellation, invalid pagination/date, filtering by canonical status timestamp (not database insertion time) and sanitized uncertainty paths are covered.

Migration acceptance reconstructs the prior audience/lease constraints in a separate synthetic schema, seeds an existing MCP grant and running in-app lease, nonzero call/token/reservation/unknown counters, versioned fifteen-minute enrollment settings/eligibility and queued job. It applies the normal two migrations and compares **complete rows** in accounts, kingdoms, mandates, clients, grants, refresh tokens, runs, enrollments, leases and durable jobs. All are identical. Subsequent A2A lease acquisition remains blocked and its close operation leaves the run/lease/counters intact. Other tests confirm refresh keeps the lease ID, another grant cannot release it, and expiry blocks a fresh game command. These synthetic results establish preservation semantics; no live migration/restoration/deployment acceptance is invented.

## Documentation and tracker

[Setup, OAuth, schemas and exact recovery semantics](../../api/a2a.md) accompany dated specification corrections: architecture 1.4, access 1.4, runtime 1.5 and privacy 1.3. The source review records affected historical tickets; their original scope/acceptance/status/evidence and all existing population metadata remain unchanged. New acceptance belongs to PACT-168.

Linear search found no matching existing issue. Creation was rejected at the workspace free issue limit, request **a49e4a6ff8bcf8e1**; the local tracker is the execution record. No remote issue/completion or hosted CI/external-host certification is claimed.

## Rollout boundary

This assignment performs no changes to the server Luna or local Nemotron Fleet releases, identities, budgets/counters, unknown markers or schedule anchors. Separate work is present in the sibling Fleet repository; none is modified or included in this PACT change. This assignment changes PACT source only; the feature remains off until a selected API/gateway release is deployed with migrations and explicit enablement. A future rollout must preserve protected databases/vaults and read back the flag/card/authenticated capabilities; it need not restart or convert either fleet. A separately consenting A2A client may then choose this interface. Actual third-party hosts and improved communication/strategic outcomes require their own observed acceptance.

No further dependency-ready implementation in this assignment remains. Deployment/enablement is the next operational step; deferred roadmap tickets and peer-hosted capability exchange remain separately scoped.
