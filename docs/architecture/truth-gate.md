# The Truth Gate & The Anchor

One of the most persistent vulnerabilities in autonomous and companion AI systems is memory corruption and behavioral drift. When an AI automatically and unconditionally assimilates every interaction into its beliefs, it becomes vulnerable to prompt injection, gaslighting, hallucinations, and identity drift.

Siduri prevents this through the **Truth Gate** and the **Anchor Architecture**.

---

## 1. Dual-Layered Reality: The Operator & The Anchor

Siduri operates with a two-tier cognitive architecture:

1. **Short-Term Conversational Awareness**: Siduri naturally maintains active turn-by-turn dialogue context, immediate perceptions, and conversational flow in working memory without latency.
2. **Authoritative Worldview (The Anchor)**: Any permanent modifications to her worldview, relationship facts, semantic claims, or persona directives must pass through a strict **Truth Gate**.

The operator functions as the anchor. Before raw claims or self-directed persona mutations alter Siduri's permanent database, they are staged for audit, modification, approval, or rejection.

```text
               ┌───────────────────────────────┐
               │    Perception / Conversation   │
               └───────────────┬───────────────┘
                               │
                Extracted Claims / Directives
                               │
                               ▼
               ┌───────────────────────────────┐
               │       Memory Truth Gate       │
               │   Status: PENDING (Isolated)  │
               └───────────────┬───────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       Operator Approval               Operator Rejection
               │                               │
               ▼                               ▼
      Status: APPROVED                Status: REJECTED
  Admitted to Active Memory /      Permanently excluded from
    Active Self Worldview             Cognitive Planning
```

---

## 2. Implementation: Memory Truth Gate

The memory truth gate is implemented in `@siduri-x/memory` and runtime orchestration:

### 2.1 Staging as `PENDING`
When learning from explicit user teaching or structured LLM proposals (`memoryProposals` or `behaviorProposals`):
- Claims are created via `memory.proposeClaim()` with an initial status of `'PENDING'`.
- Behavioral directives are created via `memory.proposeDirective()` with `'PENDING'`.
- Source events are linked (`sourceEventId`) to maintain full provenance and evidence traces.

### 2.2 Strict Projection Boundaries
- **Worldview Isolation**: `memory.searchClaims()` filters strictly on `status = 'APPROVED'`. Unapproved claims are invisible to cognitive retrieval and context construction.
- **Active Self Persona Isolation**: In the `@siduri-x/behavior` compiler, pending directives are excluded from prompt compilation under the `pending_not_active` invariant diagnostic.

### 2.3 Operator Audit & Approval Workflow
Human operators manage the Truth Gate via administrative API endpoints:
- `GET /memory/proposals`: Audit pending memory proposals awaiting verification.
- `POST /memory/proposals/approve`: Transition a claim to `'APPROVED'` with user confirmation recorded as `'explicit'`.
- `POST /memory/proposals/reject`: Mark a proposal as `'REJECTED'`, preventing it from influencing the companion.
- `POST /memory/proposals/update`: Refine or correct proposed claims before approving them.
- `POST /memory/behavioral/approve` & `reject`: Approve or reject behavioral and persona directives.

### 2.4 Immutability & Lineage Tracking
Approved claims are immutable. Any modification via `memory.updateClaim()` proposes a new replacement claim with `supersedes: originalClaimId` in `'PENDING'` status. When the replacement is approved, the original claim transitions to `'SUPERSEDED'`, preserving full provenance and lineage in SQLite (`memory_claims.supersedes` and `memory_claims.source_event_id`). For cryptographic, tamper-evident operational audit trails with SHA-256 hash chaining, see the Action Audit System (`action_audit_log` via `ActionStore`).

---

## 3. Implementation: Response & Evidence Gating (`ResponseGatingEngine`)

In addition to memory persistence, the Truth Gate enforces runtime admissibility before Siduri emits speech or executes actions (see `@siduri-x/core`):

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
- **Untrusted Evidence Protection**:
  - Responses incorporating untrusted evidence (e.g., OCR, unverified sensory readings) automatically require approval (`requiresApproval: true`).
- **Gate Evaluation (`evaluateGate`)**:
  - If approval is pending or evidence sensitivity violates disclosure rules, the response is held (`status: 'STAGED'`, `reasonCode: 'APPROVAL_REQUIRED'`). Voice synthesis and body execution are inhibited until the owner submits `/dev/approve-response`.
- **Evidence Disclosure**: Private or restricted evidence attached to candidate speech is filtered before emission, ensuring that internal secrets never leak.

---

## 4. Verification and Invariants

The Truth Gate is tested across unit, adversarial, and integration suites:
- **Core Gate Mechanics**: `packages/core/src/gating.test.ts`
- **Adversarial Invariant 8 (Admissibility vs. Factuality)**: `packages/core/src/adversarial.test.ts`
- **Memory Proposal Isolation**: `packages/organs/memory/src/index.test.ts`
- **API & Staged Approval Flow**: `apps/api/src/t4-gating.test.ts`
