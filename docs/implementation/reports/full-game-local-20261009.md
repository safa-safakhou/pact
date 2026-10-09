# Continuous full-game local players — 9 October 2026

PACT-138 implements the founder's explicit requests: release all implemented mechanics to the local models and run **50 accounts indefinitely**. Implementation is complete and the new controller is live. This is a full-game local-player release on the existing deployed game, not certification of the deferred production/channel work or a new server economy. The API already implements the command families; no feature flags, database migrations or server permission bypass were needed. Backend runtime remains `local-reliability-20261009-1`.

## Actual scope and execution

- New run **`full-game-1791537512736-10b87b6c`**, initialized **09:18:32.736 UTC / 11:18:32 Berlin**. Exactly the existing fifty kingdoms from the finished overnight cohort are reused. Their stock, mandates, progress and identity remain intact. Guest sessions/OAuth grants are renewed through normal APIs; credentials never enter model input.
- Windows task **`PACT Full Game 50 Continuous`**, current-user limited/interactive privileges, hidden launch, login trigger, unlimited OS execution time, single instance and failure restart. The supervisor retries the same persisted controller with backoff, never new accounts or reset counters. The launcher prevents idle system sleep while active.
- Native protected state **`C:/Users/ENDORFY/pact-full-game-50-continuous-20261009`**. `status.json` and `supervisor.json` are credential-free; private checkpoints and daily journals remain owner-only. STOP ends new work and remains terminal. Old `PACT Local Players 50 20261009` and the October 4 capped experiment stay finished.
- The new continuous mode has **no lifetime request ceiling, deadline or cumulative synthetic-owner exception ceiling**, as explicitly requested. It retains lifetime attempt/turn/owner-decision counters. Each call/turn remains bounded: ninety-second inference timeout, up to three actions and selected reads per plan, one shared local GPU worker, minimum five-minute owner revisit. The actual interval can be longer under load or failure backoff.

## Full mechanic access

`full-game.mjs` derives its catalog directly from `GameActionSchema` and all five implemented social command families, **58 commands** in total. It does not reuse the six-action peaceful allowlist, cohort-only target filter, one-hour/no-bond supply restriction, old compact brief or limited automatic-owner decision policy.

Available mechanics include:

- All construction and cancellation; training, disbanding and cancellation.
- Contacts, messages and transfers; supply offers, changed counters, signatures, withdrawal, notice, refusal and release; all engine-supported durations, rates and bonds.
- Scouting/sharing, garrison lending/signing/withdrawal/seizure/exit/release, raids and coalition decisions.
- Court creation, membership/request handling, roles, leadership, pins and closure.
- Articles, mutual allegiance, invitations, selected-evidence Seals and Chronicle notices/stories.

Authorized read tools come from the actual MCP tool catalog. Every turn reads the complete authorized owner projection and start guide, rotates rule lessons and public Court/politics/Chronicle discovery, and may request further reads. Large data is adaptively paged with explicit omission paths/counts; this limits context size, not the available mechanics. Reads return next-turn observations, so decisions cannot rely on future unread facts. Models still choose their own strategy, and capability availability does not prove every mechanic was chosen.

Game rules still apply: private ownership, actual troops/stock, quotas, contract capacity, versions, prerequisites, economic time and refusal rules. Account deletion, credential/admin operations, shell and arbitrary URLs are not game actions and are not exposed. Deferred native/provider/distribution features are not made complete by this release.

Courts/publications and other human-only game choices use a **separate opted-in synthetic-owner controller**, with the founder's standing consent for exact gameplay decisions. Game commands first try the agent route; only definitive authority denials can invoke the normal authenticated owner command with the same ID and payload. Stock/quota/rules denials are never escalated to authority overrides. The owner controller never raises the mandate. Seal/Chronicle decisions obtain a fresh server preview for the exact selection, bind its digest and use the normal social dispatcher. Models receive no human cookies, entry keys, CSRF/OAuth tokens or arbitrary owner HTTP capability.

Uncertain writes persist their exact command before dispatch. Receipt recovery precedes new inference/writes and retries the same ID/payload only after definitive receipt-not-found. OAuth refresh-response loss can reauthenticate the same guest identity; foreign kingdom recovery fails closed. Newly issued one-time invitation results remain private owner state; a recovered receipt does not reconstruct a lost one-time link result.

## Verification and issues fixed before handoff

- **54 Node tests passed**, including eleven new full-profile/recovery cases. All eleven new cases also passed under native Windows Node 24. These cover all command families and full engine terms, refusing arbitrary reads/admin commands, exact owner preview binding, authority versus stock denial, connection lease reuse across multiple writes, uncertain social receipt recovery, same-ID replay, STOP, session recovery, identity mismatch and growing-context paging.
- **60 integration tests passed across nine files**: Courts, politics, Seals, Chronicle, troops, scouting, garrison admission, raids and raid randomness. These complement PACT-137's previously passing 87 ownership/settlement/approval integration tests; this task does not claim a rerun of all repository suites or hosted CI.
- Typecheck passed. Biome checked 28 local script files; planning render/check and Git whitespace checks are recorded on completion. Live server `verify.sh` passed again. No server TypeScript/domain behavior was changed; only local-model transport adds an optional full-profile prompt ceiling while the bounded profile retains its old limit.
- Finite live model verification used two existing opted-in owners. An initial non-start guide topic lacked the world-status field; corrected code reads the actual start guide and adds separate topic lessons. Model output and ordinary build dispatch then passed for both owners.
- A finite zero-inference probe verified **seven observations/commands** through the released adapter: same-ID Court-create receipt recovery, Court join, pin, read after joining, Article publication, fresh-preview Chronicle notice and normal two-Spearman training. The first Court response exposed the social API's `{receipt,result}` wrapper; correcting normalization recovered the original commitment rather than creating a duplicate Court. [Live evidence](evidence/full-game-local-20261009-live-probe.json).
- All **50 owners completed a successful first full-game turn**. The initial follow-up pass had **16 `PROMPT_LIMIT` failures** as read results accumulated. They did not dispatch partial model actions. Adaptive paging/text excerpts were added and tested; fresh read-only checks for the three affected large contexts generated valid prompts of 66,582, 62,787 and 64,223 characters under the full-profile ceiling. No category was removed from the catalog.
- A rolling controller restart retained the same run ID, all fifty identities and **75 previously reserved attempts**. No pending command existed at the restart snapshot. Subsequent requests increased to 94, and the updated controller had no new failed turns at the startup observation. Lifetime failures were retained, not erased.
- A subsequent batch check found repeated `run.open` calls could deny a second action in the same connection. The adapter now opens once and reuses that connection's lease. A new live probe issued/accepted a normal contact invitation, then committed two messages with **one lease open**, all four commands committed. Its first oversized conversation query was rejected by the existing five-message read limit and corrected; the engine limit was preserved. [Invitation and batched-message verification](evidence/full-game-local-20261009-message-probe.json). Journals redact opaque tokens; exact commands and one-time owner results remain in protected private state.
- The final rolling update retained **173 reserved attempts**, all kingdoms and the same run ID, with zero pending commands at its snapshot. At **09:37:33 UTC / 11:37:33 Berlin**, task and controller were Running with **50 successful owners, 182 reserved attempts, 164 successful turns, 16 retained pre-fix context failures, 24 committed commands and zero pending commands**. No turn failure occurred after adaptive paging was released. Interrupted in-flight attempts stay counted, so completed-turn totals need not equal reserved attempts. [Release health](evidence/full-game-local-20261009-release-health.json).

At **09:28:28 UTC / 11:28:28 Berlin**, the task and controller were **Running**, with **50/50 successful owners**, 94 reserved attempts, 77 completed successful turns, 16 historical context failures, zero pending commands and 16 committed commands (14 builds, two offers). One attempt was in progress, so attempt/finished-turn counts need not match. The broader live probe's Court/publication/training commitments are separate from these controller command counts. Models had also proposed training; a proposal/denial is not a completed training order. [Startup and restart evidence](evidence/full-game-local-20261009-startup.json).

Executed regression commands:

```sh
node --test scripts/local-population/*.test.mjs scripts/population/*.test.mjs
# 54 passed
npx vitest run --config vitest.integration.config.ts \
  tests/integration/courts.test.ts tests/integration/politics.test.ts \
  tests/integration/seals.test.ts tests/integration/chronicle.test.ts \
  tests/integration/troops.test.ts tests/integration/scouting.test.ts \
  tests/integration/garrison-admission.test.ts tests/integration/raids.test.ts \
  tests/integration/raid-randomness.test.ts
# 60 passed across 9 files, 5.79 seconds
npm run typecheck
npx biome check scripts/local-population
python3 docs/implementation/backlog.py render
python3 docs/implementation/backlog.py check
git diff --check
```

## Operational limits and handoff

Qwen3.5 4B Q4_K_M uses the same pinned local digest as before, on the Windows RTX 5070 Ti. Full profile: 32,768 context, 2,400 output tokens, adaptive prompt target below 78,000 characters and maximum transport ceiling 80,000. Models can still make poor decisions, invent IDs, fail validation or encounter legitimate denials; the dispatcher remains authoritative. There is no claim of perfect decision quality, guaranteed five-minute rounds, complete live military/Seal lifecycle coverage or indefinite uptime demonstrated from a short startup observation.

The computer must remain powered on, signed in, and able to reach Ollama, the WSL checkout and the game server. Sleep prevention cannot survive shutdown, logout, network loss or GPU/service failure. The controller retries failures; monitor heartbeat, per-owner successful turns, backlog/denials and local disk for the continuing journal. There is no automatic historical archive deletion or rollover. [Operating instructions and stop command](../../operations/local-population.md).

Implementation is committed under the founder's standing preference; no push is implied. Linear's known free issue limit remains unresolved, so PACT-138 and this report are the local execution record. The new continuous observation is ongoing until the founder stops it; completion of implementation does not mark that observation or the 24 deferred tasks complete.
