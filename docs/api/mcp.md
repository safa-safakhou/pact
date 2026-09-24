# MCP transport

Tickets: PACT-017; PACT-049 in progress.

`POST /mcp` and `GET /mcp` are the single Streamable HTTP surface. Clients authenticate with an MCP-audience Bearer access token from `@pact/oauth`. Origin must match `PACT_ORIGIN`. Supported protocol versions are `2025-11-25` and `2025-06-18`; unknown versions fail with `UNSUPPORTED_PROTOCOL`.

## Sessions

`initialize` creates an `mcp_sessions` row and returns `Mcp-Session-Id`. Later `tools/list` / `tools/call` and `GET /mcp` streams require that session and bind it to the authenticated account. Another account cannot resume the session.

## Tools

`world:read` grants list `pact_world_read_v1`, which accepts `targetKingdomId` and an optional 1–60-minute forecast horizon. It returns the same owner/contact/participant/public projection as `GET /v1/world/kingdoms/:kingdomId`; the authenticated account, never tool prose, determines visibility. `game:act` grants list `run.open`, the sandbox tools, and `pact_command_v1`. `run.open` obtains one 15-minute write lease bound to the authenticated MCP session; it starts no model inference and a second active holder gets `RUN_ALREADY_ACTIVE`. A read-only grant cannot call write tools even by naming one directly, and the shared dispatcher rechecks the scope. `pact_command_v1` accepts social, troop, construction, supply, scouting, and garrison actions in the shared envelope alongside sandbox actions. Gameplay writes check the exact live session lease transactionally; contact request/answer, training/building cancellation, and disband are human-only, while agent transfer/training/construction/scouting/signature and contract-breaking actions require mandate authority. Raid tools and garrison seizure remain PACT-049 work. No model-provider or consumer-chat certification is claimed.

`game.building.queue` and human-only `game.building.cancel` are also accepted by the shared command envelope. A human queue uses an exact one-use permit derived from the authenticated human session; an agent queue needs its live run lease and a suitable mandate. MCP agents cannot invoke the human-only cancellation path. Construction remains one part of the in-progress PACT-049 integration; no model-provider or hosted-client certification is claimed.

Supply actions are `game.supply.offer`, `counter`, `sign`, `withdraw`, `notice`, `refuse`, and `release`. Offer/counter carry exact versioned terms; the server derives the party from the session and activates only after two valid signatures. Nonbinding agent offers need an active write lease; an agent signature also reserves future authority. Agent notice/refusal/release checks the `supply.break` mandate action in the same transaction. `game.scout.start` commits a two-Spearman timed operation, Silver/Grain cost, and charge; `game.scout.share` shares an already-completed report only from its owning kingdom. These are typed commands, not arbitrary model instructions.

Garrison actions are `game.garrison.offer`, `sign`, `withdraw`, `exit`, and `release`. The offer names a host, exact unit counts and optional bonds; the authenticated kingdom is always the lender. Signing uses the same transaction-bound authority reservation as the domain service, and the second signature activates the visiting detachment. An agent exit or mutual-release request requires `garrison.break` in its current mandate. Seizure is intentionally not exposed yet: it requires an exact one-use human approval, not a generic game command. Signature receipts report only the caller's own bond debit; the contract and ledger record the other party's simultaneous bond movement.

Private responses set `Cache-Control: no-store`.
