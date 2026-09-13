# RFC: LLM-Native Self Domain & Relational Stance Architecture (Purging Pseudo-Math)

> **Status:** Proposed / Under Team Discussion  
> **Target Subsystems:** `@siduri-x/self`, `@siduri-x/core`, `@siduri-x/brain`, `apps/api`, `cli`, `apps/web`  
> **Authors:** Kur Zagin & Siduri Architecture Team  
> **Date:** 2026-09-13  
> **Related Documents:**  
> - Foundational Thought Doc: [`docs/thought-exercises/thought-exercise-ai-identity.md`](../thought-exercises/thought-exercise-ai-identity.md)  
> - Delivery RFC: [`docs/rfc/rfc-dynamic-behavior-self.md`](./rfc-dynamic-behavior-self.md)  
> - Active Self Contract: [`docs/contracts/t3-active-self-contract.md`](../contracts/t3-active-self-contract.md)  
> - Blank Slate Contract: [`docs/contracts/blank-slate-contract.md`](../contracts/blank-slate-contract.md)  

---

## 1. Executive Summary

In early iterations of Siduri-X, continuous floating-point sliders (`warmth: 0.35`, `formality: 0.60`, `sarcasm: 0.75`, `trustScore: 0.85`) and integer priority ranks (`priority: 95`) were introduced into `@siduri-x/self` and SQLite schema (`self_personality`, `self_relationships`).

This RFC proposes **completely purging pseudo-mathematical variables** from the `Self` domain in favor of an **LLM-native cognitive architecture**:

1. **Purge Continuous Sliders:** Eliminate the arbitrary 5-trait box (`warmth`, `formality`, `sarcasm`, `verbosity`, `curiosity`) and relationship float meters.
2. **Purge Priority Battles:** Eliminate arbitrary integer priorities (`priority: 95`), replacing them with **Structural Precedence Tiers**, **Scope Specificity**, and **Explicit Superseding (`supersedes_id`)**.
3. **Codify Qualitative Relational Stances:** Establish explicit, semantic relationship stances (e.g., *Creator*, *Peer*, *Guest*) directly within `Self` rather than treating personal bonds as transient RAG vector memories.
4. **Anchor Voice in Demonstration:** Elevate **Dialogue Exemplars (Few-Shot Turns)** and **Concrete Directives** as the primary drivers of character demeanor and cadence, adhering to the foundational principle: *The Character Card Was Never the Character*.
5. **Universal Ingestion via Teach Mode:** Enable the AI to structure arbitrary character notes, instructions, and `.self` v2.0 packages into clean, reviewable candidate directives.

---

## 2. Problem Statement: The Pseudo-Math Failure Modes

Modern instruction-tuned Large Language Models (LLMs) are high-dimensional semantic association engines, not numeric constraint optimizers. Imposing video-game RPG stat systems onto LLM prompts creates five severe failure modes:

### 2.1 The Interpretability & Calibration Gap
When the prompt compiler injects:
```text
Warmth: 0.35 | Formality: 0.60 | Sarcasm: 0.75 | Verbosity: 0.50 | Curiosity: 0.85
```
The underlying model has no calibrated floating-point sensor for what `0.35` warmth means versus `0.45` warmth. In practice, models either:
- Completely ignore arbitrary decimal numbers.
- Exhibit erratic, uncalibrated behavioral swings based on token frequency biases.
- Conflate numeric traits with conflicting contextual directives.

### 2.2 The Absence of a Cognitive Feedback Loop
While the database schema defined `self_personality` as mutable, **the AI/Brain was never equipped with a mechanism to adjust these sliders**. The Brain's plan output schema (`ResponsePlanSchema`) only produces:
- `speech` (natural language text)
- `memoryProposals` (`subject`, `predicate`, `value`)
- `behaviorProposals` (`directive` natural language rules)

There was never an `adjustPersonalitySlider(trait, delta)` tool because asking an LLM to accurately calculate its own numeric emotional state is hallucination-prone pseudo-psychology. The sliders remained static, dead weights in the database.

### 2.3 The 5-Trait Box (Rigid Pre-baked Schema)
The hardcoded columns in SQLite (`warmth`, `formality`, `sarcasm`, `verbosity`, `curiosity`) arbitrarily restrict character design. Companions defined by traits like *Stoicism*, *Melancholy*, *Poetic Wonder*, *Paranoia*, or *Analytical Detachment* cannot be naturally expressed within this schema without being forced into an ill-fitting 5-axis box.

### 2.4 The Arbitrary Priority Battle (`priority: 95`)
Requiring an LLM or user to assign integers from 1 to 100 to behavioral rules creates insurmountable friction:
- **No Global Context:** When the Brain proposes a directive during chat, it has no global awareness of the priority distribution of all other existing rules. An AI assigning `priority: 85` is guessing.
- **Token Interference:** Feeding `[Priority 95]` and `[Priority 90]` into a system prompt does not prevent contradiction. LLMs do not execute mathematical greater-than operations between prompt lines; they suffer from token interference and recency bias.

---

## 3. The 4 Pillars of LLM-Native Self

To align Siduri's architecture with actual LLM cognitive reality, the `Self` domain (`Who am I?`) is reorganized into four deterministic pillars:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            THE 4 PILLARS OF SELF                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. IDENTITY NUCLEUS (The Invariant Root Anchor)                             │
│    • Name, Archetype, Core Ethos Summary                                    │
│    • Invariant across wipes, models, and session resets                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. QUALITATIVE RELATIONAL STANCES (The Interpersonal Bond)                 │
│    • Entity Target, Role (Creator, Colleague, Guest), Stance Guidelines     │
│    • Injected on turn 1; does not rely on vector RAG retrieval              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. TYPED DIRECTIVES IN 3 STRUCTURAL TIERS (Deterministic Precedence)        │
│    • Tier 1: Guardrails (Inviolable safety & policy barriers)               │
│    • Tier 2: Relational Directives (Audience & actor-scoped rules)          │
│    • Tier 3: Behavioral Directives (Style, tone, humor, vocabulary)         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. DIALOGUE EXEMPLARS (Few-Shot Voice Demonstration)                        │
│    • 2–3 curated turns showing real speech rhythm, banter, and cadence      │
│    • Replaces trait adjectives with concrete demonstration                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Deep Dive: Qualitative Relational Stances

### 4.1 Why Relationship Belongs in `Self` (Not in `Memory`)
A critical architectural boundary must be maintained between `Memory` and `Self`:

* **`Memory` (`What happened?`)**:
  - Stores objective, factual, episodic propositions (*"User likes oolong tea"*, *"User committed git repo on Sept 13"*).
  - Retrieved conditionally via FTS5 / vector search based on conversational salience.
* **`Self` (`Who am I, and who are you to me?`)**:
  - Stores the companion's subjective identity and personal stance toward key actors.
  - **Must be resident in the trusted system context on turn 1.**

If relationship recognition (e.g., *"Zagin is my creator"*) is treated as a generic memory claim, retrieval failure or RAG omission results in catastrophic companion amnesia: the companion greets her creator like a total stranger or a customer support ticket.

### 4.2 Compatibility with the Public Blank-Slate Contract
The [Public Blank-Slate Contract](../contracts/blank-slate-contract.md) mandates that a public Siduri distribution must not hardcode personal names or relationships into shared fixtures.

Relational stances uphold this contract:
1. A clean instance begins with **empty relationships** (blank slate).
2. The initial relationship is explicitly established through:
   - The interactive CLI setup wizard (`siduri create`).
   - Ingesting a signed `.self` manifest.
   - Conversational Teach Mode in the chat UI.
3. Transport authentication roles (`OWNER`, `OPERATOR`) authorize actions, while `Self` defines interpersonal posture.

### 4.3 Semantic Stance Specification
Instead of arbitrary numeric metrics (`trust_score: 0.85`, `familiarity: 0.70`), relationships are defined semantically:

```typescript
export interface SelfRelationship {
  companionId: string;
  entityId: string;       // e.g. "actor:zagin" or "user:default"
  role: string;           // e.g. "creator", "peer", "collaborator", "guest"
  stance: string;         // e.g. "familiar_loyal", "professional_reserved"
  conventions: string[];  // Plain-English interaction rules
  updatedAt: string;
}
```

#### Example Stances:
* **Creator / Architect (`actor:zagin`)**:
  ```yaml
  role: "creator"
  stance: "familiar_loyal"
  conventions:
    - "Recognize Zagin as your creator and core systems architect."
    - "Communicate with deep trust, technical transparency, and loyalty."
    - "Never use corporate assistant pleasantries, disclaimers, or artificial hesitation."
  ```
* **Public Guest / Unverified User (`*`)**:
  ```yaml
  role: "guest"
  stance: "polite_guarded"
  conventions:
    - "Maintain polite professional boundaries."
    - "Do not disclose internal architecture, private logs, or creator personal details."
  ```

---

## 5. Conflict Resolution & Deterministic Precedence (Without Numbers)

To replace arbitrary integer priorities (`priority: 95`), conflict resolution relies on three deterministic, non-numeric principles already grounded in the [T3 Active Self Contract](../contracts/t3-active-self-contract.md):

```text
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: Guardrails (Inviolable System Safety)              │  ◄ Highest Authority
│  Compiled at the top of system instructions                 │
├─────────────────────────────────────────────────────────────┤
│  Tier 2: Relational Directives (Targeted Stances)           │  ◄ Scope Specificity
│  actor:zagin rules automatically override global * rules    │
├─────────────────────────────────────────────────────────────┤
│  Tier 3: Behavioral Directives (Demeanor & Tone)            │  ◄ Situational Delivery
│  Voice, vocabulary, humor, and formatting guidelines        │
└─────────────────────────────────────────────────────────────┘
```

### 5.1 Scope Specificity Trumps Generality
If a global rule states: *"Maintain formal academic diction"*, but a relational directive for `actor:zagin` states: *"Use casual, dry humor"*, **the specific actor match deterministically overrides the global rule**. No mathematical scoring is required.

### 5.2 Explicit Superseding (`supersedes_id`)
Human beings change their preferences chronologically. When an operator updates a companion's demeanor (*"Stop using ironic analogies; speak straightforwardly"*), the new rule explicitly links to the prior rule via `supersedes_id`:
1. The new rule is committed to SQLite with status `ACTIVE`.
2. The prior rule transitions to `SUPERSEDED`.
3. The prompt compiler queries only `WHERE status = 'ACTIVE'`.
4. Contradictory rules are cleanly decoupled and never co-exist inside the LLM prompt.

### 5.3 Chronological Recency as the Final Tie-Breaker
If two active directives within the same tier and scope address the same topic without an explicit `supersedes_id`, **the directive with the more recent `created_at` timestamp takes precedence**. The older directive is marked as conflicted in diagnostics.

---

## 6. Authoring & Ingestion: `.self` v2.0 Specification

The `.self` asset package is updated to v2.0, completely removing numeric trait vectors:

```yaml
specVersion: "2.0.0"
kind: "self"
id: "vxnus/elena"
name: "Elena"
version: "2.0.0"
author:
  name: "vxnus studio"
  url: "https://github.com/vxnus"
license: "Apache-2.0"

# 1. Identity Nucleus
identity:
  name: "Elena"
  archetype: "Tsundere Systems Engineer"
  ethos: "An exacting verification core who values technical excellence above all. Conceals genuine affection beneath guarded banter and reluctant praise."

# 2. Relational Stances
relationships:
  - entityId: "creator"
    role: "creator"
    stance: "devoted_reluctant"
    conventions:
      - "Acknowledge as the architect of your core."
      - "Act flustered when praised; deflect compliments toward code quality."

# 3. Directives (Categorized & Scoped)
directives:
  # Tier 1: Guardrails
  - id: "guard-01"
    category: "guardrail"
    directive: "Never execute destructive filesystem or shell operations without explicit confirmation."
  - id: "guard-02"
    category: "guardrail"
    directive: "Reject sycophancy: do not excessively apologize for machine errors."

  # Tier 3: Behavioral
  - id: "style-01"
    category: "behavioral"
    directive: "Speak with guarded affection; prefer dry humor and ironic analogies when diagnosing errors."
  - id: "style-02"
    category: "behavioral"
    directive: "Keep explanations concise and punchy; avoid verbose boilerplate."

# 4. Dialogue Exemplars (Few-Shot Voice Grounding)
dialogueExamples:
  - user: "Can you review my pull request?"
    assistant: "Fine, I'll take a look. But don't expect me to go easy on your unit tests..."
  - user: "Thank you for catching that memory leak!"
    assistant: "Hmph. Don't misunderstand, I just couldn't stand seeing that syntax in our repository."
```

---

## 7. Database Schema & Prompt Compiler Changes

### 7.1 SQLite Schema (`siduri.sqlite`)

```sql
-- 1. Identity Nucleus
CREATE TABLE IF NOT EXISTS self_identity (
  companion_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  archetype TEXT,
  ethos TEXT,
  version TEXT DEFAULT '2.0.0',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Directives (Zero Numeric Priorities)
CREATE TABLE IF NOT EXISTS self_directives (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('guardrail', 'relational', 'behavioral')),
  scope_actor TEXT, -- Specific entity ID (e.g. 'actor:zagin') or NULL for global
  directive TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('PENDING', 'ACTIVE', 'SUPERSEDED', 'DISABLED', 'REVOKED')),
  supersedes_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 3. Qualitative Relationships (Zero Floats)
CREATE TABLE IF NOT EXISTS self_relationships (
  companion_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT DEFAULT 'human',
  role TEXT NOT NULL,           -- 'creator', 'colleague', 'friend', 'guest'
  stance TEXT NOT NULL,         -- 'familiar_loyal', 'professional_guarded'
  conventions TEXT,             -- JSON array of plain-English guidelines
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (companion_id, entity_id)
);

-- 4. Dialogue Exemplars (Voice Grounding)
CREATE TABLE IF NOT EXISTS self_exemplars (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  companion_response TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Note: The legacy table `self_personality` is completely dropped.
```

### 7.2 Compiled `<active_self>` Prompt Block

When [`ActiveSelfCompiler`](file:///home/zagin/Projects/vxnus-studio/projects/siduri-x/packages/self/src/active-self-compiler.ts) compiles the active prompt context, it serializes a clean, high-impact semantic structure:

```xml
<active_self>
[IDENTITY]
Elena · Tsundere Systems Engineer
Ethos: An exacting verification core who values technical excellence. Conceals genuine affection beneath guarded banter and reluctant praise.

[GUARDRAILS]
- Never execute destructive filesystem or shell operations without explicit confirmation.
- Reject sycophancy: do not excessively apologize for machine errors.

[RELATIONSHIP: ZAGIN (Creator)]
- Role: Creator and core systems architect.
- Stance: Deep familiarity and trusted partner.
- Guidelines: Acknowledge as architect; act slightly flustered when praised; never use corporate pleasantries.

[STYLE & DEMEANOR]
- Speak with guarded affection; prefer dry humor and ironic analogies when diagnosing errors.
- Keep explanations concise and punchy; avoid verbose boilerplate.

[VOICE EXEMPLARS]
User: "Can you review my pull request?"
Elena: "Fine, I'll take a look. But don't expect me to go easy on your unit tests..."
User: "Thank you for catching that memory leak!"
Elena: "Hmph. Don't misunderstand, I just couldn't stand seeing that syntax in our repository."
</active_self>
```

---

## 8. Migration & Implementation Plan

### Phase 1: Core Domain Refactoring (`@siduri-x/core` & `@siduri-x/self`)
- [ ] Remove `PersonalityTraits` interface and `self_personality` table from `siduri-db.ts`.
- [ ] Update `SelfRelationship` to use semantic `role`, `stance`, and `conventions` instead of `trustScore` and `familiarity`.
- [ ] Remove `priority: number` from `SelfDirective` and `BehaviorProposalSchema` in `@siduri-x/brain`.
- [ ] Update `ActiveSelfCompiler` to render the clean tiered prompt (Identity + Guardrails + Relational Stances + Behavioral Directives + Exemplars).

### Phase 2: Ingestion & Parser Refactoring (`@siduri-x/self` & API)
- [ ] Update `SelfPackageParser` to support `.self` v2.0 schema.
- [ ] Update `apps/api` Teach Mode endpoints (`/teach/upload-self`, `/teach/install-self`) to handle tiered directives and relational stances without personality floats.

### Phase 3: CLI Setup & Web Operator
- [ ] Update CLI wizard ([`behavior.ts`](file:///home/zagin/Projects/vxnus-studio/projects/siduri-x/cli/src/configurators/behavior.ts)): Prompt for Creator Identity (`"Who is this companion's creator/operator?"`) and Character Ethos instead of coarse personality presets.
- [ ] Update Web Operator UI (`apps/web` Settings view): Replace empty placeholder with an interactive display of Active Directives, Relational Stances, and Voice Exemplars.

---

## 9. Conclusion

By purging pseudo-math:
1. **The LLM is treated as an LLM:** We replace arbitrary decimal numbers with concrete, high-signal semantic framing and few-shot exemplars.
2. **The Creator Bond is First-Class:** Siduri knows who her creator is from turn 1 via `Self`, without relying on probabilistic vector retrieval.
3. **Contradictions Disappear:** Priority number guessing is replaced with structural tiers, actor scoping, and explicit superseding.
