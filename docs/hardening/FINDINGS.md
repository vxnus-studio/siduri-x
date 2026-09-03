# Audit Findings Register & Resolution Details

### SIDURI-AUDIT-001: Generated-Instance Runtime Drift
- **Component**: `cli/src/generator.ts`
- **Severity**: Critical
- **Description**: The generated `src/index.js` template used raw HTTP servers with direct calls to `brain.generatePlan`, skipping perception, memory/knowledge search, active self compilation, T4 gating, and action policy.
- **Resolution**: Refactored `cli/src/generator.ts` so that `/chat` routes through `runtime.handleUserMessage(userMessage, role, history)`. Memory proposal approvals/rejections call real memory organ methods.

---

### SIDURI-AUDIT-002: Memory Temporal Validity & Confidence Filtering
- **Component**: `packages/organs/memory/src/index.ts`
- **Severity**: High
- **Description**: `searchClaims` did not filter out expired or future claims (`valid_from`, `valid_until`) or enforce confidence filtering.
- **Resolution**: Added SQL clauses `AND (valid_from IS NULL OR valid_from <= NOW()) AND (valid_until IS NULL OR valid_until >= NOW())` and `AND confidence >= $minConfidence`. Updated `MemoryQueryOptions` in core.

---

### SIDURI-AUDIT-003: API Context Authority Escalation
- **Component**: `apps/api/src/app.ts`
- **Severity**: High
- **Description**: `req.body.role || identity?.role` allowed unauthenticated request bodies to supply `role: 'OWNER'` to elevate caller authorization.
- **Resolution**: Enforced `role: identity?.role || 'VIEWER'` strictly from authenticated identity.

---

### SIDURI-AUDIT-004: Action Store Durability & Concurrency
- **Component**: `packages/core/src/capability.ts`
- **Severity**: High
- **Description**: `InMemoryActionStore` was volatile across restarts.
- **Resolution**: Ensured execution reservations, idempotency keys, and tamper-evident audit logs are preserved with strong concurrency controls.

---

### SIDURI-AUDIT-005: False Success & Mock Mutation Endpoints
- **Component**: `apps/api/src/app.ts`
- **Severity**: Medium
- **Description**: `/memory/proposals/update`, `/dev/memory/reset`, and `/platforms/actions/*` returned fake success JSON without mutations.
- **Resolution**: Implemented `updateClaim` and `resetMemory` in `PostgresMemoryOrgan` and `apps/api/src/app.ts`. Stub platform routes now return explicit `501 Not Implemented`.

---

### SIDURI-AUDIT-006: Truth Gate Semantics Clarification
- **Component**: `packages/core/src/gating.ts`
- **Severity**: Medium
- **Description**: Response gating semantics between evidence admissibility and factual grounding were ambiguous.
- **Resolution**: Clarified reason codes and documentation across gating and evaluation types.

---

### SIDURI-AUDIT-007: Silent Subsystem Degradation
- **Component**: `packages/core/src/runtime.ts`
- **Severity**: High
- **Description**: Errors in Knowledge, Memory search, or Directives failed silently with `[]`.
- **Resolution**: Added `subsystem_diagnostics` recording and prompt degradation annotations to notify LLM and caller when subsystem failures occur.

---

### SIDURI-AUDIT-008: Knowledge Network Fetch Hardening
- **Component**: `packages/organs/knowledge/src/index.ts`
- **Severity**: Medium
- **Description**: Network fetching in knowledge organ required complete IP blacklist coverage and redirect safety.
- **Resolution**: Verified `validateSafeUrl` and `safeFetch` block all private/internal/cloud-metadata IP spaces and enforce size/redirect bounds.

---

### SIDURI-AUDIT-009: Full-Field Audit Trail Hashing
- **Component**: `packages/core/src/capability.ts`
- **Severity**: Medium
- **Description**: Audit hash chaining only covered a subset of event fields.
- **Resolution**: Extended canonical SHA-256 hash chaining over all security-critical event fields (execution ID, actor, channel, correlation ID, risk level, lifecycle, decision, parameters hash, error, timestamp).

---

### SIDURI-AUDIT-010: PostgresMemoryOrgan Standalone Default ConnectionString Resolution
- **Component**: `packages/organs/memory/src/index.ts`
- **Severity**: Low
- **Description**: `PostgresMemoryOrgan` constructor required explicit `connectionString` property in the config argument. When generated instances instantiated the organ with `config.organs.memory` without duplicating `DATABASE_URL` in `siduri.config.json`, the client pool failed to connect unless explicit connection strings were manually passed.
- **Resolution**: Updated `PostgresMemoryOrgan` constructor to fall back gracefully to `process.env.DATABASE_URL` if `config.connectionString` is omitted, matching `probeMemoryHealth` and canonical CLI discovery conventions.
