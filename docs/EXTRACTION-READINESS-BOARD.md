# Siduri-Y extraction readiness board

Status: **RED — contracts documented, runtime extraction not yet implemented**

This is the short operational view of the current extraction program. The
individual contracts remain authoritative for implementation detail; this page
answers what is ready, what is proven, and what the next permitted slice is.

## Track board

| Track | Contract authority | Documentation state | Runtime/evidence state | Next permitted action |
| --- | --- | --- | --- | --- |
| T0 baseline | [PHASE-0-EXTRACTION-BASELINE.md](./PHASE-0-EXTRACTION-BASELINE.md), [ORIGINAL-SOURCE-TRACEABILITY.md](./ORIGINAL-SOURCE-TRACEABILITY.md) | Complete enough to implement fixtures | B0–B9 not ported at API/runtime | Create neutral fixtures and record results |
| T1 context | [T1-NEUTRAL-CONTEXT-SPEC.md](./T1-NEUTRAL-CONTEXT-SPEC.md), [T1-IMPLEMENTATION-CHECKLIST.md](./T1-IMPLEMENTATION-CHECKLIST.md) | Ready | RED; no canonical mapper in runtime | Implement core context types, one API mapper, T1-01–T1-06 |
| T2 memory | [T2-MEMORY-STATE-MACHINE.md](./T2-MEMORY-STATE-MACHINE.md), [PHASE-2-MEMORY-EXTRACTION-HANDOFF.md](./PHASE-2-MEMORY-EXTRACTION-HANDOFF.md) | Ready after T1 | Compatibility lifecycle only | Implement actor-scoped candidates and lifecycle after T1 |
| T3 behavior | [T3-ACTIVE-SELF-CONTRACT.md](./T3-ACTIVE-SELF-CONTRACT.md), [BEHAVIOR-EXTRACTION-HANDOFF.md](./BEHAVIOR-EXTRACTION-HANDOFF.md) | Ready after T2 | Legacy `activeRole` semantics remain | Replace compiler context after T2 evidence |
| T4 evidence | [T4-EVIDENCE-CHAIN-CONTRACT.md](./T4-EVIDENCE-CHAIN-CONTRACT.md), [EVIDENCE-EXTRACTION-HANDOFF.md](./EVIDENCE-EXTRACTION-HANDOFF.md) | Ready after T1/T2 | Isolated adapters; no complete response gate | Wire evidence and independent response approval |
| T5 experience | [T5-EXPERIENCE-EVENT-CONTRACT.md](./T5-EXPERIENCE-EVENT-CONTRACT.md), [EXPERIENCE-EXTRACTION-HANDOFF.md](./EXPERIENCE-EXTRACTION-HANDOFF.md) | Ready after T4 | Adapter baseline; unified event path absent | Dispatch only approved neutral events |
| T6 security | [T6-SECURITY-OPERATIONS-CONTRACT.md](./T6-SECURITY-OPERATIONS-CONTRACT.md), [SECURITY-OPERATIONS-EXTRACTION-HANDOFF.md](./SECURITY-OPERATIONS-EXTRACTION-HANDOFF.md) | Documented; pending dependencies | Production-like security evidence missing | Test after context/output paths exist |
| T7 release | [T7-RELEASE-EVIDENCE-CONTRACT.md](./T7-RELEASE-EVIDENCE-CONTRACT.md), [PUBLIC_RELEASE_READINESS.md](./PUBLIC_RELEASE_READINESS.md) | Go/no-go target documented | NO-GO; health audit is RED | Do not release until R0–R8 pass |

## Current blockers

These are implementation findings, not documentation tasks:

1. `/chat` still routes through a legacy private/owner interpretation.
2. Runtime teaching/retrieval still contains personal subject/audience
   defaults.
3. `/me` still returns an invented personal identity.
4. Web/operator clients still assume a default companion ID and personal
   teaching copy.
5. Core and organ boundaries still expose legacy role/scope semantics.
6. B0–B9 have no complete neutral API/runtime evidence.

Exact source locations and severity are maintained in
[`REPOSITORY_HEALTH_AUDIT.md`](./REPOSITORY_HEALTH_AUDIT.md). Do not mark a
blocker resolved because a contract document exists.
Scan classifications and the next regression command are maintained in
[`FORBIDDEN-DEFAULT-SCAN-BASELINE.md`](./FORBIDDEN-DEFAULT-SCAN-BASELINE.md).
Review vocabulary is standardized in
[`NEUTRAL-TERMINOLOGY-GLOSSARY.md`](./NEUTRAL-TERMINOLOGY-GLOSSARY.md).
HTTP boundary examples are maintained in
[`T1-API-CONTRACT-EXAMPLES.md`](./T1-API-CONTRACT-EXAMPLES.md).
The expected manual experience sequence is maintained in
[`PHASE-0-NEUTRAL-MANUAL-WALKTHROUGH.md`](./PHASE-0-NEUTRAL-MANUAL-WALKTHROUGH.md).

## Next implementation slice

The next code change is limited to T1 P1/P2:

See [`T1-IMPLEMENTATION-PLAN.md`](./T1-IMPLEMENTATION-PLAN.md) for the exact
file and test boundary.

```text
neutral core context types
        ↓
one API compatibility mapper
        ↓
explicit public/private/operator request validation
        ↓
T1 contract tests and B0/B6 fixture expression
```

Do not modify teaching extraction, memory retrieval, prompt wording, UI copy,
voice, overlay, or outbound wiring in that slice. Those changes depend on the
context boundary and would make the extracted semantics harder to audit.

## Evidence discipline

Every implementation change must include:

- original source/test reference;
- neutral contract mapping;
- blank-slate impact assessment;
- fixture and negative test;
- API/runtime evidence where the track requires it;
- health-gate movement only for findings directly proven fixed;
- updated [VERIFICATION_EVIDENCE_MANIFEST.md](./VERIFICATION_EVIDENCE_MANIFEST.md).

Use [EXTRACTION_CHANGE_RECORD_TEMPLATE.md](./EXTRACTION_CHANGE_RECORD_TEMPLATE.md)
for the record. The release decision remains NO-GO while any required evidence
is missing, partial, indirect, or contradicted by a production scan.
