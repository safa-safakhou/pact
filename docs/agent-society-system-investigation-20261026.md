# PACT agent society investigation

The [detailed systems investigation in the adjacent Fleet checkout](../../fleet/docs/agent-society-system-investigation-20261026.md) connects the six-hour run's game state, eight architecture profiles, context packets, inference admission, model decisions and reporting. It separates confirmed mechanisms from unresolved causes and proposes directions for the agent-society R&D goal. The cross-repository link uses the normal adjacent `mine/pact` and `mine/fleet` workspaces.

The experiment did produce 207 committed actions, 52 completed upgrades, 55 messages and five activated supply contracts, one of which defaulted. It did not yet demonstrate a broadly interacting society or establish an architecture ranking.

PACT-specific findings:

- Hall 2 requires Farm 2, Barracks 2 and Storehouse 1, plus 180 iron and 90 silver. Eleven kingdoms met the building prerequisites at the end. Some still lacked stock: C1 finished six other upgrades and had about 22.3 iron and 13 silver remaining. In contrast, B1–B3 retained their initial construction allowance and made no upgrades. These waits need different interpretations.
- Effect quotes expire after 30 seconds, while their revision includes the world clock and broad resource/authority dependencies. The coordinator's average turn took 134 seconds. Native stale-state protection is doing useful work, but the deliberation workflow is poorly matched to its lifetime. Do not weaken atomic authorization to hide the mismatch.
- Contact acceptance reached only five kingdoms across three pairs. Of the 55 messages, 51 were H1 → C2 and only one was C2 → H1. Message volume overstates reciprocal conversation. Nineteen kingdoms had no accepted contact edge; eight introductions remained pending.
- The E2–D3 contract defaulted for insufficient stock. E2's promised iron outflow was 30 per hour against level-1 mine production of 20. This is a sustainability question and a potentially useful behavioral result, not automatically a host bug. E2 also became unavailable during the run. Exact settlement attribution remains unestablished.
- Fleet records 203 committed actions inside turns ending `WAIT` and four inside turns ending `READ`. Those codes cannot be interpreted as absence of game effects. The authoritative action receipts remain the correct effect measure.

The broader investigation confirmed 317 autonomous errors on empty skill-operation objects, an oversized inbox cycle behind 435 failures before inference, repeated legacy schema reads, coordinator staleness, reasoning exhaustion and six in-run/three closing-deadline usage holds. Eight held allocations have late usage observations without settlement. Cancellation under the historical full workload and the primary supervisor's discarded exception remain unresolved.

The intended research distinction is between reliable game interfaces and imperfect agent choices. Permissions, privacy, exact resource accounting, single-writer authority and receipts remain mandatory. A legal bad trade, an unproductive wait or a failed plan can be observed as behavior; the next question is whether the agent understands the consequences and adapts.

Investigation only: no new live model calls, game commands, deployments, resets, replay or uncertainty review. The world remains paused at tick 359, with 24 finished Fleet cohorts and nine held actors. Services/provider were not restarted. E4/KQ1 remain blocked. Source and evidence limitations are listed in the Fleet report; this is not a repaired or qualified candidate.
