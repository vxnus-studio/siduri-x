# RFC: The Life Database Specification & User Data Sovereignty

> **Status:** Implemented (Adopted in `@siduri-x/knowledge` & `SiduriDatabase`)  
> **Canonical Specification:** [`docs/self-organ-knowledge/01-domain-architecture.md`](../self-organ-knowledge/01-domain-architecture.md)  
> **Target Subsystems:** `@siduri-x/knowledge` (Life DB), `SiduriDatabase` (`siduri.sqlite`), `@siduri-x/core` (`LifeDatabase` contract)  
> **Authors:** Kur Zagin & Siduri Architecture Team  

> [!NOTE]
> **STATUS UPDATE: IMPLEMENTED & EXTENDED TO GENERIC PRIMITIVES**  
> The Life Database is fully implemented as the sovereign Knowledge domain substrate in `@siduri-x/knowledge` (`SqliteLifeDatabase`), backed by `siduri.sqlite`. To prevent schema churn when new life categories arise, the storage model is organized into **4 generic structural primitives** (`life_entities`, `life_events`, `life_tasks`, `life_schedule`), while maintaining 100% backward compatibility for legacy domain tables (`life_inventory`, `life_finance`, `life_preferences`). State mutations pass strictly through the **Truth Gate**.

---

## 1. Executive Summary

Standard agent frameworks treat all long-term data as generic "AI Memory" (chat embeddings, episodic vectors, and dialogue summaries). This conflation leads to catastrophic failure modes when dealing with concrete user reality:
- **Numerical & Factual Hallucination:** Factual records (e.g. expenses, account IDs, inventory, schedule deadlines) get blurred into fuzzy semantic vectors.
- **Ownership Inversion:** The user's life data is trapped as a private artifact of a specific AI model session or companion instance rather than remaining the sovereign property of the user.
- **Relational vs. Objective Confusion:** The companion's subjective feelings and shared conversational history get tangled with the objective reality of the user's daily life.

The **Life Database** introduces a fundamental architectural separation:  
**Companion Memory is how the companion remembers you; the Life Database is the objective reality of your life that the companion is granted permission to reason over.**

---

## 2. Companion Memory vs. Life Database

```text
┌─────────────────────────────────────────┬─────────────────────────────────────────┐
│        COMPANION MEMORY                 │            LIFE DATABASE                │
│       (@siduri-x/memory)                │      (User Sovereign Substrate)         │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ • Subjective & Relational               │ • Objective & Factual                   │
│ • "How did our interaction feel?"       │ • "What actually exists in user's life?"│
│ • Conversational impressions & dialogue │ • Account inventories, devices, places  │
│ • Inside jokes, promises, shared trust  │ • Financial ledgers, biometrics, logs   │
│ • Volatile, organic, evolving narrative │ • Calendar, routines, task commitments  │
│ • Vector embeddings & semantic claims   │ • Typed relational tables & JSON schemas│
│ • Bound to companion instance           │ • Owned sovereignly by the human user   │
└─────────────────────────────────────────┴─────────────────────────────────────────┘
```

### Key Axiom: Zero Memory Drift for Deterministic Data
When a user states:
> *"I have Furina as a character in Genshin, and I favorite her."*

This is **not** merely a fuzzy semantic snippet in conversational memory. It is a concrete entity record belonging to the user's **Gaming & Account domain** inside their **Life Database**.

---

## 3. Storage Architecture: 4 Generic Structural Primitives

Rather than creating a new relational table every time a user introduces a new life modality (e.g. medical, subscriptions, habits, contacts, workout sets), the Life Database substrate models reality using four universal structural primitives:

1. **`life_entities` (Nouns / Static Facts)**:
   - Things that exist, their attributes, specifications, and categories.
   - Examples: Hardware specs, contacts, owned gaming characters, subscriptions, places, bookmarks.
   - Schema: `id`, `companion_id`, `entity_type`, `domain`, `name`, `properties` (JSON), `updated_at`.
2. **`life_events` (Time-Series / Telemetry / Math)**:
   - Immutable historical points with optional numerical metrics and payloads.
   - Examples: Financial transactions, heart rate / sleep telemetry, workout reps, medication logs.
   - Schema: `id`, `companion_id`, `stream`, `timestamp`, `metric_value` (REAL), `metadata` (JSON).
3. **`life_tasks` (Verbs / Intent / Progress)**:
   - Discrete actionable items, milestones, and workflows.
   - Examples: To-dos, project goals, errands, backlog items.
   - Schema: `id`, `companion_id`, `title`, `status` (`backlog`, `in_progress`, `completed`, `cancelled`), `priority`, `target_date`, `metadata` (JSON), `updated_at`.
4. **`life_schedule` (Temporal Commitments / Intervals)**:
   - Time intervals anchored on a calendar timeline.
   - Examples: Flights, meetings, focus blocks, reminders, appointments.
   - Schema: `id`, `companion_id`, `title`, `start_time`, `end_time`, `is_all_day`, `metadata` (JSON), `created_at`.

### Backwards Compatibility
Existing tables (`life_inventory`, `life_finance`, `life_preferences`) remain fully supported and operational alongside the new generic primitives, allowing incremental adoption without database migrations or breaking changes.

---

## 4. Epistemic Protection: The Truth Gate Invariant

A companion cannot arbitrarily mutate the user's Life Database through hallucinations or conversational misunderstandings. All mutations are governed by the **Truth Gate**:

> **"Learning may propose. Truth Gate authorizes."**

```text
  Conversational Extract ──► Staged Proposal ('PENDING') ──► Truth Gate ──► Human Operator Approval
                                                                               │
                                                                               ├── Approved ──► Commit to Life DB
                                                                               │
                                                                               └── Rejected ──► Quarantined / Dropped
```

1. **Passive / Conversational Learning**:
   - Extracted candidate facts targeting knowledge (e.g. `subject: 'entity:*'`, `'task:*'`, `'event:*'`) are quarantined in `memory_claims` as `PENDING`.
   - Invisible to context retrieval until explicit human approval (`POST /knowledge/proposals/approve`).
   - Approval invokes `promoteApprovedClaimToKnowledge`, committing mutations to `siduri.sqlite`.
2. **Direct Intent Execution (`@siduri-x/hands`)**:
   - Explicit operational commands (e.g., *"Save my new laptop serial number"*, *"Log $14 for lunch"*) bypass conversational learning and execute via signed `HandsOrgan` tool contracts (`life:save_entity`, `life:log_event`, `life:upsert_schedule`, `life:update_task`).
   - Requires cryptographically valid `AuthorizationCapability` tokens and appends tamper-evident audit records to `action_audit_log`.

---

## 5. Portability & Sovereign Ownership

- **Model-Agnostic:** Companions or underlying LLM models may be upgraded, swapped, or re-instantiated from blank slates. The Life Database persists unchanged.
- **Local-First & Encrypted:** Stored under direct user authority in SQLite (`siduri.sqlite`), ensuring sensitive financial, biometric, and personal records remain sovereign and private.

