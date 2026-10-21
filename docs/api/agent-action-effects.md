# Scoped action effects protocol

Source candidate; disabled unless `PACT_AGENT_ACTION_EFFECTS_ENABLED=1`. No deployment or execution-setting amendment is included.

`fleet.action-effects.v1` binds complete owner-local claims/capacities and opaque authoritative dependency revisions to one native command. The [coverage matrix](../implementation/agent-action-effects-matrix.md) defines the eight supported actions and their exact boundaries. A quote is read-only, not permission, a reservation, peer consent, or proof of outcome.

`POST /v1/agent-action-effects/quote`: authenticated owner/agent, normal world-read scope, body `{command}`. Returns the exact native command digest and a30-second UTC validity window.

`POST /v1/agent-action-effects/execute`: normal command authority and write lease, body `{command,guard:{schemaVersion:"fleet.action-effects-guard.v1",expectedRevision,expectedEffects,reserveConstraints?}}`. An optional `reserveConstraints` maps iron/silver/grain to minimum ordinary internal units after immediate debits. The same command ID/payload/guard resolves the original receipt, including while paused. Changed payload or guard conflicts; stale state/authority/offer/capacity fails before mutation. No automatic quote refresh/retry is authorized.

Fleet translates its immutable `pact.action.v1` intent into the existing native command version. Its local intent digest is checked locally; transport converts only that digest to the canonical native command hash. The remote service recomputes all effects and guard facts from authenticated ownership, never trusting Fleet's identity or arithmetic.

MCP exposes `pact_action_effects_quote_v1` (read-only, `world:read`) and `pact_action_effects_execute_v1` (write, `game:act`) only when the same port is installed. API bearer writes require the existing exact holder in `Mcp-Session-Id`; the unchanged handler verifies its live owner-bound lease. Human cookie writes require normal CSRF/origin authorization. Neither interface acquires or renews a lease. `/v2/interfaces.actionEffects` advertises the exact action list only when enabled. This is independent of `fleet.coordination.v1`.
