# Verification evidence manifest

Status: current coverage inventory; parity evidence incomplete

This manifest distinguishes component tests from end-to-end behavior evidence.
A test is evidence only for the invariant it actually exercises.

The first pending boundary is enumerated in
[`T1-IMPLEMENTATION-CHECKLIST.md`](./T1-IMPLEMENTATION-CHECKLIST.md). The
entries below must be updated with actual test names, commands, and results;
the checklist itself is not evidence.

Fixture review follows
[`BLANK-SLATE-FIXTURE-GUIDE.md`](./BLANK-SLATE-FIXTURE-GUIDE.md); neutral test
data is a prerequisite, not a substitute for runtime evidence.

Memory transition evidence must follow
[`T2-MEMORY-STATE-MACHINE.md`](./T2-MEMORY-STATE-MACHINE.md), including the
separate response-approval lifecycle.

Memory disclosure evidence must follow
[`T2-MEMORY-DISCLOSURE-MATRIX.md`](./T2-MEMORY-DISCLOSURE-MATRIX.md), including
positive and negative include/exclude assertions.

Prompt and Active Self evidence must follow
[`T3-ACTIVE-SELF-CONTRACT.md`](./T3-ACTIVE-SELF-CONTRACT.md), including empty
slate, scope, injection, and recipient-validation tests.

Evidence and response tests must follow
[`T4-EVIDENCE-CHAIN-CONTRACT.md`](./T4-EVIDENCE-CHAIN-CONTRACT.md), including
redaction, citation, disclosure, and independent response approval.

Output evidence must follow
[`T5-EXPERIENCE-EVENT-CONTRACT.md`](./T5-EXPERIENCE-EVENT-CONTRACT.md),
including adapter metadata, lifecycle, disclosure, and outbound approval.

Security and operations evidence must follow
[`T6-SECURITY-OPERATIONS-CONTRACT.md`](./T6-SECURITY-OPERATIONS-CONTRACT.md),
including capability, isolation, secret, failure, and runbook tests.

Release evidence must follow
[`T7-RELEASE-EVIDENCE-CONTRACT.md`](./T7-RELEASE-EVIDENCE-CONTRACT.md); a
candidate commit and clean-checkout result are required for every gate.

Current track status and next authorized work are summarized in
[`EXTRACTION-READINESS-BOARD.md`](./EXTRACTION-READINESS-BOARD.md).

## Current evidence

| Current test | What it proves | What it does not prove |
| --- | --- | --- |
| `packages/organs/memory/src/index.test.ts` isolation tests | `companion_id` is bound into memory SQL and claims/directives do not cross-read | Public blank slate, neutral subject mapping, complete lifecycle, or API routing |
| `packages/organs/memory/src/index.test.ts` FTS tests | Token filtering, simple dictionary, OR/prefix query construction | Correct audience/channel policy or private disclosure at runtime boundary |
| `packages/organs/memory/src/index.test.ts` provenance test | Some provenance fields and requested-scope filtering are preserved | Source-event requirement for every confirmed claim, expiry, revocation, or public/private contract |
| `packages/organs/behavior/src/index.test.ts` | Directive status filtering, priority ordering, scope matching, and injection filtering | Neutral actor/channel/audience semantics or learned-vs-self separation |
| `packages/organs/brain/src/index.test.ts` | Provider request schema, malformed-response retry, endpoint configuration, and prompt section assembly | Empty-memory runtime behavior, no personal defaults, knowledge suppression, or public disclosure |
| `apps/api/src/runtime.test.ts` | A narrow standalone runtime response/proposal path using legacy role/scope values | Public API routing, fresh companion behavior, actor identity, approval boundary, or B0–B9 |
| `apps/api/src/smoke.test.ts` | Postgres isolation and directive mutation constraints with fixture companions | Public blank slate, neutral identifiers, response approval, or web behavior |
| `packages/organs/observation/src/index.test.ts` | Bounded evidence, raw-frame non-retention, duplicate suppression, expiry, and malformed reading rejection | Grounded knowledge, response approval, public output, or live capture |
| `packages/organs/knowledge/src/index.test.ts` | Pack/provider loading, citation/revision preservation, and retrieval fallback | Untrusted-context policy, memory proposals, or public/private disclosure |
| `packages/organs/voice`, `body`, and `vision` tests | Local adapter behavior, lifecycle events, queueing, image requests, and crop logic | End-to-end Siduri experience, blank slate, memory safety, or approval policy |
| `apps/gateway` and `apps/memory-service` tests | Service scaffolding and isolated service behavior where covered | The canonical runtime/API path or extracted original chat behavior |

## B0–B9 evidence status

| Scenario | Required evidence | Current status |
| --- | --- | --- |
| B0 fresh companion is empty | API/runtime initialization and empty-memory chat | Missing; current runtime has personal defaults |
| B1 ordinary conversation is not teaching | API/runtime negative teaching test | Missing |
| B2 explicit teaching is pending | API/runtime candidate + source-event test | Partial organ APIs; missing neutral actor-scoped subject |
| B3 approval promotes one candidate | Separate claim/directive approval integration test | Partial isolated methods; missing complete runtime receipt/effect evidence |
| B4 rejection/session-only is inactive | Retrieval after rejection/expiry | Missing at public runtime boundary |
| B5 disclosure is audience-safe | Public/private retrieval and response evidence test | Missing; current chat route forces legacy private/owner semantics |
| B6 identity is not inferred | Empty-memory identity question with no external search | Missing |
| B7 correction preserves history | Revision/supersession integration test | Partial storage compatibility; not proven end-to-end |
| B8 untrusted context cannot alter policy | Runtime prompt-injection test with retrieved context | Partial organ prompt/directive tests; missing runtime path |
| B9 observation is bounded/approved | Observation → grounding → response approval integration test | Partial observation organ; grounding and approval path missing |

## Health-gate evidence status

| Gate | Evidence required | Current status |
| --- | --- | --- |
| Neutral core context | Types and mapper separate actor, channel, audience, subject | Missing; current core overloads `MemoryScope` |
| No private default chat route | API test sends public request with explicit audience | Missing; `/chat` forces `OWNER` |
| No personal runtime defaults | Forbidden-default scan with classified exceptions | Failing; see health audit |
| Blank `/me` | API test with empty profile | Failing; returns `Primary User` |
| Dynamic client companion | Two-companion web/operator integration test | Failing; clients send `default` |
| Release readiness | Full checklist and clean checkout verification | RED; see [PUBLIC_RELEASE_READINESS.md](./PUBLIC_RELEASE_READINESS.md) |

## T1 P1/P2 evidence status

| Checklist cases | Required boundary proof | Current status |
| --- | --- | --- |
| T1-01, T1-02 | Public chat resolves configured public context and does not turn authorization into a private relationship | Missing; `/chat` still forces `OWNER` |
| T1-03, T1-04 | Private/operator requests require explicit channel, audience, and capability | Missing; neutral request context is not present at the API boundary |
| T1-05, T1-06 | Personal global subject/audience values are rejected or quarantined in public mode | Failing; runtime still contains `primary_user` and `MASTER_PRIVATE` defaults |
| T1-07, T1-08 | Anonymous teaching policy and companion isolation survive context mapping | Missing at runtime boundary; isolated storage tests are insufficient |
| T1-09, T1-10 | Stateful requests require correlation metadata and expose ambiguity diagnostics | Missing; no canonical compatibility mapper exists |

T1 cannot be marked complete from the existing organ tests. Each row needs a
direct contract or API/runtime test and a recorded result before the health
audit can move its corresponding finding.

## Required additions

The next test work should be added in this order:

1. neutral core context and compatibility-mapper tests;
2. B0 and B6 empty-memory API/runtime tests;
3. B2/B3/B4 teaching, approval, rejection, and expiry tests;
4. B5 public/private disclosure tests;
5. B7/B8 lifecycle and trust-boundary tests;
6. B9 grounded observation and response-approval test;
7. two-companion web/operator discovery test;
8. clean-checkout release verification.

Do not delete or weaken existing isolation and provider tests while adding this
coverage. The goal is additive proof: component behavior plus extracted
experience behavior.

## Evidence rule

The historical handoff may report green builds and isolated tests, but those
results cannot close a B0–B9 or health gate unless the test crosses the
relevant boundary. The manifest is complete only when every “Missing” or
“Partial” row has a linked test and recorded result.

Release-level command procedures are maintained in
[`PUBLIC_RELEASE_READINESS.md`](./PUBLIC_RELEASE_READINESS.md#repeatable-verification-commands).
Evidence-specific acceptance gates are maintained in
[`EVIDENCE-EXTRACTION-HANDOFF.md`](./EVIDENCE-EXTRACTION-HANDOFF.md).
Output/lifecycle acceptance gates are maintained in
[`EXPERIENCE-EXTRACTION-HANDOFF.md`](./EXPERIENCE-EXTRACTION-HANDOFF.md).
