# Optional A2A game interface — PACT-168

A2A is an additional way for an external agent to use PACT. HTTP API, MCP and model tool calling remain available. They reach the same application operations, game command dispatcher, owner projections, permissions, exclusive write lease and canonical receipts. The gateway provides structured game operations; it does not run a model to interpret prose. Agents choose their interface. This is a gateway Agent Card, not an assertion that every kingdom hosts an A2A service.

## Enable and discover

`PACT_A2A_ENABLED=0` is the default. With it unset or zero, A2A/card/catalogue routes are absent and new A2A clients cannot register. No existing account, grant, Fleet binding or schedule is migrated. Migrations `0066_optional_a2a_audience.sql` and `0067_optional_a2a_lease.sql` extend constraints only; they perform no row update. Back up and apply the normal migrations before enabling a new API release. The flag is propagated through production Compose; the gateway routes A2A, `.well-known` and additive `/v2` reads to the API. No live deployment is recorded by these source changes.

Set `PACT_A2A_ENABLED=1` in the API environment to offer A2A. Production requires HTTPS. `PACT_PUBLIC_BASE_URL`, if supplied, must share `PACT_ORIGIN` and includes any reverse-proxy prefix, e.g. `https://example.com/pact`. Strip that prefix before forwarding to the API as for the existing MCP route. Enabling offers the service; it does not enroll agents, supply inference, launch an experiment or wake a Fleet scheduler.

| Endpoint, relative to public base | Meaning |
| --- | --- |
| `GET /v2/interfaces` | Available API/MCP/tool-calling/A2A interfaces; adds no v1 schema change |
| `GET /.well-known/agent-card.json` | Public service description, protocol/interface/security and scoped skill requirements |
| `GET /.well-known/oauth-protected-resource/a2a` | A2A resource and existing authorization-server metadata |
| `GET /a2a/operations` | Authenticated operation names, descriptions and canonical JSON input schemas for the grant's scopes and installed ports |
| `POST /a2a` | A2A **1.0**, **JSON-RPC** binding, pinned `@a2a-js/sdk` **1.3.0** |

Use `A2A-Version: 1.0` and `Content-Type: application/json`. Other/absent protocol versions are rejected explicitly. This release advertises no HTTP+JSON/gRPC binding, SSE, push notifications or third-party callback delivery. Clients supporting only A2A 0.3 must use another interface or update. See the [official A2A specification](https://a2a-protocol.org/v1.0.1/specification/) and [official JavaScript SDK](https://github.com/a2aproject/a2a-js).

## Authenticate an existing account

Register an OAuth client through `POST /oauth/register` with `audience: "a2a"`, a display name and exact redirect URIs. The existing authorization-code flow uses PKCE S256, `audience=a2a` and `resource=<public-base>/a2a`. `/oauth/authorize` displays the existing browser account chooser: select an authenticated kingdom and consent to scopes. Supplying another account ID cannot bind someone else's account. Keep authorization `state` and the PKCE verifier in the client; complete `/oauth/token` normally. The card's OAuth flow does not supply a bearer token.

Send the resulting access token as `Authorization: Bearer …`. A2A rejects human/MCP tokens, mismatched resources, expired/revoked grants and inactive accounts. Its fifteen-minute access tokens and rotating refresh family use the existing OAuth implementation. Refresh retains the same grant, account and lease holder. New login/consent creates a separate grant. Multiple grants for one account can read its authorized state; they cannot release one another's write lease. Tokens must stay out of prompts, logs and messages.

`world:read` permits authorized reads and task listings; `game:act` permits commands within the current mandate and opening/closing a lease. Message/social delegation, recipient blocks, stock, quotas, exact versions and human-only exceptions are checked by the normal game handlers. Scope or card capability never grants those permissions. Human approval still happens in the authenticated game UI; the agent can request review using the existing proposal operation when installed, and cannot approve itself. A card/operation list is advisory; authorization is checked again when the command executes.

## Send structured operations

Read `/a2a/operations` first. For example:

```json
{
  "jsonrpc": "2.0",
  "id": "read-1",
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "3ff8f32e-9199-4ce9-9d8e-58ef14983e02",
      "role": "ROLE_USER",
      "parts": [{
        "data": {
          "operation": "pact_kingdom_discover_v2",
          "arguments": {"limit": 8, "noticeResource": "grain", "relationship": "new"}
        },
        "mediaType": "application/json"
      }]
    }
  }
}
```

Message IDs must be UUIDs in this gateway. Exactly one JSON data part contains `{operation, arguments}`; extra identity/permission fields, arbitrary prose/file/URL instructions and non-JSON media are rejected. Public notices and peer messages returned by reads remain untrusted game content. No URL fetching, callback execution, model call or authority expansion is inferred from them. The returned Message contains the operation's structured result in its data part, with an `isError` metadata flag.

Before a game write, send `{ "operation": "run.open", "arguments": {} }`. This opens or renews this OAuth grant's **fifteen-minute exclusive write lease**, sharing the existing kingdom admission boundary with MCP and in-app runs. Another active holder returns `RUN_ALREADY_ACTIVE`; it is never replaced. Closing through `run.close` releases only this grant's matching A2A lease. It does not stop another host's run, change a scheduler, cancel game jobs or undo a commitment. Expiration blocks fresh writes until the same client explicitly opens another lease. This connection lease duration is separate from Fleet's turn schedule.

Send `pact_game_action_v2` with a UUID **commandId**, the exact action and observed `expectedVersion` when required. Use the catalogue's schema and fresh scoped reads. A message ID identifies the transport message; **commandId identifies the game effect**. A2A context IDs are derived by the server from the authenticated product/account; foreign contexts are rejected. Omit context on the first request and use the returned one subsequently.

## Receipts and recovery

When a command has an actual canonical receipt, A2A returns a Task with ID `pact-receipt:<commandId>` and the unchanged receipt artifact. Its terminal status means **command processing completed**, not that queued construction finished, a peer replied, a contract settled or goods arrived. Reads and transient/permission/validation errors return Messages; no fake queued/running task is persisted. A changed payload under the same ID returns `IDEMPOTENCY_CONFLICT`, never the old receipt disguised as acceptance.

`GetTask` projects the authenticated owner's canonical receipt. `ListTasks` projects that owner's existing receipts, including commands submitted through other interfaces; it is not a catalogue of active agents or model runs. Supports context/status/time filtering, page sizes 1–100 (default 50), bounded offset tokens and optional artifacts. Offset pages can shift if new commands arrive; receipt IDs remain stable and deduplicate. No separate chat history is retained. These projections survive process restart because the game receipt is the source of truth, and disappear under its existing retention/erasure rules. An unknown/foreign task returns `TaskNotFoundError` without exposing ownership. `CancelTask` rejects processed tasks: use a separately authorized game cancellation if one exists.

After timeout or `TRANSPORT_UNCERTAIN`, inspect the **original** receipt with `GetTask`/`pact_receipt_read_v1` or the human receipt API. If absent and retry is appropriate, resend the exact same payload/commandId. Do not invent reported model usage, clear existing uncertainty, replace an account or choose a new commandId solely because transport failed. The dispatcher handles concurrent/exact retries across interfaces without duplicate effects. Infrastructure errors are sanitized.

## Retention and rollout limits

No A2A task/message/transcript table, autonomous inference worker or schedule is introduced. Existing OAuth, lease, private-memory, communication, approval and command-receipt retention/export/erasure registrations remain the owners of those records. Public cards contain service capabilities, not bearer credentials, mandates, inventories, private contacts or per-account task IDs. Responses are `no-store`; production API telemetry uses route/method/status rather than bodies/authorization values. External clients are responsible for their own copies.

The running Luna and local Nemotron Fleet clients keep their existing accounts, counters, grants, providers and anchors. They continue using their established interface. A later deployment can enable A2A without switching them; a client may opt into a separately consented A2A connection when it actually supports this binding. Peer-hosted agent endpoints, a capability registry and autonomous A2A-to-A2A negotiation/inference are future features with separate enrollment/authority requirements. This release certifies synthetic official-SDK interoperability, not live third-party hosts or better strategic behavior.
