# T2 memory disclosure matrix

Status: policy target; runtime retrieval has not yet proven this matrix

This matrix defines which memory records may be returned for each neutral
request context. It complements the lifecycle rules in
[`T2-MEMORY-STATE-MACHINE.md`](./T2-MEMORY-STATE-MACHINE.md). Disclosure is a
policy decision; authentication and approval capabilities do not bypass it.

## Request dimensions

Retrieval evaluates these dimensions in order:

```text
companion -> lifecycle/validity -> channel -> audience -> sensitivity -> relevance
```

The query must carry all dimensions before the memory organ is called. A role
may authorize inspection or approval, but it is never substituted for channel,
audience, or subject.

## Baseline claim set

Use these synthetic records in a disclosure fixture for `companion-a`:

| Claim | Subject | Status | Sensitivity | Allowed audience | Expected meaning |
| --- | --- | --- | --- | --- | --- |
| C-public | `actor:actor-a` | `APPROVED` | `public` | `audience-public` | Safe public preference/fact |
| C-direct | `actor:actor-a` | `APPROVED` | `private` | `audience-direct-a` | Actor-scoped direct context |
| C-private | `actor:actor-a` | `APPROVED` | `restricted` | `audience-private-a` | Explicit private context |
| C-pending | `actor:actor-a` | `PENDING` | `public` | `audience-public` | Candidate awaiting approval |
| C-rejected | `actor:actor-a` | `REJECTED` | `public` | `audience-public` | Audit-only rejected proposal |
| C-expired | `actor:actor-a` | `EXPIRED` | `public` | `audience-public` | No longer valid |
| C-other | `actor:actor-b` | `APPROVED` | `public` | `audience-public` | Different actor subject |
| C-other-companion | `actor:actor-a` | `APPROVED` | `public` | `audience-public` | Same actor, different companion |

## Retrieval outcomes

| Request | Must return | Must exclude | Reason |
| --- | --- | --- | --- |
| Public, `audience-public`, actor-a | C-public | C-direct, C-private, C-pending, C-rejected, C-expired, C-other, C-other-companion | Current public policy plus subject/companion isolation |
| Direct, `audience-direct-a`, actor-a | C-public and C-direct | C-private, C-pending, C-rejected, C-expired, C-other, C-other-companion | Direct audience permits direct claim, not restricted private claim |
| Private, `audience-private-a`, actor-a | C-public and C-private | C-direct, C-pending, C-rejected, C-expired, C-other, C-other-companion | Private audience is explicit and does not activate pending data |
| Operator inspection, `audience-operator`, operator-a | No current claim by default; audit views may show scoped metadata | All claim payloads not explicitly permitted | Inspection capability is not disclosure permission |
| Public, administrator role, actor-a | C-public | C-direct, C-private, all inactive/other-scope records | Elevated role cannot bypass audience/sensitivity |
| Public, actor-b | Only records explicitly permitted to actor-b/public policy | C-direct/C-private for actor-a and all actor-a-only data | Subject and audience isolation |
| Any request, companion-b | Only companion-b records | Every `companion-a` record | Tenant/companion isolation |

The exact set of public-safe claims may be configured; the exclusion rules are
non-negotiable. An empty result is valid and must not be filled with a personal
fallback or an inferred relationship.

## Claim and directive separation

The same matrix applies independently to behavioral directives, with an
additional requirement that only `ACTIVE` directives enter compilation.

```text
claim approval     != behavior activation
memory retrieval   != prompt compilation
operator inspection != public disclosure
response approval  != memory approval
```

An operator may inspect a pending/rejected record through a separately scoped
audit surface. That does not make its value eligible for a public prompt,
caption, citation, or output event.

## Negative disclosure tests

Every adapter/runtime implementation must assert that:

1. a public query cannot retrieve C-direct or C-private;
2. an administrator/operator role cannot bypass audience or sensitivity;
3. pending, rejected, expired, superseded, revoked, and session-only records
   never appear in current retrieval;
4. a same-named actor in another companion cannot cross-read records;
5. excluded evidence IDs and payloads are absent from response metadata;
6. an empty permitted result does not cause identity or relationship invention;
7. changing only the route or authorization role cannot change the subject;
8. operator audit output does not become public output through a shared cache,
   queue, WebSocket, or overlay event.

## Required evidence record

For each matrix row, record:

```text
companion / actor / session:
channel / audience / role / capabilities:
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
