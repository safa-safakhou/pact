# Telemetry operations

`@pact/telemetry` is the single product-neutral boundary for operational events. API requests receive a server-generated UUID in `x-request-id`; a caller-supplied value is accepted only when it is a valid UUID. Command handlers add command, run, and job UUIDs as those objects come into existence. The outbox migration persists the correlation fields, and workers continue the same trace with `executeTracedWorker`.

Trace entries carry an event name, timestamp, severity, retention class, correlation IDs, and a small sanitized attribute object. They never require a prompt, message body, provider request or response, email, authorization header, password, token, credential, cookie, or raw error message. `Telemetry` recursively censors sensitive keys. The Fastify logger independently redacts those keys and replaces serialized errors with a stable code. Client failures contain a generic message, a stable public code, and the request ID.

Use `recordStage` for the four command stages: `api`, `transaction`, `outbox`, and `worker`. Add a stable `errorCode` when a stage fails; do not attach an exception, transcript, or model payload. A command that fails in a worker remains discoverable by its request/command IDs and the persisted outbox event ID.

`GET /metrics` returns Prometheus text for readiness, queue lag, and provider-error totals. Metric labels accept only short alphanumeric, underscore, or hyphen values; invalid values become `unknown` so private text and unbounded identifiers cannot become labels. Provider adapters increment errors by registered provider name and stable error code. Queue consumers set lag from the oldest ready item, in seconds. Metrics contain no account, kingdom, request, command, run, job, or message identifiers.

## Retention classes

The registry in `@pact/telemetry` is deployment configuration, using real time:

| Class | Maximum | IP rule | Use |
| --- | ---: | --- | --- |
| `rawEdgeMetadata` | 7 days | delete at 7 days | Immediate abuse and security detection |
| `securityAudit` | 90 days | remove after 7 days unless attached to an active incident | Authentication and security events |
| `productAnalytics` | 90 days | never include IP | Pseudonymous product events; aggregate after expiry |
| `operational` | 30 days | never include IP | Content-free process and command traces |

Infrastructure must apply a lifecycle no longer than the registered maximum. The 30-day operational window is an implementation limit for content-free diagnostics; it does not extend any source-data retention period. A legal hold or active security case is handled under the privacy policy and must not be implemented by silently changing the general lifecycle.

## Incident check

Search by request or command UUID, then verify the expected stage sequence. Never paste private content into a log query or incident note. For a suspected leak, capture only the event IDs, restrict access, and follow the privacy incident process. The automated fixtures seed credentials, email, prompt, message body, payload, and raw error text and assert that none appears in application logs, telemetry, metrics, or the client error envelope.
