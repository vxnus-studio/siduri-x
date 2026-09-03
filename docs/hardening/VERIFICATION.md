# Verification Procedures & Test Results

## Automated Test Suites

The entire test suite across all workspace packages passes cleanly:

```bash
pnpm -r test
```

### Key Verification Suites

1. **Core Package (`packages/core`)**:
   - `src/adversarial.test.ts`: Dedicated adversarial suite testing:
     - Memory truth & cognition context filtering
     - Role elevation & request context boundary defense
     - Action idempotency, replay defense, and HMAC parameter tampering detection
     - Subsystem failure diagnostics & degraded prompt assembly
     - Response gating evidence admissibility semantics
     - Full-field SHA-256 tamper-evident audit trail verification
   - `src/action-policy.test.ts`: Policy rules, role capability evaluation, and risk tiers.
   - `src/capability.test.ts`: Cryptographic HMAC signatures, replay prevention, and full-field SHA-256 tamper-evident audit chaining.
   - `src/gating.test.ts`: T4 Response gating, evidence admissibility, and staging approval.
   - `src/context.test.ts` & `src/evidence.test.ts`: Neutral context mapping and audience disclosure boundaries.

2. **Memory Organ (`packages/organs/memory`)**:
   - `src/disclosure.test.ts`: Audience filtering, temporal validity (`valid_from`, `valid_until`), and confidence thresholds.
   - `src/index.test.ts`: PostgreSQL FTS search parity, bounded limits, and migration compatibility.

3. **Knowledge Organ (`packages/organs/knowledge`)**:
   - `src/index.test.ts`: E-Pack citation preservation, SSRF IP blocking (AWS/GCP metadata, loopback, private ranges), and redirect security.

4. **Hands Organ (`packages/organs/hands`)**:
   - `src/index.test.ts`: Mandatory capability authorization, parameter hash validation, recursive schema validation, prototype pollution defense, and concurrency reservation.

5. **API Gateway (`apps/api`)**:
   - `src/auth.test.ts`: Token resolution and local development fallbacks.
   - `src/context-mapper.test.ts`: Context normalization and policy enforcement.
   - `src/t6-security.test.ts`: Cross-companion isolation, replay defense, and prompt injection mitigation.
   - `src/t7-release.test.ts`: End-to-end flow from user message to multi-modal experience dispatch.

6. **CLI Generator (`cli`)**:
   - `src/generator.test.ts`: Multi-organ composition invariants, programmatic generated template verification, and runtime parity.

---

## Build Verification

```bash
pnpm -r build
```
- All TypeScript packages and Next.js frontend export build with zero type errors.
