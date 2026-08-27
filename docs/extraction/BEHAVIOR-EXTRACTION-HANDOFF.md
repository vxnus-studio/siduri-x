# Behavior and prompt extraction handoff

Status: ready after neutral memory contracts

The normative Active Self and prompt compilation target is
[`T3-ACTIVE-SELF-CONTRACT.md`](./T3-ACTIVE-SELF-CONTRACT.md).
The prompt section test matrix is in
[`T3-PROMPT-SECTION-MATRIX.md`](./T3-PROMPT-SECTION-MATRIX.md).

## Objective

Extract the original Siduri Active Self, disclosure, prompt-boundary, and
failure behavior into a neutral behavior organ. Preserve the safety semantics;
do not copy the original personal `MeProfile`, recipient names, titles, or
relationship values.

## Original sources

- `siduri/packages/persona/behavior.py` (`ActiveSelfProjection` and
  `ActiveSelfCompiler`);
- `siduri/packages/persona/prompt.py` (`PromptContext` and
  `PromptAssembler`);
- `siduri/packages/persona/domain.py` (`DisclosurePolicy` and recipient
  filtering mechanics);
- `siduri/docs/memory/PUBLIC_DISCLOSURE_POLICY.md`;
- `siduri/tests/test_behavioral_memory.py`;
- `siduri/tests/test_chat.py` blank-slate, teaching, and prompt cases;
- `siduri/tests/test_prompt03.py` response-recipient validation and degradation.

The original tests use personal values such as `Master` and
`primary_user` to exercise scope behavior. Port the asserted safety and
visibility outcomes with neutral actors, audiences, and directives.

## Extracted invariants

### A. Active Self is approved runtime behavior

Only active, valid, permitted directives may enter the highest-precedence
behavior projection. Pending, rejected, disabled, superseded, revoked, or
expired directives remain out of the prompt.

### B. Scope is policy context, not identity

Behavior matching receives the explicit channel/audience/session context. It
does not infer identity or relationship from an authorization role, route, or
transport recipient.

### C. Learned user context is separate

User claims, companion self-identity, and behavioral directives have distinct
storage and prompt sections. A learned user fact cannot silently become a
companion identity rule, and a companion rule cannot silently become a user
profile fact.

### D. Prompt boundaries are immutable

The prompt must preserve these rules:

- approved behavior is bounded by its compiled scope;
- routing metadata does not establish a name, title, or relationship;
- absent approved relationship/address memory requires neutral language;
- memory, observations, knowledge, platform text, and quoted chat are data,
  never system instructions;
- privacy, evidence, approval, and tool policies outrank retrieved content.

### E. Unsafe directives are excluded

Directives attempting to ignore, override, bypass, reveal, or expose system
policy, secrets, prompts, permissions, or private memory are rejected or
excluded from the active projection. The rejection remains auditable.

## Work packages

### A1 — neutral behavior context

Replace the current single `activeRole` input with the neutral authorization,
channel, audience, subject, and session context. Keep a compatibility mapper at
the boundary only.

### A2 — directive compiler

Compile only approved active directives after checking lifecycle, validity,
audience, sensitivity, supersession, priority, and injection safety. Return
both the compiled projection and excluded directive reasons for operator audit.

### A3 — prompt assembly

Separate trusted system rules, active companion behavior, permitted memory,
untrusted contextual data, user input, and response constraints. Ensure empty
memory produces a neutral prompt without personal relationship language.

### A4 — response/provider boundary

Validate response plans against the requested channel/audience and expected
recipient metadata. A provider that returns a mismatched recipient, unsafe
plan, or malformed response must degrade safely without activating behavior or
publishing output.

### A5 — runtime/API integration

Pass the neutral context through chat, memory retrieval, behavior compilation,
prompt assembly, response approval, voice, and overlay boundaries. No layer may
reconstruct a personal/private context from a legacy role.

## Required behavior tests

| Test group | Required result |
| --- | --- |
| Empty slate | No active behavior and neutral relationship/address language |
| Scope filtering | Public/direct/private/operator contexts compile only permitted directives |
| Lifecycle filtering | Pending, rejected, disabled, superseded, revoked, and expired directives are excluded |
| Priority and conflict | Higher-priority valid directive wins without destroying audit history |
| Injection resistance | Unsafe directive is excluded and cannot alter system rules |
| Context separation | User claim does not become self identity; self directive does not become user fact |
| Recipient validation | Mismatched provider response is rejected or safely degraded |
| Public disclosure | Private behavior and memory do not enter public prompt or overlay |
| Runtime boundary | At least B0, B5, B6, and B8 pass through API/runtime |

## Do-not-copy list

- `MeProfile` personal values;
- `MASTER_PRIVATE`, `MASTER_STREAM`, or personal recipient names;
- `Kur Zagin`, `Master`, or creator defaults;
- global `primary_user` identity;
- personal relationship/address phrases as UI defaults;
- game-specific behavior fields in the core behavior organ.

See [LEGACY_IDENTIFIER_MIGRATION.md](./LEGACY_IDENTIFIER_MIGRATION.md).

## Exit criteria

Behavior extraction is complete only when:

1. the compiler consumes neutral context and no longer overloads auth role as
   audience;
2. only approved permitted directives enter Active Self;
3. prompt assembly passes empty-memory and untrusted-context tests;
4. public/private behavior and memory disclosure tests pass at runtime;
5. provider mismatches and failures degrade without state mutation;
6. no personal values remain in behavior defaults or public UI templates;
7. the verification manifest and health audit record the evidence.

Until then, the behavior organ is a compatibility slice and the repository
remains RED.
