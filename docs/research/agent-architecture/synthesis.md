# Cross-paper findings

**Assessment:** Several architectures are credible routes to the mission. The evidence supports testing functional specialization and different decision timescales; it does not establish that separate “brains” are necessary, that additional layers always help, or that replacing a strong reasoner with a small model merely lowers intelligence while preserving play.

This is a bounded review of the selected 80 papers, read sequentially. It is not an exhaustive or systematically sampled survey of everything published through November 2026. Results span different tasks, interfaces, training budgets and metrics; they cannot be pooled into an architecture ranking. Conclusions below are reviewer synthesis; individual notes distinguish demonstrated results from inference.

## Three viable routes

These diagrams describe alternatives to compare, rather than a proposed Fleet implementation. Every route includes feedback; training systems are omitted.

```text
A. Integrated policy
   Game → observations → state / memory → policy → actions → Game
                                             ↑
                                      task / objective

B. Controllers at different timescales
   Game → observations → state ──→ fast controller → actions → Game
                            │             ↑
                            └→ deliberation → goals / constraints
                                 ↑              │
                                 └── outcomes ──┘

C. Planning over reusable behavior
   Game → observations → state → planner / search
                            ↑          │
                            │     skill / program
                            │          ↓
                            └── outcomes ← executor → actions → Game
```

| Route | Evidence to take seriously | Main unresolved burden |
|---|---|---|
| Integrated recurrent policy | Competitive play in [Dota, 70](https://arxiv.org/abs/1912.06680); visual imitation in [Counter-Strike, 67](https://arxiv.org/abs/2104.04258) | Training coverage, memory, adaptation and control under distribution changes |
| Different timescales and learned goals | [FeUdal Networks, 29](https://arxiv.org/abs/1703.01161) and [Quake capture-the-flag, 65](https://arxiv.org/abs/1807.01281) | Useful goal representations, coordination and whether hierarchy beats a matched baseline |
| World models and search | [Dreamer, 42](https://arxiv.org/abs/1912.01603) and [MuZero, 44](https://arxiv.org/abs/1911.08265) | Model error, exploration, planning cost and training requirements |
| Skills with explicit execution | [Options, 26](https://people.cs.umass.edu/~barto/courses/cs687/Sutton-Precup-Singh-AIJ99.pdf) and executable program libraries | Discovering useful skills, start/stop conditions, recovery and coverage of unfamiliar situations |
| Language-guided orchestration | Grounded robot planning and [Voyager, 79](https://arxiv.org/abs/2305.16291) | Dependence on supplied interfaces, perception, execution skills and sufficiently capable models |

## What changes our original hypothesis

**Separate responsibilities do not require separate models or processes.** RT-H uses shared weights for different roles; robot soccer distills specialist training into one policy. Functional decomposition, parameter separation and runtime fault isolation are different design choices. [RT-H, 75](https://arxiv.org/abs/2403.01823), [Robot soccer, 69](https://arxiv.org/abs/2304.13653).

**Hierarchy has costs and counterexamples.** MAXQ distinguishes recursive from global optimality. FuN loses to flat baselines on some games. Learned skill priors depend on the demonstrations’ relevance; unused or unsuitable options can burden planning. These are reasons to compare architectures under matched conditions. [MAXQ, 27](https://arxiv.org/abs/cs/9905014), [SPiRL, 35](https://arxiv.org/abs/2010.11944).

**More thinking is not automatically better.** Reasoning consumes time during which the world can change. Anytime computation and metareasoning make that tradeoff explicit, without requiring an expensive scheduler before every action. [Anytime algorithms, 22](http://anytime.cs.umass.edu/shlomo/papers/Zaimag96.pdf), [Metareasoning, 23](https://doi.org/10.1016/0004-3702(91)90015-C).

**Learned models can support training, online search, or both.** A world model does not imply that every live action waits for a planning rollout. Distinguish training-time imagination from acting-time computation. [DreamerV3, 43](https://arxiv.org/abs/2301.04104).

**Sparse internal activity does not establish cheaper execution.** RIM’s implementation computes updates before masking; computational savings require measurement. [RIM, 50](https://arxiv.org/abs/1909.10893).

**Looking alive is a separate objective.** Believability, motion style, survival, partial task progress and winning measure different outcomes. Generative Agents primarily evaluates believability; AMP explicitly studies style. Neither substitutes for task competence. [Generative Agents, 80](https://arxiv.org/abs/2304.03442), [AMP, 38](https://arxiv.org/abs/2104.02180).

## Mechanical competence and cognition must meet at the interface

An agent may reason well while depending on someone else’s pathfinding, targeting or manipulation. Conversely, a competent motor policy may lack reliable objectives or memory. The review therefore treats three questions separately:

1. **Mechanics:** Can it execute the necessary actions accurately, on time, from the available observations?
2. **Cognition:** Can it choose useful objectives, retain relevant information and revise decisions?
3. **Integration:** Do its choices remain executable as conditions change, and does observed failure alter subsequent behavior?

This division is an evaluation framework, not a claim that three physical modules are required.

Record the observation/action interface with every result: pixels versus structured state; keyboard/mouse versus navigation/skill APIs; hidden-state privileges; scripted assistance; rewards; resets and preserved inventory. These determine which part of the mission the experiment actually tests. In particular, Voyager explicitly delegates low-level control, while Counter-Strike cloning studies visual motor behavior. Their scores answer different questions.

The phrase “everything is classification” describes an input/output view but hides the central engineering problem. Actions change future inputs; memory, continuous control, variable-duration skills and stopping decisions matter. A classifier can be one component of a closed-loop agent. The options framework makes action duration and termination explicit. [Options, 26](https://people.cs.umass.edu/~barto/courses/cs687/Sutton-Precup-Singh-AIJ99.pdf).

## Graceful degradation remains a hypothesis to test

A weaker reasoner might leave a controller running while making the agent ineffective. We need separate measures of execution continuity, constraint compliance, goal progress and eventual success.

```text
Component weakens / disappears
             │
             ▼
Can execution continue? → Are actions acceptable? → Is progress useful?
                                                       │
                                                       ▼
                                              Can the agent recover?
```

Known fallback behavior, detectable failure and recoverable states matter. Simplex and shielding offer conditional guarantees under explicit assumptions; learned recovery is empirical. Maintaining safety is not equivalent to completing a game objective. [Neural Simplex, 58](https://arxiv.org/abs/1908.00528), [Shielding, 59](https://arxiv.org/abs/1708.08611), [Recovery RL, 62](https://arxiv.org/abs/2010.15920).

Scaffolding does not remove minimum component capability: SayPlan’s weaker-model search fails frequently, and Voyager’s weaker code generator markedly reduces progress. A model-size comparison also changes training and model family, so it cannot isolate parameter count as the cause. [SayPlan, 77](https://arxiv.org/abs/2307.06135), [Voyager, 79](https://arxiv.org/abs/2305.16291).

Degradation can also be learned inside one policy: perceptive locomotion incorporates unreliable sensor information without requiring separate runtime services. [Perceptive locomotion, 64](https://arxiv.org/abs/2201.08117).

## Triggers and execution contracts deserve equal attention

The papers provide concrete trigger choices: outcome feedback for replanning; periodic plus user-event updates in Hi Robot; different rates for motor adaptation and action generation in RMA; model-based event conditions in control theory. Their assumptions and timing guarantees differ. [Hi Robot, 76](https://arxiv.org/abs/2502.19417), [RMA, 72](https://arxiv.org/abs/2107.04034), [Event-triggered control, 24](https://www.ee.ucla.edu/~tabuada/Papers/EventTriggered.pdf).

**Reviewer inference:** Whatever architecture we test should expose the following behavior. This is a comparison checklist, not a claim that every reviewed system implements it.

| Contract | Question |
|---|---|
| Observation | What is known, how old is it, and what is uncertain? |
| Decision | What triggers another decision, and when does the previous one expire? |
| Skill | When can it start; what indicates completion, failure or timeout? |
| Interruption | Who can interrupt, how quickly, and what cleanup is required? |
| Action ownership | How are conflicting simultaneous proposals resolved? |
| Feedback | Is success independently observed, or merely predicted/reported? |
| Fallback | What can continue when planning, perception or execution fails? |

A live shooter and a turn-based game can share these concepts. Their deadlines, observations, action semantics and consequences differ, so sharing an architecture does not imply identical control or training.

## Transfer claims need narrower labels

Distinguish new states/maps within a game, new tasks with the same mechanics, changed physics or controls, and entirely different games. Also distinguish reusing an algorithm from transferring the same trained agent.

DreamerV3’s broad results largely train separate agents per task. Successor-feature transfer assumes shared dynamics and reward structure. RMA adapts within a trained locomotion family. None alone establishes a single agent that enters arbitrary games and plays appropriately. [Successor features, 48](https://arxiv.org/abs/1606.05312).

The reviewed set does not establish a universally successful architecture for our general mission. This is a limit of this evidence, rather than proof that such an agent cannot be built.

## Comparison that would reduce uncertainty

**Proposed research only; no experiments have been run here.**

Compare an integrated policy, a policy with slower goal-setting, and a planner over reusable skills/programs. Hold interfaces, environment privileges, available training evidence and overall resource accounting comparable. Report typical seeds and tuning costs.

| Dimension | Useful measurements |
|---|---|
| Mechanical | Accuracy, invalid actions, reaction latency, missed deadlines |
| Cognitive | Objective completion, strategic choices, memory-dependent performance |
| Integration | Stale decisions, conflicting actions, failed skills, recovery time |
| Robustness | Delayed/removed reasoner, noisy observations, unavailable skills |
| Transfer | New maps/tasks, altered controls, and different game families separately |
| Efficiency | Training data, pretraining assumptions, compute, inference cost and elapsed time |
| Style, if desired | Human-likeness scored independently from competence |

A strong result would show **which decomposition helps which failure mode**, and what competence survives when components weaken. Adding modules is not itself the success criterion.

## Implication for Fleet

The evidence favors keeping architecture choices testable: interchangeable observation/action interfaces, explicit timing and execution outcomes, and comparable evaluation across candidate policies. This is reviewer inference. It does not justify prescribing a particular number of models or layers.

This assignment produced literature evidence and notes. It did not audit the current Fleet source architecture, modify Fleet/PACT, or run agents. Mapping these findings to concrete Fleet changes requires a separate source-level comparison.
