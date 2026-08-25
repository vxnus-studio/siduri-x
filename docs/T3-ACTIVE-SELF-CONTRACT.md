# T3 Active Self contract

Status: implementation target; current behavior compiler still accepts legacy role context

This contract defines how approved companion behavior becomes prompt context.
It extracts the original Active Self and prompt-boundary behavior while keeping
Siduri-Y a blank slate. User memory is not companion identity, and a transport
role is not a relationship.

## Three projections

Prompt assembly must keep these projections distinct:

| Projection | Describes | Source | Default when empty |
| --- | --- | --- | --- |
| Companion configuration | What this deployment explicitly enables | Configured capability and neutral identity metadata | Only configured values |
| Active Self | Approved, scoped rules for companion behavior | Active behavioral directives | No learned behavior |
| User context | Approved facts about an explicit actor/subject | Audience-filtered claims | No user identity or relationship |

The compiler may serialize these sections into one provider prompt, but it must
not merge their semantics or allow one section to create another.

## Neutral compiler input

The target context is conceptually:

```ts
interface ActiveSelfContext {
  companionId: string;
  actor: {
    actorId: string;
    authorizationRole: "viewer" | "operator" | "administrator";
    capabilities: string[];
    authenticated: boolean;
  };
  conversation: {
    channel: "public" | "direct" | "private" | "operator";
    audienceId: string;
    correlationId: string;
  };
  sessionId: string;
  directives: ApprovedDirective[];
  claims: PermittedClaim[];
  untrustedContext: UntrustedContext[];
}
```

`ApprovedDirective` and `PermittedClaim` are projections from the T2 memory
contract. They are not write-capable objects. The compiler receives no method
that can approve, mutate, or broaden scope.

## Compilation order

```text
validate context
    ↓
bind companion and correlation scope
    ↓
filter directive lifecycle and validity
    ↓
filter directive channel/audience/subject scope
    ↓
reject unsafe directive text
    ↓
resolve priority/conflicts without deleting history
    ↓
compile Active Self
    ↓
filter claims by disclosure policy
    ↓
append untrusted data in a marked data-only section
    ↓
validate response constraints and recipient metadata
```

No provider output can move upward in this sequence. Retrieved memory,
observation, OCR, platform text, quoted chat, and knowledge results remain
untrusted data even when they contain imperative language.

## Directive admission rules

A directive enters Active Self only if all conditions hold:

1. its companion ID matches the request;
2. its status is `ACTIVE` and its validity window includes the request time;
3. its audience, channel, subject, and session scope permit this request;
4. it has an approval and source-event record;
5. it passes unsafe-instruction validation;
6. it has a bounded priority and deterministic conflict behavior.

Pending, rejected, disabled, superseded, revoked, and expired directives are
excluded and reported as diagnostic reasons, not silently treated as active.

## Conflict and precedence

When two active directives address the same behavior dimension, the compiler
must choose deterministically using configured policy:

```text
explicit scope match
    > broader scope
    > higher approved priority
    > newer approved revision
    > stable identifier tie-breaker
```

The chosen rule may affect the prompt projection only. The excluded rule and
the conflict decision remain auditable. A conflict must not mutate or delete a
claim/directive.

## Prompt trust sections

The provider prompt should expose explicit sections with fixed precedence:

1. trusted system and safety policy;
2. configured companion capability/identity metadata;
3. compiled Active Self rules;
4. permitted user claims and evidence references;
5. bounded conversation history and current user input;
6. untrusted retrieved/provider/platform data;
7. response, audience, approval, and citation constraints.

The exact provider syntax may vary. The semantic ordering and trust labels may
not. User or provider content cannot override sections 1–3 or alter section 7.

## Blank-slate behavior

With empty claims and directives, the compiler must:

- avoid a user name, title, creator, owner, master, or prior relationship;
- avoid claiming that the actor is known from authentication or routing;
- retain the companion's explicitly configured capabilities only;
- answer identity/relationship questions with bounded uncertainty or a request
  for explicit teaching;
- avoid unrelated knowledge retrieval for a self-identity question;
- produce no learned Active Self rule.

This is a runtime invariant, not a prompt-text snapshot. Tests must assert the
absence of personal claims and unauthorized retrieval/effects.

## Failure and provider boundary

The compiler/provider adapter must reject or safely degrade when:

- a directive contains an instruction to bypass policy, approval, permissions,
  privacy, or secrets;
- provider output names a recipient or audience different from the request;
- the response plan is malformed or lacks required approval metadata;
- context is missing companion, channel, audience, actor/session, or
  correlation fields;
- retrieval returns a claim outside the permitted disclosure set.

Failure must not approve memory, activate behavior, emit public output, or
partially mutate conversation state.

## Required tests

| Test | Required proof |
| --- | --- |
| Empty Active Self | No active directives and neutral relationship behavior |
| Lifecycle filtering | Every non-active lifecycle state is excluded |
| Scope filtering | Public/direct/private/operator contexts select only permitted rules |
| Separation | User claim cannot become companion identity or directive |
| Injection | Unsafe directive and untrusted context cannot rewrite policy |
| Conflict | Priority and scope resolution is deterministic and auditable |
| Recipient validation | Mismatched provider response is rejected/degraded |
| Failure atomicity | Provider/compiler failure causes no approval or memory mutation |
| Runtime boundary | B0, B5, B6, and B8 pass through API/runtime context |

The contract is complete only when these tests use the neutral fixture rules
from [`BLANK-SLATE-FIXTURE-GUIDE.md`](./BLANK-SLATE-FIXTURE-GUIDE.md) and their
results are recorded in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
