# Game agent architecture literature review

Reviewed 2 November 2026. The mission is an agent that can enter a game and play appropriately, both mechanically and cognitively. The review compares possible routes without assuming an LLM, separate models, or a layered architecture is required.

Start with the [cross-paper synthesis and architecture diagrams](synthesis.md). Several architectures remain viable; modularity alone does not establish competent play or graceful degradation.

The 80 selected papers were reviewed sequentially. Each note records its source/version, reading coverage, mechanism, evidence, limitations and mission implications. Coverage of appendices, proofs, figures, code and videos varies and is explicit in the notes. This is a bounded literature review, not an exhaustive survey or independent replication.

The [machine-readable corpus](corpus.json) maps paper identifiers to sources and local notes. These research findings are separate from canonical PACT specifications and implementation acceptance.

## Paper notes

### 01–08 — foundations and agent architectures

- [01 — A Robust Layered Control System for a Mobile Robot](papers/01.md)
- [02 — Intelligence Without Representation](papers/02.md)
- [03 — Integrating Planning and Reacting in a Heterogeneous Asynchronous Architecture for Controlling Real-World Mobile Robots](papers/03.md)
- [04 — An Architecture for Autonomy](papers/04.md)
- [05 — Decision-Making in an Embedded Reasoning System](papers/05.md)
- [06 — BDI Agents: From Theory to Practice](papers/06.md)
- [07 — The HEARSAY-II Speech-Understanding System: Integrating Knowledge to Resolve Uncertainty](papers/07.md)
- [08 — Introduction to Soar](papers/08.md)

### 09–16 — cognition and biological control

- [09 — A Standard Model of the Mind](papers/09.md)
- [10 — An Integrated Theory of the Mind](papers/10.md)
- [11 — An Analysis and Comparison of ACT-R and Soar](papers/11.md)
- [12 — A Review of 40 Years of Cognitive Architecture Research](papers/12.md)
- [13 — Uncertainty-Based Competition Between Prefrontal and Dorsolateral Striatal Systems for Behavioral Control](papers/13.md)
- [14 — Homeostatic Reinforcement Learning for Integrating Reward Collection and Physiological Stability](papers/14.md)
- [15 — Continuous Homeostatic Reinforcement Learning for Self-Regulated Autonomous Agents](papers/15.md)
- [16 — Active Inference and Learning](papers/16.md)

### 17–24 — execution, planning and timing

- [17 — A Survey of Behavior Trees in Robotics and AI](papers/17.md)
- [18 — Behavior Trees in Robot Control Systems](papers/18.md)
- [19 — How Behavior Trees Modularize Hybrid Control Systems and Generalize Sequential Behavior Compositions, the Subsumption Architecture, and Decision Trees](papers/19.md)
- [20 — Hierarchical Task and Motion Planning in the Now](papers/20.md)
- [21 — Integrated Task and Motion Planning](papers/21.md)
- [22 — Using Anytime Algorithms in Intelligent Systems](papers/22.md)
- [23 — Principles of Metareasoning](papers/23.md)
- [24 — Event-Triggered Real-Time Scheduling of Stabilizing Control Tasks](papers/24.md)

### 25–32 — hierarchical reinforcement learning

- [25 — Feudal Reinforcement Learning](papers/25.md)
- [26 — Between MDPs and Semi-MDPs: A Framework for Temporal Abstraction in Reinforcement Learning](papers/26.md)
- [27 — Hierarchical Reinforcement Learning with the MAXQ Value Function Decomposition](papers/27.md)
- [28 — The Option-Critic Architecture](papers/28.md)
- [29 — FeUdal Networks for Hierarchical Reinforcement Learning](papers/29.md)
- [30 — Data-Efficient Hierarchical Reinforcement Learning](papers/30.md)
- [31 — Learning Multi-Level Hierarchies with Hindsight](papers/31.md)
- [32 — Hierarchical Deep Reinforcement Learning: Integrating Temporal Abstraction and Intrinsic Motivation](papers/32.md)

### 33–40 — skills and representations

- [33 — Diversity Is All You Need: Learning Skills Without a Reward Function](papers/33.md)
- [34 — Dynamics-Aware Unsupervised Discovery of Skills](papers/34.md)
- [35 — Accelerating Reinforcement Learning with Learned Skill Priors](papers/35.md)
- [36 — Learning Latent Plans from Play](papers/36.md)
- [37 — DeepMimic: Example-Guided Deep Reinforcement Learning of Physics-Based Character Skills](papers/37.md)
- [38 — AMP: Adversarial Motion Priors for Stylized Physics-Based Character Control](papers/38.md)
- [39 — Universal Value Function Approximators](papers/39.md)
- [40 — From Skills to Symbols: Learning Symbolic Representations for Abstract High-Level Planning](papers/40.md)

### 41–48 — world models, memory and transfer

- [41 — World Models](papers/41.md)
- [42 — Dream to Control: Learning Behaviors by Latent Imagination](papers/42.md)
- [43 — Mastering Diverse Domains Through World Models](papers/43.md)
- [44 — Mastering Atari, Go, Chess and Shogi by Planning with a Learned Model](papers/44.md)
- [45 — Hybrid Computing Using a Neural Network with Dynamic External Memory](papers/45.md)
- [46 — Neural Episodic Control](papers/46.md)
- [47 — Imagination-Augmented Agents for Deep Reinforcement Learning](papers/47.md)
- [48 — Successor Features for Transfer in Reinforcement Learning](papers/48.md)

### 49–56 — modularity and continual learning

- [49 — Modular Multitask Reinforcement Learning with Policy Sketches](papers/49.md)
- [50 — Recurrent Independent Mechanisms](papers/50.md)
- [51 — Progressive Neural Networks](papers/51.md)
- [52 — PathNet: Evolution Channels Gradient Descent in Super Neural Networks](papers/52.md)
- [53 — Overcoming Catastrophic Forgetting in Neural Networks](papers/53.md)
- [54 — Continual Learning Through Synaptic Intelligence](papers/54.md)
- [55 — Composable Deep Reinforcement Learning for Robotic Manipulation](papers/55.md)
- [56 — Neural Production Systems: Learning Rule-Governed Visual Dynamics](papers/56.md)

### 57–64 — safety, recovery and adaptation

- [57 — The Simplex Architecture for Safe On-Line Control System Upgrades](papers/57.md)
- [58 — Neural Simplex Architecture](papers/58.md)
- [59 — Safe Reinforcement Learning via Shielding](papers/59.md)
- [60 — Safe Reinforcement Learning via Shielding Under Partial Observability](papers/60.md)
- [61 — Control Barrier Function Based Quadratic Programs for Safety Critical Systems](papers/61.md)
- [62 — Recovery RL: Safe Reinforcement Learning with Learned Recovery Zones](papers/62.md)
- [63 — Robots That Can Adapt Like Animals](papers/63.md)
- [64 — Learning Robust Perceptive Locomotion for Quadrupedal Robots in the Wild](papers/64.md)

### 65–72 — game agents and motor adaptation

- [65 — Human-Level Performance in First-Person Multiplayer Games with Population-Based Deep Reinforcement Learning](papers/65.md)
- [66 — Grandmaster Level in StarCraft II Using Multi-Agent Reinforcement Learning](papers/66.md)
- [67 — Counter-Strike Deathmatch with Large-Scale Behavioural Cloning](papers/67.md)
- [68 — Hierarchical Imitation and Reinforcement Learning](papers/68.md)
- [69 — Learning Agile Soccer Skills for a Bipedal Robot with Deep Reinforcement Learning](papers/69.md)
- [70 — Dota 2 with Large Scale Deep Reinforcement Learning](papers/70.md)
- [71 — Hierarchical Macro Strategy Model for MOBA Game AI](papers/71.md)
- [72 — RMA: Rapid Motor Adaptation for Legged Robots](papers/72.md)

### 73–80 — language-guided agent systems

- [73 — Do As I Can, Not As I Say: Grounding Language in Robotic Affordances](papers/73.md)
- [74 — Inner Monologue: Embodied Reasoning Through Planning with Language Models](papers/74.md)
- [75 — RT-H: Action Hierarchies Using Language](papers/75.md)
- [76 — Hi Robot: Open-Ended Instruction Following with Hierarchical Vision-Language-Action Models](papers/76.md)
- [77 — SayPlan: Grounding Large Language Models Using 3D Scene Graphs for Scalable Robot Task Planning](papers/77.md)
- [78 — Code as Policies: Language Model Programs for Embodied Control](papers/78.md)
- [79 — Voyager: An Open-Ended Embodied Agent with Large Language Models](papers/79.md)
- [80 — Generative Agents: Interactive Simulacra of Human Behavior](papers/80.md)
