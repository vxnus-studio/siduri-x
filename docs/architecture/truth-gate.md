# The Truth Gate & The Anchor

One of the most persistent vulnerabilities in autonomous and companion AI systems is memory corruption, factual hallucination, and behavioral drift. When an AI automatically and unconditionally assimilates every interaction into its beliefs and persistent databases, it becomes vulnerable to prompt injection, gaslighting, hallucinations, and identity drift.

Siduri prevents this through the **Truth Gate** and the **Anchor Architecture**.

---

## 1. Dual-Layered Reality & The Universal Epistemic Gatekeeper

Originally conceived for memory and persona self-modification, the Truth Gate in Siduri-X is the **Universal Epistemic Gatekeeper** governing all four pillars of the companion's existence:

1. **Self**: Identity, archetype, core directives, and qualitative relational stances (`@siduri-x/self`).
2. **Knowledge (The Life Database)**: The user's sovereign objective reality — entities, events, tasks, schedule, and grounded preferences (`@siduri-x/knowledge`).
3. **Memory**: Long-term semantic claims and episodic interaction traces (`@siduri-x/memory`).
4. **Action & Expression**: Speech disclosure, physical actuation, and tool execution (`@siduri-x/brain`, `@siduri-x/hands`).

### Core Invariant
> **"Learning may propose. Truth Gate authorizes."**

No conversational inference, autonomous background reflection, or external sensory perception can directly write to Siduri's persistent beliefs, worldview, or Life Database. Every mutation learned through interaction is quarantined in `PENDING` state until the human operator (The Anchor) authorizes it.

```text
               ┌────────────────────────────────────────────────────────┐
               │         Perception / Conversational Learning           │
               └───────────────────────────┬────────────────────────────┘
                                           │
                            Staged Proposals (Claims / Directives)
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │                   THE TRUTH GATE                       │
               │             Status: PENDING (Quarantined)              │
               └───────────────────────────┬────────────────────────────┘
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
             Operator Approval                           Operator Rejection
                     │                                           │
                     ▼                                           ▼
            Status: APPROVED                            Status: REJECTED
                     │                                   Permanently Excluded
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
[ Self Pillar ] [ Life DB ]   [ Memory ]
- Identity      - Entities    - Semantic Claims
- Directives    - Events      - Worldview
- Relationships - Tasks       - Dialogue Retrieval
                - Schedule
```

---

## 2. Implementation: The Truth Gate Pipeline

The Truth Gate is implemented across `@siduri-x/core`, `@siduri-x/knowledge`, `@siduri-x/self`, and `@siduri-x/memory`.

### 2.1 Staging as `PENDING`
When learning from explicit user teaching or autonomous extraction:
- General semantic claims are created via `memory.proposeClaim()` with `'PENDING'`.
- Behavioral and persona directives are created via `memory.proposeDirective()` with `'PENDING'`.
- Candidate facts targeting the user's Life Database (e.g. `subject: 'task:*'`, `entity:*`, `event:*`, `schedule:*`) are staged as pending claims with structured evidence payloads.
- Full provenance (`sourceEventId`, timestamps, confidence) is preserved.

### 2.2 Strict Projection Boundaries
- **Worldview Isolation**: `memory.searchClaims()` filters strictly on `status = 'APPROVED'`. Unapproved claims are invisible to cognitive retrieval and context construction.
- **Active Self Isolation**: In the `@siduri-x/self` compiler (`ActiveSelfCompiler`), pending directives are excluded under the `pending_not_active` invariant diagnostic.
- **Life DB Isolation**: Unapproved knowledge proposals are never written to `life_entities`, `life_events`, `life_tasks`, `life_schedule`, or `life_preferences`. They remain quarantined in `memory_claims`.

### 2.3 Operator Audit & Approval Workflow
Human operators control the Truth Gate via administrative API endpoints:
- `GET /memory/proposals`: Audit pending memory and persona proposals.
- `POST /memory/proposals/approve`: Authorize a pending proposal.
- `POST /memory/proposals/reject`: Reject a candidate claim or directive.
- `POST /knowledge/proposals/approve`: Explicit Truth Gate endpoint to approve candidate claims targeting the Life Database.
- `POST /memory/behavioral/approve` & `reject`: Manage persona directives.

### 2.4 Immutability & Lineage Tracking
Approved claims are immutable. Any modification via `memory.updateClaim()` proposes a new replacement claim with `supersedes: originalClaimId` in `'PENDING'` status. When approved, the original transitions to `'SUPERSEDED'`, maintaining complete auditable lineage in SQLite (`memory_claims.supersedes`).

### 2.5 Active Self Promotion Bridge (`promoteClaimToSelf`)
When an approved claim targets identity, archetype, stance, or directives:
- Updates `self_identity` (`role` and `archetype`).
- Promotes relational stance to `self_relationships` (affinity, trust, interaction conventions).
- Activates behavioral directives in `self_directives` (`status: 'active'`).

### 2.6 Knowledge Promotion Bridge (`promoteApprovedClaimToKnowledge`)
When an approved proposal targets the user's Life Database:
- **Entities & Ownership (`entity:*`, `subject: entity:...`, `owns_*`, `has_*`, characters, accounts, devices)**: Commits to `life_entities` (nouns, inventory, gaming characters/accounts, contacts, bookmarks, specs) with domain and entity type inference.
- **Events & Telemetry (`event:*`, `stream:*`, `expense`, `income`)**: Commits to `life_events` (telemetry, measurements, financial transactions, logs).
- **Tasks & Goals (`task:*`, `todo:*`, `task_*`, `todo_*`, `goal`)**: Commits to `life_tasks` (verbs, to-dos, milestones, backlog).
- **Schedule & Calendar (`schedule:*`, `calendar:*`, `appointment`, `meeting`)**: Commits to `life_schedule` (time-bound calendar intervals).
- **Preferences (`preference:*`, `pref:*`)**: Commits to `life_preferences` (grounded personal choices).

### 2.7 Direct Action vs. Learning: The Dual Path
- **Passive / Conversational Learning**: Always passes through the Truth Gate quarantine (`PENDING` -> Human Approval -> SQLite Commit).
- **Direct User Action (`HandsOrgan`)**: When the user explicitly instructs Siduri to act immediately (e.g., *"Add task to buy groceries"*, *"Log $15 for lunch"*), the action executes via signed `HandsOrgan` tool contracts (`life:save_entity`, `life:log_event`, `life:upsert_schedule`, `life:update_task`).
  - Required: Valid `AuthorizationCapability` token signed by the companion's private key.
  - Required: Complete execution entry recorded in `action_audit_log` with SHA-256 hash chaining.

---

## 3. Implementation: Response & Evidence Gating (`ResponseGatingEngine`)

In addition to state persistence, the Truth Gate enforces runtime admissibility before Siduri emits speech or executes actions (see `@siduri-x/core`):

```text
  Brain Plan Proposal ──► Stage Response ──► Evaluate Gate ──► Admitted? ──► Voice / Action Execution
                                                    │
                                                    ├── No (Requires Approval / Expired / Excluded)
                                                    │     └── Hold in STAGED status
                                                    │
                                                    └── Yes (Approved / Grounded)
                                                          └── Emit Speech with Admitted Citations
```

- **Staged Response Plans**: Candidate outputs generated by `@siduri-x/brain` pass through `ResponseGatingEngine.stageResponse()`.
- **Untrusted Evidence Protection**: Responses incorporating untrusted evidence (e.g., OCR, unverified sensory readings) automatically require approval (`requiresApproval: true`).
- **Gate Evaluation (`evaluateGate`)**: If approval is pending or evidence sensitivity violates disclosure rules, the response is held (`status: 'STAGED'`, `reasonCode: 'APPROVAL_REQUIRED'`). Voice synthesis and body execution are inhibited until the owner submits `/dev/approve-response`.

---

## 4. Verification and Invariants

The Universal Truth Gate is thoroughly verified across unit, adversarial, and integration test suites:
- **Core Gate Mechanics & Gating Engine**: `packages/core/src/gating.test.ts`
- **Conversational Teach & Epistemic Gate Lifecycle**: `packages/core/src/conversational-teach.test.ts`
- **Adversarial Invariant 8 (Admissibility vs. Factuality)**: `packages/core/src/adversarial.test.ts`
- **Generic Life Primitives & Knowledge Storage**: `packages/core/src/siduri-db.test.ts`, `packages/knowledge/src/life-database.test.ts`
- **Capability-Gated Hands Execution**: `packages/organs/hands/src/index.test.ts`
- **API Endpoints & Knowledge Gate Integration**: `apps/api/src/knowledge.test.ts`, `apps/api/src/t4-gating.test.ts`
