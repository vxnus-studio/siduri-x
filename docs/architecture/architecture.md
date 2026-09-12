# Architecture Overview

> **Status:** Implemented (Clean Architecture, Pure SQLite Foundation)  
> **Topology:** 4 Core Domains (`packages/{core, self, knowledge, memory}`) + 9 Pluggable Peripheral Organs (`packages/organs/{brain, hands, ear, vision, voice, body, observation, mouth, eknowledge}`)

---

## 1. Ontological Architecture

Siduri-X structures artificial companion consciousness into **four fundamental questions**, governed by one gatekeeping authority (Truth Gate) and orchestrated by one cognitive organ (Brain):

```text
                                SIDURI RUNTIME (@siduri-x/core)
                                             │
                 ┌───────────────────────────┼───────────────────────────┐
                 │                           │                           │
               SELF                      KNOWLEDGE                     MEMORY
          (@siduri-x/self)          (@siduri-x/knowledge)        (@siduri-x/memory)
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
   - **Stream A (External Knowledge)**: Cited external lore / docs via `@siduri-x/eknowledge`.
   - **Stream B (Episodic Memory)**: Verified past conversational episodes and claims via `@siduri-x/memory` (FTS5).
   - **Stream C (Self Directives)**: Active identity and behavioral rules from `@siduri-x/self`.
   - **Stream D (Life Context)**: Objective user reality (inventory, expenses, schedules) from `@siduri-x/knowledge`.
3. **Prompt Compilation**: Injects active self rules, neutral framing, and sovereign life context into inference prompts.
4. **Cognition Planning**: `Brain` produces a structured `ResponsePlan` (speech, internal monologue, memory proposals, action intents).
5. **Truth Gate & Gating Evaluation**: Response plans are evaluated against safety and evidence criteria. Candidate claims are quarantined as `PENDING`.
6. **Settlement & Action**: Memory proposals are recorded; action intents are verified by `ActionPolicyEngine` and executed via `Hands`.
7. **Experience Emission & Output**: Speech is synthesized via `Voice` and rendered to the client via `Mouth` (SSE streaming + Live2D visemes).
