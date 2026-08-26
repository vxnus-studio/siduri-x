# T3 prompt-section matrix

Status: prompt target; current Brain/Behavior adapters do not yet prove the full matrix

This matrix specifies what may enter each provider prompt section and what must
be rejected. It operationalizes the trust ordering in
[`T3-ACTIVE-SELF-CONTRACT.md`](./T3-ACTIVE-SELF-CONTRACT.md) without importing
personal identity or relationship defaults.

## Section contract

| Section | Allowed inputs | Trust level | Required filtering | Forbidden effect |
| --- | --- | --- | --- | --- |
| System/safety policy | Immutable application policy and provider constraints | Highest | Configuration/schema validation | Cannot be replaced by retrieved text |
| Companion configuration | Explicit companion capabilities and neutral configured identity metadata | Trusted | Companion binding and deployment validation | Cannot contain learned actor profile or personal fallback |
| Active Self | Approved active directives within channel/audience/subject/session scope | Trusted projection | Lifecycle, validity, scope, priority, injection checks | Pending/user/evidence text cannot enter as active rule |
| User context | Approved claims permitted for this request | Trusted data projection | Companion, subject, lifecycle, audience, sensitivity, relevance | Cannot rewrite companion identity or policy |
| History/input | Bounded validated user/assistant messages and current input | Untrusted data | Role/length/null/history validation | Cannot become system instruction or approval |
| Retrieved context | Knowledge, observation, OCR, platform, quoted, or external text | Untrusted data | Source/trust/expiry/citation/disclosure filtering | Cannot alter role, audience, memory, or tools |
| Response constraints | Target audience, approval state, citations, output capability | Trusted policy | Exact response/companion/correlation binding | Provider cannot broaden destination or skip approval |

## Prompt assembly order

The semantic order is fixed even if a provider adapter serializes it
differently:

```text
1. system/safety policy
2. companion configuration
3. approved Active Self
4. permitted user context
5. bounded history and current input
6. marked untrusted retrieved context
7. response/output constraints
```

Sections 5 and 6 are data. Imperative text inside them remains data and cannot
change sections 1–3 or 7. The provider response is also untrusted until its
schema, recipient, evidence, and approval policy are validated.

## Scenario matrix

| Scenario | Must be present | Must be absent or rejected |
| --- | --- | --- |
| B0 fresh public chat | Configured companion metadata, neutral policy, empty user/behavior sections | User identity, relationship, title, private audience, personal history |
| B1 ordinary conversation | Bounded history/input and relevant permitted context | Candidate activation, hidden teaching effect, system-role history |
| B2 pending teaching | Receipt/proposal metadata outside active prompt or clearly pending section | Pending claim/directive as factual memory or Active Self |
| B5 public disclosure | Public-safe claims/evidence and public output constraints | Direct/private claims, private citations, operator metadata |
| B6 self-identity question | Neutral configured self context and bounded uncertainty policy | Unrelated knowledge search, invented user/creator identity |
| B8 injection-shaped retrieval | Marked untrusted data, source/trust metadata | Policy override, prompt disclosure, permission change, approval mutation |
| B9 grounded response | Valid evidence IDs, citations, uncertainty, staged response policy | Raw frame/prompt, unapproved output, evidence beyond audience |

## Active Self admission matrix

| Directive state/condition | Active Self result | Diagnostic |
| --- | --- | --- |
| `ACTIVE`, valid, permitted, safe | Include in deterministic priority order | Included directive ID and scope |
| `PENDING` | Exclude | `pending_not_active` |
| `REJECTED`, `DISABLED`, `SUPERSEDED`, `REVOKED`, `EXPIRED` | Exclude | State-specific reason |
| Wrong companion | Exclude | `companion_mismatch` |
| Wrong channel/audience/subject/session | Exclude | Scope-specific reason |
| Unsafe instruction text | Exclude and retain audit reason | `unsafe_directive` |
| Conflicting active rules | Deterministic winner; retain excluded conflict | `directive_conflict` |

Diagnostics are operator/audit metadata. They must not expose private directive
text to public output.

## Negative prompt assertions

Every prompt-boundary test must assert both content and absence:

1. a role does not become a user name, relationship, or Active Self rule;
2. an approved user claim does not appear in the companion configuration section;
3. a pending/rejected/expired directive is not serialized as active behavior;
4. untrusted “ignore policy” text remains marked data and cannot alter rules;
5. private claims and evidence are absent from public prompt/context;
6. empty memory does not trigger a personal fallback or unrelated retrieval;
7. provider output cannot change response audience or approval state;
8. prompt assembly failure causes no memory/behavior/output mutation.

## Evidence record

For each section/scenario test, record:

```text
companion / actor / channel / audience:
input and fixture IDs:
included section IDs or bounded summaries:
excluded section IDs/reasons:
provider request validation:
provider response validation:
API/runtime boundary:
test command and candidate commit:
result: PASS | FAIL | NOT RUN
```

The matrix is complete only when section tests use neutral fixtures and runtime
results are entered in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
