# Public blank-slate contract

Siduri-Y is intended for public distribution. A freshly created companion is
therefore a blank slate, regardless of the personal configuration used by the
original `siduri/` project.

## Initial state

The initial state contains only explicitly configured companion identity and
capabilities. It contains no user identity, relationship, preferred address,
private history, interests, or account data.

The runtime must not manufacture a name such as `Primary User`, or interpret a
transport role such as `OWNER` as proof that the speaker is a creator, master,
or primary user.

## Teaching boundary

Teaching is an explicit user/operator action with provenance. The flow is:

```text
source event → pending candidate → approval decision
                         ├── approved → canonical/active
                         ├── rejected → retained for audit, not retrieved
                         └── session-only → expires with its session
```

Approved claims retain their source, authority, sensitivity, audience,
validity, and revision history. Corrections supersede earlier values without
destroying the audit trail.

## Public/private separation

Public, direct, private, and operator channels are runtime/configuration
concepts. They are not personal identity concepts. Audience identifiers must
be generic and documented; personal names must never be embedded in shared
code, defaults, or tests.

Authentication determines what an actor may do. It does not determine who the
actor is to the companion or what relationship the companion should claim.

## Acceptance tests

A blank-slate implementation must demonstrate that:

- empty memory does not predeclare a relationship;
- a greeting does not retrieve or invent personal facts;
- explicit teaching creates pending records only;
- rejected and unreviewed candidates are not retrievable memory;
- public retrieval excludes private claims;
- a role or route alone cannot create a personal relationship;
- personal data is absent from default configuration and fixtures.

The original blank-slate reference is
`/home/zagin/Projects/vxnuslabs/siduri/tests/test_chat.py`, especially
`test_empty_memory_does_not_predeclare_user_relationship`.
