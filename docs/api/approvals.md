# Exact-command approvals

Tickets: PACT-020.

`@pact/approvals` stores immutable approval requests keyed by `(product_scope, command_id)` with a canonical command hash, effects summary, preconditions, and a 15-minute expiry (earlier deadlines can be layered later).

## HTTP

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/v1/approvals/:approvalId` | Authenticated status/review; never commits |
| `GET` | `/approvals/:approvalId` | Deep-link review surface; opaque ID only, never a bearer approval secret |
| `POST` | `/v1/approvals/:approvalId/approve` | Human session cookie required; commits the exact stored command once |
| `POST` | `/v1/approvals/:approvalId/reject` | Human session cookie required; records a rejected receipt |

Double approve returns the original receipt. Expired or changed terms fail. Chatbot text and host tool confirmations are not approval credentials—only the human POST path commits.

Private responses set `Cache-Control: no-store`.
