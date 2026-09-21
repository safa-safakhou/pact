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
