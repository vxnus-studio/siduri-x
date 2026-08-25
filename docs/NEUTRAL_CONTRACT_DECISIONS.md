# Neutral contract decisions

Status: extraction target; implementation pending

This document resolves the contract questions that currently prevent direct
extraction from the original Siduri behavior. It is intentionally separate
from the current TypeScript types: those types contain compatibility names and
must not be treated as the final public contract.

Use [`NEUTRAL-TERMINOLOGY-GLOSSARY.md`](./NEUTRAL-TERMINOLOGY-GLOSSARY.md) when
reviewing field names or deciding whether a legacy term is being overloaded.

## Decision 1 — actor authorization is not audience

An authenticated actor answers: “what operations may this caller perform?”
Conversation routing answers: “which channel and audience is this response for?”
Learned subject identity answers: “whose fact or preference is this?”

These are independent values:

```text
ActorContext
├── actorId                 opaque caller/session identifier
└── authorizationRole       viewer | operator | administrator | ...

ConversationContext
├── channel                 public | direct | private | operator
├── audience                configured audience identifier(s)
└── isLive                  transport/session metadata

SubjectRef
└── subjectId               explicit subject, never inferred from auth role
```

The existing `OWNER | VIEWER | OPERATOR` type is currently used for all three
purposes. It may remain as a migration input, but no new behavior may rely on
that overload.

## Decision 2 — public is the neutral default

A newly created companion starts in the `public` channel with a configured
public audience. Private or operator channels must be explicitly selected by
the caller and authorized by policy. The default must never be a personal
recipient or private audience.

Audience identifiers are configuration data. The implementation must not
ship `MASTER_PRIVATE`, a personal title, or a creator-specific audience as a
default.

## Decision 3 — subjects are explicit and scoped

Claims refer to a stable subject identifier supplied by the conversation
context or explicit teaching. The runtime must not synthesize a global
`primary_user` subject.

For a user-supplied fact, the target shape is conceptually:

```text
subject = actor:<opaque-actor-id>
predicate = <validated field>
value = <bounded value>
```

If an installation wants a shared subject, it must configure that subject
explicitly. A route, token, role, speaker label, or repository path is not
evidence of a relationship.

## Decision 4 — relationship is a taught claim, not a runtime default

Relationship claims are valid only when the user explicitly states the
relationship and the resulting candidate is approved. The runtime may not
translate “OWNER” into creator, master, owner, or primary user.

The original relationship tests are extracted for their candidate, approval,
scope, and disclosure behavior. Their personal relationship values are
fixtures, not Siduri-Y defaults.

## Decision 5 — candidate lifecycle is canonical

All learned facts and runtime behavior follow this lifecycle:

```text
source event
    ↓
pending candidate
    ├── approved → canonical / active
    ├── rejected → audit-only
    └── session-only → expires with session

canonical / active
    ├── corrected → superseded by revision
    ├── revoked  → no longer retrievable
    └── expired  → no longer retrievable
```

Model, OCR, observation, platform, and external knowledge inputs can propose
only pending candidates. They cannot directly create active personal memory.

## Decision 6 — retrieval is a policy decision

Memory retrieval must evaluate, in order:

1. companion/tenant identity;
2. lifecycle status and validity window;
3. requested channel and audience;
4. sensitivity and disclosure policy;
5. query relevance and bounded result count.

The caller's authorization role is not a bypass for audience or sensitivity
filters.

## Decision 7 — response approval is separate from memory approval

A grounded response may require operator approval even when it creates no
memory. Approving a memory candidate must not implicitly approve a public
response, and approving a response must not implicitly approve a memory or
behavior candidate.

## Decision 8 — compatibility mapping is temporary

The migration layer may accept existing Siduri-Y payloads, but it must map
them into the neutral contract explicitly and record ambiguity. In particular:

| Legacy input | Neutral interpretation | Required handling |
| --- | --- | --- |
| `OWNER` on chat | authorization role only | require channel/audience separately |
| `VIEWER` on chat | authorization role only | default to configured public channel only when policy permits |
| `OPERATOR` on chat | authorization role only | do not imply private personal relationship |
| `MASTER_PRIVATE` audience | unsupported personal legacy value | reject or require explicit migration configuration |
| `primary_user` subject | unsupported global subject | require actor-scoped subject mapping |
| missing audience | no audience selected | use configured public default, never private |

## Contract acceptance gates

Before runtime extraction begins, `@siduri-y/core` must be able to represent:

- actor authorization independently from channel and audience;
- explicit subject identity without a global primary-user assumption;
- public, direct, private, and operator disclosure contexts;
- pending, approved, rejected, session-only, superseded, revoked, and expired
  lifecycle states;
- source events, authority, confidence, sensitivity, validity, and audit links;
- separate memory-candidate and response-approval decisions.

These are design gates, not claims that the current implementation already
satisfies them.

Open policy questions and their proposed safe defaults are tracked in
[`OPEN_EXTRACTION_DECISIONS.md`](./OPEN_EXTRACTION_DECISIONS.md).
The T1 boundary shapes are specified in
[`T1-NEUTRAL-CONTEXT-SPEC.md`](./T1-NEUTRAL-CONTEXT-SPEC.md).
