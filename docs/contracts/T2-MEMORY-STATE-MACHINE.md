# T2 memory state machine

Status: implementation target; current memory organ is a compatibility slice

This is the canonical lifecycle target for extracted Siduri memory. It makes
approval, disclosure, correction, and expiry explicit without using a
personal subject or audience as a shortcut. It supplements
[`PHASE-2-MEMORY-EXTRACTION-HANDOFF.md`](./PHASE-2-MEMORY-EXTRACTION-HANDOFF.md)
with state transitions and retrieval predicates.

The concrete request/claim retrieval outcomes are in
[`T2-MEMORY-DISCLOSURE-MATRIX.md`](./T2-MEMORY-DISCLOSURE-MATRIX.md).

## Separate record kinds

Siduri-Y must not collapse these records into one status field:

| Record | Purpose | Can affect canonical memory? | Can affect visible output? |
| --- | --- | --- | --- |
| Source event | Immutable input and provenance envelope | No | No |
| Claim proposal | Candidate fact about an explicit subject | Only after claim approval | Only as a pending receipt |
| Behavioral proposal | Candidate instruction for companion behavior | Only after behavior approval | Only as a pending receipt |
| Response proposal | Candidate grounded answer/output | No memory mutation | Only after response approval |
| Audit/revision event | Append-only decision/history record | No | Operator inspection only |

A proposal may reference a source event, but a source event alone is never a
claim, directive, or response.

## Claim lifecycle

```text
                         ┌──────────────┐
                         │    PENDING   │
                         └──────┬───────┘
          reject ───────────────┼────────────── approve
           │                    │                    │
           ▼                    ▼                    ▼
       REJECTED             SESSION_ONLY          APPROVED
           │                    │                    │
           └──────────────┐     │ expiry             │ correction/replacement
                          ▼     ▼                    ▼
                       EXPIRED                 SUPERSEDED
                                                     │ revoke
                                                     ▼
                                                  REVOKED
```

The diagram describes terminal/current states, not permission to skip audit
events. Every transition records actor capability, reason, timestamp, source
event, companion, and correlation ID.

### Allowed claim transitions

| From | Operation | To | Required condition |
| --- | --- | --- | --- |
| — | propose | `PENDING` | Valid source event, explicit subject, bounded value, and policy context |
| `PENDING` | approve | `APPROVED` | Explicit approval capability and unchanged candidate/version |
| `PENDING` | reject | `REJECTED` | Explicit rejection decision |
| `PENDING` | mark session-only | `SESSION_ONLY` | Session policy permits non-durable context |
| `PENDING` | expire | `EXPIRED` | Valid-until or retention boundary reached |
| `APPROVED` | supersede | `SUPERSEDED` + new `PENDING`/`APPROVED` record | Replacement links both records and preserves history |
| `APPROVED` | revoke | `REVOKED` | Explicit revocation capability and reason |
| `SESSION_ONLY` | expire | `EXPIRED` | Owning session ends or session TTL elapses |
| `APPROVED` | expire | `EXPIRED` | Validity period ends and no renewal policy applies |

No transition may silently delete a record. A rejected, superseded, revoked,
or expired record may remain searchable to an operator through an audit path,
but it is never returned by current-memory retrieval.

## Behavioral lifecycle

```text
PENDING -> ACTIVE -> DISABLED
    │        │  └──────► SUPERSEDED
    │        └──────────► REVOKED
    ├──────► REJECTED
    └──────► EXPIRED
```

`ACTIVE` is a compiled permission projection, not proof that the directive is
true about a user. A directive enters prompt compilation only when it is
active, within validity, and permitted by the request's companion, channel,
audience, subject, and capability policy.

## Response lifecycle

```text
STAGED -> APPROVED -> EMITTED
    ├──> REJECTED
    └──> EXPIRED
```

Response approval is independent from claim or behavior approval. A response
may cite an approved claim, but approving the response does not approve a
pending claim. A memory decision does not authorize public output.

## Current retrieval predicate

Every current-memory query must apply these filters in order:

```text
companion_id == request.companionId
AND lifecycle in current_states_for_record_kind
AND validity includes now
AND channel policy permits the record
AND audience intersection is non-empty
AND sensitivity policy permits the record
ORDER BY bounded relevance and recency
```

The request's authorization role is evaluated for capability, approval, or
inspection operations. It is not substituted for `subject`, `channel`, or
`audience`, and it cannot bypass disclosure policy.

## Invariants for implementation

1. A confirmed claim cannot exist without a source event and approval record.
2. A pending claim or directive cannot enter prompt context as active state.
3. A response proposal cannot emit before response approval.
4. A correction appends a replacement and preserves the prior snapshot.
5. A superseded, revoked, rejected, session-only, or expired record is absent
   from current public retrieval.
6. Every query and transition is bound to one companion ID.
7. Subject references are explicit and actor-scoped where they represent a
   user; no global `primary_user` is canonical.
8. Audience IDs are configured neutral values; `MASTER_PRIVATE` is never a
   default.
9. Provider, OCR, observation, platform, and retrieved text can propose data
   but cannot approve it or alter lifecycle policy.
10. Failed multi-record transitions leave no partial approval, supersession,
    or audit state.

## Required test groups

| Group | Minimum assertion |
| --- | --- |
| Transition legality | Invalid state transitions fail without mutation |
| Approval atomicity | Approval writes canonical state and audit history together |
| Rejection/expiry | Rejected and expired records remain auditable but are not retrieved |
| Revision | Replacement returns current value and preserves old snapshot |
| Disclosure | Public context excludes private/direct claims regardless of role |
| Isolation | Same actor across two companions cannot cross-read or cross-approve |
| Trust boundary | Untrusted content cannot change status, audience, or approval |
| Response separation | Memory approval and response approval produce independent records |

The state machine is not complete evidence. Each group must be implemented at
the relevant adapter and API/runtime boundary, then recorded in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
