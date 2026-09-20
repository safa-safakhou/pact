# Shared wire contracts

`@pact/contracts` is the only source for command, receipt, event, cursor, and model-tool payload shapes. Zod produces runtime validation and JSON Schema from the same definitions. HTTP, MCP, provider adapters, and clients import these exports instead of recreating validators.

Version 1 commands use `pact.command.v1`; events use `pact.event.v1`. A command ID is a UUID and remains stable across transport retries. The authenticated server derives effective identity and authority; serialized actor context is validated context, never permission to impersonate another account.

The foundation tool set contains only `sandbox.echo`, `sandbox.counter.increment`, `sandbox.draft.read`, and `sandbox.draft.write`. Strict schemas reject unknown fields and tool kinds, including code execution, database queries, credential access, and human account operations. Later tickets extend the discriminated action union through reviewed schemas.

Resource amounts serialize as non-negative integer strings with at most 18 decimal digits, avoiding JSON floating-point loss. The game rulebook's internal resource unit is 1/600 of a displayed resource; later rule tickets own that conversion and exact arithmetic.

`commandJsonSchema` is the shared request schema. `httpCommandContract` binds it to `POST /v1/commands`; `mcpCommandTool` exposes the same schema to MCP. Receipt codes are a closed enum and never replaced with improvised model prose. `GET /v1/receipts/:commandId` returns the caller's own receipt for retry reconciliation and never another account's result. Private API responses set `Cache-Control: no-store`.

Human identity and setup endpoints are documented separately in [identity API](identity.md). They use the same authenticated server boundary but are human account operations rather than model/game commands.

## Command gateway

`@pact/application` owns `CommandDispatcher`. The HTTP adapter authenticates the human session, then the dispatcher overwrites command actor fields with that principal. Same `commandId` and canonical payload (schema version, action, expected version) return the original receipt; a changed payload returns `IDEMPOTENCY_CONFLICT` without a second mutation. Receipts, sandbox state, and outbox events commit in one transaction.
