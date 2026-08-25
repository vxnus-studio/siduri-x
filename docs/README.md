# Siduri-Y documentation index

Siduri-Y has two documentation tracks: the current behavior-extraction track
and older implementation/knowledge handoffs. Read the current track first.

## Authority order

When documents disagree, use this order:

1. [Repository health audit](./REPOSITORY_HEALTH_AUDIT.md) — current health,
   severity, and evidence.
2. [Behavior extraction boundary](./SIDURI_BEHAVIOR_EXTRACTION.md) — what is
   extracted from original Siduri and what is deliberately excluded.
3. [Blank-slate contract](./BLANK_SLATE_CONTRACT.md) — public default
   invariants.
4. [Neutral contract decisions](./NEUTRAL_CONTRACT_DECISIONS.md) — canonical
   actor, channel, audience, subject, memory, and approval semantics.
5. [Parity roadmap](./SIDURI_PARITY_ROADMAP.md) — phase status and exit gates.
6. [Extraction matrix](./SIDURI_EXTRACTION_MATRIX.md) — source-to-contract
   inventory.
7. [Phase 0 baseline](./PHASE-0-EXTRACTION-BASELINE.md) — executable scenario
   requirements.
8. [Phase 1 extraction handoff](./PHASE-1-EXTRACTION-HANDOFF.md) — next
   implementation work packages.
9. [Extraction change record template](./EXTRACTION_CHANGE_RECORD_TEMPLATE.md)
   — evidence required for each future behavior or memory change.
10. [Legacy identifier migration](./LEGACY_IDENTIFIER_MIGRATION.md) — removal
    map for personal and overloaded identifiers.
11. [Public release readiness](./PUBLIC_RELEASE_READINESS.md) — go/no-go
    checklist for a public blank-slate release.
12. [Limitations](./limitations.md) — current known gaps and non-completion
    conditions.
13. [Open extraction decisions](./OPEN_EXTRACTION_DECISIONS.md) — policy
    questions that must not be resolved implicitly in runtime code.
14. [Phase 0 golden trace](./PHASE-0-GOLDEN-TRACE.md) — neutral state and
    response transitions to port as executable fixtures.
15. [Verification evidence manifest](./VERIFICATION_EVIDENCE_MANIFEST.md) —
    what current tests prove and what parity evidence is missing.
16. [Phase 2 memory extraction handoff](./PHASE-2-MEMORY-EXTRACTION-HANDOFF.md)
    — lifecycle and disclosure implementation target.
17. [Behavior extraction handoff](./BEHAVIOR-EXTRACTION-HANDOFF.md) — Active
    Self, prompt, and disclosure implementation target.
18. [Evidence extraction handoff](./EVIDENCE-EXTRACTION-HANDOFF.md) — grounding,
    citations, observations, and response approval target.
19. [Experience extraction handoff](./EXPERIENCE-EXTRACTION-HANDOFF.md) — voice,
    avatar, overlay, platform, and outbound delivery target.
20. [Extraction track map](./EXTRACTION_TRACK_MAP.md) — dependency order across
    all current extraction handoffs.
21. [Security and operations extraction handoff](./SECURITY-OPERATIONS-EXTRACTION-HANDOFF.md)
    — public deployment, isolation, failure, and audit target.
22. [Extraction source catalog](./EXTRACTION_SOURCE_CATALOG.md) — which
    original files are behavioral oracles versus personal/domain data.
23. [Current extraction handoff](./CURRENT_EXTRACTION_HANDOFF.md) — current
    RED status and the next authorized implementation slice.
24. [T1 neutral context specification](./T1-NEUTRAL-CONTEXT-SPEC.md) — concrete
    actor, channel, audience, subject, and compatibility shapes.
25. [T1 implementation checklist](./T1-IMPLEMENTATION-CHECKLIST.md) — bounded
    P1/P2 work packages, test matrix, and stop conditions.
26. [Original source traceability](./ORIGINAL-SOURCE-TRACEABILITY.md) — exact
    original tests mapped to neutral B0–B9 behavior and memory guarantees.
27. [Blank-slate fixture guide](./BLANK-SLATE-FIXTURE-GUIDE.md) — neutral
    fixture envelope, identifier rules, and review checklist.
28. [T2 memory state machine](./T2-MEMORY-STATE-MACHINE.md) — neutral claim,
    behavior, response, approval, revision, expiry, and retrieval lifecycle.
29. [T3 Active Self contract](./T3-ACTIVE-SELF-CONTRACT.md) — approved behavior,
    prompt trust boundaries, scope filtering, and failure semantics.
30. [T4 evidence-chain contract](./T4-EVIDENCE-CHAIN-CONTRACT.md) — provenance,
    grounding, disclosure filtering, and response approval.
31. [T5 experience event contract](./T5-EXPERIENCE-EVENT-CONTRACT.md) — approved
    voice, avatar, overlay, ingress, and outbound event boundaries.
32. [T6 security and operations contract](./T6-SECURITY-OPERATIONS-CONTRACT.md)
    — capability, isolation, secrets, failure, ingress, egress, and runbook
    boundaries.

## Current status

Siduri-Y is **RED** for public blank-slate and behavioral parity. The organs
are integrated, but runtime contracts still contain legacy personal/private
assumptions. The health audit is the authoritative status document.

## Reference repository

The original repository is the behavioral and memory reference:

```text
/home/zagin/Projects/vxnuslabs/siduri/
```

Extract its safety boundaries, lifecycle, provenance, prompt behavior, and
user-visible outcomes. Do not copy its personal identity, relationship policy,
recipient names, or deployment configuration into Siduri-Y defaults.

## Historical documents

The following are useful implementation records but are not current parity
status:

- `handoff.md` and `PHASE-1-PARITY-HANDOFF.md` — earlier compatibility slices;
- `PHASE-1-HANDOFF.md` through `PHASE-8-HANDOFF.md` — knowledge, deployment,
  observation, or modularization tracks;
- `phase4-modularization.md` — experimental API/MCP service-boundary track;
- `implementation.md`, `organs.md`, and organ-specific pages — component
  baselines, not proof of extracted behavior.

Historical “complete” language is scoped to its original track and cannot
override the health audit or extraction roadmap.

## Contributor rule

Before adding a behavior or memory implementation:

1. identify the original source/test that defines the behavior;
2. identify the neutral contract it maps to;
3. preserve blank-slate defaults;
4. add the scenario and acceptance evidence;
5. update the extraction matrix and health status.

Do not mark parity complete because a package builds or a compatibility test
passes.

For a concrete change, copy
[`EXTRACTION_CHANGE_RECORD_TEMPLATE.md`](./EXTRACTION_CHANGE_RECORD_TEMPLATE.md)
and attach the completed record to the implementation work.
