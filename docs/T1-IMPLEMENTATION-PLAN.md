# T1 P1/P2 implementation plan

Status: authorized next code slice; no T1 runtime implementation has started

This plan translates the T1 contracts into a bounded file-level change. It is
deliberately narrower than full Siduri behavior extraction. The implementation
must establish context and compatibility mapping first, then stop for evidence
review.

## Change boundary

### P1 — core contract

| Target file | Planned change | Must not change yet |
| --- | --- | --- |
| `packages/core/src/context.ts` | Add neutral actor, authorization, capability, channel, audience, subject, conversation, diagnostic, and request types | Memory lifecycle, prompt wording, or provider behavior |
| `packages/core/src/index.ts` | Export the context types and mark legacy role/scope types as compatibility-only where practical | Remove legacy types before adapters are migrated |
| `packages/core/src/context.test.ts` | Assert required fields, legal channel values, actor/subject separation, and diagnostic shape | Use personal names or deployment-specific audiences |

The preferred implementation is a new context module exported from core rather
than expanding the current `MemoryScope` into a misleading universal type.

### P2 — one API mapper

| Target file | Planned change | Must not change yet |
| --- | --- | --- |
| `apps/api/src/context-mapper.ts` | Map the current request envelope and legacy auth role into one neutral `RequestContext` | Add mapper logic to memory, behavior, or UI packages |
| `apps/api/src/context-mapper.test.ts` | Cover T1-01 through T1-10 with neutral fixtures and structured diagnostics | Assert only that a request “looks valid” without checking semantics |
| `apps/api/src/index.ts` | Call the mapper at the API boundary and reject malformed/ambiguous context before runtime invocation | Rewrite teaching, `/me`, clients, or output adapters in this slice |
| `apps/api/src/index.test.ts` or API route test | Prove public/private/operator context handling at the route boundary | Treat direct runtime unit tests as API proof |

If the existing test harness cannot exercise the Express route, add the smallest
route-level harness needed to prove the mapper is actually used. Do not move
legacy interpretation into a test-only helper.

## Target data flow

```text
HTTP request + authenticated actor
          ↓
      context mapper
          ↓
  RequestContext or structured rejection
          ↓
  runtime boundary (context-aware signature)
          ↓
  organs receive neutral context only
```

The first slice may temporarily carry an explicit compatibility projection for
legacy organs, but that projection must be created once, named as legacy, and
never treated as canonical audience or subject state.

## Mapper decision table

| Input condition | Result | Diagnostic requirement |
| --- | --- | --- |
| Public endpoint, valid actor/session, missing audience | Configured public audience | Record that audience was defaulted by public policy |
| Private/operator endpoint, missing audience or capability | Reject | Stable missing-context reason |
| `OWNER`, `VIEWER`, or `OPERATOR` role | Authorization role only | Explicitly record role-to-capability mapping |
| `MASTER_PRIVATE` in public request | Reject/quarantine | Legacy-personal-audience reason |
| `primary_user` subject | Reject global subject or map only with explicit actor consent | No silent canonical claim |
| Missing actor | Anonymous session only if policy permits | No durable subject or approval capability |
| Missing companion ID | Reject | No fallback to `default` or first runtime |
| Missing correlation ID | Reject for stateful operation | No generated silent correlation in the API mapper |
| Conflicting channel/audience/capability | Reject | Preserve all relevant ambiguity codes |

## Required T1 proof

The implementation PR/commit must attach:

1. a completed [extraction change record](./EXTRACTION_CHANGE_RECORD_TEMPLATE.md);
2. core type and mapper test output;
3. route-level evidence showing the mapper is used;
4. a forbidden-default scan with migration exceptions classified;
5. updated [VERIFICATION_EVIDENCE_MANIFEST.md](./VERIFICATION_EVIDENCE_MANIFEST.md);
6. health-audit updates only for findings directly fixed;
7. an explicit list of remaining T1/T2 blockers.

T1 is not complete when only `packages/core` compiles. It is not complete when
the mapper exists but `/chat` still bypasses it. It is not complete when tests
pass only with personal fixture values.

## Stop and review conditions

Return to contract review before continuing if implementation requires:

- changing `OWNER` into a new name for a personal relationship;
- making private audience the public fallback;
- deriving subject from display name, role, route, or authentication alone;
- letting an organ reinterpret legacy values independently;
- changing teaching extraction, memory retrieval, prompt assembly, UI, voice,
  overlay, or outbound behavior in the same unreviewed slice;
- weakening a negative test to preserve current runtime behavior.

After T1 evidence is recorded, the next authorized work is T0 B0/B6 runtime
proof followed by T2 M1/M2 memory lifecycle extraction, as shown on the
[readiness board](./EXTRACTION-READINESS-BOARD.md).
