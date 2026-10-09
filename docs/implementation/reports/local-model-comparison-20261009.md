# Five local-model comparison — 9 October 2026

PACT-139, founder-authorized downloads and five fresh accounts per recommended model, followed by a couple-hour observation. Interpreted as **five candidates, 25 new kingdoms, two hours of gameplay after provisioning**. This is an additional bounded run; the existing fifty-player continuous controller remains active and its counters/identities/deadline-free authorization were not reset.

## Actual status at setup handoff

At **11:38:10 UTC / 13:38:10 Berlin**, Windows task **`PACT Local Model Comparison 25 20261009`** was Running, with protected preparation state reporting Gemma download progress: 2,598,193,059 of 7,381,383,680 bytes for its main layer. This is a transfer observation, not completion of that model or all weights. Downloads, provisioning and live first-turn verification were **still pending** at that observation. No comparison kingdoms or game results are claimed by this setup report.

Task startup was verified through `preparation.json`, not inferred from registration alone. The hidden native Windows launcher calls `comparison.mjs --prepare-and-run`, supplies the founder authorization marker and native state directory, prevents idle system sleep and records errors privately. It is a limited current-user task, with login trigger, five failure restarts at one-minute intervals, one instance and no OS execution limit. The application supplies the finite gameplay deadline. The machine, logged-in account, WSL checkout and Ollama must remain available.

[Credential-free setup snapshot](evidence/local-model-comparison-20261009-setup.json) records later download progress and confirms that the original run still has the same run ID, fifty successful owners and no currently failing owners. It deliberately records no new comparison kingdoms or gameplay before provisioning.

The automatic pipeline:

1. Download missing local weights for `gemma4:12b`, `qwen3.5:9b`, `granite4.2:8b`, `ornith-1.5:9b`, `lfm2.5:8b`. Runtime-generated progress is credential-free. Each transfer is bounded to sixty minutes per attempt; ordinary Ollama partial downloads can resume on retry. All five weights must pass local preflight before provisioning.
2. Persist twenty-five random entry keys before any guest join. Provision five distinct normal kingdoms per model using the normal public guest/OAuth routes. A partial provisioning retry reuses its saved keys/kingdoms, without replacing failed identities. Pin every installed model's digest in the checkpoint/manifest. No stock, rules, game time or existing account data is changed for setup.
3. Once all identities are provisioned, persist `startedAt` and `endsAt = startedAt + 120 minutes` exactly once. A ready checkpoint cannot be reinitialized. The 1,000-attempt ceiling counts requests before inference, including failures; at five-minute minimum revisits the nominal twenty-four rounds need approximately 600 calls, with the extra ceiling providing a finite safety bound. Restart never resets the deadline or counters.
4. Run the existing full-game adapter over one serial comparison worker, routing each actor to its pinned model. Deadline/request-cap/STOP checks gate further inference and gameplay dispatch; inference timeout is bounded by the remaining run time. Uncertain commands retain their exact payload/ID and reconcile before further writes. The separate opted-in synthetic owner controller handles normal human-only gameplay decisions under founder consent, without changing mandates or bypassing stock, quotas, ownership or prerequisites.
5. Stop gameplay automatically at the original deadline or cap; retain the checkpoints and daily journals for analysis. Issued game obligations continue under ordinary engine rules after the client stops; the deadline stops the experimental player controller, not server settlement.

## Matched comparison and limitations

Every model receives the same five role instructions: production/prerequisite recovery, completed supply negotiation, Court coordination/publication, affordable troop/scouting strategy, and diplomacy/contact/error recovery. All 58 implemented game command kinds and authorized reads remain available. Fresh owners preserve default server mandates; exact exceptions use the existing normal owner path. No contacts, signatures, Courts or useful actions are manufactured as model successes. Players establish their own relationships. Peers include the 25 comparison kingdoms, so interactions across model groups are possible and must be identified in final analysis.

The first comparison deliberately holds inference settings constant: **32K context, 2,400 output tokens, `think:false`, temperature zero, ninety-second call limit and minimum five-minute revisit**. This compares deployed non-thinking player configurations; it does not test the candidates' best possible reasoning settings. Actual JSON/schema support, inference fit and first successful turns remain live observations to verify after downloads. Package availability alone is not integration certification.

The original 50-player worker shares the same GPU/Ollama and network. This is an operational comparison with background load, not a controlled hardware benchmark or 75 concurrent resident models. Loading/switching, context caching, CPU offload and turn-duration differences can affect throughput. Record per-model load/warm timing and actual revisit gaps. Unequal completed-turn counts must not be mistaken for unequal intelligence. Fresh starting states, role matching and broad mechanic availability improve comparability but do not guarantee enough two-hour samples of every mechanic.

Final analysis must separate valid JSON/turn success from useful committed actions, changed counterterms, bilateral contract activation, truthful messages, deadlock/expiry recovery, Court/publication/military effects, no-op loops and denied repeated commands. Read-only cohort database evidence should verify actual effects; avoid attributing the older finite adapter probes or overnight contracts to this experiment.

## Observation and operations

Protected state: **`C:/Users/ENDORFY/pact-model-comparison-25-20261009`**. Do not commit/copy `private-state.json`, cookies, entry keys, OAuth tokens, one-time invitation tokens or complete private journal content. `preparation.json`, later `manifest.json` and `status.json` are credential-free. `worker.log` is private diagnostics. Runtime accounts/digests/deadline are recorded in the manifest once provisioned.

```powershell
Get-ScheduledTask -TaskName 'PACT Local Model Comparison 25 20261009'
Get-Content 'C:\Users\ENDORFY\pact-model-comparison-25-20261009\preparation.json'
Get-Content 'C:\Users\ENDORFY\pact-model-comparison-25-20261009\status.json'
# Explicit permanent stop; do not remove STOP and resume this finite experiment.
New-Item -ItemType File 'C:\Users\ENDORFY\pact-model-comparison-25-20261009\STOP'
```

Thread heartbeat **`pact-five-model-comparison-observation`**, every fifteen minutes, was successfully created ACTIVE. It observes preparation/startup, handles actual failures within this assignment, records the first successful turn for all 25 owners, and produces/commits a final model-quality report after the real deadline. It stays quiet on unchanged/non-actionable state and disables/deletes itself after the final report. The worker owns the deadline independently; a delayed heartbeat cannot extend gameplay. No separate account or time limit was changed by the monitoring automation.

## Verification completed for setup

- **58 Node tests passed** across local/population harness suites, including new finite deadline/cap behavior, matched candidate roles, required authorization, partial-provisioning retry with the same 25 keys/identities, exact two-hour deadline, and refusal to reinitialize a ready checkpoint.
- **Seven targeted tests passed under native Windows Node 24**, covering comparison setup/recovery and existing continuous session/identity recovery.
- `npm run typecheck` passed. Biome checked the three changed/new runner files; subsequent final checks are recorded in the commit. Existing server gameplay implementation is reused; no backend deployment or engine-rule modification occurred, and gameplay integration suites were not rerun for this client-only setup.
- The existing 50-player run remains untouched. This ticket remains **In Progress** until actual local weights, 25 live owners and model startup are verified; comparative quality and the full two-hour observation remain pending. Known Linear free-issue-limit means local task/report tracking is used rather than inventing a hosted issue.

Next required evidence: all five pinned downloads, 25 distinct kingdom IDs with five model assignments, persisted actual start/deadline, first successful model turns, and the real completion report. Do not mark observation complete merely because the runner exists or the task is Running.
