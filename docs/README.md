# Siduri Documentation Hub

Siduri is an agentic AI cognition and runtime system structured as independent, composable organs.

The documentation is organized into two primary sections:

```
docs/
├── README.md            # Documentation index and directory map
├── release-status.md    # Canonical release status, verified commit, invariants, and commands
├── architecture/        # Core organ architecture, runtime design, and subsystem specifications
├── contracts/           # Neutral context specs, memory state machine, safety gating, and event contracts
├── rfc/                 # Architectural RFC proposals and protocol specifications
└── thought-exercises/   # Conceptual explorations, identity taxonomy, and philosophical analyses
```

> **Current Release State**: See [**Canonical Release Status**](./release-status.md) for current release readiness, verified commit, and architecture invariants.

---

## 1. Architecture (`docs/architecture/`)
Core specifications for the decoupled organ architecture and system components:

- **[Siduri Organ Architecture](./architecture/siduri-organ-architecture.md)** — **Primary architectural blueprint:** Decoupling philosophy, the 10 core organs (Brain, Memory, Knowledge, Behavior, Ear, Vision, Mouth, Hands, Body, Voice), perception-decision-action loops, and the E-ecosystem.
- **[Architecture Overview](./architecture/architecture.md)** — High-level runtime overview.
- **[The Truth Gate & Anchor](./architecture/truth-gate.md)** — Two-tier reality model: memory proposal staging and runtime response/evidence gating.
- **[Organs Reference](./architecture/organs.md)** — Detailed responsibilities and interfaces of organ packages.
- **[Companion Runtime](./architecture/companion-runtime.md)** — Orchestration of organs inside the active companion runtime.
- **[Behavior & Active Self](./architecture/behavior.md)** — Behavioral compilation, directive scoping, and safety projection.
- **[Action Policy Design](./architecture/action-policy-design.md)** — Cryptographic action capabilities, MCP execution, and audit chaining.
- **[Memory Subsystem](./architecture/memory.md)** — PostgreSQL claims persistence, lifecycle, and temporal indexing.
- **[Knowledge & E-Packs](./architecture/knowledge-e.md)** — E-Knowledge integration, provenance, and citations.
- **[API Reference](./architecture/api.md)** — REST API surface and endpoint contracts.
- **[CLI Reference](./architecture/cli.md)** — Command-line interface and diagnostic tools.
- **[Configuration Guide](./architecture/configuration.md)** — Runtime and companion YAML/JSON configuration.
- **[Development Guide](./architecture/development.md)** — Local development environment, building, and running.
- **[Testing Strategy](./architecture/testing.md)** — Test suite layout and execution.
- **[Subsystem Integrations](./architecture/integrations.md)** — External adapters (Voice Synthesis, Live2D, OpenRouter).
- **[Limitations & Boundaries](./architecture/limitations.md)** — System boundaries and non-goals.
- **[Implementation Status](./architecture/implementation.md)** — Monorepo status, verified organs, and capabilities.
- **[Migration & V1 Roadmap](./architecture/migration.md)** — Transition from legacy multi-viewer streaming to 1-User Agent model.

---

## 2. RFCs & Proposals (`docs/rfc/`)
Architectural proposals and prospective specifications:

- **[RFC: Dynamic Behavior & `.self`](./rfc/rfc-dynamic-behavior-self.md)** — Distribution protocol, 3-mode memory acquisition, and `.self` ingestion via Teach Mode.
- **[RFC: The Life Database Specification](./rfc/rfc-life-database.md)** — Separation of subjective companion memory vs. sovereign user life database.
- **[RFC: Benchmarking Framework](./rfc/rfc-benchmarking-framework.md)** — Performance SLA budgets, memory scaling, truth gate throughput, and microbenchmark architecture.

---

## 3. Thought Exercises (`docs/thought-exercises/`)
Conceptual analysis and design philosophy:

- **[Thought Exercise: AI Identity & Behavior](./thought-exercises/thought-exercise-ai-identity.md)** — Conceptual analysis disentangling identity, personality, user knowledge, and situational response models.

---

## 4. Contracts & Safety (`docs/contracts/`)
Type-safe interfaces, gating engine, memory state machines, and neutral security contracts:

- **[T1 Neutral Context Spec](./contracts/t1-neutral-context-spec.md)** — Actor, request context, and authorization definitions.
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



