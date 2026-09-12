# Siduri Documentation Hub

Siduri is an **experimental, open-source AI companion research runtime** structured around **four core domain substrates** (`Self`, `Knowledge` / Life DB, `Memory`, `Core`) and **nine pluggable peripheral organs** (`Brain`, `Hands`, `Ear`, `Vision`, `Voice`, `Body`, `Observation`, `Mouth`, `E-Knowledge`).

> [!NOTE]
> **Research & Prototype Notice**  
> Siduri is an evolving architectural testbed. Subsystems and contracts are verified in isolated mock unit test suites and package scaffolding fixtures, but are **untested in continuous real-world end-to-end (E2E) environments**. We welcome inspection, feedback, and experimentation.

```
docs/
├── README.md                 # Documentation index and directory map
├── release-status.md         # Prototype verification status, testing boundaries, and invariants
├── self-organ-knowledge/     # [CANONICAL] Clean Architecture, Pure SQLite, and .self Ingestion Suite
│   ├── README.md             # Clean architecture blueprint and core questions
│   ├── 01-domain-architecture.md   # Domain models, SQLite schema, and contracts
│   ├── 02-self-asset-and-teach-mode.md # .self file format, safety scanner, and Teach Mode
│   └── 03-phased-migration-plan.md     # 6-phase zero-baggage migration roadmap (COMPLETED)
├── architecture/             # Organ architecture, runtime design, and subsystem specifications
├── contracts/                # Neutral context specs, memory state machine, safety gating, and event contracts
├── rfc/                      # Architectural RFC proposals and protocol specifications
└── thought-exercises/        # Conceptual explorations, identity taxonomy, and philosophical analyses
```

> **Current Status**: See [**Prototype Verification Status**](./release-status.md) for architectural invariants, testing boundaries, and limitations.

---

## 0. Clean Architecture & Pure SQLite Substrates (`docs/self-organ-knowledge/`) **[CANONICAL / IMPLEMENTED]**

The authoritative architecture specification defining the complete eradication of PostgreSQL, unified `siduri.sqlite` storage, and the 4-domain separation:

- **[Architecture Blueprint](./self-organ-knowledge/README.md)** — Core ontological model: *Self* (Who am I?), *Knowledge* (What do I know?), *Memory* (What happened?), *Organs* (What can I do?).
- **[01. Domain Architecture & SQLite Schema](./self-organ-knowledge/01-domain-architecture.md)** — Unified `siduri.sqlite` schema, FTS5 BM25 search, `SelfRepository`, `LifeDatabase`, and `EpisodicMemoryStore` contracts.
- **[02. The `.self` Asset Specification & Teach Mode](./self-organ-knowledge/02-self-asset-and-teach-mode.md)** — Specification for `.self` character ethos packages, safety scanning (`scanDirective`), and interactive Teach Mode batch proposal cards.
- **[03. Phased Engineering Roadmap](./self-organ-knowledge/03-phased-migration-plan.md)** — **[COMPLETED ✅]** Full 6-phase migration plan executed: Pure SQLite foundation, package extraction, organ purification, 4-stream runtime refactor, Teach Mode API, and PostgreSQL purge.

---

## 1. Architecture Reference (`docs/architecture/`)

Detailed subsystem and organ-level specifications:

- **[Architecture Overview](./architecture/architecture.md)** — High-level runtime overview and 4-stream parallel execution flow.
- **[The Truth Gate & Anchor](./architecture/truth-gate.md)** — Two-tier reality model: memory proposal staging and runtime response/evidence gating.
- **[Organs Reference](./architecture/organs.md)** — Detailed responsibilities and package mapping for all 4 domains and 9 peripheral organs.
- **[Companion Runtime](./architecture/companion-runtime.md)** — `SiduriRuntime` orchestration pipeline, 4-stream parallel context retrieval, and life context injection.
- **[Memory Subsystem](./architecture/memory.md)** — SQLite FTS5 episodic memory store, claims lifecycle, and historical PostgreSQL migration notes.
- **[External Knowledge & E-Packs](./architecture/knowledge-e.md)** — `@siduri-x/eknowledge` client, cited context, and SSRF hardening.
- **[Action Policy Design](./architecture/action-policy-design.md)** — Cryptographic action capabilities, MCP execution, and audit chaining.
- **[API Reference](./architecture/api.md)** — REST API surface including `/chat`, `/chat/stream`, `/teach/upload-self`, and `/teach/install-self`.
- **[CLI Reference](./architecture/cli.md)** — `@vxnus/siduri` CLI reference, dynamic organ discovery, and diagnostic tools.
- **[Configuration Guide](./architecture/configuration.md)** — Runtime and companion YAML/JSON configuration.
- **[Development Guide](./architecture/development.md)** — Local development environment, building, and running.
- **[Testing Strategy](./architecture/testing.md)** — Test suite layout, invariant assertions, and clean-machine verification.
- **[Subsystem Integrations](./architecture/integrations.md)** — External adapters (Voice Synthesis, Live2D, OpenRouter).
- **[Limitations & Boundaries](./architecture/limitations.md)** — System boundaries and non-goals.
- **[Migration & V1 Roadmap](./architecture/migration.md)** — Historical transition from legacy multi-viewer streaming to single-owner companion model.
- **[Single-Owner Phased Migration Plan](./architecture/single-owner-phased-migration.md)** — Step-by-step roadmap that eliminated internal RBAC partitions.
- ~~**[Behavior & Active Self](./architecture/behavior.md)**~~ — *Legacy Reference* (behavior compiled into `@siduri-x/self`).

---

## 2. RFCs & Proposals (`docs/rfc/`)

Architectural proposals, design explorations, and prospective specifications:

| Document | Title | Status |
| :--- | :--- | :--- |
| **[`rfc-siduri-self-organ-knowledge.md`](./rfc/rfc-siduri-self-organ-knowledge.md)** | Core Self, Organs, Knowledge, and Memory Architecture | **Implemented** (Adopted in `self-organ-knowledge/`) |
| **[`rfc-dynamic-behavior-self.md`](./rfc/rfc-dynamic-behavior-self.md)** | Dynamic Behavior Delivery & The `.self` Asset Specification | **Implemented** (`@siduri-x/self` + Teach Mode) |
| **[`rfc-life-database.md`](./rfc/rfc-life-database.md)** | The Life Database Specification & User Data Sovereignty | **Implemented** (`@siduri-x/knowledge`) |
| **[`rfc-benchmarking-framework.md`](./rfc/rfc-benchmarking-framework.md)** | Performance SLA Budgets, Scaling & Microbenchmarks | **Planned** (Upcoming Benchmark Suite) |

---

## 3. Contracts & Safety Specifications (`docs/contracts/`)

Type-safe interfaces, gating engine invariants, and security contracts:

- **[T1 Neutral Context Spec](./contracts/t1-neutral-context-spec.md)** — Actor, request context, and single-owner authorization definitions.
- **[T1 API Contract Examples](./contracts/t1-api-contract-examples.md)** — Concrete payload examples for API endpoints.
- **[T2 Memory State Machine](./contracts/t2-memory-state-machine.md)** — Claim lifecycle (`PENDING` -> `APPROVED` -> `EXPIRED` / `REVOKED`).
- **[T2 Memory Disclosure Matrix](./contracts/t2-memory-disclosure-matrix.md)** — Channel sensitivity and disclosure boundaries.
- **[T3 Active Self Contract](./contracts/t3-active-self-contract.md)** & **[Prompt Section Matrix](./contracts/t3-prompt-section-matrix.md)** — Behavior projection and prompt assembly rules.
- **[T4 Evidence Chain Contract](./contracts/t4-evidence-chain-contract.md)** — Citations, grounding, and response gating evaluation.
- **[T5 Experience Event Contract](./contracts/t5-experience-event-contract.md)** — Outbound event envelopes (voice, avatar, action).
- **[T6 Security Operations Contract](./contracts/t6-security-operations-contract.md)** — Secret isolation, capabilities, and failure boundaries.
- **[T7 Release Evidence Contract](./contracts/t7-release-evidence-contract.md)** — Release gating criteria and verification.
- **[Neutral Terminology Glossary](./contracts/neutral-terminology-glossary.md)** — Standard terminology dictionary.
- **[Blank Slate Contract](./contracts/blank-slate-contract.md)** & **[Fixture Guide](./contracts/blank-slate-fixture-guide.md)** — Invariants for clean-slate initializations.

---

## 4. Thought Exercises (`docs/thought-exercises/`)

- **[Thought Exercise: AI Identity & Behavior](./thought-exercises/thought-exercise-ai-identity.md)** — Conceptual analysis disentangling identity, personality, user knowledge, and situational response models.
