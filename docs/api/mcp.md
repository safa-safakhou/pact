# MCP transport

Tickets: PACT-017.

`POST /mcp` and `GET /mcp` are the single Streamable HTTP surface. Clients authenticate with an MCP-audience Bearer access token from `@pact/oauth`. Origin must match `PACT_ORIGIN`. Supported protocol versions are `2025-11-25` and `2025-06-18`; unknown versions fail with `UNSUPPORTED_PROTOCOL`.

## Sessions

`initialize` creates an `mcp_sessions` row and returns `Mcp-Session-Id`. Later `tools/list` / `tools/call` and `GET /mcp` streams require that session and bind it to the authenticated account. Another account cannot resume the session.

## Tools

Sandbox tools and `pact_command_v1` dispatch through the shared `CommandDispatcher`. Tool listing never expands scopes; the OAuth token already defines authority, and human-only operations remain blocked for MCP audiences.

Private responses set `Cache-Control: no-store`.
