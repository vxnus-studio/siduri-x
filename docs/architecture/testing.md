# Testing Strategy & Test Suites

Status: Comprehensive Test Coverage (Unit, Adversarial, Contract, Integration)

The test suites verify architectural invariants, neutral blank-slate properties, memory isolation, and security boundaries across the monorepo:

## 1. Test Architecture
1. **Core Invariants & Adversarial Suites** (`packages/core/src/`):
   - `adversarial.test.ts`: 10 core architectural invariants (memory immutability, evidence gating, audit chaining, capability signing, idempotency, blank slate).
   - `gating.test.ts`: Response staging, evidence filtering, and operator approval flows.
   - `action-policy.test.ts`: Action authorization, cryptographic capability tokens, and replay prevention.
2. **Organ Subsystems** (`packages/organs/`):
   - `memory`: PostgreSQL isolation (`companion_id`), proposal transitions, full-text search, and audit history.
   - `behavior`: `ActiveSelfCompiler` rules, safety filters, leet-speak normalization, and priority ordering.
   - `brain`: Structured schema validation and response generation.
   - `observation`: Frame deduplication, rate limiting, and size bounding.
   - `hands`, `voice`, `body`: Provider adapters, queues, and experience event lifecycle.
3. **API & Boundary Verification Suites** (`apps/api/src/`):
   - `b0-b6.test.ts`: Neutral blank-slate invariants (empty memory, public chat, identity queries).
   - `context-mapper.test.ts`: Boundary mapper verifying neutral actor context, channel, and audience resolution.
   - `t4-gating.test.ts`: Staged response plans and operator approval workflows.
   - `t5-experience.test.ts`: Outbound experience event contracts.
   - `t6-security.test.ts`: Ingress bounds, secret isolation, CORS, and failure boundaries.
   - `t7-release.test.ts`: Full positive end-to-end flow and release gates.

## 2. Running the Test Suites
```bash
# Run all monorepo test suites via Turborepo
pnpm test

# Run clean-machine release verification
pnpm release:check
```

