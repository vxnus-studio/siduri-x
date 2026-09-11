# Domain Architecture & Interface Contracts: Self, Organs, Knowledge, and Memory

> **Status:** Canonical Clean Specification  
> **Philosophy:** Zero backward compatibility compromises. Pure SQLite (`siduri.sqlite`). Pure architectural boundaries.  
> **Target Subsystems:** `@siduri-x/core`, `@siduri-x/self`, `@siduri-x/knowledge`, `@siduri-x/memory`, `@siduri-x/organs/*`  
> **Related Documents:**  
> - [02. The `.self` Asset Specification & Teach Mode](file:///home/zagin/Projects/vxnus-studio/projects/siduri-x/docs/self-organ-knowledge/02-self-asset-and-teach-mode.md)  
> - [03. Phased Engineering Roadmap](file:///home/zagin/Projects/vxnus-studio/projects/siduri-x/docs/self-organ-knowledge/03-phased-migration-plan.md)  

---

## 1. Ontological Architecture Overview

Siduri-X structures artificial consciousness into **four discrete semantic domains**, governed by one gatekeeping authority and orchestrated by one cognitive organ:

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

All three persistent continuity substrates (`Self`, `Knowledge`, `Memory`) are backed by a single unified local-first database: **`siduri.sqlite`**.

---

## 2. Domain 1: Self (`Who am I?`) — `packages/self`

### 2.1 Definition & Responsibilities
`Self` represents Siduri as an individual agent. It provides personal continuity across conversation sessions, model upgrades, and experiences. Even if episodic memories are compacted or deleted, Siduri remains recognizably Siduri.

`Self` encapsulates:
1. **Identity:** Immutable name, origin, core ethos, and companion archetype.
2. **Personality:** Calibrated multi-dimensional tendencies (warmth, formality, sarcasm, curiosity).
3. **Values & Guardrails:** Ethical baselines and compile-time prompt barriers.
4. **Behavioral Dispositions:** Active compiled directives governing demeanor and expression.
5. **Directional Relationships:** Subjective stance toward specific entities (e.g., *Siduri $\rightarrow$ Kur*).
6. **Active Self Compiler:** Merged from legacy `@siduri-x/behavior`. Projects active traits and winning directives into `<active_self>` prompt tokens.

### 2.2 Interface Contract: `SelfRepository`
```typescript
export interface SelfIdentity {
  companionId: string;
  name: string;
  archetype?: string;
  version: string;
}

export interface PersonalityTraits {
  warmth: number;       // 0.0 - 1.0
  formality: number;    // 0.0 - 1.0
  sarcasm: number;      // 0.0 - 1.0
  verbosity: number;    // 0.0 - 1.0
  curiosity: number;    // 0.0 - 1.0
}

export interface SelfDirective {
  id: string;
  companionId: string;
  priority: number;
  directive: string;
  status: 'ACTIVE' | 'DISABLED' | 'SUPERSEDED';
  category: 'behavioral' | 'guardrail' | 'relational';
  supersedesId?: string;
}

export interface SelfRelationship {
  companionId: string;
  entityId: string;        // e.g. "actor:kur"
  entityType: 'human' | 'companion' | 'system';
  trustScore: number;     // 0.0 - 1.0
  familiarity: number;    // 0.0 - 1.0
  interactionConventions: string[];
}

export interface SelfRepository {
  getIdentity(companionId: string): Promise<SelfIdentity>;
  getPersonality(companionId: string): Promise<PersonalityTraits>;
  getActiveDirectives(companionId: string): Promise<SelfDirective[]>;
  getRelationship(companionId: string, entityId: string): Promise<SelfRelationship | null>;
  
  // Mutations strictly gated by Truth Gate
  commitDirectives(companionId: string, directives: SelfDirective[]): Promise<void>;
  updateRelationship(companionId: string, rel: SelfRelationship): Promise<void>;
}
```

---

## 3. Domain 2: Knowledge (`What do I believe / know?`) — `packages/knowledge`

### 3.1 The Life Database (Internal Sovereign Knowledge)
`@siduri-x/knowledge` is the home of the user's sovereign Life DB, stored in typed relational tables inside `siduri.sqlite`:
* `life_inventory`: Accounts, game rosters (Genshin UIDs, weapons, characters), owned hardware, software subscriptions.
* `life_finance`: Expense logs, recurring bills, monthly budgets (enables exact arithmetic without LLM drift).
* `life_schedule`: Deadlines, routines, focus hours, commitments.
* `life_preferences`: Dietary restrictions, UI settings, aesthetic choices.

```typescript
export interface LifeDatabase {
  getInventory(companionId: string, domain?: string): Promise<LifeInventoryItem[]>;
  getFinanceSummary(companionId: string): Promise<LifeFinanceSummary>;
  getSchedule(companionId: string, windowStart: Date, windowEnd: Date): Promise<LifeScheduleItem[]>;
  getPreferences(companionId: string): Promise<Record<string, string>>;
  queryContext(companionId: string, query: string): Promise<string[]>;
}
```

---

## 4. Domain 3: Memory (`What happened?`) — `packages/memory`

### 4.1 Pure Episodic Experience (SQLite + FTS5)
`@siduri-x/memory` records raw experience and historical interaction turns without conflating them with personality or user accounts.

Backed by SQLite FTS5, it provides sub-millisecond lexical and BM25 relevance search without requiring PostgreSQL:

```typescript
export interface EpisodicMemoryStore {
  recordEvent(companionId: string, event: SourceEvent): Promise<void>;
  searchClaims(companionId: string, query: string, limit?: number): Promise<MemoryClaim[]>;
  proposeClaim(claim: Omit<MemoryClaim, 'id'>): Promise<MemoryClaim>;
  approveClaim(claimId: string): Promise<void>;
}
```

---

## 5. Domain 4: Organs (`What can I do / perceive?`) — `packages/organs/*`

### 5.1 Pluggable Capabilities
Every organ inside `packages/organs/` is an interchangeable peripheral with an `organ-manifest.json`:

```text
packages/organs/
├── brain/         # Cognitive organ: LLM orchestration (OpenRouter, Ollama)
├── ear/           # Sensory organ: Audio perception & intent classification
├── voice/         # Expressive organ: TTS speech synthesis queue
├── mouth/         # Transport organ: SSE, WebSockets, streaming chunks
├── vision/        # Sensory organ: Visual comprehension & OCR
├── hands/         # Action organ: Audited execution of tools & shell
├── body/          # Expressive organ: Live2D / VRM motion & emotion
├── observation/   # Sensory organ: Screen and window frame capture
└── eknowledge/    # External Information organ: E-Knowledge pack client
```

### 5.2 External Knowledge is an Organ (`eknowledge`)
While the user's sovereign Life DB is internal (`packages/knowledge`), searching external knowledge packs (Genshin game lore, API documentation) is handled by the **`eknowledge` organ** via `@vxnus/e-knowledge`. It generates audited citations and evidence records ingested by the Truth Gate.

---

## 6. The Unified SQLite Substrate (`siduri.sqlite`)

```text
┌────────────────────────────────────────────────────────────┐
│                       siduri.sqlite                        │
├──────────────────────────────┬─────────────────────────────┤
│      @siduri-x/self          │    @siduri-x/knowledge      │
│  • self_identity             │  • life_inventory           │
│  • self_personality          │  • life_finance             │
│  • self_directives           │  • life_schedule            │
│  • self_relationships        │  • life_preferences         │
├──────────────────────────────┴─────────────────────────────┤
│                    @siduri-x/memory                        │
│  • memory_events (raw episodic turns)                      │
│  • memory_claims (durable asserted facts)                  │
│  • memory_search (FTS5 BM25 virtual table index)           │
└────────────────────────────────────────────────────────────┘
```

By unifying storage in SQLite WAL mode:
* Backups and portability are a single file copy.
* Transactions across Self, Knowledge, and Memory are ACID atomic.
* In-process queries execute in `< 0.05ms`.
* Zero background daemons, zero network overhead, zero Docker requirements.
