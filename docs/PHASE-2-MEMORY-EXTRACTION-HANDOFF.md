# Phase 2 — memory behavior extraction handoff

Status: ready after Phase 1 neutral contracts

> This is the behavior-extraction Phase 2. It is distinct from the older
> knowledge/deployment and grounded-observation handoffs that use the same
> numeric phase family.

## Objective

Extract the original Siduri memory and teaching behavior into the neutral
Siduri-Y contracts without copying personal subjects, recipients, or domain
fields. The memory organ must preserve lifecycle, provenance, disclosure, and
revision behavior across replaceable adapters.

The normative transition and retrieval contract for this phase is in
[`T2-MEMORY-STATE-MACHINE.md`](./T2-MEMORY-STATE-MACHINE.md).
Disclosure fixtures and expected include/exclude results are in
[`T2-MEMORY-DISCLOSURE-MATRIX.md`](./T2-MEMORY-DISCLOSURE-MATRIX.md).

## Original sources

- `siduri/packages/memory/service.py`
  (`SourceEvent`, `VersionedClaim`, `MemoryProposal`, `BehavioralDirective`,
  retrieval, approval, revision, and audit operations);
- `siduri/packages/memory/teaching.py` (bounded deterministic extraction);
- `siduri/packages/memory/postgres.py` (persistence and retrieval behavior);
- `siduri/docs/memory/TEACH_SIDURI.md` (lifecycle and provenance policy);
- `siduri/docs/memory/MEMORY_MODEL.md` (proposal/approval boundary);
- `siduri/docs/memory/PUBLIC_DISCLOSURE_POLICY.md` (audience safety);
- `siduri/tests/test_explicit_teaching.py`;
- `siduri/tests/test_behavioral_memory.py`;
- `siduri/tests/test_chat.py` teaching and pending-candidate cases;
- `siduri/tests/test_teach_mode_evaluation.py`.

Original personal values are fixtures or deployment configuration. Extract the
invariants and outcomes, not `primary_user`, personal recipient names, creator
defaults, or game-specific fields.

## Work packages

### M1 — canonical memory model

Represent, without loss:

- companion/tenant identity;
- actor-scoped subject reference;
- subject, predicate, bounded value, and claim type;
- source event and evidence;
- authority, confidence, sensitivity, and allowed audiences;
- candidate status and confirmation decision;
- valid-from/valid-until and expiry;
- supersedes/replaces/revokes relationships;
- audit and revision history.

Add missing lifecycle states explicitly rather than overloading `REJECTED` or
`SUPERSEDED` for session-only or expired data.

### M2 — deterministic teaching extraction

Teaching extraction must:

- recognize only explicit teaching forms defined by the neutral contract;
- produce atomic candidates with bounded values;
- attach the source event and original evidence;
- use the requesting actor's explicit subject reference;
- keep relationship claims separate from preferences and identity facts;
- avoid embedding game or personal-domain patterns in the core extractor;
- never activate a candidate during extraction or generation.

### M3 — approval and revision service

Implement separate operations for:

```text
claim:       propose → approve | reject | session-only | expire | revoke | supersede
behavior:    propose → approve | reject | disable | revoke | supersede | expire
response:    stage   → approve | reject | expire
```

Each operation must retain source, actor/capability, reason, timestamp, and
related revision/audit records. Claim approval must not activate a behavior;
behavior approval must not publish a response.

### M4 — policy-filtered retrieval

Retrieval must apply the policy order from the neutral contract:

```text
companion → lifecycle/validity → channel/audience → sensitivity → relevance
```

It must return only current permitted records, while preserving enough
provenance for receipts and operator inspection. Public retrieval must never
receive private evidence merely because the caller has an operator role.

### M5 — persistence and adapter parity

The Postgres adapter, deterministic test adapter, and any service boundary must
share the same contract behavior. Every stateful operation must preserve
`companion_id` and actor/audience context. Database transactions must protect
multi-record approval, supersession, and audit writes from partial state.

### M6 — runtime/API integration

Connect memory behavior only after Phase 1 context mapping exists:

- runtime receives explicit actor/channel/audience context;
- proposals are returned as pending receipts;
- retrieval is policy-filtered before prompt assembly;
- approval endpoints enforce capability and companion boundaries;
- `/me` does not invent a profile;
- public and private integration tests use separate contexts.

## Required test port

Port and neutralize the original tests into the following groups:

| Group | Required proof |
| --- | --- |
| M1 | source event, claim fields, lifecycle states, validity, and history |
| M2 | ordinary conversation produces no candidates; explicit input creates bounded pending candidates |
| M3 | approval/rejection/session-only/revision operations are independent and auditable |
| M4 | public/private/operator retrieval is filtered by audience and sensitivity |
| M5 | tenant isolation and transaction rollback prevent cross-companion/partial writes |
| M6 | B0, B2, B3, B4, B5, B6, and B7 pass through the API/runtime boundary |

Use neutral fixture names and generated actor IDs. Any personal or domain value
must be an explicit teaching input and must start pending.

## Do-not-copy list

Do not port these as canonical memory behavior:

- global `primary_user` subject;
- `MASTER_PRIVATE` audience;
- creator/Master relationship defaults;
- personal names or profile values from original configuration;
- Genshin-specific teaching patterns in the core package;
- authentication role as a memory scope or relationship.

See [LEGACY_IDENTIFIER_MIGRATION.md](./LEGACY_IDENTIFIER_MIGRATION.md).

## Exit criteria

Phase 2 memory extraction is complete only when:

1. M1–M6 have neutral contracts and implementation evidence.
2. Every confirmed record has a source event and audit history.
3. No pending, rejected, session-only, expired, superseded, or revoked record
   is incorrectly retrieved as current public memory.
4. Public/private/operator disclosure tests pass through the runtime/API.
5. Corrections preserve history and return only the current permitted value.
6. No personal default remains in production memory extraction or schema
   defaults.
7. The verification manifest and health audit record the test results.

Until these criteria pass, memory remains a compatibility slice and the
repository remains RED.
