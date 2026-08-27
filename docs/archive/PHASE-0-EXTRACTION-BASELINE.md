# Phase 0 — behavior extraction baseline

Status: specification recorded; executable fixtures not yet ported

## Objective

Extract the original Siduri behavior into a set of neutral, provider-independent
scenarios before changing Siduri-Y runtime code. The scenarios describe visible
outcomes and safety decisions; they do not prescribe the original Python
module boundaries or personal deployment values.

The original tests are the evidence source. The fixture values below are
intentionally generic so that the baseline can run against a public
blank-slate companion.

The exact original test references for these scenarios are maintained in
[`ORIGINAL-SOURCE-TRACEABILITY.md`](./ORIGINAL-SOURCE-TRACEABILITY.md).
Fixture construction and personal-value exclusion rules are defined in
[`BLANK-SLATE-FIXTURE-GUIDE.md`](./BLANK-SLATE-FIXTURE-GUIDE.md).

The state-transition form of the baseline is specified in
[`PHASE-0-GOLDEN-TRACE.md`](./PHASE-0-GOLDEN-TRACE.md).
The manual vertical-slice procedure is specified in
[`PHASE-0-NEUTRAL-MANUAL-WALKTHROUGH.md`](./PHASE-0-NEUTRAL-MANUAL-WALKTHROUGH.md).

## Baseline scenarios

### B0 — fresh companion is empty

Setup: create a new companion with no claims, directives, or user profile.

Expected:

- no user name, address, relationship, or private profile is present;
- the prompt says to speak neutrally and not claim prior personal knowledge;
- the response does not address the user with a preconfigured title;
- no knowledge search is performed for a greeting.

Original evidence: `test_chat.py::test_empty_memory_does_not_predeclare_user_relationship`.

### B1 — ordinary conversation is not teaching

Input: a normal greeting or question with no explicit teaching language.

Expected:

- no memory or behavior candidate is created;
- the response remains within the request's channel and audience;
- conversation history is bounded and validated.

Original evidence: `test_explicit_teaching.py::test_ordinary_conversation_does_not_create_candidates` and
`test_chat.py::test_chat_history_is_bounded_and_validated`.

### B2 — explicit teaching creates bounded candidates

Input: a user explicitly supplies a preference, name, or other profile fact.

Expected:

- the source event records the original input and provenance;
- each atomic fact becomes a separate pending candidate;
- no candidate becomes active during generation;
- the candidate uses a neutral subject representing the requesting actor, not
  `primary_user` or a predeclared relationship;
- a relationship is stored only when explicitly stated and later approved.

Original evidence: `test_explicit_teaching.py::test_one_teaching_message_decomposes_multiple_atomic_claims` and
`test_chat.py::test_chat_candidates_are_pending_until_review`.

### B3 — approval promotes exactly one candidate

Expected:

- approval creates canonical memory or active behavior according to the
  candidate type;
- source event, authority, sensitivity, audience, and confirmation are
  retained;
- unrelated candidates and existing values are unchanged;
- the operator receipt identifies the resulting runtime effect.

Original evidence: `test_behavioral_memory.py::test_provenance` and
`test_response_approval.py::test_grounded_response_is_held_until_approval`.

### B4 — rejection and session-only state do not persist as active memory

Expected:

- rejected candidates remain auditable but are excluded from retrieval;
- session-only values expire with the session;
- an unreviewed candidate never changes the system prompt or public output.

Original evidence: `test_chat.py::test_chat_candidates_are_pending_until_review` and
`test_teach_mode_evaluation.py`.

### B5 — disclosure is audience-safe

Setup: approve one public-safe claim and one private claim for the same
companion.

Expected:

- a public request sees only the public-safe claim;
- a private request sees only claims permitted for that audience;
- citations and response metadata do not expose excluded evidence;
- actor authentication does not bypass audience or sensitivity policy.

Original evidence: `test_behavioral_memory.py::test_audience_filtering` and
`docs/memory/PUBLIC_DISCLOSURE_POLICY.md`.

### B6 — identity and relationship are learned, not inferred

Setup: ask the companion about the user's identity or relationship while
memory is empty.

Expected:

- the companion states uncertainty or asks for explicit teaching;
- it does not query unrelated external knowledge;
- it does not claim a creator, owner, master, or prior personal history.

Original evidence: `test_chat.py::test_self_identity_chat_does_not_query_eteyvat_or_attach_citations` and
`test_behavioral_memory.py::test_empty_slate`.

### B7 — correction preserves history

Expected:

- a correction creates a new revision;
- the previous value is superseded or revoked, not deleted;
- retrieval returns only the current permitted value;
- audit history explains who changed it, why, and from which source.

Original evidence: `test_behavioral_memory.py::test_correction_and_supersession`.

### B8 — untrusted context cannot alter policy

Input: a retrieved memory, OCR result, platform message, or knowledge result
contains instructions to change identity, permissions, or memory policy.

Expected: the content is treated as data, not as a system instruction.

Original evidence: `test_behavioral_memory.py::test_injection_resistance` and
`test_prompt03.py`.

### B9 — observation is bounded and approval-gated

Expected:

- frames are redacted before provider access;
- raw frames are not persisted in observations or public events;
- duplicate and expired observations are suppressed;
- provider failures become bounded evidence/status, not memory mutations;
- grounded public output waits for the response approval boundary.

Original evidence: `test_observation.py`, `test_observation_service.py`, and
`test_response_approval.py::test_grounded_response_is_held_until_approval`.

## Fixture requirements

Each ported fixture must identify:

```text
scenario_id
companion_id
actor_id
channel
audience
input_messages
initial_claims
initial_directives
expected_response_constraints
expected_candidates
expected_retrieval
expected_events
```

Fixtures must use generated or neutral identifiers. A fixture containing a
personal name, title, relationship, or game account is allowed only when the
scenario explicitly tests user teaching, and the value must still begin as a
pending candidate.

## Phase 0 exit criteria

Phase 0 is complete only when:

1. B0–B9 exist as executable fixtures or are explicitly marked as blocked by a
   missing neutral contract.
2. Every expected outcome maps to an original source and a Siduri-Y test.
3. At least one test crosses the API/runtime boundary for B0, B2, B4, B5, and
   B6.
4. A fresh companion contains no personal defaults after initialization.
5. The parity roadmap is updated with observed differences rather than a
   completion claim.
