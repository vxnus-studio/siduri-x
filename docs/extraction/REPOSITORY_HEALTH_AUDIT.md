# Siduri-Y repository health audit

Audit status: **RED**

Audit scope: public distribution, blank-slate initialization, extracted Siduri
behavior, memory safety, and documentation truthfulness.

This audit is a baseline for the extraction phase. It does not claim that the
current runtime is healthy because build or unit tests pass.

## Executive result

Siduri-Y is structurally decoupled, but it is not yet a healthy public
blank-slate companion runtime. The remaining issues are behavioral and
contract-level, not merely cosmetic:

- the public chat route is forced through a private/owner model;
- legacy personal memory subjects and audiences remain in production code;
- the runtime and UI contain personal relationship teaching assumptions;
- companion selection is hardcoded to a default ID in client paths;
- several historical documents previously overstated parity or completion.

The documentation claims have now been corrected. The runtime violations are
intentionally retained as the next extraction implementation work.

The identifier-by-identifier removal policy is in
[`LEGACY_IDENTIFIER_MIGRATION.md`](./LEGACY_IDENTIFIER_MIGRATION.md).
The release go/no-go checklist is in
[`PUBLIC_RELEASE_READINESS.md`](./PUBLIC_RELEASE_READINESS.md).
The broader current limitations register is in
[`limitations.md`](./limitations.md).
The test-boundary evidence inventory is in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
The ordered critical path is in
[`EXTRACTION_TRACK_MAP.md`](./EXTRACTION_TRACK_MAP.md).
Security and operations readiness is specified in
[`SECURITY-OPERATIONS-EXTRACTION-HANDOFF.md`](./SECURITY-OPERATIONS-EXTRACTION-HANDOFF.md).
The next-session implementation boundary is recorded in
[`CURRENT_EXTRACTION_HANDOFF.md`](./CURRENT_EXTRACTION_HANDOFF.md).

## Severity findings

### H1 — chat routing violates public channel semantics

Evidence: [apps/api/src/index.ts:113](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/apps/api/src/index.ts:113)

`/chat` describes itself as a private surface and routes the request as
`OWNER`. This conflates authentication with conversation audience and means a
public caller cannot exercise the neutral public contract.

Required disposition: extract the channel/audience contract first, then route
chat using explicit request context. Do not merely rename `OWNER` to another
role.

### H1 — personal audience and subject defaults remain in runtime

Evidence:

- [apps/api/src/runtime.ts:21](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/apps/api/src/runtime.ts:21)
- [apps/api/src/runtime.ts:26](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/apps/api/src/runtime.ts:26)
- [apps/api/src/runtime.ts:37](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/apps/api/src/runtime.ts:37)
- [apps/api/src/runtime.ts:209](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/apps/api/src/runtime.ts:209)

Teaching and model proposals default to `primary_user` and `MASTER_PRIVATE`,
and recognize a creator relationship. These are personal deployment concepts,
not public Siduri-Y defaults.

Required disposition: map explicit teaching to an actor-scoped subject and a
configured audience. Relationship claims remain pending until approval.

### H1 — hardcoded user identity is exposed by the API

Evidence: [apps/api/src/index.ts:101](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/apps/api/src/index.ts:101)

`/me` returns `Primary User` for every caller. A blank-slate companion must not
invent a user name or relationship.

Required disposition: return actor/authentication metadata separately from any
learned subject profile, with no personal fallback.

### H2 — web clients hardcode companion identity and creator teaching

Evidence:

- [apps/web/src/app/chat/chat-client.tsx:211](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/apps/web/src/app/chat/chat-client.tsx:211)
- [apps/web/src/app/chat/chat-client.tsx:439](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/apps/web/src/app/chat/chat-client.tsx:439)
- [apps/web/src/app/operator/operator-client.tsx:347](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/apps/web/src/app/operator/operator-client.tsx:347)

The UI hardcodes `default` companion IDs and presents a creator relationship as
a teaching template. This prevents the public product from being a genuinely
fresh companion experience.

Required disposition: obtain companion context from runtime/configuration and
offer neutral teaching prompts.

### H2 — legacy personal aliases remain in memory presentation and fixtures

Evidence:

- [apps/web/src/lib/memory-display.ts:14](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/apps/web/src/lib/memory-display.ts:14)
- [packages/organs/memory/src/index.test.ts:106](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/packages/organs/memory/src/index.test.ts:106)
- [packages/organs/memory/src/index.test.ts:118](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/packages/organs/memory/src/index.test.ts:118)

The display and tests still encode `primary_user`, `master`, and
`MASTER_PRIVATE`. Explicit migration tests may mention legacy values, but
canonical public fixtures must use neutral subjects and audiences.

### H3 — historical documentation was previously misleading

Evidence corrected in:

- [docs/handoff.md](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/docs/handoff.md)
- [docs/implementation.md](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/docs/implementation.md)
- [docs/memory.md](/home/zagin/Projects/vxnuslabs/architecture/siduri-y/docs/memory.md)

Older knowledge/deployment handoffs now identify their phase track and scope.
The extraction roadmap is the authoritative parity status.

## Positive controls already present

- organ boundaries and companion isolation exist;
- the brain prompt includes a neutral/no-prior-knowledge rule;
- memory proposals have pending states and provenance fields;
- observation work has bounded retention and evidence identifiers;
- extraction, blank-slate, matrix, baseline, and contract documents now define
  the target state;
- documentation diff validation passes.

These controls are foundations, not evidence that the H1 findings are fixed.

## Health gates

The repository may move from RED to AMBER only after:

1. neutral actor/channel/audience contracts exist in core;
2. `/chat` no longer forces a private personal route;
3. no runtime default uses `primary_user` or `MASTER_PRIVATE`;
4. a fresh companion has no hardcoded user identity;
5. B0, B2, B4, B5, and B6 pass at the runtime/API boundary;
6. web and operator clients resolve companion context dynamically.

It may move from AMBER to GREEN only after the complete B0–B9 baseline,
memory lifecycle, disclosure, provenance, and vertical experience checks pass.

## Verification record

The audit was produced from repository searches, source inspection, and the
original Siduri tests/docs under `/home/zagin/Projects/vxnuslabs/siduri/`.
`git diff --check` passes for the documentation changes. Runtime changes are
not included in this audit turn.

The release checklist contains the repeatable branch, forbidden-default, and
build/test commands:
[`PUBLIC_RELEASE_READINESS.md`](./PUBLIC_RELEASE_READINESS.md#repeatable-verification-commands).
The current classified scan baseline is maintained in
[`FORBIDDEN-DEFAULT-SCAN-BASELINE.md`](./FORBIDDEN-DEFAULT-SCAN-BASELINE.md).
