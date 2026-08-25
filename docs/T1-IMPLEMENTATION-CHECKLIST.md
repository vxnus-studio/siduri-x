# T1 implementation checklist

Status: documentation target; T1 P1/P2 is not implemented

This checklist is the execution companion to
[`T1-NEUTRAL-CONTEXT-SPEC.md`](./T1-NEUTRAL-CONTEXT-SPEC.md). It limits the
first implementation slice to the context boundary and one compatibility
mapper. It is not permission to redesign memory, prompts, teaching, or the
web experience in the same change.

All test data for this slice follows the
[`BLANK-SLATE-FIXTURE-GUIDE.md`](./BLANK-SLATE-FIXTURE-GUIDE.md).

## P1 — core context contracts

| Item | Target | Required proof |
| --- | --- | --- |
| Actor | Add opaque actor/session identity, authentication state, authorization role, and capabilities | Type-level contract test; no role-to-subject conversion |
| Conversation | Add channel, configured audience, live flag, and correlation ID | Public/direct/private/operator validation tests |
| Subject | Add explicit typed subject reference with optional actor ownership | Anonymous request produces no durable subject |
| Request | Require companion ID and the complete context before an organ call | Missing-context rejection test |
| Diagnostics | Preserve mapping ambiguity and rejection reasons | Structured diagnostic assertion |
| Compatibility | Keep legacy role/scope inputs marked as boundary-only | Search and type test showing organs consume neutral context |

The contract must distinguish these independent questions:

```text
authorization  -> what the actor may do
channel        -> where the interaction occurs
audience       -> who may receive or retrieve the result
subject        -> whose claim or directive is being discussed
capability     -> which operation is explicitly permitted
```

## P2 — one compatibility boundary

Create one mapper at the API request boundary. The mapper must be the only
place that interprets legacy `OWNER`, `VIEWER`, `OPERATOR`, missing channel,
missing audience, `MASTER_PRIVATE`, `primary_user`, or `default` values.

Required mapper behavior:

1. A declared public endpoint with no audience resolves to configured public
   context and never to a private audience.
2. A private or operator request without explicit channel, audience, and
   capability fails with a structured error.
3. `OWNER` maps only to authorization; it does not create a relationship,
   subject, or private audience.
4. `primary_user` is rejected as a global canonical subject. An explicit,
   consent-eligible actor may receive an actor-scoped subject.
5. `MASTER_PRIVATE` is accepted only as an explicit migration marker, never as
   a public default.
6. `default` is not a canonical companion identity; clients must use resolved
   configuration or discovery.
7. The mapper preserves companion isolation and correlation metadata.

No organ may contain a second legacy mapping. If an organ needs a field that
does not exist in the neutral request context, stop and extend the contract
with evidence rather than adding a local fallback.

## Test matrix

| Case | Input | Expected result | Evidence location |
| --- | --- | --- | --- |
| T1-01 | Anonymous public chat, no audience | Configured public audience; no subject; accepted if public chat is enabled | API/runtime contract test |
| T1-02 | `OWNER` public chat | Authorization metadata only; no private route or relationship | API regression test |
| T1-03 | Private chat without capability | Rejected before organ invocation | API negative test |
| T1-04 | Operator request without operator context | Rejected with diagnostic | API negative test |
| T1-05 | Global `primary_user` input | Rejected or quarantined at mapper | Compatibility test |
| T1-06 | `MASTER_PRIVATE` in public mode | Rejected; no fallback | Compatibility test |
| T1-07 | Missing actor on explicit teaching | Pending/anonymous policy only; no durable profile | Memory-boundary test |
| T1-08 | Two companion IDs, same actor | Context and memory remain isolated | Integration test |
| T1-09 | Missing correlation ID | Rejected before stateful operation | Contract test |
| T1-10 | Ambiguous legacy request | Structured ambiguity diagnostic; no silent interpretation | Mapper test |

The first implementation must include T1-01 through T1-06. T1-07 through
T1-10 are required before the phase can move to the memory adapter.

## Evidence and documentation updates required with implementation

The implementation change must include a completed copy of
[`EXTRACTION_CHANGE_RECORD_TEMPLATE.md`](./EXTRACTION_CHANGE_RECORD_TEMPLATE.md)
and update, in the same change:

- [`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md)
  with actual test commands and results;
- [`REPOSITORY_HEALTH_AUDIT.md`](./REPOSITORY_HEALTH_AUDIT.md) only for
  findings directly proven fixed;
- [`CURRENT_EXTRACTION_HANDOFF.md`](./CURRENT_EXTRACTION_HANDOFF.md) with the
  remaining authorized slice;
- [`EXTRACTION_TRACK_MAP.md`](./EXTRACTION_TRACK_MAP.md) with T1 status;
- [`PUBLIC_RELEASE_READINESS.md`](./PUBLIC_RELEASE_READINESS.md) if a release
  gate changes.

## Explicit stop conditions

Stop the change and return to contract review if any test or implementation
requires:

- a personal name, creator relationship, or private audience default;
- an authentication role to act as a subject or audience;
- an organ-specific legacy mapper;
- durable anonymous identity without a documented consent policy;
- memory or behavior activation during request generation;
- a claim that build/typecheck success proves behavioral parity.

T1 is complete only when the acceptance tests in the neutral specification,
the cases above, and the Phase 1 exit criteria all have direct runtime/API
evidence.
