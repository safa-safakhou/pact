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

## Inference worker

`workers/inference` leases `envoy.run.tick` durable jobs and calls `RunService.executeModelCall`. Ambiguous provider failures mark the run `failed` with `ambiguousCrash` and fail the job without an unbounded retry loop. Idle inbox delivery never receives a provider adapter.

The provider router validates tool names, unique call IDs, and parsed arguments before `RunService` passes returned calls to the injected `executeToolCalls` port. If the router admits a call but no executor is configured, the run fails with `MALFORMED_TOOL_CALL`; calls are never silently discarded. Other non-quota provider/tool errors also fail the run immediately, including when allowance remains. The product-owned executor must use the shared command dispatcher, derive agent identity from the run, and check `assertRunWriteLease` in the command transaction. This lease check requires the exact active `pact_run` holder, owning account, and live deadline; an MCP lease is not interchangeable. The current inference worker still configures only the fake provider with no game tools, so this port is not yet an end-to-end game command route. Durable tool-result/receipt handoff and bounded context remain PACT-049 work.
