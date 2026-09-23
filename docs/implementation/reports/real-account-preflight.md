# MVP account environment preflight

Ticket: PACT-025 / MNI-88
Implementation revision/PR: `b5f2a3f`
Verification date/environment: 23 September 2026, Node 24 local workspace and single VPS release `mvp-20260923-1` with synthetic MVP register

## Result

The API has a fail-closed registration gate backed by a host-only operator register. Missing, unreadable, malformed, placeholder, or terms-mismatched configuration cannot reach the identity signup service. Public routes expose the registration state and notices without exposing internal agreement references or operational evidence. The single-VPS deployment has a read-only operator-state mount and retains internal Mailpit as the zero-cost MVP email proof.

The private connection-test environment uses a complete, explicitly synthetic operator register and permits synthetic-data MVP signup. Actual production controller/support identity and reviewed processor agreement/transfer records are deferred to PACT-098 / MNI-157.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-025 | Empty required operator fields fail closed; the complete labeled synthetic register enables private MVP signup. | `services/api/src/operator-preflight.test.ts`; focused tests; live disabled and enabled probes | Pass: unavailable/invalid configuration returned 503 before identity invocation; the synthetic register passed preflight and enabled the test environment. |
| PACT-025 | MVP notices, captured email delivery, temporary ownership, and restore/deletion checks are demonstrated. | `npm run preflight:operator -- infra/production/operator-register.mvp-test.json`; Mailpit and PACT-024 restore/deletion evidence | Pass for synthetic-data MVP. Production facts and independent legal review are explicitly outside this ticket and tracked by PACT-098. |

## Documentation

- [Identity and onboarding operations](../../operations/identity.md#real-registration-operator-preflight)
- [Single-VPS deployment](../../operations/vps-deployment.md#registration-gate)
- `infra/production/operator-register.example.json`
- `infra/production/operator-register.mvp-test.json`

## Decisions and limitations

Registration availability is separate from API readiness. The public notice projection omits private agreement/evidence references. The generic example remains invalid and disabled; the environment-specific MVP register is conspicuously synthetic and instructs testers not to use real personal data. Real outbound email remains deferred to PACT-078.

## Handoff

PACT-025 can close after the enabled live check. PACT-098 / MNI-157 owns the actual controller/contact facts, reviewed documents, production privacy/support ownership, processor/transfer records, and staff-MFA certification before production or paid signup.
