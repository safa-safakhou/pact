# Durable inbox and SSE

Tickets: PACT-022.

`@pact/inbox` writes audience-filtered events into `inbox_events` with deduplication on `(product_scope, event_id, account_id)`. Clients page with a sequence cursor, acknowledge progress, and may open an SSE stream.

## HTTP

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/v1/inbox?cursor=&limit=` | Ordered events after the cursor for the authenticated account |
| `POST` | `/v1/inbox/ack` | Cookie-authenticated Origin/CSRF write; body `{ "cursor": "<sequence>" }`; advances acknowledgement monotonically |
| `GET` | `/v1/inbox/stream` | SSE delivery; honors `Last-Event-ID` as the cursor |

When a cursor predates the retention floor, the list response sets `resyncRequired` and `resumeFrom` instead of silently inventing history. Inbox delivery never invokes a provider adapter and cannot change an action receipt.

Private responses set `Cache-Control: no-store`.
