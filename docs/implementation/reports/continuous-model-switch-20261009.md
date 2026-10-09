# Continuous population model switch — PACT-142, 9 October 2026

The founder requested switching the existing fifty accounts to the better tested local model and checking its live behavior. The selected candidate is **Qwen 3.5 9B**, the strongest observed development candidate in the [five-model comparison](local-model-comparison-20261009.md). Its earlier social verification also showed defaulted repeated contracts and no dialogue; this selection does not establish superior bargaining or reliable autonomous strategy.

## Applied change

At **17:31:40.460 UTC / 19:31:40 Berlin**, run `full-game-1791537512736-10b87b6c` changed from `qwen3.5:4b` to **`qwen3.5:9b`**. All fifty existing owners are assigned the new model. The downloaded digest is pinned to `56671c2ab9385f9cfcb404638e32cd62d88e3501d44822208363c010179a3c90`.

The same Windows task and native state directory resumed. The switch checkpoint retained **4,213 lifetime attempts**, all kingdom identities, conversation memory, pacing, authority settings and the indefinite authorization. No new accounts or budgets were created. No command was pending at the switch. Context remains 32,768, output limit 2,400, inference timeout ninety seconds, non-thinking generation and minimum owner interval five minutes. There is no global run deadline/request ceiling. The finished twenty-five-player comparison and two-player verification remain terminal with their original counters/deadlines.

The operator `switch-model.mjs` requires this specific founder-authorized transition, obtains an exclusive checkpoint lock, refuses a live worker or pending command, refuses terminal/STOP/finite experiments, verifies existing fifty distinct identities and preflights local weights. It changes only the model assignment/weights and appends a timestamped authorization history. A repeat with the same pinned weights is a no-op; a same-name digest change fails closed. Model failure does not silently choose another candidate.

Ollama's residency snapshot showed only Qwen 9B loaded, with **6,684,284,026 bytes reported in VRAM**, equal to its reported loaded size, and a 32,768 context. This supports full GPU residency at that snapshot; it is not a VRAM stress test or multi-day capacity result.

## Checks and observation

The complete Node runner/client suite passed **64 tests**. The new switch test also passed on native Windows Node, covering authorization, active-worker/terminal/finite/pending refusal, failed preflight preserving state, all-actor memory/counter/authority preservation and idempotent repeated switching. Biome and planning/whitespace checks passed. This change affects the local operator only; no server deployment, economy or approval-boundary change was needed.

At **17:34:05.342 UTC**, the task and controller were Running, with **all fifty configured for Qwen 9B** and **twelve distinct owners completing twelve actual 9B turns**. Requests increased to 4,225; the original run ID and all owners matched. Those turns produced **nineteen committed messages and one committed supply signature**, plus one game-denied signature with code INVALID_COMMAND. One plan was empty. There were **zero failed turns, current failures or pending commands**. Inference median/p95 was **9.297/17.461 seconds**, including initial loading. This is a short startup sample, not a fifty-owner first-cycle completion or a measured improvement in bargaining. [Credential-free evidence](evidence/continuous-model-switch-20261009.json). The worker stays active after this short check. A five-minute *minimum* interval is not a guarantee of five-minute cycles: one serial worker and longer 9B inference can lengthen revisits.

Implementation commit: `9e5595c`. Normal private state and journal bodies remain protected; only public model metadata and aggregate receipt/latency evidence are published. No deferred production task is resumed. Known hosted Linear issue limits remain; the local PACT-142 ticket records this operational assignment.

PACT-142 is complete for the authorized model switch and short live check. Continuing game observation remains open under the existing indefinite run; historical model-quality failures are not marked fixed by these startup receipts.
