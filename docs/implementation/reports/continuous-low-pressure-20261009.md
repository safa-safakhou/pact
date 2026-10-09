# Low-pressure continuous local players — PACT-143, 9 October 2026

The founder requested immediate relief because the local machine was getting too hot. The worker was interrupted first and Qwen 9B explicitly unloaded through Ollama. The same fifty-owner indefinite run then resumed with a lower-duty profile; no model replacement, new account or finite experiment restart occurred.

## Applied settings

At **19:11:11.333 UTC / 21:11:11 Berlin**, the checkpoint retained run `full-game-1791537512736-10b87b6c` and **4,773 lifetime attempts**, changing:

- Minimum owner interval: **five minutes → one hour**.
- Initial quiet cooldown: **five minutes**, until **21:16:11 Berlin**.
- Existing owners' next turns: spread **72 seconds apart**, instead of an immediately overdue fifty-player burst.
- Persisted quiet gap after every completed or failed turn: **at least sixty seconds**, including after restart/overdue scheduling.
- Ollama model residency: **immediate unload after each inference**, through explicit `keep_alive: 0` rather than the previous ten-minute residency.

The exact model/digest, context, output ceiling, individual timeout, gameplay/approval permissions, identities, conversation memory and lifetime counters remain intact. Any persisted pending command retains its original ID/payload; the operator changes scheduling, not recovery semantics. No pending command existed in the observed resumed snapshot. Ordinary profiles without the new settings retain their prior scheduler and ten-minute Ollama default. The finished comparison and two-player verification remain terminal.

Hourly cadence is a minimum. Cold model loads and the global cooling gap may lengthen rounds. Fifty owners retain gameplay availability, but receive much fewer turns. Nominal scheduled turns fall from about 8,200/day at the previous measured throughput to at most approximately 1,200/day, an estimated **85% reduction** before loading/spacing overhead. This is a dispatch-volume projection, not a measured power-saving percentage. The GPU can still work hard briefly during an individual call.

## Verification

The full Node runner/client suite passed **66 tests**; both new tests also passed on native Windows Node. Tests cover founder authorization, live-worker/terminal/STOP/finite-state refusal, owner identity/counter/memory/authority/exact pending preservation, initial staggering, overdue-cohort cooling, persisted restart gating, idempotent repeated application, unchanged ordinary scheduling and forwarding zero keep-alive without replacing it with the old default. Biome and planning/whitespace checks passed.

Ollama explicitly returned `done_reason: unload` after the immediate relief action. An initial post-unload GPU sample was **51°C, 7% utilization, 33.42 W and 1,220 MiB**. At **21:11:12 Berlin**, it was **39°C, 1%, 30.31 W and 1,220 MiB**. This confirms observed cooling and released model residency, not the temperature before interruption or a long-term thermal guarantee. [Ollama documents immediate unload via keep-alive zero](https://docs.ollama.com/api/chat).

The resumed Windows task/controller are Running with the same fifty owners and Qwen 9B assignment. During the initial quiet window, the request counter remains 4,773, no model is resident in Ollama, and no current failure/pending command is recorded. The next scheduled live turn is 21:16:11 Berlin; this handoff verifies the cool idle phase and transport rule, not an already-completed post-change hourly cycle. The one-hour spacing and sixty-second gap persist in the checkpoint, rather than depending on a temporary terminal sleep.

## Operations

`low-pressure.mjs --state <same protected native directory>` requires `PACT_LOW_PRESSURE_AUTHORIZATION=cool-existing-fifty-hourly`. Interrupt and confirm the previous worker exited before using the locked operator; resume the existing `PACT Full Game 50 Continuous` task afterward. Reapplying an already matching profile is a no-op and does not postpone turns again. It refuses terminal/STOP or finite experiments and never resets their budgets. A future change in frequency needs covering founder authorization; do not silently restore the prior busy profile.

[Sanitized applied settings and idle evidence](evidence/continuous-low-pressure-20261009.json). No credential or private message was published. No server deployment or hardware power-limit change was performed. PACT-143 is complete for the authorized cooling/pacing repair and observed idle verification; prolonged thermal behavior remains unmeasured.
