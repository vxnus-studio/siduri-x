# Siduri-Y extraction track map

Status: ordered implementation map; current track remains RED

This map is the dependency order for extracting the original Siduri
experience. It is intentionally separate from the older numbered knowledge,
deployment, and modularization handoffs.

## Dependency flow

```text
baseline evidence
        ↓
neutral contracts + compatibility boundary
        ↓
memory and teaching lifecycle
        ↓
Active Self and prompt behavior
        ↓
evidence, grounding, and response approval
        ↓
voice, avatar, overlay, platform, and outbound experience
        ↓
security, operations, vertical checks, release gate
```

No later track may use a legacy personal/private interpretation to bypass an
earlier missing contract.

## Track sequence

| Track | Authority | Current state | Dependency | Exit evidence |
| --- | --- | --- | --- | --- |
| T0 — baseline | [PHASE-0-EXTRACTION-BASELINE.md](./PHASE-0-EXTRACTION-BASELINE.md), [PHASE-0-GOLDEN-TRACE.md](./PHASE-0-GOLDEN-TRACE.md) | Specified; fixtures not ported | Original Siduri tests | B0–B9 neutral fixtures and traces |
| T1 — contracts | [PHASE-1-EXTRACTION-HANDOFF.md](./PHASE-1-EXTRACTION-HANDOFF.md), [NEUTRAL_CONTRACT_DECISIONS.md](./NEUTRAL_CONTRACT_DECISIONS.md), [T1-IMPLEMENTATION-CHECKLIST.md](./T1-IMPLEMENTATION-CHECKLIST.md) | Ready; implementation pending | T0 definitions | Core context types and one compatibility mapper |
| T2 — memory | [PHASE-2-MEMORY-EXTRACTION-HANDOFF.md](./PHASE-2-MEMORY-EXTRACTION-HANDOFF.md) | Ready after T1 | T1 actor/subject/audience/lifecycle | Source events, candidates, approval, revision, disclosure |
| T3 — behavior | [BEHAVIOR-EXTRACTION-HANDOFF.md](./BEHAVIOR-EXTRACTION-HANDOFF.md) | Ready after T2 | T1 context + T2 approved memory | Neutral Active Self and prompt trust tests |
| T4 — evidence | [EVIDENCE-EXTRACTION-HANDOFF.md](./EVIDENCE-EXTRACTION-HANDOFF.md), [T4-EVIDENCE-CHAIN-CONTRACT.md](./T4-EVIDENCE-CHAIN-CONTRACT.md) | Ready after T2/T1 | T1 audience + T2 provenance | Grounded citations and independent response approval |
| T5 — experience | [EXPERIENCE-EXTRACTION-HANDOFF.md](./EXPERIENCE-EXTRACTION-HANDOFF.md) | Ready after T4 | T4 approved response/event contract | Voice/body/overlay/platform output gates |
| T6 — security/operations | [SECURITY-OPERATIONS-EXTRACTION-HANDOFF.md](./SECURITY-OPERATIONS-EXTRACTION-HANDOFF.md) | Pending | T0–T5 | Isolation, secrets, failure, approval, and audit evidence |
| T7 — release | [PUBLIC_RELEASE_READINESS.md](./PUBLIC_RELEASE_READINESS.md), [REPOSITORY_HEALTH_AUDIT.md](./REPOSITORY_HEALTH_AUDIT.md) | RED | T0–T6 | Clean scan, runtime evidence, manual vertical slice |

## Current critical path

The shortest path to a meaningful health improvement is:

1. T1 P1/P2: define neutral context and map legacy request shapes;
2. T0 B0/B6: prove fresh-companion and identity-question behavior at runtime;
3. T2 M1/M2: replace global personal subjects in memory extraction;
4. T2 M4: enforce public/private retrieval policy;
5. T3 A3: assemble neutral prompts from approved context;
6. T4 E3/E4: stage and approve grounded responses independently;
7. T5 X6: connect only approved plans to visible/outbound experience.

## Track status rules

- “Ready” means the handoff is specific enough to implement, not that the
  behavior exists.
- “Partial” means an adapter or isolated test exists, not parity.
- “Complete” requires the handoff exit criteria, verification manifest, and
  health audit to agree.
- A historical knowledge/deployment phase marked complete does not advance this
  extraction track.

## Contributor rule

Every implementation change must name its track, dependency, original source,
neutral contract, blank-slate impact, test evidence, and health-gate movement.
Use [EXTRACTION_CHANGE_RECORD_TEMPLATE.md](./EXTRACTION_CHANGE_RECORD_TEMPLATE.md).
Classify the original source with
[EXTRACTION_SOURCE_CATALOG.md](./EXTRACTION_SOURCE_CATALOG.md) before using it.
