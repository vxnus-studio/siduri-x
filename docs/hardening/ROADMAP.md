# Hardening & Correctness Roadmap

## Phase 1: Critical Architectural Correction
- [x] **1A: Fix generated-instance / runtime drift (`SIDURI-AUDIT-001`)**
  - Refactored `cli/src/generator.ts` so that generated `src/index.js` orchestrates through `SiduriRuntime.handleUserMessage`.
  - Memory approval and rejection endpoints execute real state changes via `memory.approveClaim` / `rejectClaim`.
- [x] **1B: Fix memory temporal validity and confidence filtering (`SIDURI-AUDIT-002`)**
  - Updated `packages/organs/memory/src/index.ts` to enforce `valid_from`, `valid_until`, and `confidence >= minConfidence`.
  - Added regression test suite verifying parameter binding and temporal bounds in `packages/organs/memory/src/disclosure.test.ts`.

---

## Phase 2: Authority, State, and Correctness
- [x] **2A: Fix API context authority (`SIDURI-AUDIT-003`)**
  - Updated `apps/api/src/app.ts` so that verified caller identity strictly governs caller authorization role.
  - Caller-supplied roles in request bodies are ignored / prevented from overriding authentication.
- [x] **2B: Action store durability and concurrency (`SIDURI-AUDIT-004`)**
  - Preserved reservation idempotency, unique execution tracking, and capability replay protections across restarts.
- [x] **2C: Truthful endpoint returns & remove false success (`SIDURI-AUDIT-005`)**
  - Updated `apps/api/src/app.ts` to route `/memory/proposals/update` and `/dev/memory/reset` to actual PostgreSQL organ operations.
  - Returns `501 Not Implemented` on unconfigured platform stub routes (`/platforms/actions/*`, `/platforms/events`).

---

## Phase 3: Failure Semantics and Defense in Depth
- [x] **3A: Subsystem degradation diagnostics (`SIDURI-AUDIT-007`)**
  - Exposed subsystem degradation diagnostics in `packages/core/src/runtime.ts` context prompts and return metadata.
- [x] **3B: SafeFetch network hardening (`SIDURI-AUDIT-008`)**
  - Verified comprehensive SSRF protection, IP blacklisting, redirect validation, and stream bounded parsing in `packages/organs/knowledge/src/index.ts`.
- [x] **3C: Truth Gating semantics clarification (`SIDURI-AUDIT-006`)**
  - Clarified evidence admissibility, reason codes, and gate dispositions in `packages/core/src/gating.ts`.
- [x] **3D: Full-field audit hash chaining (`SIDURI-AUDIT-009`)**
  - Bound all security-critical event fields (execution ID, actor, channel, correlation ID, risk level, lifecycle, decision, parameters, error, timestamp) into canonical SHA-256 hash chaining in `packages/core/src/capability.ts`.

---

## Phase 4: Release & Operational Validation
- [x] Monorepo clean build passing across all 17 workspaces (`pnpm -r build`).
- [x] Full unit, integration, and adversarial regression suites passing (`pnpm -r test`).
- [x] Clean-machine standalone distribution & package artifact validation passing.
- [x] Live PostgreSQL database migrations and checksum tracking validated (`siduri db push`).
- [x] Memory lifecycle (propose, approve, reject, temporal filter, confidence filter, restart persistence) verified.
- [x] Action execution idempotency, HMAC verification, replay defense, and concurrent reservation verified.
- [x] Subsystem degradation diagnostics and network SSRF boundaries verified under failure injection.
- [x] Hardening & verification documentation set updated in `docs/hardening/`.
- [x] **Verdict: GO — Release baseline established.**
