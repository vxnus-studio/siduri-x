# RFC: Semantic Supersession & Teach Mode Onboarding Specification

> **Status:** Accepted & Implemented  
> **Target Systems:** `@sidurijs/core` (`SiduriDatabase`), `@sidurijs/self` (`ActiveSelfCompiler`), `@sidurijs/memory`, Web Chat App  
> **Related Documents:**  
> - [T2 Memory State Machine](../contracts/t2-memory-state-machine.md)  
> - [T3 Active Self Contract](../contracts/t3-active-self-contract.md)  
> - [The .self Asset & Teach Mode Ingestion Pipeline](../self-organ-knowledge/02-self-asset-and-teach-mode.md)  
> - [Evidence Screenshots Directory](../../assets/screenshots/logs/)

---

## 1. Executive Summary

During blank-slate companion initialization and interactive user teaching, two failure modes frequently emerge in LLM memory systems:
1. **Priority Inflation & Conflicting Directives:** When an initial instruction is assigned a numerical priority (e.g. `priority: 75` for `"Address actor:user as Kur Zagin"`), subsequent refinement instructions (e.g. `"Address actor:user as Master Zagin"`) either conflict with the prior rule or fail to take precedence if assigned an equal or lower priority.
2. **Context Memory Blindness / Hallucination on Fresh Chats:** In a fresh chat session, if the companion fails to recognize compiled active identity rules as ground truth, it may hallucinate missing memory systems or misstate user relationships.

This RFC formalizes **Semantic Supersession** and the **Teach Mode Onboarding Golden Path** to guarantee that single-value behavioral dimensions cleanly supersede older rules without numeric inflation, while maintaining full historical auditability.

---

## 2. Core Architecture: Semantic Supersession vs. Numeric Priority

### 2.1 The Limits of Numeric Priority
In conventional agent systems, rules are assigned static weights (e.g., 50 to 90). When a user tells the agent to change how they are addressed:
- Priority numbers cannot convey the human communicative intent of **replacement**.
- Assigning higher numbers leads to "priority creep" (escalating to 85, 95, 100), polluting the database with competing active directives that confuse LLM comprehension.

### 2.2 The Semantic Supersession Engine
Under Semantic Supersession, single-valued behavioral and identity dimensions are governed by `SINGLE_VALUE_PREDICATES`:

```ts
const SINGLE_VALUE_PREDICATES = new Set([
  'name',
  'preferred_name',
  'preferred_address',
  'preferred_form_of_address',
  'form_of_address',
  'title',
  'honorific',
  'role',
  'archetype',
  'origin',
  'created_by',
  'stated_relationship',
  'relationship',
  'relationship_to_siduri',
  'ethos',
  'server',
  'uid',
  'preferred_language',
]);
```

When a claim or directive matching any single-value predicate is approved:
1. **State Transition:** All prior `active` or `pending` records for the same `(subject, predicate)` are atomically transitioned to `status = 'superseded'`.
2. **Exclusion from Active Self:** Only directives with `status = 'active'` are admitted into `@sidurijs/self` compilation. Outdated instructions are omitted from the LLM prompt.
3. **Auditability:** Superseded claims remain queryable by operators or temporal historical queries (`"What was my name before?"`) without polluting current behavioral context.
4. **Tie-Break Determinism:** When priorities are identical, recency (`createdAt` descending) acts as the decisive tie-breaker (`newest wins`).

---

## 3. Active Self Compilation & Interlocutor Precedence

To guarantee that the companion uses the interlocutor's chosen form of address:
1. In `ActiveSelfCompiler`, approved address directives (`"Address actor:user as Master Zagin"`) update the entity's `interactionConventions` with `Address as <Title>`.
2. The compiler projects this directly into `<active_self>` under the relationship section:
   ```markdown
   <active_self>
   Identity:
   - Name: Siduri | Origin/Created By: Kur Zagin
   Relationship:
   - Toward actor:user (creator): Stance=familiar_loyal
   - Interlocutor Preferred Form of Address: Master Zagin
   Behavior:
   - Address actor:user as Master Zagin
   </active_self>
   ```
3. Brain prompt rules enforce that `Interlocutor Preferred Form of Address` takes precedence over base names during direct conversational address.

---

## 4. The Teach Mode Onboarding Golden Path (Verified Benchmark)

This sequence establishes the canonical 4-step onboarding dialogue verified on single-port local instances (`http://localhost:3000`) with model `openai/gpt-5.6-luna`.

### 4.1 Session 1: Identity, Relationship & Form of Address

#### Turn 1: Companion Identity Grounding
- **User Prompt:**
  ```text
  Your name is Siduri
  ```
- **Companion Response:**
  ```text
  Understood. My name is Siduri.
  ```
- **Runtime Settlement:**
  - `Remember: Companion name is Siduri.` [APPROVED]
  - `Runtime effect: Identify and refer to self as Siduri.` [ACTIVE]

#### Turn 2: Creator Relationship & Base Name
- **User Prompt:**
  ```text
  i am Kur Zagin, your creator
  ```
- **Companion Response:**
  ```text
  Understood, Kur Zagin. You are my creator.
  ```
- **Runtime Settlement:**
  - `Remember: User name is Kur Zagin.` [APPROVED]
  - `Remember: User role is creator.` [APPROVED]
  - `Remember: User stated relationship is creator of Siduri.` [APPROVED]
  - `Runtime effect: Address actor:user as Kur Zagin.` [ACTIVE]
  - `Runtime effect: Recognize actor:user as Siduri's creator.` [ACTIVE]

#### Turn 3: Form of Address Supersession
- **User Prompt:**
  ```text
  you may address me as Master Zagin
  ```
- **Companion Response:**
  ```text
  Understood, Master Zagin. I’ll address you as Master Zagin.
  ```
- **Runtime Settlement & Supersession:**
  - `Remember: User preference is Prefers to be addressed as Master Zagin.` [APPROVED]
  - `Runtime effect: Address actor:user as Master Zagin.` [ACTIVE]
  - **Supersession Action:** Prior directive `Address actor:user as Kur Zagin` is transitioned to `status = 'superseded'`.

---

### 4.2 Session 2: Fresh Chat Session Memory Recall

#### Turn 1: Greeting with Preferred Address
- **User Prompt:**
  ```text
  hey
  ```
- **Companion Response:**
  ```text
  Hey, Master Zagin. How can I help?
  ```
- **Outcome:** The new session immediately incorporates the active address without prompting or reminder.

#### Turn 2: Comprehensive Self & Relational Recall
- **User Prompt:**
  ```text
  who are you?
  ```
- **Companion Response:**
  ```text
  I’m Siduri, Master Zagin—a companion created by you. I’m here to assist, learn your preferences, and communicate with you directly.
  ```
- **Outcome:** Zero memory amnesia. The model accurately recalls its identity (`Siduri`), creator relationship (`created by you`), and preferred honorific (`Master Zagin`) seamlessly.

---

## 5. Verification & Visual Evidence

Visual logs and step-by-step screenshots demonstrating Teach Mode proposal approvals, state transitions, and live UI chat rendering are archived in [`assets/screenshots/logs/`](file:///home/zagin/Projects/vxnus-studio/projects/siduri-x/assets/screenshots/logs/):

1. **[`teach-mode-session1-identity-and-supersession.png`](file:///home/zagin/Projects/vxnus-studio/projects/siduri-x/assets/screenshots/logs/teach-mode-session1-identity-and-supersession.png)**:
   - Captures the initial onboarding dialog: identity declaration (*"My name is Siduri"*), creator role recognition (*"You are my creator"*), and supersession to preferred address (*"Understood, Master Zagin"*).
   - Displays real-time proposal settlement receipts and active runtime effects.

2. **[`teach-mode-session2-fresh-chat-recall.png`](file:///home/zagin/Projects/vxnus-studio/projects/siduri-x/assets/screenshots/logs/teach-mode-session2-fresh-chat-recall.png)**:
   - Captures a fresh chat session greeting with *"Hey, Master Zagin"* and answering *"who are you?"* with complete, zero-hallucination recall (*"I’m Siduri, Master Zagin—a companion created by you..."*).
