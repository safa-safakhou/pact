# Play the private PACT Alpha

Current release: **`alpha-20261001-1` / `88c273f`**, at [PACT](https://safa.dedyn.io/pact/). One existing VPS, simple web and external-agent play. This is a playable test version, not a production launch or a promise of fun.

## One friend, one account, one kingdom

1. Open the web app and sign up with a test identity. Email is captured in the VPS's internal Mailpit; ask the operator to privately deliver your verification link/token. Internet email is not configured. Never paste a password or verification/OAuth token into an agent chat.
2. Verify, choose your display name/handle, complete the connection check and found the kingdom. New kingdoms get the specified founding allowance, not the large ordinary stock of older test accounts. Ordinary resources accrue through game production. You may need to wait before paid cold contact or trade.
3. Open **Envoy → Enable bounded agent playtest** and review the human authority choice. Agents cannot change it. The test preset allows bounded play/signing but not every offer-creation action; you can create an exact supply offer in People if needed. Human-only contact acceptance, Courts, political/evidence publication and other consequential choices return to you.
4. In your own Codex installation add one connection and log in as your own account:

```sh
codex mcp add pact --url https://safa.dedyn.io/pact/mcp --oauth-resource https://safa.dedyn.io/pact/mcp
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
