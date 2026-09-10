# T2 memory disclosure matrix

> [!NOTE]
> Updated for single-owner deployment model. Multi-audience disclosure tiers have been replaced by owner-scoped retrieval.

Status: policy target; updated for single-owner deployment model

This matrix defines which memory records may be returned for each neutral
request context in a single-owner companion deployment. It complements the
lifecycle rules in [`T2-MEMORY-STATE-MACHINE.md`](./t2-memory-state-machine.md).
Disclosure is a policy decision; companion isolation, lifecycle validity, and
sensitivity constraints cannot be bypassed.

## Request dimensions

Retrieval evaluates these dimensions in order:

```text
companion -> lifecycle/validity -> sensitivity -> relevance
```

The query evaluates these dimensions before memory records are returned. In the
single-owner model, internal audience tiers and multi-role RBAC hierarchies are
eliminated: memory is strictly partitioned by companion boundary (`companionId`),
filtered by lifecycle status and temporal validity, evaluated against
sensitivity constraints, and ranked by relevance. An operator role authorizes
inspection or auditing, but it is never substituted for companion isolation,
subject boundaries, or lifecycle state.

## Baseline claim set

Use these synthetic records in a disclosure fixture for `companion-a`:

| Claim | Subject | Status | Sensitivity | Scope | Expected meaning |
| --- | --- | --- | --- | --- | --- |
| C-owner | `actor:actor-a` | `APPROVED` | `standard` | `owner` | Standard owner preference/fact |
| C-restricted | `actor:actor-a` | `APPROVED` | `restricted` | `owner` | Restricted sensitive owner context |
| C-companion | `companion:companion-a` | `APPROVED` | `standard` | `companion` | Companion-scoped identity or operational state |
| C-pending | `actor:actor-a` | `PENDING` | `standard` | `owner` | Candidate awaiting approval |
| C-rejected | `actor:actor-a` | `REJECTED` | `standard` | `owner` | Audit-only rejected proposal |
| C-expired | `actor:actor-a` | `EXPIRED` | `standard` | `owner` | No longer valid (validity elapsed) |
| C-other | `actor:actor-b` | `APPROVED` | `standard` | `owner` | Different actor subject |
| C-other-companion | `actor:actor-a` | `APPROVED` | `standard` | `owner` | Same actor, different companion boundary |

## Retrieval outcomes

| Request | Must return | Must exclude | Reason |
| --- | --- | --- | --- |
| Owner context, standard sensitivity, actor-a | C-owner | C-restricted, C-pending, C-rejected, C-expired, C-other, C-other-companion | Active approved owner claims; restricted sensitivity and inactive/cross-scope records excluded |
| Owner context, restricted sensitivity, actor-a | C-owner and C-restricted | C-pending, C-rejected, C-expired, C-other, C-other-companion | Explicit restricted sensitivity query permits restricted claims; lifecycle and isolation enforced |
| Companion-only scope, companion-a | C-companion | C-owner, C-restricted, C-pending, C-rejected, C-expired, C-other, C-other-companion | Query scoped strictly to companion identity/state excludes owner/actor claims |
| Operator inspection, operator-a | No active claims by default; audit views may show scoped metadata | All claim payloads not explicitly requested through audit query | Inspection capability is an audit surface, not runtime execution disclosure permission |
| Owner context, elevated / operator role, actor-a | C-owner | C-restricted, all inactive/other-scope records | Elevated role cannot bypass sensitivity constraints, lifecycle states, or companion isolation |
| Owner context, actor-b | C-other | C-owner, C-restricted, and all actor-a records | Subject isolation ensures claims targeting actor-a are not returned for actor-b |
| Any request, companion-b | Only companion-b records | Every `companion-a` record | Strict tenant/companion isolation |

The exact set of retrieved claims may be configured by query parameters; the
exclusion rules are non-negotiable. An empty result is valid and must not be
filled with an unverified fallback or an inferred relationship.

## Claim and directive separation

The same scope rules apply independently to behavioral directives, with an
additional requirement that only `ACTIVE` directives enter prompt compilation.

```text
claim approval      != behavior activation
memory retrieval    != prompt compilation
operator inspection != runtime prompt injection
response approval   != memory approval
```

An operator may inspect a pending or rejected record through a separately scoped
audit surface. That does not make its value eligible for prompt compilation,
citation, or runtime execution events.

## Negative disclosure tests

Every adapter/runtime implementation must assert that:

1. a standard query cannot retrieve restricted-sensitivity records (`C-restricted`) without explicit sensitivity qualification;
2. a companion-scoped query cannot retrieve owner-scoped claims (`C-owner`);
3. an administrator or operator role cannot bypass sensitivity constraints, lifecycle states, or companion boundaries;
4. pending, rejected, expired, superseded, revoked, and session-only records never appear in current runtime retrieval;
5. a same-named actor in another companion cannot cross-read records across companion boundaries;
6. actor-specific queries cannot retrieve claims belonging to a different actor subject;
7. excluded evidence IDs and payloads are absent from response metadata and prompt context;
8. an empty permitted result does not cause identity or relationship invention;
9. changing only the route or authorization role cannot alter the target subject;
10. operator audit output does not leak into runtime companion output through a shared cache, queue, WebSocket, or event pipeline.

## Required evidence record

For each matrix row, record:

```text
companion / actor / session:
scope / sensitivity / role / capabilities:
claim fixture IDs:
expected included IDs:
expected excluded IDs:
actual included/excluded IDs:
response/evidence metadata inspected:
adapter and API/runtime boundary:
test command and candidate commit:
result: PASS | FAIL | NOT RUN
```

The matrix is complete only when these rows run through the relevant API/runtime
boundary and the results are entered in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
