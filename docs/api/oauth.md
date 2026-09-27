# OAuth authorization and resource endpoints

PACT is the OAuth authorization server and protected resource for MCP and first-party native clients. Use authorization code with PKCE S256 only.

## Metadata

- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/oauth-protected-resource` (MCP audience)
- `GET /.well-known/oauth-protected-resource/human`

## Token lifecycle

| Grant | Lifetime |
| --- | --- |
| Access token | 15 minutes |
| Refresh token (rotating) | 30 days absolute; reuse revokes the token family |

Scopes: `world:read`, `messages:write`, `game:act`. None authorize human approval, credential reads, mandate raises, checkout, or account deletion/export.

## Routes

- `POST /oauth/register` — dynamic registration
- `GET /oauth/authorize` — validated browser sign-in page for PKCE consent. Repeated identical `resource` query parameters from an MCP client are normalized to one exact resource; conflicting values fail. Other duplicate parameters still fail schema validation.
- `POST /oauth/authorize` — cookie-authenticated Origin/CSRF write; human session issues a code; response includes consent `{ clientName, subjectLabel, scopes }`
- `POST /oauth/token` — `authorization_code` or `refresh_token`
- `POST /oauth/revoke`

Redirect URIs must match exactly. Client metadata URLs must be HTTPS and must not resolve to private networks. MCP and human audiences are separate registrations; agent tokens never inherit human-only permissions.

Implementation: `@pact/oauth` (`OAuthService`).
