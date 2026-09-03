# Siduri Documentation Hub

Siduri is an agentic AI cognition and runtime system structured as independent, composable organs.

The documentation is organized into four distinct sections:

```
docs/
├── RELEASE_STATUS.md # Canonical release status, verified commit, invariants, and reproducible commands
├── architecture/     # Core organ architecture, runtime design, and subsystem specifications
└── contracts/        # Neutral context specs, memory state machine, safety gating, and event contracts
```

> **Current Release State**: See [**Canonical Release Status**](./RELEASE_STATUS.md) for current go/no-go status, verified SHA (`06823ac2de61a5d8923f4072fe221bf943ea4aa4`), and architecture invariants.


---

## 1. Architecture (`docs/architecture/`)
Core specifications for the decoupled organ architecture and system components:

- **[Siduri Organ Architecture](./architecture/siduri-organ-architecture.md)** — **Primary architectural blueprint:** Decoupling philosophy, the 10 core organs (Brain, Memory, Knowledge, Behavior, Ear, Vision, Mouth, Hands, Body, Voice), perception-decision-action loops, and the E-ecosystem.
- **[Architecture Overview](./architecture/architecture.md)** — High-level runtime overview.
- **[Organs Reference](./architecture/organs.md)** — Detailed responsibilities and interfaces of organ packages.
- **[Companion Runtime](./architecture/companion-runtime.md)** — Orchestration of organs inside the active companion runtime.
- **[Behavior & Active Self](./architecture/behavior.md)** — Behavioral compilation, directive scoping, and safety projection.
- **[Memory Subsystem](./architecture/memory.md)** — PostgreSQL claims persistence, lifecycle, and temporal indexing.
- **[Knowledge & E-Packs](./architecture/knowledge-e.md)** — E-Knowledge integration, provenance, and citations.
- **[API Reference](./architecture/api.md)** — REST API surface and endpoint contracts.
- **[CLI Reference](./architecture/cli.md)** — Command-line interface and diagnostic tools.
- **[Configuration Guide](./architecture/configuration.md)** — Runtime and companion YAML/JSON configuration.
- **[Development Guide](./architecture/development.md)** — Local development environment, building, and running.
- **[Testing Strategy](./architecture/testing.md)** — Test suite layout and execution.
- **[Subsystem Integrations](./architecture/integrations.md)** — External adapters (Voice Synthesis, Live2D, OpenRouter).
- **[Limitations & Boundaries](./architecture/limitations.md)** — System boundaries and non-goals.
- **[Migration & V1 Roadmap](./architecture/migration.md)** — Transition from legacy multi-viewer streaming to 1-User Agent model.

---

## 2. Contracts & Safety (`docs/contracts/`)
Type-safe interfaces, gating engine, memory state machines, and neutral security contracts:

- **[T1 Neutral Context Spec](./contracts/T1-NEUTRAL-CONTEXT-SPEC.md)** — Actor, request context, and authorization definitions.
- **[T1 API Contract Examples](./contracts/T1-API-CONTRACT-EXAMPLES.md)** — Concrete payload examples for API endpoints.
- **[T1 Implementation Plan](./contracts/T1-IMPLEMENTATION-PLAN.md)** & **[Checklist](./contracts/T1-IMPLEMENTATION-CHECKLIST.md)** — Context mapper implementation details.
- **[T2 Memory State Machine](./contracts/T2-MEMORY-STATE-MACHINE.md)** — Claim lifecycle (`PENDING` -> `APPROVED` -> `EXPIRED` / `REVOKED`).
- **[T2 Memory Disclosure Matrix](./contracts/T2-MEMORY-DISCLOSURE-MATRIX.md)** — Channel sensitivity and disclosure boundaries.
- **[T3 Active Self Contract](./contracts/T3-ACTIVE-SELF-CONTRACT.md)** & **[Prompt Section Matrix](./contracts/T3-PROMPT-SECTION-MATRIX.md)** — Behavior projection and prompt assembly rules.
- **[T4 Evidence Chain Contract](./contracts/T4-EVIDENCE-CHAIN-CONTRACT.md)** — Citations, grounding, and response gating evaluation.
- **[T5 Experience Event Contract](./contracts/T5-EXPERIENCE-EVENT-CONTRACT.md)** — Outbound event envelopes (voice, avatar, action).
- **[T6 Security Operations Contract](./contracts/T6-SECURITY-OPERATIONS-CONTRACT.md)** — Secret isolation, capabilities, and failure boundaries.
- **[T7 Release Evidence Contract](./contracts/T7-RELEASE-EVIDENCE-CONTRACT.md)** — Release gating criteria and verification.
- **[Neutral Contract Decisions](./contracts/NEUTRAL_CONTRACT_DECISIONS.md)** — Architectural decision log on context neutrality.
- **[Neutral Terminology Glossary](./contracts/NEUTRAL-TERMINOLOGY-GLOSSARY.md)** — Standard terminology dictionary.
- **[Legacy Identifier Migration](./contracts/LEGACY_IDENTIFIER_MIGRATION.md)** — Guide on removing overloaded legacy identifiers.
- **[Blank Slate Contract](./contracts/BLANK_SLATE_CONTRACT.md)** & **[Fixture Guide](./contracts/BLANK-SLATE-FIXTURE-GUIDE.md)** — Invariants for clean-slate initializations.
- **[Forbidden Default Baseline](./contracts/FORBIDDEN-DEFAULT-SCAN-BASELINE.md)** — Safety baseline preventing default relationship assumptions.

