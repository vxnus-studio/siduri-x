# RFC: Removing Memory — Deconstructing the Metaphor into Sovereign Primitives

> **Title:** Removing Memory  
> **Status:** Implemented / Accepted  
> **Target Subsystems:** `@sidurijs/core`, `@sidurijs/self`, `@sidurijs/knowledge`, `@sidurijs/memory` (superseded), `@sidurijs/organs/observation`  
> **Canonical Reference:** [VX-26-13: *What are we calling memory?*](https://vxnus.xyz/article/what-are-we-calling-memory)  
> **Authors:** Kur Zagin & Siduri Architecture Team  

---

## 1. Context & Motivation

### 1.1 The Problem with the Word "Memory"
In AI systems, the word **"memory"** has become a catch-all metaphor borrowed from biological consciousness. When an engineering team says their agent "has long-term memory," it usually means nothing more than an external database that stores text and performs keyword or vector retrieval.

As articulated in [VX-26-13](https://vxnus.xyz/article/what-are-we-calling-memory):
> *"Calling both of these 'memory' isn't obviously wrong. But it does mean the word is stretching across a boundary that, from an engineering standpoint, is enormous — the difference between **'new information is available to be read'** and **'the reader itself is now different.'** I'm not sure a single word should be asked to carry both without at least raising an eyebrow about it."*

When a single concept is tasked with representing:
1. Short-term conversational context,
2. An archive of historical messages,
3. Sovereign user life data (finances, schedules, game accounts),
4. Real-time screen perception, and
5. Enduring persona, identity, and behavioral dispositions,

the architecture inevitably collapses under ontological confusion.

### 1.2 Current Architectural Pathology in Siduri-X
Despite earlier intentions in [`docs/self-organ-knowledge/01-domain-architecture.md`](../self-organ-knowledge/01-domain-architecture.md) to separate domains, the current `@sidurijs/memory` subsystem suffers from severe structural entanglement:

1. **Memory as an Artificial Funnel for Self (`promoteApprovedClaimToSelf`):**  
   In [`packages/core/src/runtime.ts`](../../packages/core/src/runtime.ts), companion identity and relational traits cannot be formed directly. Instead, they are wrapped into a generic `MemoryClaim`, staged in a `memory_claims` table, and then conditionally intercepted and promoted into `SelfRepository`. `Self` (the reader) is subordinated as a downstream derivative of an external database query.
2. **Duplicated Directives:**  
   Behavioral rules and personality constraints are implemented twice: once in `SelfRepository` (`self_directives`) and again as legacy shims in `SqliteMemoryStore` (`proposeDirective()`, `getDirectives()`).
3. **Ontological Flattening:**  
   Objective user reality (e.g. an account UID, a calendar deadline, an active window title) is flattened into semantic strings scored by text search, rather than represented as typed, verifiable state.

### 1.3 Why Remove the Wording: Easier and Expansive Definition
Removing the word **"memory"** is not merely an aesthetic or semantic exercise—**it drastically simplifies and clarifies system definition**.

As long as we keep the word "memory" in the vocabulary, system design gets trapped in ambiguous, circular debates:
- *"Is this long-term memory or short-term memory?"*
- *"Should this fact be chunked, embedded into vectors, or stored in a semantic graph?"*
- *"Does the model 'remember' this if it only gets retrieved when prompted?"*

When we discard the word entirely, we expand our view and ask plain, functional questions about what Siduri actually needs to do:
- **"Siduri needs to remember chat per session."**  
  Immediate conversational coherence during an active interaction. When we talk, Siduri shouldn't forget what was said two turns ago in the active window.
- **"Siduri needs to know my life."**  
  The objective facts of the user's everyday reality: hardware, gaming rosters, finances, schedules, subscriptions, and dietary preferences.
- **"Siduri needs to know what is happening on my screen."**  
  Real-time situational awareness: active window titles, IDE diffs, OCR text, and live visual context.
- **"Siduri needs to stay Siduri."**  
  Her own personality, tone, ethical guardrails, demeanor, and relationship stance toward the user.
- **"Siduri needs to audit past occurrences."**  
  An append-only record of past tool runs, commands, and historical conversation transcripts for debugging or review.

By shedding the word "memory," each of these requirements becomes straightforward to define, architect, and optimize using purpose-built tools instead of trying to shoehorn all of them into an overloaded "memory" database.

---

## 2. The Core Principle: What Does Siduri Actually Need?

Instead of asking *"How should memory work?"*, we ask: **"What concrete capabilities does Siduri require to operate as a sovereign desktop companion?"**

When analyzed by actual operational requirements, Siduri's needs resolve into **five discrete primitives**:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       SIDURI RUNTIME                                        │
└──────┬──────────────────────┬──────────────────────┬───────────────────┬────────────────────┘
       │                      │                      │                   │                    │
       ▼                      ▼                      ▼                   ▼                    ▼
 1. THE READER          2. USER LIFE           3. SITUATION        4. DIALOGUE          5. AUDIT
     (Self)              (Knowledge)           (Observation)        (Session)           (Archive)
"Who am I?"          "What is user's life?" "What is happening?" "What was said?"   "What happened?"
───────────────────────────────────────────────────────────────────────────────────────────────
• Identity            • Inventory & hardware • Active window     • Working context   • Append-only log
• Demeanor & traits   • Schedule & calendar  • Screen capture    • Turn sliding-win  • Audited events
• Directives & rules  • Financial ledgers    • Audio/OCR frame   • Ephemeral buffer  • BM25 search
• Relationships/trust • Preferences & tasks  • Perceptual diffs  • In-memory scratch • Cold storage
```

---

## 3. The Five Sovereign Primitives

### Primitive 1: Standing Disposition & Identity (`@sidurijs/self`)
* **Role:** Defines **the reader itself**.
* **Questions Answered:** *Who am I? How do I speak? How do I treat Kur versus a guest? What boundaries must I respect?*
* **Constituents:**
  - `SelfIdentity`: Name, archetype, origin, ethos.
  - `PersonalityTraits`: Calibrated dimensions (warmth, formality, sarcasm, curiosity).
  - `SelfDirectives`: Active behavioral constraints and rules governing demeanor.
  - `SelfRelationships`: Trust scores, stance, and interaction conventions per entity.
* **Storage & Compilation:** Stored in `self_*` relational tables; compiled directly into the `<active_self>` system prompt.
* **Key Invariant:** Does **not** require retrieval or search. It is the standing posture of the companion.

### Primitive 2: Sovereign Life State (`@sidurijs/knowledge`)
* **Role:** The user's external, objective reality.
* **Questions Answered:** *What devices does Kur own? What is Kur's schedule today? What are Kur's financial commitments?*
* **Constituents:**
  - `life_entities`: Hardware, accounts, game rosters, subscriptions.
  - `life_events`: Metrics, financial expenses, time-series telemetry.
  - `life_tasks`: Backlog, priorities, deadlines.
  - `life_schedule`: Calendar items, recurring events, focus hours.
  - `life_preferences`: Dietary choices, UI settings, declared preferences.
* **Storage:** Typed, deterministic SQLite tables in `siduri.sqlite`.
* **Key Invariant:** Owned sovereignly by the human user. Zero semantic fuzziness or vector drift for deterministic facts.

### Primitive 3: Situational Awareness & Perception (`packages/organs/observation`)
* **Role:** Real-time environmental sensing.
* **Questions Answered:** *What window is focused? What code is on screen? What audio was just heard?*
* **Constituents:**
  - Screen capture & OCR readings.
  - Window manager focus tracking.
  - Perceptual diff digests.
* **Storage:** Ephemeral ring buffers with strict TTL expiration (seconds to minutes).
* **Key Invariant:** Never stored as durable history unless an explicit trigger or user action promotes it into an event.

### Primitive 4: Dialogue Continuity (`SessionBuffer` / Session Context)
* **Role:** Working conversation scratchpad.
* **Questions Answered:** *What did we discuss three turns ago in this active chat?*
* **Constituents:**
  - Recent message history.
  - Immediate unresolved conversational goals.
* **Storage:** In-memory sliding window or session-scoped transient table.
* **Key Invariant:** Cleared or sealed upon session completion. Does not undergo truth-gating or long-term indexing.

### Primitive 5: Audited Interaction Archive (`@sidurijs/archive` / Ledger)
* **Role:** Permanent, cold, append-only history.
* **Questions Answered:** *What exact command was executed on July 14th? What conversation took place last month?*
* **Constituents:**
  - Source events (raw immutable input payloads).
  - Audited tool execution receipts.
  - Cold chat turn transcripts.
* **Storage:** SQLite with WAL mode + FTS5 full-text indexing (`archive_events`, `archive_search`).
* **Key Invariant:** External queryable record. Does not represent consciousness or standing capacity; it is an index of past events retrieved only when explicitly queried.

---

## 4. Deconstruction & Migration Strategy

### 4.1 Dismantling `@sidurijs/memory`
1. **Retire the Term "Memory":**
   - `@sidurijs/memory` package is renamed or replaced by `@sidurijs/archive` (or `EpisodicLedger`).
   - Remove `MemoryOrgan` from `@sidurijs/core`. Split its contract into `ArchiveStore` and `DialogueHistory`.
2. **Purge Directives from Storage/Archive:**
   - Remove `proposeDirective()`, `getDirectives()`, `commitDirective()` from the archive store.
   - All behavioral rules and directives belong exclusively to `SelfRepository` in `@sidurijs/self`.
3. **Eliminate the Indirect Funnel (`promoteApprovedClaimToSelf`):**
   - When a user explicitly teaches Siduri a behavioral rule (e.g. *"Be more concise"*), it is directly committed to `SelfRepository.commitDirectives()`.
   - When a user states an objective fact (e.g. *"My Genshin UID is 7001234"*), it is directly committed to `LifeDatabase.saveEntity()`.
   - No intermediary `MemoryClaim` or staged conversion layer is used.

### 4.2 Before vs. After Topology

#### Before (The Muddled Memory Funnel)
```text
User Input ──► MemorySettler ──► MemoryClaim (PENDING in memory_claims)
                                        │
                                        ▼ (approveClaim)
                           ┌────────────┴────────────┐
                           ▼                         ▼
                 promoteApprovedClaimToSelf    promoteApprovedClaimToKnowledge
                           │                         │
                           ▼                         ▼
                     SelfRepository             LifeDatabase
```

#### After (Direct Domain Routing)
```text
User Input ──► InteractionRouter / Classifier
                     │
                     ├─► Behavioral rule ──────► SelfRepository (Direct disposition update)
                     ├─► Life fact / entity ───► LifeDatabase (Direct relational update)
                     ├─► Active dialogue ──────► SessionBuffer (Immediate working context)
                     └─► Audit trail ──────────► ArchiveLedger (Append-only cold log)
```

---

## 5. Architectural Benefits

1. **Zero Metaphor Overhead:** Systems engineers and users interact with clear primitives: *Self* (personality), *Life DB* (user facts), *Session* (chat window), and *Archive* (event log).
2. **Performance & Reliability:** Eliminates the two-step staging pipeline (`MemoryClaim` $\rightarrow$ promotion), removing race conditions and multi-table synchronization lag.
3. **Decoupled Evolution:** Modifications to the persona engine (`Self`) no longer risk breaking the event log or search indices.
4. **Philosophical Alignment:** The code matches reality: bytes in a database are recognized as storage and retrieval; the system prompt and weights are recognized as the reader.
