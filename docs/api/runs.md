# Bounded Envoy runs

Tickets: PACT-021.

`@pact/runs` owns exclusive kingdom/subject write leases and the Envoy run lifecycle: start, wait, resume, stop, takeover, and MCP lease acquisition without inference.

## HTTP

| Method | Path | Behavior |
| --- | --- | --- |
| `POST` | `/v1/runs` | Human session starts a bounded run (objective, provider, model, optional credential) |
| `GET` | `/v1/runs/:runId` | Owner-scoped run status and allowance counters |
| `POST` | `/v1/runs/:runId/stop` | Stop; release write lease; preserve committed work |
| `POST` | `/v1/runs/:runId/wait` | Waiting releases the worker without polling a model |
| `POST` | `/v1/runs/:runId/resume` | Resume within original deadline and remaining allowance |

Defaults: 15 minutes, 6 conversations, 12 messages, 20 calls, 40 000 tokens. Resume never extends the deadline. A second client receives `RUN_ALREADY_ACTIVE`.

Before invoking a provider, the service reserves against the actual assembled messages and tool definitions for that call, not a fixed input allowance. Caller-controlled message text is charged conservatively by UTF-8 bytes; stable tool schemas use an approximate four-bytes-per-token estimate. If the estimate leaves no output allowance, the run finishes without a provider call. Provider-reported usage reconciles the reservation afterward. This is a bounded admission estimate, not an exact provider-token guarantee.

## Inference worker

`workers/inference` leases `envoy.run.tick` durable jobs and calls `RunService.executeModelCall`. Ambiguous provider failures mark the run `failed` with `ambiguousCrash` and fail the job without an unbounded retry loop. Idle inbox delivery never receives a provider adapter.

The provider router validates tool names, unique call IDs, and parsed arguments before `RunService` passes returned calls to the injected `executeToolCalls` port. If the router admits a call but no executor is configured, the run fails with `MALFORMED_TOOL_CALL`; calls are never silently discarded. Other non-quota provider/tool errors also fail the run immediately, including when allowance remains. The PACT-owned command bridge uses the shared dispatcher and derives agent identity from the run. Gameplay transactions check `assertAgentWriteLease`: an MCP session must hold its own `mcp` lease, while an in-app Envoy must own the live `pact_run` lease. These holders are not interchangeable. The inference process now composes the same `@pact/application` game handler as the API, with the generated `pact_command_v1` tool and an optional raid-seed secret from its own mount. A PostgreSQL fake-provider fixture exercises this actual composition. The deployed worker still registers only the deterministic fake provider; real model credentials, durable tool-result/receipt handoff, and bounded authorized context remain PACT-049 work. Do not present this as a live model-game route.
