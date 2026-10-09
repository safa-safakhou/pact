# Human identity and setup API

All responses under `/v1/auth/` and `/v1/setup/` use `Cache-Control: no-store`. Login sets only `pact_session`, an opaque server-stored identifier with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and an absolute expiry. The login response carries the CSRF token for the first-party client. Cookie-authenticated writes require that token in `x-csrf-token` and an exact configured `Origin`.

| Method and path | Purpose | Authentication |
| --- | --- | --- |
| `GET /v1/auth/session` | Restore stable session-bound CSRF, account ID, guest flag and expiry metadata in a new tab | Human session cookie; no-store |
| `POST /v1/auth/guest/save` | Request verified in-place conversion of the current guest account | Human cookie, CSRF and Origin; registration gate, current terms, 18+ and password policy |
| `POST /v1/auth/logout` | Revoke only this browser session and expire its cookie | Human cookie, CSRF and Origin |
| `POST /v1/auth/signup` | Accept email/password, current terms, and the 18+ declaration | Public; generic accepted result for duplicate email |
| `POST /v1/auth/verify` | Consume a 24-hour signup or guest-save email token; guest conversion preserves the existing kingdom | Public single-use token |
| `POST /v1/auth/login` | Create a 7-day idle/30-day absolute human session | Email/password and MFA when enabled |
| `POST /v1/auth/reset/request` | Queue a recovery email | Public; same result for existing and missing accounts |
| `POST /v1/auth/reset/confirm` | Consume the 15-minute token, change password, and revoke sessions/grants/runs | Public single-use token |
| `POST /v1/auth/reauthenticate` | Rotate into a newly authenticated session | Valid cookie, CSRF/origin, password, and MFA when enabled |
| `POST /v1/auth/sign-out-everywhere` | Revoke sessions, OAuth grants, and active runs | Recently authenticated human cookie and CSRF/origin |
| `GET /v1/auth/connections` | List active human sessions and OAuth grants | Human cookie |
| `POST /v1/auth/email-change/request` | Check current password and queue verification to the new address | Recently authenticated human cookie and CSRF/origin |
| `POST /v1/auth/email-change/confirm` | Consume the new-address token and notify the old address | Public single-use token |
| `POST /v1/auth/mfa/begin` | Create a pending TOTP secret | Recently authenticated human cookie and CSRF/origin |
| `POST /v1/auth/mfa/confirm` | Verify TOTP and return ten one-time recovery codes | Recently authenticated human cookie and CSRF/origin |
| `GET /v1/setup/draft` | Read the authenticated account's private draft | Human cookie |
| `PATCH /v1/setup/draft` | Save display name, proposed handle, and portrait with optimistic versioning | Human cookie and CSRF/origin |
| `POST /v1/setup/connection-check` | Record a successful connection check | Human cookie and CSRF/origin |
| `POST /v1/setup/sandbox-activation` | Validate setup and create an idempotent test receipt | Human cookie and CSRF/origin |

The setup route ignores caller-supplied ownership fields. A draft contains no stocks, troops, score, or public target. Sandbox activation records only a test receipt; real kingdom founding remains unavailable until PACT-031.
