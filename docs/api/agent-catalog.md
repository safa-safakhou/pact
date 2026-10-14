# Authenticated executable operation catalog

AR-P02 / PACT-172. Shared operation names and exact JSON argument schemas remain in reviewed contracts; `AgentOperationService.listOperations` and MCP advertise only installed ports under the caller's scopes. `_meta["pact/operation"]` adds `pact.operation-catalog.v1`, the exact argument-contract name, audience, required scopes and read-only status. MCP presentation uses the same metadata constructor. Existing names/input schemas are unchanged; compatible old clients can ignore additive metadata. A declared unsupported catalog version must fail explicitly, not silently reinterpret arguments.

Advertisement never grants stock, remaining authority, target ownership or a write lease. Shared application handlers still perform current authorization and atomic dispatch. The catalog is not a second engine or permission system.

Invalid argument responses preserve bounded schema ID and at most eight field paths/codes. Values/private messages are excluded. OAuth and scope denials precede projection/argument execution; no private target data is revealed through validation. This source does not enable optional interfaces or change any live grant/client.
