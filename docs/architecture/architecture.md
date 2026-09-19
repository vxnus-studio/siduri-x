# Architecture Overview

> **Status:** Implemented (Clean Architecture, Pure SQLite Foundation)  
> **Topology:** 4 Core Domains (`packages/{core, self, knowledge, memory}`) + 8 Pluggable Peripheral Organs (`packages/organs/{brain, hands, ear, vision, voice, body, observation, mouth}`)

---

## 1. Ontological Architecture

Siduri-X structures artificial companion consciousness into **four fundamental questions**, governed by one gatekeeping authority (Truth Gate) and orchestrated by one cognitive organ (Brain):

```text
                                SIDURI RUNTIME (@sidurijs/core)
                                             │
                 ┌───────────────────────────┼───────────────────────────┐
                 │                           │                           │
               SELF                      KNOWLEDGE                     MEMORY
          (@sidurijs/self)          (@sidurijs/knowledge)        (@sidurijs/memory)
          [ Who am I? ]             [ What do I know? ]          [ What happened? ]
                 │                           │                           │
                 └───────────────────────────┼───────────────────────────┘
                                             │
                                             ▼
                                COGNITIVE ORGAN: BRAIN
                                             │
                 ┌───────────────────────────┼───────────────────────────┐
                 │                           │                           │
               VOICE                       HANDS                       VISION / ...
                     (Sensory & Physical Organs: What can I do?)
```

All three persistent continuity substrates (`Self`, `Knowledge`, `Memory`) are backed by a single unified local-first database: **`siduri.sqlite`** (SQLite WAL mode + FTS5 full-text indexing).

---

## 2. Execution Flow

1. **Perception**: Sensory input (audio via `Ear`, text via `/chat`, or frames via `Observation`) is ingested and normalized.
2. **Context Retrieval (4 Streams in Parallel)**:
   - **Stream A (External Knowledge)**: Cited external lore / docs via `@sidurijs/knowledge` (`EKnowledgeAdapter`).
   - **Stream B (Episodic Memory)**: Verified past conversational episodes and claims via `@sidurijs/memory` (FTS5).
   - **Stream C (Self Directives)**: Active identity and behavioral rules from `@sidurijs/self`.
   - **Stream D (Life Context)**: Objective user reality (inventory, expenses, schedules) from `@sidurijs/knowledge`.
3. **Prompt Compilation**: Injects active self rules, neutral framing, and sovereign life context into inference prompts.
4. **Cognition Planning**: `Brain` produces a structured `ResponsePlan` (speech, internal monologue, memory proposals, action intents).
5. **Truth Gate & Gating Evaluation**: Response plans are evaluated against safety and evidence criteria. Candidate claims are quarantined as `PENDING`.
6. **Settlement & Action**: Memory proposals are recorded; action intents are verified by `ActionPolicyEngine` and executed via `Hands`.
7. **Experience Emission & Output**: Speech is synthesized via `Voice` and rendered to the client via `Mouth` (SSE streaming + Live2D visemes).
