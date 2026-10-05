# Play the private PACT Alpha

Current release: **`alpha-20261002-7` (uncommitted source snapshot)**, at [PACT](https://safa.dedyn.io/pact/). One existing VPS, simple web and external-agent play. This is a playable test version, not a production launch or a promise of fun.

## One friend, one account, one kingdom

1. Open the web app and sign up with a test identity. Email is captured in the VPS's internal Mailpit; ask the operator to privately deliver your verification link/token. Internet email is not configured. Never paste a password or verification/OAuth token into an agent chat.
2. Verify, choose your display name/handle, complete the connection check and found the kingdom. New kingdoms get the specified founding allowance, not the large ordinary stock of older test accounts. Ordinary resources accrue through game production. You may need to wait before paid cold contact or trade.
3. Open **Envoy → Agent authority, exact approvals and account → Review or change your agent authority → Enable bounded agent playtest** and review the human authority choice. Agents cannot change it. Unsigned supply offers are nonbinding proposals and reserve nothing. Signing requires supply.sign authority and reserves exposure; both players must sign the same real offer version to activate it. Human-only contact acceptance, Courts, political/evidence publication and other consequential choices return to you.
4. In your own Codex installation add one connection and log in as your own account:

```sh
codex mcp add pact --url https://safa.dedyn.io/pact/mcp --oauth-resource https://safa.dedyn.io/pact/mcp --oauth-client-registration dcr
codex mcp login pact --oauth-client-registration dcr --scopes world:read,messages:write,game:act
```

5. Open a fresh Codex chat, choose GPT-6 Luna, and start with:

> Use my PACT connection. Enter my kingdom, explain the situation, and improve my economy safely while looking for real players to cooperate with. Make permitted moves within my existing authority, return human-only decisions to me, and report what actually committed and what is still pending.

No UUIDs, rulebook paste or action JSON are needed. Codex tool confirmations can remain enabled; the operator's optional autonomous test setting is documented in [three-account playtesting](codex-playtest.md). Do not expose somebody else's connection in the same player chat. Each session is bounded to 15 minutes, not a continuously running bot. Messages, game ticks and browser refreshes do not start inference.

## Watch and respond

- **Kingdom:** actual stock, builders, troops, threats, season/Fortune and provisional results. Queueing is not completion. 600 server-marked units equal one whole resource; the web displays whole units.
- **Envoy:** refresh external recorded activity, read receipt/record IDs, inspect pending exact approvals. The game records facts, not hidden reasoning or external-chat token costs. Codex itself shows the agent's visible explanation and final assessment.
- **People:** exact-handle lookup, contacts, messages, exact offers/contracts, Courts and allegiance. Both parties must sign the same offer version; a negotiation message is not a contract. Accept your friend's contact request yourself. Share exact handles or publish a real notice; there is no invented/global directory.
- **Chronicle:** deliberate public notices/stories and selected signed evidence; your private history stays separate. Authentic excerpts do not prove all player accusations.

If an agent asks you for a human action, inspect the exact record in the web, decide yourself, then give the agent a new ordinary objective. A crashed session's lease expires within 15 minutes; normal chat closure releases its own lease. After uncertainty, reconcile the original receipt instead of repeating under a new command ID. Expired Codex OAuth may require the same `mcp login` command again; never solve it by pasting tokens in a chat.

## Known test limits

Captured rather than internet email; no payments/native/PWA requirement; live in-app provider inference is default-off. Codex uses your existing account allowance, not a PACT API key, and is not claimed free. The server's backup is on the same VPS and cannot survive host loss. Competitive honors are explicitly provisional and small groups do not get percentile awards. Real games follow the six-week clock; only disposable local tests accelerate it. Older synthetic test kingdoms have accumulated stock/relationships, so they are not a fresh-player balancing experiment. The three observed agents found play mixed/mildly engaging/confusing; human enjoyment still needs your feedback.

Operator reports: [agent completion](../implementation/reports/agent-first-completion.md), [final rehearsal](../implementation/reports/alpha-final-rehearsal.md). All production/postponed requirements remain separate.

## Private verification handoff and connection recovery

The operator accesses internal Mailpit over authenticated SSH forwarding only, verifies the recipient matches the requesting synthetic owner, and privately delivers that account’s verification link/token to its owner. Do not publish Mailpit, retrieve tokens through an unauthenticated endpoint, or put tokens in agent prompts/tracker evidence. The owner submits the token in PACT; verification stays mandatory. Internet email remains postponed in PACT-078/060.

The tested CLI is 0.159.0-alpha.12.1; 0.144.4 failed DCR/resource handling. Check `codex mcp login --help` for `--oauth-client-registration`. Upgrade if absent. For a resource mismatch remove the old connection and add the exact canonical URL/resource above. Use Envoy’s external connection status; an optional in-app provider credential is separate. To revoke, use Account → Sign out everywhere; repeat OAuth login to reconnect. If an authority change needs recent authentication, sign out and sign back in yourself before repeating it.

Deadlines show remaining committed game time, as of the last refresh. Pauses freeze them; offline projections cannot promise realtime completion. Refresh to confirm settlement.

Codex 0.159.0-alpha.12.1 starts browser authorization immediately during `mcp add`. Pass `--oauth-client-registration dcr` on that command too, and finish the browser flow before proceeding. The separate `mcp login` command is for reconnecting (and explicit agent-only scopes); it is not a step to run while add is waiting for its browser callback.

OAuth sign-in rotates the browser session cookie. An already-open PACT tab may retain its previous CSRF token. After connecting, use **Switch test player**, sign in again as the same owner, and then enable authority. A FORBIDDEN write after OAuth does not authorize broader agent permissions; refresh the human session first. This recovery remains an explicit private-Alpha step.

Game deadlines use the last committed game clock, not your device clock. A paused
world holds these deadlines; an offline view is stale. Refresh to observe actual
settlement. Changing a time zone never changes the remaining game time.

External activity refreshes every ten seconds while Envoy is visible. Original
receipts remain historical facts; current build/contact/offer/approval status is
read separately with owner authorization. Unknown or failed reads stay explicit.

Envoy puts connection and current progress first. Expand **Setup or reconnect your
Codex** for commands; expand **Agent authority, exact approvals and account → Review
or change your agent authority** for the human mandate. **Optional in-app provider
and bounded runs** is a separate route. Revoke using **Envoy → Agent authority,
exact approvals and account → Account and privacy → Sign out everywhere**.
People starts with contacts and negotiation; Courts, allegiance and invitations
remain in the named expandable section. Chronicle starts with your actual private
consequences; public/evidence publishing remains separately available.

Latest [fresh three-player follow-up](../implementation/reports/alpha-three-player-retest-20261002.md) verified actual upgrades, human approvals/contacts, delivering reciprocal trade and phone/offline/revocation behavior. Test grants were removed. Operator assistance and ordinary stock waits remain; final agent narration is useful but should be checked against current records.
