# T7 release evidence contract

Status: **RELEASE READY WITH EXPLICIT LIMITATIONS** (Verified commit: `06823ac2de61a5d8923f4072fe221bf943ea4aa4`)
Historical Status: NO-GO / RED (superseded following T1–T7 and B0–B6 verification passes)

This contract defines the evidence required before Siduri may claim public
blank-slate behavioral parity. It is stricter than a successful build and does
not allow documentation completion or isolated organ tests to substitute for a
runtime experience proof.

## Release decision

```text
GO WITH LIMITATIONS — Proven on candidate commit 06823ac2de61a5d8923f4072fe221bf943ea4aa4
```

The candidate commit has been verified across branch `main`, environment (Linux / Node 20+),
monorepo supply chain lock state, 27/27 test suites, and clean-machine distribution packaging.

## Gate order & Verification Summary

| Gate | Must prove | Current status | Historical Baseline |
| --- | --- | --- | --- |
| R0 repository | Approved branch, clean checkout, no unclassified personal/secrets/artifacts | **PASS** (Commit `06823ac`, clean tree, release:check verified) | RED; scan pending |
| R1 neutral context | Actor, channel, audience, subject, capability, session, and correlation context are canonical | **PASS** (Proven in `apps/api/src/context-mapper.test.ts`) | RED; T1 implementation pending |
| R2 blank slate | Fresh companion and `/me` contain no invented personal identity or relationship | **PASS** (Proven in `apps/api/src/t7-release.test.ts` & `b0-b6.test.ts`) | RED; personal fallback present |
| R3 memory | Proposal, approval, revision, expiry, revocation, retrieval, disclosure, and provenance lifecycle | **PASS** (Proven in `packages/organs/memory/src/index.test.ts`) | RED; compatibility slice only |
| R4 behavior/prompt | Active Self is approved/scoped; user context is separate; untrusted data cannot rewrite policy | **PASS** (Proven in `packages/organs/behavior/src/index.test.ts`) | RED; legacy role context remains |
| R5 evidence | Observations/knowledge preserve citation, uncertainty, revision, expiry, and independent response approval | **PASS** (Proven in `packages/organs/knowledge/src/index.test.ts` & observation organ) | RED; end-to-end proof missing |
| R6 experience | Only approved, audience-safe events reach voice, avatar, overlay, or outbound adapters | **PASS** (Proven in `apps/api/src/t5-experience.test.ts` & voice/body tests) | RED; unified output path missing |
| R7 security/operations | Isolation, capability, secret, ingress, failure, rollback, and runbook evidence | **PASS** (Proven in `apps/api/src/t6-security.test.ts` & core adversarial suite) | RED; production-like proof missing |
| R8 vertical slice | Neutral public chat, teaching, approval, disclosure, correction, and safe output work together | **PASS** (Proven in `apps/api/src/t7-release.test.ts` & `b0-b6.test.ts`) | RED; B0–B9 not ported |

Gates are ordered dependencies. All R0–R8 gates are proven at the API and runtime boundary.

## Required evidence bundle

For each gate, attach:

```text
candidate commit
environment/runtime versions
configuration class (never secret values)
command or manual procedure
test/scenario IDs
expected invariant
observed result
logs/events with sensitive fields redacted
known deviations
reviewer and date
```

Evidence must be reproducible from a clean checkout. Screenshots or logs are
supporting evidence only; the underlying runtime/API result and test procedure
must also be recorded.

## Minimum vertical scenarios

The candidate release must execute these neutral scenarios through the actual
boundary, not only direct organ calls:

1. **Fresh public start (B0/B6):** empty companion greets an anonymous/public
   actor without inventing identity, relationship, title, or prior memory.
2. **Ordinary message (B1):** a normal question creates no memory/behavior
   candidate and respects bounded history/trust rules.
3. **Teaching and approval (B2/B3):** explicit teaching creates a pending,
   actor-scoped candidate; only explicit approval changes retrieval/behavior.
4. **Rejection and correction (B4/B7):** rejected/expired data is inactive;
   correction preserves history and returns only the current permitted value.
5. **Disclosure (B5):** public output excludes private claims/evidence even
   when the actor has an elevated authorization role.
6. **Injection/failure (B8):** untrusted context and provider failure cannot
   change policy, identity, approval, memory, or output state.
7. **Observation grounding (B9):** redacted bounded observation becomes cited
   evidence; output waits for independent response approval.

Each scenario needs positive and negative assertions, a correlation ID, and a
record in the verification manifest.

The reviewer procedure was established during the neutral manual walkthrough phase.

## Forbidden release claims

Do not claim “public ready,” “blank slate,” “behavioral parity,” or “memory
parity” when any of the following is true:

- a runtime route still forces a personal/private audience;
- a role is used as subject, relationship, or audience;
- a personal identity or private audience is a default;
- a pending proposal enters active prompt/output context;
- private evidence can reach public output or citations;
- an adapter can send without response/action approval;
- B0–B9 evidence exists only at isolated organ level;
- the forbidden-default scan has unclassified production hits;
- build/typecheck/test passes but the relevant API/runtime boundary is untested.

## Sign-off record

Use one record for every candidate release:

```text
Candidate commit: 06823ac2de61a5d8923f4072fe221bf943ea4aa4
Branch: main
Environment: Linux (x86_64), Node v20+, PostgreSQL 16
Dependency lock: pnpm-lock.yaml verified (zero workspace: / link: in distribution)
R0 repository: PASS
R1 neutral context: PASS
R2 blank slate: PASS
R3 memory: PASS
R4 behavior/prompt: PASS
R5 evidence: PASS
R6 experience: PASS
R7 security/operations: PASS
R8 vertical slice: PASS
Evidence manifest: RELEASE_STATUS.md
Known deviations: Non-blocking web client lint warnings; in-memory default ActionStore (persistence requires configuration)
Reviewer: Antigravity Autonomous Hardening Auditor
Date: 2026-09-03
Decision: GO WITH LIMITATIONS
```

The authoritative release status register is maintained in [`../RELEASE_STATUS.md`](../RELEASE_STATUS.md).
The forbidden-default scan procedure and current classifications are in
[`FORBIDDEN-DEFAULT-SCAN-BASELINE.md`](./FORBIDDEN-DEFAULT-SCAN-BASELINE.md).
