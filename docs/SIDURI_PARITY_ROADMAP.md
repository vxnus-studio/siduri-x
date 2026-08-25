# Siduri-Y Parity Roadmap

## Goal

Make `siduri-y` behaviorally equivalent to the original `siduri/` in the
parts that define Siduri's experience, while keeping the organs independently
replaceable.

The original repository is the behavioral reference. A decoupled organ is not
considered complete merely because its TypeScript API compiles; it must satisfy
the same user-visible behavior and safety guarantees.

Reference repository:

```text
/home/zagin/Projects/vxnuslabs/siduri/
```

Target repository:

```text
/home/zagin/Projects/vxnuslabs/architecture/siduri-y/
```

## Parity definition

For each capability, parity means:

1. The same input produces the same meaningful outcome, even if internal
   implementation and provider names differ.
2. The same privacy, approval, provenance, and failure boundaries are enforced.
3. The same important metadata is available to the UI and operator console.
4. An automated test demonstrates the behavior.
5. A manual vertical-slice check confirms the experience.

The original implementation remains the oracle until a deliberate contract
change is documented.

## Phase 0 — Baseline the original experience

Status: completed

Run the original `siduri/` private chat and record its behavior before changing
Siduri-Y.

Capture fixtures for:

- ordinary private chat;
- empty memory, followed by explicit teaching;
- pending memory proposal and approval;
- rejected proposal;
- behavioral proposal and activation;
- correction or supersession;
- knowledge answer with citations;
- identity/relationship question without prior memory;
- private information that must not enter public context.

Deliverables:

- golden request/response fixtures;
- a short manual chat transcript;
- a parity matrix linking each behavior to original tests and source files.

Exit criteria: the team can explain what “working like Siduri” means for each
fixture.

## Phase 1 — Canonical contracts and compatibility layer

Status: completed for the current compatibility slice; full lifecycle parity remains in progress

Port the original domain contracts into `@siduri-y/core` before porting organs.

Required contracts:

- `SourceEvent`;
- `VersionedClaim`;
- `MemoryProposal`;
- `BehavioralDirective`;
- recipient, audience, sensitivity, authority, confirmation, and activation
  policies;
- response plan, citation, evidence, and event envelope contracts.

Compatibility rule: existing Siduri-Y APIs may remain temporarily, but they
must map losslessly into the canonical contracts. Do not discard fields merely
because the first adapter does not use them.

Exit criteria: TypeScript types can represent every field needed by the
original memory, chat, provenance, and overlay flows.

## Phase 2 — Memory parity

Status: in progress

Upgrade the memory organ from the current basic `memory_claims` table to the
original lifecycle:

- source events as immutable inputs;
- versioned claims with provenance and authority;
- explicit confirmation and status transitions;
- sensitivity and allowed audiences;
- valid time, expiry, supersession, replacement, and revocation;
- memory revisions and audit events;
- legacy text-memory compatibility projection where required;
- persistent Postgres/Supabase implementation and deterministic test store.

Required tests:

- approval does not mutate canonical memory before approval;
- private memory is excluded from stream/public retrieval;
- source events are required for confirmed claims;
- superseded claims are not retrieved as current facts;
- correction preserves history and provenance;
- companion or tenant boundaries cannot cross-read memory.

Exit criteria: Siduri-Y passes the original memory lifecycle scenarios with
equivalent returned records and safety decisions.

## Phase 3 — Provenance and evidence parity

Status: completed for private chat, teaching, and proposal receipts

Make provenance first-class across memory, knowledge, observation, and chat.

Required behavior:

- every persisted claim points to a source event;
- every knowledge result preserves source, document/chunk, and revision data;
- response plans carry bounded evidence IDs;
- chat metadata exposes citation details, not only opaque IDs;
- operator views can inspect the evidence behind a response;
- untrusted retrieved text is context, never system instruction;
- private evidence never leaks to the public overlay.

Exit criteria: a cited chat answer in Siduri-Y is inspectable from response to
source event, and private evidence is excluded from public output.

## Phase 4 — Private chat parity

Status: in progress

Rebuild `SiduriRuntime.handleUserMessage()` around the original private-chat
policy rather than a generic chat completion.

Required behavior:

- private recipient classification;
- bounded and validated conversation history;
- neutral behavior when no relationship memory exists;
- approved memory and active behavior injection with scope checks;
- knowledge retrieval only when appropriate;
- structured response-plan validation;
- memory and behavior candidates remain pending until approval;
- inline receipts show the proposed change, provenance, scope, and runtime
  effect;
- chat failures degrade safely without corrupting memory or conversation state.

Required tests should be ported from `siduri/tests/test_chat.py` and extended
for the decoupled organ interfaces.

Exit criteria: the same private-chat fixtures from Phase 0 produce equivalent
memory effects, citations, and visible chat behavior.

## Phase 5 — Learned behavior and Active Self parity

Status: in progress

Port the original behavioral-memory model and compiler.

Required behavior:

- behavioral proposals are typed and validated;
- scope includes recipient, audience, and session mode;
- activation state is explicit;
- approval, disable, revoke, and supersession are distinct operations;
- unsafe instructions and prompt-injection attempts are rejected;
- only active, permitted directives enter the prompt;
- runtime effects are visible to the operator.

Exit criteria: teaching Siduri a preference or form of address changes only the
permitted private behavior and never silently changes public behavior.

## Phase 6 — Grounded observation and knowledge parity

Status: pending

Port the original observation-to-response flow:

```text
capture -> redact -> observe -> ground -> cite -> response plan -> approval -> output
```

Required behavior:

- bounded screen capture with privacy redaction;
- expiring observations and duplicate suppression;
- uncertainty and false-positive handling;
- E-Teyvat/provider citations with revisions;
- grounded response approval before public output;
- no raw frame persistence or leakage into chat/public events.

Current progress: Siduri-Y now has a decoupled fixture observation organ with
bounded retention, duplicate suppression, expiry, confidence, evidence IDs,
and malformed-provider handling. The API exposes `GET /observations` and
`POST /dev/mock-observation`.

Remaining work for this phase: connect trusted knowledge grounding, response
plans, operator approval, and live redacted capture.

Exit criteria: the fixture observation flow in the original repo has an
equivalent Siduri-Y flow and metadata contract.

## Phase 7 — Voice, overlay, and avatar parity

Status: pending

Connect the decoupled voice and body organs through lifecycle events.

Required event sequence:

```text
ResponsePlanCreated
  -> SpeechStarted
  -> SpeechAmplitude*
  -> SpeechCompleted | SubtitleFallback | SpeechFailed
```

Required behavior:

- actual local audio sink or explicit subtitle-only fallback;
- Japanese, English, and Indonesian subtitle delivery;
- amplitude-driven avatar animation;
- preparing, speaking, idle, and failure states;
- reconnecting overlay clients recover current state;
- VTube Studio expressions/actions remain configurable and observable.

Exit criteria: a browser overlay and OBS browser source show the same captions,
voice lifecycle, and avatar state transitions as the original.

## Phase 8 — Platform and outbound-action parity

Status: pending

Port the original platform boundary only after private chat and grounded output
are stable.

Required behavior:

- Twitch EventSub and YouTube Live Chat normalization;
- deduplication, reconnect, rate limits, and token handling;
- inbound chat becomes a scoped viewer event;
- replies are suggestions first;
- outbound messages require explicit approval;
- sent/rejected actions have durable audit receipts;
- platform failures do not break private chat or the overlay.

Exit criteria: synthetic Twitch and YouTube events pass through the same
approval boundary and produce equivalent action records.

## Phase 9 — Persistence, security, and operations parity

Status: pending

Match the original operational guarantees:

- authoritative Postgres/Supabase persistence;
- migrations and startup readiness checks;
- loopback/origin/auth boundaries;
- bounded model, memory, voice, and platform timeouts;
- emergency mute and token revocation;
- backup/restore and data-retention behavior;
- structured privacy-safe telemetry;
- degraded modes that preserve safe chat and subtitle operation.

Exit criteria: the stream preflight and failure runbooks can be followed for
Siduri-Y without undocumented manual recovery.

## Phase 10 — Parity release gate

Status: pending

Before calling Siduri-Y the decoupled successor, run:

- all ported original tests;
- Siduri-Y unit and integration tests;
- memory/provenance/chat vertical-slice tests;
- overlay and voice lifecycle tests;
- platform approval tests;
- a local soak test with reconnects and provider failures;
- a manual private-chat and OBS preflight.

Release is blocked if any of these occur:

- private memory appears in public context;
- a response claims unsupported personal knowledge;
- a claim becomes canonical without approval;
- citations or source events are lost;
- an outbound platform action bypasses approval;
- the overlay speaks without a completion/fallback event;
- a dependency failure corrupts memory or leaves an unsafe active state.

## Working rule

Do not delete or simplify an original behavior while extracting an organ.
First preserve the behavior behind a decoupled interface; simplify only after
the change is explicitly accepted as a new product decision.
