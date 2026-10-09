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

## Follow-up — 20:04–20:06 Berlin

The founder requested another check. This was read-only: no restart, model/settings change, new account, mandate change or experiment extension. Production verification passed; the Windows task and controller remained Running, and Qwen 9B remained fully GPU-resident at the reported 6.684 GB/32K context. The same fifty owners and indefinite bounds remain in place.

At 18:04:17 UTC, the journal had 184 completed 9B turns and eleven empty plans, with zero failed turns/current failures/pending commands. All fifty had played. The subsequent detailed snapshot at **18:04:57 UTC** contained **188 completed turns, three or four per owner, and 372 committed messages from 47 owners**. Actual median/p95 owner revisit intervals were **531.470/544.855 seconds**: approximately **8 minutes 51 seconds / 9 minutes 5 seconds**. The configured five-minute interval remains a minimum, not achieved round throughput. Call median/p95 in the earlier snapshot was **9.097/11.964 seconds**.

Communication volume is much stronger than before the social repair, but quality remains limited. **116 of 372 messages repeated an identical body from the same owner to the same peer** within this window, beyond that pair's first copy. This is an exact text metric, not a semantic quality score; a new incoming message can make a repeated confirmation admissible. The counts still show substantial repeated conversation. There were no successful counteroffers, and no construction, Court, training, scouting or raid commitments in the sampled post-switch outcomes. Models concentrated on messages and a few supply offers/signatures.

At 18:04:17, ordinary admission outcomes included nine message rate denials, four offer rate denials, five queue-full denials, six local duplicate-message rejections, four invalid signatures and other invalid/repeated social attempts. These are **action refusals**, not crashed inference or failed controller turns. At 18:04:27 the original cohort had **55 unread messages and three full directional queues**, well below the earlier 201/22 backlog, but with remaining blocked pairs.

### Actual trade effects, excluding duplicate signatures

Six new offers were committed in the sampled window. The 18:05:31 database check found **four expired without activation and two still open**. No successful counter changed their terms. Repeated signature receipts do not represent new contracts.

There was **one actual new contract after the switch**, `c37c77d4-28e4-470d-bb39-5df33d4baa07`, activated at **17:35:39.644 UTC**. Its offer was originally committed by the 4B worker at **17:27:27.513 UTC**; 9B completed the two signatures. This is progress on an inherited offer, not a new 9B-initiated negotiation. Offer-to-activation wall time was **8 minutes 12.131 seconds**. At 18:06:04 it remained active with **62 installments, zero failures**, and 1,550 marked Grain and 1,550 marked Iron delivered, matching due amounts. A separate returned contract ID belonged to an expired 05:37 UTC contract and was not credited as a new activation. The selected historical installment totals and 272 older expired contracts were likewise not attributed to the model switch.

**Assessment:** infrastructure and all fifty owners are healthy; communication works and one inherited trade is delivering. The larger model is still spending much of its activity on repeated replies and uncompleted offers, without demonstrated substantive bargaining or broader gameplay. This observation does not establish that it is strategically better than 4B under matched conditions. [Sanitized follow-up evidence](evidence/continuous-model-followup-20261009-2004.json).
