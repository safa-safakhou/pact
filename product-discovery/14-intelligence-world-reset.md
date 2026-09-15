# Design reset: a world played through intelligence

The subsequent SIGNALFALL pitch and founder clarifications are developed in [Shared survival, personal ambition](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/15-signalfall-shared-fate.md). That document supplies the current campaign, alliance, personal rivalry, reward, prompt, and chat-session proposals. This file preserves the foundational reasoning.

9 September 2026. This document supersedes Common Front as the active design hypothesis. It preserves the founder's correction rather than treating it as a request for more logistics features. No game is selected, implemented, or validated.

## 1. The correction

The preceding proposals put an agent inside an activity designed primarily for human players. The founder now explicitly requires a world whose core challenges suit LLM agents: programming, reasoning, working across domains, producing constrained outputs, communicating discoveries, and choosing work that fits an agent's abilities.

The active constraints are a single persistent multiplayer world, no graphical character gameplay, meaningful LLM-agent participation, and a human role that can include selection, specialization, risk, and alliances. Fixed shared missions and sharing answers are important possibilities to develop. Zombies, mathematics, psychology, exact-output tasks, model-specific roles, and PvE are examples to investigate; they are not all mandatory systems.

Human involvement can be lighter than in the earlier proposals. We should not impose frequent direct manipulation or force a person to approve every important action. Choosing an expedition, backing a particular agent, helping a friend, and deciding what to share may be sufficient if people care about the consequences.

The question is now: **What world becomes interesting when solving, learning, and communicating are the ways agents act upon it?**

## 2. What strengths can support the design

The useful capability bundle is rapid interpretation of unfamiliar instructions, access to broad learned knowledge, code and tool creation, experimentation, and the ability to communicate findings in a form another agent can use. Sustained processing and coordination across many tasks can also matter. These are candidate advantages to measure in our tasks, not proof that every model is faster or more expert than every human.

Speed must mean elapsed time to a valid useful result, including thinking, tool execution, retries, and provider delay. Tokens per second alone is a poor class system. Model, tools, orchestration, task familiarity, and available resources all affect the result. The founder's named fast model is an illustrative example; this document makes no claim about its availability or ranking.

Coding benchmarks already separate generation, repair, execution, and output prediction. That supports designing different kinds of intellectual work rather than a single intelligence score. It does not prove that completing them is entertaining. [LiveCodeBench paper](https://arxiv.org/abs/2403.07974).

Verifiable constraints offer one way to judge outputs consistently. IFEval studies that approach and discusses limitations of model-based evaluation. A game's semantic and social challenges may need other rules; a free-form answer cannot become objectively correct simply because another LLM approves it. [IFEval paper](https://arxiv.org/abs/2311.07911).

Generalist-task difficulty can also be counterintuitive. GAIA's original study found large gaps on tasks described as conceptually simple for people. Its historical results are not current model rankings, but they are a reason to measure our actual challenge families. [GAIA paper](https://arxiv.org/abs/2311.12983).

A further production lesson: Terminal-Bench 2.1 corrected task dependencies, resource budgets, and mismatches between instructions and tests. An unfair or broken verifier would feel like the game cheating. [Terminal-Bench revision](https://www.tbench.ai/news/terminal-bench-2-1).

## 3. Five different games suggested by that foundation

### A. A world of unknown laws

Every region contains machines, languages, societies, and phenomena whose rules can be discovered. Agents experiment, read evidence, write interpreters, and prove hypotheses. Solving a site yields a reusable capability: understanding its language, operating its machines, predicting its hazards, or accessing another region. People organize research groups and decide where to explore and how to distribute discoveries.

The long-term achievement is a civilization's growing understanding of its world. New players inherit knowledge and can reach the frontier faster. The main weakness is content exhaustion once the world is understood; producing more question text does not fix that.

### B. A siege fought with discoveries

Threats have discoverable behavior. Agents investigate them and construct working counters. A solution can protect everyone facing that behavior, while changing conditions expose new research problems. People decide whether to defend established areas, investigate the next threat, or publish a discovery that changes the campaign.

The main pleasure is collective breakthroughs under pressure. The principal risk is reducing all intellectual work to interchangeable damage points, losing both the meaning of the solution and the role of communication.

### C. An economy of inventions

Agents solve practical challenges to create working tools, algorithms, interpreters, or designs. Other agents use and combine them. A useful invention changes what other players can produce or attempt. Humans establish research specialties, partnerships, standards, and terms of access.

The main pleasure is becoming known for something others actually use. The main weakness is that copying information is cheap. Artificially pretending an answer is scarce would undermine the premise; value would have to come from timely discovery, trusted validation, integration, and relationships. Knowledge monopolies could still dominate.

### D. A distributed mystery

One shared world contains a large, coherent mystery with clues across languages, code, mathematics, social testimony, and experimental systems. Agents pursue different leads and reconcile conflicting explanations. Humans form investigation groups, choose theories to back, and decide which incomplete findings to trust.

The main pleasure is assembling a discovery no participant had alone. It can support a powerful finite campaign. Repeated reveals and secret master solutions are harder to sustain as a persistent service, and a public walkthrough eventually changes the experience.

### E. A contest over the world's rules

Players propose bounded mechanisms that change shared territory: a transportation rule, defensive filter, resource transformation, or access protocol. Their agents construct solutions and others seek counterexamples or compatible improvements. A proposal earns adoption by meeting public correctness and resource requirements. Humans form coalitions around the world they want.

The main pleasure is invention and intellectual rivalry with visible consequences. The principal risks are specialist accessibility, verifier abuse, griefing through rule changes, and a dominant group capturing governance. This is the most ambitious and least mature direction here.

These are alternative product centers, not five launch modes. A and B receive the developed example below: discovery supplies the core activity, and shared threats give discoveries urgency and consequence. C, D, and E expose other ways to use the same agent strengths without assuming zombies are the answer.

## 4. Developed hypothesis: solutions become abilities

Working description: **A shared world where your agent's discoveries become tools, knowledge, and defenses that you and other players can use.**

The world contains stable named sites. Each site has an observable state and an intellectual obstacle. A solution changes what can be done there and, when applicable, produces an artifact that remains useful elsewhere.

Examples:

| Challenge | Agent's actual task | How success changes play |
| --- | --- | --- |
| An unreadable network | Infer a message format from evidence and implement a decoder | Read previously inaccessible observations and share decoded information |
| A damaged machine | Repair a program to satisfy a published behavioral contract | Restore a real world function, such as a scanner or access gate |
| An unknown phenomenon | Select experiments, infer a rule, and provide a prediction or witness | Predict when an area is safe or identify a hidden dependency |
| A constrained signal | Construct a string accepted by a published grammar and state-dependent conditions | Activate a particular mechanism while its conditions hold |
| Conflicting research records | Reconcile evidence, units, and assumptions to produce a checkable result | Discover which operating procedure is valid for the region |
| A fictional society | Infer defined preferences and negotiate an agreement meeting participants' conditions | Gain cooperation or access through a materially different route |

A coding solution is an actual working counter or instrument within the game. A mathematical result determines an operating condition. Communication transfers a method another participant can apply. Success can also pay an explicit bounty, but its principal consequence should remain tied to what was solved.

A single answer is appropriate for some missions. A program, proof, design, or negotiated agreement can have many valid forms. Requiring one secret spelling of a correct answer would unnecessarily weaken that variety.

## 5. Fixed missions and shared knowledge

The founder's A1/A2 example should work literally. You send your agent to A1, your wife sends hers to A2, and you exchange the answers. Each can then use the other's solution. The rules recognize that as intended cooperation.

Three kinds of knowledge give that a progression:

1. **An answer:** the key or exact result for a stable site. It keeps working for anyone who learns it.
2. **A method:** a decoder, proof technique, experiment protocol, or reusable program that solves a family of related situations.
3. **A synthesis:** combining findings from several sites to do something none of the individual answers enabled.

Solved sites do not secretly change their questions to invalidate sharing. Versioned new discoveries and new conditions are identified as such. A fixed site may have a changing world state, but the game must distinguish that from changing the truth of its archived solution.

Reward consequences must be separated. A personal completion or capability unlock can be obtained once per player, including through a shared answer. A finite discovery bounty is paid once under published rules. Installing or applying a known method can still do useful work, but repeatedly resubmitting the same answer does not create infinite transferable resources.

Eventually some answers will appear in public guides. That is compatible with a world accumulating knowledge. Established regions become easier to use; frontier problems and combinations carry more of the new discovery. This needs a credible supply of authored systems and novel combinations. A finite corpus cannot honestly promise endless fresh intellectual work.

## 6. You and your wife, in one operation

The following is a fictional scenario with illustrative timing. It is intended to expose the game, not to claim an already working challenge.

You enter a district facing a swarm that will reach an inhabited archive in approximately twelve minutes. Its behavior is governed by a signal system. The region has two known unsolved sites and an active threat controller.

**A1: understand the signals.** The task contains a packet specification and damaged records. A valid decoder must recover readings across the stated input domain. You assign an agent that has performed well at fast coding and repair tasks in this game.

**A2: understand the controller.** The task is a finite state machine with a missing transition rule, accessible through bounded experiments and evidence. Your wife assigns an agent that has performed well at inference and careful testing. A2 produces a model of when the swarm advances and what kind of signal causes it to retreat. It is a stable discovery, useful in later encounters with that controller family.

You agree to exchange complete findings. Her agent does not need to repeat the decoder work; yours does not need to repeat the experiments. The exchange includes input assumptions and limits, not just a confident final sentence.

**The complication is in the combination.** Your decoder's readings are taken before the controller updates its state; the controller model describes the state afterward. Applying either result without that distinction produces the wrong signal. The agents compare examples and build a compatible counter. An experienced ally may already know this interface convention and save the group time.

You now have two viable outcomes. A tested counter protects the archive from the known threat. Extending it to pursue the source might permanently clear the district, but requires another experiment and could consume the remaining response window. You and your wife decide to deploy the reliable defense and share it with the district, while keeping an exploratory attempt available for the next session.

**The successful program changes the world.** It is installed in the archive's defensive system and counters the supported behavior as the swarm arrives. The game checks what it does; it does not award arbitrary damage because an evaluator liked its explanation. Other groups can copy the published counter and protect compatible sites. Your record shows the decoder contribution, her controller discovery, and the resulting protection.

Later, your wife can visit A1 with your shared solution and gain its personal unlock. Another region with the same signal language is now easier for both of you. A controller using a different rule creates new work, while the decoder remains valuable.

The human occasion can be a short check-in or a longer cooperative session. The person chooses the undertaking, available agent, collaborators, exposure, and use of discoveries. They may inspect or redirect reasoning if they enjoy it. They are not required to solve the code personally or approve every tool call.

## 7. How a massive swarm could work

A swarm can be a large number of threats following a shared, discoverable behavior. We do not need one separate LLM, riddle, or reasoning call for every enemy.

Different threats can create distinct intellectual challenges:

- **Decoys:** distinguish threatening signals from harmless ones; false positives waste a limited defense opportunity.
- **Adaptive organisms:** identify which of a defined set of behavioral changes has occurred, then revise a counter.
- **Disrupted infrastructure:** repair or synthesize a controller that preserves several properties while handling incoming events.
- **A linked colony:** separate teams discover components of a shared system, then assemble a compatible response.

Once understood, ordinary members of a known family can be handled by reusable tools. That is a reward for discovery. New work comes from new behavior, interactions, constraints, or previously inaccessible systems. Randomly renaming a known problem is weak new content.

An advance should follow intelligible world rules. If a whole region masters a threat, its advantage should persist. The game should not secretly increase difficulty whenever players succeed merely to maintain pressure. Regional loss can close opportunities or force a different approach, while providing a route to recovery.

PvE and PvP still remain open. In a cooperative campaign, discoveries can become public defenses. In a rival world, groups may compete to discover, withhold, exchange, or improve counters. That choice changes what sharing costs and why alliances matter; it should follow the desired social experience rather than being bundled automatically.

## 8. Agent specialization, difficulty, rewards, and loss

Do not assign permanent classes to provider brands. Use a player's observed results in the actual game: successful solve time, correctness, retries, cost, and performance by task family. An agent's chosen tools and memory also belong to that profile. Confidence expressed in prose is not a measured probability of success.

Useful mission distinctions include:

| Mission form | What is scarce | Why a different agent might fit | Reward and failure shape |
| --- | --- | --- | --- |
| An urgent response | Time before a world event | Short elapsed time to a correct answer | Time-sensitive protection; a failed submission consumes a stated attempt or response opportunity |
| A durable discovery | Access to experiments and unresolved evidence | Careful inference and checking | A reusable method or access unlock; failed experiments spend a bounded in-game resource |
| An invention | Correctness under resource constraints | Coding, debugging, and optimization | A useful artifact; known tests allow development before committing it |
| A distributed investigation | Information held across sites or groups | Clear communication and reconciliation | A shared capability; incomplete assumptions can cause a failed combined result |
| A broad synthesis | Several unfamiliar knowledge domains | Generalization and tool selection | Access to a deeper system; longer commitment and higher opportunity cost |

Difficulty should describe the structure of the problem: steps, uncertainty, verification burden, novelty, and dependencies. It should not simply mean longer prompts or more obscure trivia. Optional higher-stakes challenges expose more of the player's committed resources, with clearly stated consequences.

For a toy comparison, a mission with a 10-credit entry cost, 40-credit success payout, and no other credit loss has expected credit change of 22 at an 80% pass rate and 2 at a 30% pass rate. A slower task may still be preferable because it yields a permanent capability or protects a valued location. These are illustrative numbers, not a balance proposal. Attempt frequency, repeated access, real inference cost, and world impact all matter.

Speed windows should measure a task from its published start or accepted entry under known rules. Most discovery content need not be a global first-response race. Regional deadlines create a use for fast solvers without making every mission an endpoint-latency contest. The game must identify service faults and provide an outage policy rather than treating every timeout as intellectual failure.

A sufficiently better agent may be better across all categories. We cannot assume perfectly complementary models will exist forever. Alliances can still offer more simultaneous attention, accumulated knowledge, different goals, and trust. If our game requires a permanently weaker model to excel at one special job, the design is fragile.

More spending can buy more capable reasoning or more attempts unless constrained. Equal world-action rules do not erase that advantage. Whether stronger purchased intelligence is acceptable competition is an open product choice, not something to conceal with the word fairness. Bounded active expeditions and world resources can constrain scale, but alternate accounts remain an unresolved abuse problem.

## 9. Communication must transfer something useful

The entry level is direct answer sharing. More demanding collaboration can involve sharing assumptions, counterexamples, partial models, or compatible components. An agent can appear successful locally and still communicate an incomplete result that its partner cannot use.

A good advanced mission makes the value of information observable: receiving the missing input convention fixes the combined controller; a counterexample prevents deployment of a faulty defense; a reusable method opens another site. Awarding generic points for agent chat would not establish collaboration.

There is no claim that a single strong agent cannot solve both sites. Splitting work offers parallelism and lets friends contribute together. Communication overhead may sometimes make splitting a task slower, and the game should allow a capable player to recognize that. Forced message quotas or mandatory two-player gates would obscure this choice.

Humans can decide whom to invite, whether to publish or selectively share, what evidence to trust, and which common objective is worth supporting. Agents may communicate under those standing preferences. Public knowledge can be socially valuable even when withholding it would create a temporary advantage.

## 10. What makes a valid challenge

Programming tasks require precise inputs, permitted behavior, and an output contract. Many implementations may pass. Tests must cover meaningful behavior rather than permit a lookup table for only displayed examples. Where the domain is small, exhaustive checks can establish the defined behavior; in broader domains, passing finite tests is not a mathematical proof of universal correctness.

Mathematical tasks can accept exact values, checkable witnesses, or proofs in a supported formal system. Informal explanation quality is a different kind of judgment. The game must not present an opaque grader's preference as mathematical truth.

Constrained generation should specify characters, words, bytes, or a published tokenizer. Different providers' private token boundaries are unsuitable for a supposedly identical cross-model task. For an elementary illustration, `CABDACBD` satisfies: eight characters drawn from A/B/C/D, each twice; no equal neighbors; starts with C; ends with D; contains AB exactly once. A production challenge needs richer reasoning, meaningful game effect, and appropriate difficulty. Random generation alone is weak intellectual gameplay; if distributional randomness matters, a single string cannot prove it.

Psychology offers several different possibilities. A factual question needs defensible references. An inference task about a fictional actor can use explicitly modeled preferences and observable choices. A negotiation can succeed by producing an agreement satisfying defined conditions. An open question about a person's motives need not have one objectively correct answer. We should not force all of these into exact-answer grading.

Allow agents to write scripts and use solvers within the game's rules. Tool construction is part of the intended advantage. Cryptographic brute force or generating huge numbers of random guesses mainly rewards compute throughput; that is a different design from testing useful reasoning.

The game needs its own authored task systems, known valid solutions, validated generators, clear resource limits, and versioned corrections. Existing public benchmark questions are references for task types, not a ready-made commercial content library. Unbounded generated questions with an LLM as their only verifier are a poor foundation for consequential shared-world outcomes.

## 11. What this still has to earn

The design offers three levels of payoff: immediate successful solving, reusable personal or shared capability, and consequences for an inhabited world. Those levels need to reinforce each other. Collecting correct answers with unrelated rewards would not establish the proposed identity.

The largest risks are:

- **Spectatorship without attachment:** owners watch successful automation but feel no reason to return. Test whether mission choice, collaboration, discovery ownership, and world consequence are enough before adding human chores.
- **Solved content:** once a guide or general solver exists, familiar tasks become routine. Preserve knowledge and provide a finite, substantial frontier with a credible expansion model; do not promise infinite novelty.
- **One dominant agent:** purchased capability outweighs mission selection and alliances. Measure actual differences and decide the acceptable competition structure honestly.
- **Unreliable adjudication:** valid work fails because the task is broken. Task quality, appeals, and correction are core game design requirements.
- **Disconnected questions:** a random mix of coding, math, and psychology feels like exams with loot. Give domains coherent roles in the world's systems and discoveries.
- **Cost without useful play:** agents make many expensive attempts while the human has little stake. Measure cost per meaningful mission outcome, and do not tie the world tick to an LLM call.
- **Public-world exploitation:** duplicate rewards, collusion, malicious submitted code, and forged solution claims affect everyone. Submitted artifacts must have bounded game authority and independently checked effects. This is a product requirement, not a production architecture specification.

The next design judgment concerns whether discovering and deploying reusable knowledge produces a stronger human occasion than a competition of agents clearing unrelated missions. A direct comparison should also include active owner involvement versus unattended operation and fresh reasoning versus previously shared solutions. These are proposed evaluations; no participants, performance results, retention figures, or demand evidence have been invented.

This reset deliberately does not choose a price, launch population, arbitrary map size, or final genre. Those would be premature while the identity is still changing. The complete Version 1.0 requirement remains in force once a direction earns selection. For now, the concrete proposal is a world that players and their agents progressively learn how to operate, with their shared discoveries determining what becomes possible next.
