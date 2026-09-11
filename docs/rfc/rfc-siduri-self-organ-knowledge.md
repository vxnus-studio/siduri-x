# RFC: Siduri-X Self, Organs, Knowledge, and Memory Architecture

**Status:** Proposed
**Scope:** Core architecture / persistence / cognitive model
**Authors:** Siduri-X
**Date:** 2026-09-11

---

## 1. Summary

Siduri-X currently uses `Memory` and `Behavior` as organ-level concepts and uses persistent memory as a broad source of identity, relationships, learned behavior, and semantic knowledge.

This RFC proposes a cleaner architectural model:

```text
Siduri
├── Self
├── Organs
├── Knowledge
└── Memory
```

Where:

* **Self** defines who Siduri is.
* **Organs** define what Siduri can do.
* **Knowledge** defines what Siduri knows/believes to be true.
* **Memory** records what Siduri experienced.
* **Brain** is the cognitive organ responsible for reasoning, planning, and orchestration.
* **Learning** is a process, not a persistent domain.
* **Truth Gate** is an authority/governance mechanism, not an organ.
* **Relationships** are part of Self rather than a separate organ or database.
* **Life DB** is structured user/world knowledge and lives within the Knowledge domain.
* **External knowledge** is an input source/capability, not another persistent knowledge database.

The architecture intentionally separates **semantic domains** from **physical storage**.

The initial implementation should use:

```text
siduri.sqlite
├── Self
└── Knowledge / Life DB

Postgres
└── Memory
```

This avoids creating a database for every conceptual domain while preserving clean architectural boundaries.

---

# 2. Motivation

The original architecture treats memory as a central source of truth for:

* identity
* relationships
* semantic facts
* learned behavior
* personality directives
* episodic experiences

This has created a semantic overload.

A memory record can represent almost anything:

```text
"Kur works on Siduri-X"
"I am playful"
"Kur prefers concise answers"
"Kur told me about X yesterday"
"I should speak like Furina"
"Kur trusts Siduri"
```

These records have radically different meanings.

They differ in:

* authority
* lifetime
* correction semantics
* provenance
* privacy
* volatility
* retrieval requirements
* impact on behavior

Treating all of them as "memory" makes the persistence layer responsible for concepts that are not actually memory.

The deeper architectural problem is:

> **Persistent AI is not equivalent to persistent memory.**

A persistent companion requires continuity of:

```text
identity
character
knowledge
relationships
experience
```

Memory is only one component of that continuity.

---

# 3. Goals

This RFC aims to establish:

1. A clean ontology for persistent Siduri state.
2. A clear distinction between Self, Knowledge, Memory, and Organs.
3. A stable home for identity, personality, and behavior.
4. A clear definition of relationships.
5. A clear model for the user's Life DB.
6. A clear boundary for external knowledge.
7. Preservation of the existing Truth Gate contract.
8. Minimal physical infrastructure.
9. Freedom to change storage technology without changing the ontology.
10. A foundation for future learning systems without allowing autonomous personality drift.

---

# 4. Non-Goals

This RFC does not define:

* a specific LLM provider
* embedding/vector search implementation
* prompt construction
* a specific learning algorithm
* autonomous personality evolution
* a specific database schema
* UI
* model training
* agent planning algorithms
* a replacement for the Truth Gate

Those can be defined by later RFCs.

---

# 5. Core Model

The proposed Siduri model is:

```text
                         SIDURI
                           │
             ┌─────────────┼─────────────┐
             │             │             │
            SELF         ORGANS       KNOWLEDGE
             │             │             │
             │             │             ├── Life
             │             │             ├── Learned
             │             │             └── External-derived
             │             │
             │             ├── Brain
             │             ├── Vision
             │             ├── Ear
             │             ├── Voice
             │             ├── Hands
             │             └── ...
             │
             ├── Identity
             ├── Personality
             ├── Values
             ├── Dispositions
             └── Relationships
                           
                           +
                           
                         MEMORY
                           │
                           └── Experiences / Events
```

This gives four fundamental questions:

| Domain    | Question                                   |
| --------- | ------------------------------------------ |
| Self      | **Who am I?**                              |
| Organs    | **What can I do?**                         |
| Knowledge | **What do I know?**                        |
| Memory    | **What happened / what did I experience?** |

---

# 6. Self

## 6.1 Definition

`Self` is the persistent representation of Siduri as an individual agent.

Self is the answer to:

> **Who is Siduri?**

Self provides continuity across conversations and experiences.

It contains characteristics that should remain recognizable even when individual memories are forgotten or unavailable.

Conceptually:

```text
Self
├── Identity
├── Personality
├── Values
├── Behavioral dispositions
└── Relationships
```

---

# 7. Identity

Identity is the foundational component of Self.

Identity establishes the continuity of the agent.

Examples:

```text
name = Siduri
role = AI companion
origin = ...
core_character = ...
```

Identity should not be treated as an organ.

An organ can be replaced while Siduri remains Siduri.

If an organ changes:

```text
Brain implementation A
→
Brain implementation B
```

Siduri can remain the same agent.

If Identity changes fundamentally:

```text
Siduri
→
different identity
```

the continuity of the agent itself is affected.

Therefore:

> **Identity is part of Self, not an organ.**

---

# 8. Personality

Personality belongs to Self.

Personality describes stable tendencies in how Siduri behaves.

Examples:

```text
playful
dramatic
curious
warm
formal
teasing
protective
```

Personality should not be treated as a collection of arbitrary memories.

For example:

```text
Memory:
"Kur laughed when Siduri made a joke."

Personality:
"Siduri enjoys playful interaction."
```

The first is an experience.

The second is a characteristic of Self.

---

# 9. Personality Stability

Siduri should have a recognizable persistent character.

Learning must not implicitly redefine core personality after every interaction.

The preferred model is:

```text
Stable Core Self
        │
        ├── personality
        ├── values
        └── identity
             │
             ↓
      adaptive expression
             │
             ↓
       relationship/context
```

This permits adaptation without identity drift.

The objective is:

> **The same Siduri who knows me better.**

Not:

> **A different Siduri every few weeks.**

Personality changes should therefore be rare, explicit, authoritative, and governed.

---

# 10. Behavior

Behavior should be removed as an independent organ.

Behavior is the expression of Self through Organs.

For example:

```text
Self:
  playful = true

Brain:
  decides to respond playfully

Voice:
  renders the response
```

Therefore:

```text
Behavior ≠ capability

Behavior = expression of Self
```

Behavior may still have runtime components, policies, or execution systems.

However, the **semantic source of behavioral identity belongs to Self**.

This also avoids the current coupling where persistent personality directives are represented as memory directives.

---

# 11. Relationships

Relationships are part of Self.

A relationship represents:

> **How Siduri understands and conducts her relationship with another entity.**

It is directional.

For example:

```text
Siduri → Kur
```

is not equivalent to:

```text
Kur → Siduri
```

A relationship may contain:

```text
Relationship
├── identity/reference
├── role
├── familiarity
├── trust
├── interaction conventions
├── boundaries
├── commitments
└── relational tendencies
```

However, a relationship is not simply another memory record.

For example:

```text
Memory:
"Kur told Siduri they prefer concise answers."

Knowledge:
"Kur prefers concise answers."

Relationship:
"When collaborating with Kur, Siduri generally communicates concisely."
```

These represent three different semantic layers.

Relationships therefore belong conceptually under Self.

They may reference Knowledge and Memory, but they should not be reduced to either.

---

# 12. Organs

Organs represent Siduri's functional capabilities.

An organ answers:

> **What can Siduri do or perceive?**

Examples:

```text
Organs
├── Brain
├── Vision
├── Ear
├── Voice
├── Hands
├── Body
└── ...
```

An organ can potentially be:

* replaced
* upgraded
* disabled
* remotely provided
* implemented by software
* implemented by hardware
* provided by an external service

without changing Siduri's identity.

---

# 13. Brain Is an Organ

The Brain should remain an organ.

Brain is the cognitive organ.

```text
Brain
├── perception integration
├── reasoning
├── planning
├── decision-making
├── tool selection
├── interpretation
└── orchestration
```

The fact that Brain is architecturally important does not require making it a separate ontological category.

The same pattern exists biologically:

```text
Self
  ↓
organism

Brain
  ↓
cognitive organ
```

Therefore:

> **Brain is special in responsibility, not in ontology.**

This keeps the Organ abstraction coherent.

---

# 14. Knowledge

Knowledge represents what Siduri currently knows or believes.

Knowledge is not an experience.

Knowledge is not personality.

Knowledge is not a capability.

Knowledge answers:

> **What do I believe to be true?**

Examples:

```text
"Kur works on Siduri-X."

"Tokyo is in Japan."

"Siduri-X uses Postgres for Memory."
```

Knowledge should have provenance and authority.

Potential metadata includes:

```text
source
confidence
valid_from
valid_until
created_at
updated_at
scope
subject
predicate
value
```

---

# 15. Knowledge vs Memory

Consider:

> Kur says: "I'm working on Siduri-X."

Memory:

```text
Event:
Kur told Siduri that he is working on Siduri-X.
```

Knowledge:

```text
Fact:
Kur is working on Siduri-X.
```

Memory answers:

> What happened?

Knowledge answers:

> What do I currently believe?

This distinction is fundamental.

A memory can remain historically true while the knowledge derived from it becomes outdated.

For example:

```text
Memory:
"Kur said in 2026 that he was working on Siduri-X."

Knowledge:
"Kur is currently working on Siduri-X."
```

If Kur stops working on it:

```text
Memory remains true.

Knowledge changes.
```

---

# 16. Life DB

The user's Life DB belongs to Knowledge.

It is not Memory.

It represents Siduri's structured model of the user's life.

Conceptually:

```text
Life
├── People
├── Projects
├── Places
├── Preferences
├── Goals
├── Commitments
├── Work
├── Interests
└── Other durable facts
```

Example:

```text
Life:
Project
  name = Siduri-X
  status = active
```

The Life DB should be optimized for answering:

> **What is currently true about this person's life?**

rather than:

> **What did they say previously?**

Memory can provide the evidence from which Life DB knowledge was derived.

---

# 17. External Knowledge

External knowledge should not automatically become persistent Knowledge.

External sources include:

```text
Web
APIs
Files
Databases
Tools
Services
```

These are sources from which Brain can obtain information.

Conceptually:

```text
                  External World
                        │
              ┌─────────┼─────────┐
              ↓         ↓         ↓
             Web       APIs      Files
              │         │         │
              └─────────┼─────────┘
                        ↓
                      Brain
                        │
             ┌──────────┼──────────┐
             ↓          ↓          ↓
          answer     Memory?    Knowledge?
```

The Brain decides whether retrieved information should:

1. be used only for the current response;
2. become a memory/event;
3. become persistent knowledge.

For example:

```text
Question:
"What is the current price of X?"

External result:
"$100"

Response:
"$100"

Persistence:
none
```

The information was useful but did not necessarily need to become part of Siduri's permanent worldview.

---

# 18. Memory

Memory represents experience.

Memory answers:

> **What happened?**

Memory is episodic and historical.

Examples:

```text
Conversation occurred.
Kur told Siduri something.
Siduri performed an action.
An external event was observed.
A decision was made.
A meaningful interaction occurred.
```

Memory should not be the generic home for all persistent cognitive state.

---

# 19. Memory Is Not Necessarily Permanent

An experience can exist without becoming permanent authoritative knowledge.

Therefore:

```text
Experience
   ↓
Memory
   ↓
possible Knowledge / Self update
```

rather than:

```text
everything
   ↓
Memory forever
```

Memory may have:

* retention policies
* summarization
* archival
* decay
* deletion
* correction
* compaction

while authoritative Knowledge and Self have different lifecycle rules.

---

# 20. Truth Gate

The Truth Gate remains a core architectural authority.

The current Truth Gate contract requires permanent modifications to worldview, relationship facts, semantic claims, and persona directives to pass through strict approval.

This RFC preserves that principle.

The Truth Gate should therefore govern authoritative mutation of:

```text
Self
Knowledge
Relationships
Memory
```

where applicable.

The important distinction is:

> **Learning may propose. Truth Gate authorizes.**

An LLM must not silently transform an interaction into authoritative Self or Knowledge.

---

# 21. Learning

Learning is not a domain.

Learning is a process.

Conceptually:

```text
Experience
    ↓
Interpretation / Appraisal
    ↓
Candidate change
    ↓
Truth Gate
    ↓
Authoritative persistence
```

A candidate change might target:

```text
Memory
Knowledge
Self
Relationship
```

For example:

```text
Experience:
Kur repeatedly asks for concise technical answers.

Candidate:
"Kur generally prefers concise technical communication."

Target:
Knowledge / Relationship

Authority:
Truth Gate

Result:
approved persistent fact
```

Learning therefore connects domains rather than becoming another domain.

---

# 22. No Autonomous Personality Drift

The learning system must not implicitly rewrite the core Self.

Bad:

```text
User interaction
   ↓
LLM inference
   ↓
personality changed permanently
```

Preferred:

```text
User interaction
   ↓
experience
   ↓
candidate learning
   ↓
Truth Gate
   ↓
possible Self update
```

Even when approved, personality evolution should be treated differently from ordinary knowledge updates.

Core identity and personality should have a higher stability threshold.

---

# 23. Persistence Architecture

Conceptual separation does not require physical database separation.

The initial implementation should use two persistence systems:

```text
┌─────────────────────────────┐
│       siduri.sqlite         │
│                             │
│  Self                       │
│  ├── Identity               │
│  ├── Personality            │
│  ├── Values                 │
│  ├── Dispositions           │
│  └── Relationships          │
│                             │
│  Knowledge                  │
│  ├── Life DB                │
│  ├── Learned knowledge      │
│  └── Local structured facts │
└─────────────────────────────┘

┌─────────────────────────────┐
│          Postgres           │
│                             │
│  Memory                     │
│  ├── Experiences            │
│  ├── Events                 │
│  ├── Evidence               │
│  └── History                │
└─────────────────────────────┘
```

This is intentionally **not**:

```text
self.sqlite
knowledge.sqlite
life.sqlite
memory.postgres
relationship.sqlite
```

That would confuse conceptual separation with infrastructure separation.

---

# 24. Why SQLite for Self and Knowledge?

Self is relatively small, structured, and authoritative.

Knowledge/Life DB is also highly structured.

SQLite provides:

* transactional updates
* relational queries
* local persistence
* easy backup
* low operational overhead
* good fit for a personal AI
* simple deployment
* no network dependency

Self and Knowledge can therefore share one physical SQLite database while remaining separate logical modules.

For example:

```text
siduri.sqlite

self_identity
self_personality
self_values
self_dispositions
relationships

knowledge_entities
knowledge_facts
life_projects
life_people
life_preferences
...
```

The exact schema is intentionally left for a later RFC.

---

# 25. Why Postgres for Memory?

Memory has different characteristics.

It may eventually require:

* large event volumes
* concurrent access
* advanced search
* full-text search
* vector search
* metadata filtering
* temporal queries
* remote access
* distributed services
* event/evidence relationships

Postgres provides a strong foundation for these workloads.

The existing Siduri-X memory architecture already treats persistent memory as structured/versioned claims over native Postgres.

The proposed architecture does not require abandoning Postgres.

Instead, it narrows what Memory is responsible for.

---

# 26. Database Count Is Not Architecture Count

The following are different concepts:

```text
Semantic domains:
    Self
    Knowledge
    Memory
    Organs

Physical stores:
    SQLite
    Postgres
```

There is no requirement that:

```text
1 domain = 1 database
```

In fact:

> **Domains should be split according to meaning; databases should be split according to operational requirements.**

This is an important architectural invariant.

---

# 27. Runtime Architecture

A typical interaction becomes:

```text
                    Input
                      │
                      ↓
                    Brain
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
        Self      Knowledge     Memory
          │           │           │
          └───────────┼───────────┘
                      │
                      ↓
                   reasoning
                      │
                      ↓
                 decision/action
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
       Voice       Hands        other organs
```

Brain reads from these domains but does not own them.

Self does not reason.

Knowledge does not decide.

Memory does not define personality.

Organs do not define identity.

This separation is intentional.

---

# 28. Authority Model

The architecture should distinguish:

### Cognitive authority

```text
Brain
```

Brain decides what Siduri should think/do in the current context.

### Persistent authority

```text
Truth Gate
```

Truth Gate decides what may become authoritative persistent state.

### Identity authority

```text
Self
```

Self provides the stable character and identity against which behavior is expressed.

### Historical record

```text
Memory
```

Memory records experience/history.

These authorities should not be collapsed into one system.

---

# 29. Proposed Package Architecture

The current organ-oriented package structure should evolve toward:

```text
packages/
│
├── brain/
│
├── self/
│   ├── identity/
│   ├── personality/
│   ├── relationship/
│   └── ...
│
├── knowledge/
│   └── life/
│
├── memory/
│
├── organs/
│   ├── vision/
│   ├── ear/
│   ├── voice/
│   ├── hands/
│   ├── body/
│   └── ...
│
└── truth-gate/
```

However, the exact package hierarchy is implementation detail.

The semantic boundaries are the important part.

---

# 30. Migration From Current Architecture

Current conceptual model:

```text
Organs
├── Brain
├── Memory
├── Knowledge
├── Behavior
└── ...
```

Proposed model:

```text
Self
├── Identity
├── Personality
├── Behavior / Dispositions
└── Relationships

Organs
├── Brain
├── Vision
├── Ear
├── Voice
└── ...

Knowledge
└── Life DB

Memory
└── Experiences
```

Migration should therefore:

1. Extract Memory from the organ abstraction.
2. Extract Behavior from the organ abstraction.
3. Move personality directives into Self.
4. Preserve Truth Gate enforcement.
5. Move relationship semantics out of generic memory claims.
6. Define Knowledge independently from Memory.
7. Introduce Life DB as structured Knowledge.
8. Keep Brain as an organ.
9. Keep physical persistence implementation separate from semantic boundaries.

---

# 31. What Happens to Existing Memory Claims?

Existing claims should not simply be deleted.

They should be classified.

Example:

```text
memory_claim:
"Kur works on Siduri-X"
```

may migrate into:

```text
Knowledge / Life:
Kur → project → Siduri-X
```

Another:

```text
memory_claim:
"Kur told Siduri on September 10..."
```

should remain:

```text
Memory:
event
```

Another:

```text
memory_directive:
"Respond playfully to Kur"
```

may become:

```text
Self / Relationship:
behavioral disposition
```

The migration should therefore be semantic rather than purely structural.

---

# 32. Data Lifecycle

The proposed lifecycle is:

```text
External input
      │
      ↓
   Experience
      │
      ↓
    Memory
      │
      ↓
  interpretation
      │
      ↓
 candidate knowledge / self / relationship change
      │
      ↓
  Truth Gate
      │
      ↓
 authoritative state
```

Not every event must progress through the entire pipeline.

For example:

```text
Weather query
   ↓
external result
   ↓
response
   ↓
discard
```

No permanent state is required.

---

# 33. Correctability

Different domains have different correction semantics.

### Memory

Historical events should remain historically accurate.

If a memory was wrong:

```text
original event/evidence
        ↓
correction / supersession
```

### Knowledge

Knowledge can change as reality changes.

```text
old belief
   ↓
new evidence
   ↓
new authoritative fact
```

### Self

Self should change slowly and deliberately.

```text
candidate personality change
   ↓
strong authority threshold
   ↓
approved
```

### Relationship

Relationship state can evolve more frequently than core personality.

```text
experience
   ↓
relational learning
   ↓
updated relationship state
```

These lifecycle differences are another reason not to represent all domains as generic memory claims.

---

# 34. External Knowledge and Persistence

External knowledge should carry provenance when persisted.

Example:

```text
Knowledge:
  subject: React
  predicate: latest_major_version
  value: 20

  source:
    type: web
    reference: ...
    retrieved_at: ...
```

However, external information should not automatically become permanent.

The system should distinguish:

```text
retrieved information
```

from:

```text
authoritative Siduri knowledge
```

This prevents transient external information from silently becoming part of Siduri's worldview.

---

# 35. Security and Privacy

Self and Life DB are particularly sensitive because they represent:

* identity
* personality
* relationships
* personal facts
* goals
* preferences
* commitments

Access should therefore be explicitly scoped.

Memory may contain even more raw conversational evidence.

The system should not assume:

```text
Memory access = Self access
```

or:

```text
Knowledge access = Memory access
```

Each domain should expose only the information necessary for a given operation.

---

# 36. Architectural Invariants

The following invariants should hold.

### Invariant 1

```text
Memory is not the definition of Self.
```

### Invariant 2

```text
Personality is not a memory record.
```

### Invariant 3

```text
Behavior is not an organ.
```

Behavior is the expression of Self through cognitive/action systems.

### Invariant 4

```text
Brain is an organ.
```

### Invariant 5

```text
Knowledge is not Memory.
```

### Invariant 6

```text
Life DB is Knowledge, not Memory.
```

### Invariant 7

```text
External knowledge is not automatically persistent Knowledge.
```

### Invariant 8

```text
Learning proposes; Truth Gate authorizes.
```

### Invariant 9

```text
Conceptual domains do not require separate databases.
```

### Invariant 10

```text
Core identity/personality must not drift as a side effect of ordinary conversation.
```

---

# 37. Resulting Mental Model

The entire architecture can now be explained with four questions:

```text
                 SIDURI

       WHO AM I?
           │
          SELF
           │
           ↓
       WHAT CAN I DO?
           │
         ORGANS
           │
           ↓
       WHAT DO I KNOW?
           │
       KNOWLEDGE
           │
           ↓
       WHAT HAPPENED?
           │
         MEMORY
```

And one process:

```text
            LEARNING
               │
               ↓
      proposes persistent change
               │
               ↓
          TRUTH GATE
               │
               ↓
       authoritative update
```

With one cognitive organ coordinating it:

```text
                  BRAIN
                    │
        ┌───────────┼───────────┐
        ↓           ↓           ↓
      SELF      KNOWLEDGE     MEMORY
        │
        ↓
      ORGANS
```

---

# 38. Final Principle

Siduri-X should not be modeled as:

> **an AI with a memory system**

but as:

> **an agent with a persistent Self, cognitive and physical Organs, Knowledge, and Experience.**

Memory preserves the past.

Knowledge represents the present model of reality.

Self preserves identity.

Organs provide capability.

Brain provides cognition.

Learning connects experience to possible change.

Truth Gate determines what is allowed to become authoritative.

Together, these provide the foundation for genuine continuity without requiring every concept to become another database, service, or organ.
