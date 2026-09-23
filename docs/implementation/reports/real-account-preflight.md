# Real-account environment preflight

Ticket: PACT-025 / MNI-88
Implementation revision/PR: `b5f2a3f`
Verification date/environment: 23 September 2026, Node 24 local workspace and single VPS release `mvp-20260923-1`

## Result

The API now has a fail-closed real-registration gate backed by a host-only operator register. Missing, unreadable, malformed, placeholder, or terms-mismatched configuration cannot reach the identity signup service. Public routes expose the registration state and reviewed notices without exposing internal agreement references or operational evidence. The single-VPS deployment has a read-only operator-state mount and retains internal Mailpit as the zero-cost MVP email proof.

Real registration remains disabled. Actual controller/support identity and reviewed processor agreement/transfer records have not been provided and were not invented.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-025 | A deployment with an empty required legal/operator field cannot accept a real signup. | `services/api/src/operator-preflight.test.ts`; focused tests; live `mvp-20260923-1` HTTP/database probe | Pass: unavailable/invalid/placeholder configuration returns `503 REGISTRATION_UNAVAILABLE` before identity invocation. Live status was false, signup returned 503, and the database contained zero rows for the probe email. |
| PACT-025 | The configured notices, email delivery, privacy-request channel, staff MFA, and restore/deletion checks are demonstrated before inviting a tester. | Operator register schema and `npm run preflight:operator`; prior Mailpit and restore/deletion evidence | Blocked: schema and checker require references, but actual notices, privacy channel, ownership, staff-MFA evidence, and processor agreements still require operator-supplied facts and verification. No real tester may be invited. |

## Documentation

- [Identity and onboarding operations](../../operations/identity.md#real-registration-operator-preflight)
- [Single-VPS deployment](../../operations/vps-deployment.md#registration-gate)
- `infra/production/operator-register.example.json`

## Decisions and limitations

Registration availability is separate from process readiness so login and privacy access for existing synthetic accounts continue while signup is closed. The public notice projection omits private agreement/evidence references. The example file contains invalid placeholders and starts disabled. Real outbound email remains deferred to PACT-078; PACT-025 accepts the documented internal Mailpit proof for the private MVP.

## Handoff

The operator must provide the actual controller/contact facts, public document URLs and versions, privacy/support ownership and route, reviewed processor/transfer records, and staff-MFA evidence. Until those pass, PACT-025 remains blocked and PACT-026 and PACT-086 remain dependency-blocked.
