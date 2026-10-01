# PACT-099 — agent-first Alpha completion

Ticket: [MNI-158](https://linear.app/mnim/issue/MNI-158/pact-099-complete-agent-first-access-learning-and-observable-play). Implementation: `8789315`, `88c273f`; operator launcher added in this continuation. Observed 1 October 2026 on the existing VPS and local Node 24 / PostgreSQL 17.

## Acceptance

- Fresh connected agents learn and act: **pass**. Three separate GPT-6 Luna Codex processes used empty temporary working directories, one MCP account each, ignored user server configuration, and disabled shell/multi-agent tools. Ordinary objectives only: Aster seek peaceful Grain supply; Briar seek fair trade; Cinder improve its economy and cooperate. No kingdom IDs, action JSON, repository materials or stock/clock edits were given to them. They discovered the guide and actual contacts; Briar also read Chronicle, politics, Courts and exact-handle lookup. Empty public results were reported as empty.
- Shared handlers/views and human handoff: **pass**. All five moves used the existing MCP/dispatcher. Cinder read back both receipts and its active Storehouse III instruction (not a completed building). Briar/Cinder correctly returned the missing supply-offer authority to their human rather than changing the mandate. They did not manufacture a contract. Owner HTTP activity matched their committed records. Existing social/API/in-app integration tests cover participant/private reads and human-only changes.
- Owner activity/recovery: **pass**. Migration 0044 journals committed receipt metadata in the command transaction; retry deduplication, observer rollback, independent-account isolation, session closure, retention/export and owner-only/no-store HTTP pass integration tests. Chrome's existing Amber session displayed the new external activity panel, truthfully empty for that different account. All three test accounts' owner HTTP reports retained actions after Codex session closure/revocation. Invalid reads were recorded separately from committed moves; successful corrected reads did not become fictitious game receipts. All static lessons fit 3,600 bytes.

## Fresh observed records

| Account | Committed command | Actual result |
| --- | --- | --- |
| Aster | `7d9f6df7-2b50-4a7c-a102-5f3c76a02eac` | Message `8a4a51a1-6df1-4e54-94eb-6f612678b067`, version 1 |
| Aster | `aa1c00a5-b29b-4704-9414-0e84dc8e4ac1` | Message `d231006a-94c1-43bd-9f9b-04c7b22a1b9f`, version 1 |
| Briar | `3e4d09a0-74ca-4ec2-bec9-90b233d03c77` | Message `27827ab3-0cbd-4156-890d-28c39ef74cf0`, version 1; proposed terms in prose only |
| Cinder | `72d2f8b9-49a2-4e2b-a66d-3a25ecaf9e62` | Storehouse III queued/active, 180 whole Iron and 90 whole Silver charged; not yet completed |
| Cinder | `8cc1ac60-1881-41d9-8746-4a3ba75519bf` | Message `9e4b1f09-5167-4ae7-9280-df4765baec11`, version 1 |

Sessions ran 19:37:44–19:38:45 UTC. Two `INVALID_REQUEST` read attempts (Briar/Cinder) produced no game move; Cinder corrected zero forecast to 60 and succeeded. Aster's high stock made the supply objective unnecessary; it said no Grain secured. Briar proposed 5 Iron/hour for 6 Grain/hour by message, not a versioned offer. Cinder described play as clear and mildly engaging but authority confusing; Aster/Briar described confusion. These are agent assessments, not evidence that human friends find the game fun.

Codex usage (input includes cached tokens): Aster 190,886 input / 159,488 cached / 1,693 output; Briar 194,802 / 165,632 / 1,710; Cinder 204,291 / 169,728 / 1,953. Existing ChatGPT Codex login and GPT-6 Luna; no PACT paid inference enabled and no price/free-model claim. No hidden reasoning is saved in this report. Earlier cached OAuth `INVALID_GRANT` was rerun successfully using normal human login, DCR and PKCE; the temporary access/refresh grants were revoked after each session. Saved desktop profiles still need the normal browser reauthorization when expired.

## Deployment/checks

Encrypted same-VPS backup snapshot `537793fe` completed before rollout. `git archive 88c273f` supplied the source for immutable release **`alpha-20261001-1`**. Normal deploy applied migrations 0036–0044, replayed deletion registry (one closed, none purged), and started API/rules/seals/inference/notification/channel/gateway. Existing signing secret was preserved/created by deployment; the exact root public signing-key route was added to the shared edge without changing unrelated routes. Caddy validation passed before installation; original config backed up as `Caddyfile.pact-alpha-20261001-backup`. Public key response contains public Ed25519 material only.

`infra/production/bin/verify.sh ... https://safa.dedyn.io/pact` passed. Public health and signing keys returned successfully; Chrome reloaded the new four-tab client and season/Envoy views without the transient deployment 502. Full local build/typecheck/lint passed, 212 unit tests and 284 integration tests passed (one optional live-model skip); 26 published v1 fingerprints unchanged. The added operator launcher passed syntax/lint and the three actual runs above.

## Reproduction/handoff

[Codex playtest](../../operations/codex-playtest.md) covers normal friend connections and the operator-only launcher. [Runs API](../../api/runs.md) covers activity ownership, transaction/recovery and retention. Earlier [progress](agent-first-progress.md) is historical and superseded by this report. Next: PACT-080's final isolated gameplay/season rehearsal and Alpha friend handoff. This closes agent implementation, not the final rehearsal, production readiness, universal host certification or human enjoyment.
