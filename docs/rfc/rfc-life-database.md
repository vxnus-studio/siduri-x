# RFC: The Life Database Specification & User Data Sovereignty

> **Status:** Implemented (Adopted in `@siduri-x/knowledge` & `SiduriDatabase`)  
> **Canonical Specification:** [`docs/self-organ-knowledge/01-domain-architecture.md`](../self-organ-knowledge/01-domain-architecture.md)  
> **Target Subsystems:** `@siduri-x/knowledge` (Life DB), `SiduriDatabase` (`siduri.sqlite`), `@siduri-x/core` (`LifeDatabase` contract)  
> **Authors:** Kur Zagin & Siduri Architecture Team  

> [!NOTE]
> **STATUS UPDATE: IMPLEMENTED**  
> The Life Database is fully implemented as the sovereign Knowledge domain substrate in `@siduri-x/knowledge` (`SqliteLifeDatabase`), backed by tables `life_inventory`, `life_finance`, `life_schedule`, and `life_preferences` in `siduri.sqlite`.

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
│ • Conversational impressions & dialogue │ • Account inventories (e.g. Genshin)    │
│ • Inside jokes, promises, shared trust  │ • Financial ledgers, expenses, budgets  │
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

## 3. Core Domains of the Life Database

The Life Database is structured into modular, typed domains:

1. **Accounts & Inventories (`life_inventory`)**:
   - Game rosters (e.g. Genshin Impact characters, weapons, constellations, UIDs).
   - Owned hardware, software tools, equipment, subscriptions.
2. **Finances & Ledgers (`life_finance`)**:
   - Expense transactions, recurring bills, budget limits, savings milestones.
   - Enables exact mathematical reasoning without LLM arithmetic drift.
3. **Schedule & Time Commitments (`life_schedule`)**:
   - Deadlines, events, sleep cycles, focus hours, reminders.
4. **Personal Tastes & Grounded Preferences (`life_preferences`)**:
   - Dietary restrictions, favorite media, aesthetics, UI themes.

---

## 4. Integration with Siduri-X Organs (Zero New Organs)

The Life Database does not require adding a new organ to `@siduri-x/*`. Instead, it serves as an **external grounded substrate** that existing organs interface with through defined capabilities:

```text
                     ┌────────────────────────────────────┐
                     │          SIDURI COMPANION          │
                     │  Brain • Behavior • Memory • Hands │
                     └─────────────────┬──────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            │                                                     │
     READ / QUERY VIA                                     MUTATE / WRITE VIA
Knowledge & Action Tools                              Hands Organ Tool Contracts
            │                                                     │
            └──────────────────────────┬──────────────────────────┘
                                       │
                     ┌─────────────────▼──────────────────┐
                     │           LIFE DATABASE            │
                     │  (Encrypted, Local-First, Sovereign│
                     │   Structured PostgreSQL / SQLite)  │
                     └────────────────────────────────────┘
```

### Operational Workflows:
- **Reasoning & Retrieval (`@siduri-x/brain` + `@siduri-x/knowledge`):**
  - When asked *"Can I afford to pull on the current banner?"*, the Brain queries the Life Database for current month expenses, budget headroom, and owned pity/inventory.
  - Generates factual, hallucination-free reasoning grounded in real data.
- **Action & Mutation (`@siduri-x/hands`):**
  - Explicit user updates (e.g. *"Log $30 for lunch"*, *"Mark Furina as acquired"*) trigger audited `Hands` action intents (`log_expense`, `update_inventory`).
  - Gated by action policies and confirmation boundaries.

---

## 5. Portability & Sovereign Ownership

- **Model-Agnostic:** Companions or underlying LLM models may be upgraded, swapped, or re-instantiated from blank slates. The Life Database persists unchanged.
- **Local-First & Encrypted:** Stored under direct user authority (local SQLite/PostgreSQL), ensuring sensitive financial and personal records are never leaked or co-mingled with public or third-party datasets.
