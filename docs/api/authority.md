# Mandate and immediate authority

Humans edit a versioned kingdom mandate. Agents receive a readable copy and cannot change it through tools or payload fields.

## Routes

- `GET /v1/mandate` — ensure/read the caller's mandate
- `POST /v1/mandate` — raise/update authority; requires a human session with recent authentication (`authority.raise`)

Raising authority increments `version`. Stale sessions return `RECENT_AUTH_REQUIRED`.

## Immediate ledger

`AuthorityService.spendImmediate` enforces synthetic per-asset allowances under serializable locking so two concurrent spends cannot both consume the same remaining units. Full future-commitment accounting is deferred to PACT-039.

Default-deny human-only actions (`authority.raise`, `credential.read`, `approval.commit`, `account.delete`, `checkout`) always fail agent/MCP checks.

Implementation: `@pact/authority` (`AuthorityService`).
