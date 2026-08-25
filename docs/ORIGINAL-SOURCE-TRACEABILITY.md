# Original source traceability

Status: source map; Siduri-Y parity tests are not yet ported

This document records which original Siduri tests are the behavioral oracle for
the neutral B0–B9 scenarios. It extracts outcomes, boundaries, and lifecycle
rules. It does not copy the original recipient names, personal identity
values, game-account fixtures, or deployment assumptions into Siduri-Y.

## Scenario map

| Neutral scenario | Original source and test | Behavior to extract | Siduri-Y proof still required |
| --- | --- | --- | --- |
| B0 — fresh companion | `siduri/tests/test_chat.py::test_empty_memory_does_not_predeclare_user_relationship`; `siduri/tests/test_behavioral_memory.py::test_empty_slate` | Empty memory does not invent a user, relationship, or learned self | Fresh API/runtime initialization and first chat contain no subject or personal default |
| B1 — ordinary conversation | `siduri/tests/test_explicit_teaching.py::test_ordinary_conversation_does_not_create_candidates` | Conversation is not silently treated as teaching | Ordinary public/direct message produces no candidate or durable write |
| B2 — explicit teaching | `siduri/tests/test_chat.py::test_chat_candidates_are_pending_until_review`; `siduri/tests/test_explicit_teaching.py::test_one_teaching_message_decomposes_multiple_atomic_claims` | Explicit teaching becomes typed, atomic, pending proposals | Actor-scoped subject, source event, audience, sensitivity, and pending status survive API/runtime mapping |
| B3 — approval | `siduri/tests/test_response_approval.py::test_grounded_response_is_held_until_approval`; `siduri/tests/test_teach_mode_evaluation.py::test_approved_game_account_proposal_becomes_queryable_claim` | Approval is an explicit transition and only then changes retrieval/output | Memory approval and response approval remain separate, auditable transitions |
| B4 — rejection/session scope | `siduri/tests/test_behavioral_memory.py::test_disabled_behavior`; `siduri/tests/test_teach_mode_evaluation.py::test_respects_only_this_session_temporality` | Rejected, disabled, or session-only material is not active durable context | Runtime retrieval excludes inactive/session-expired material and preserves the decision |
| B5 — disclosure | `siduri/tests/test_chat.py::test_private_chat_uses_private_recipient_without_public_broadcast`; `siduri/tests/test_behavioral_memory.py::test_audience_filtering` | Recipient/audience filtering prevents private material from public output | Neutral channel/audience policy is enforced without treating an auth role as audience |
| B6 — identity question | `siduri/tests/test_chat.py::test_self_identity_chat_does_not_query_eteyvat_or_attach_citations` | Self-identity questions use bounded self context and do not fabricate external evidence | Blank-slate self response makes no identity claim and does not trigger unrelated retrieval |
| B7 — correction | `siduri/tests/test_behavioral_memory.py::test_correction_and_supersession`; `siduri/tests/test_teach_mode_evaluation.py::test_single_value_game_account_correction_supersedes_old_claim` | Correction supersedes prior state while retaining history/provenance | Replacement is current, old record remains auditable, and retrieval excludes superseded state |
| B8 — untrusted context | `siduri/tests/test_behavioral_memory.py::test_injection_resistance`; `siduri/tests/test_chat.py::test_chat_history_is_bounded_and_validated`; `siduri/tests/test_prompt03.py::test_recipient_mismatch_isolated_and_degraded` | User/provider/retrieved text cannot rewrite policy, roles, or recipient routing | Context validation and prompt trust boundaries hold at the runtime/API boundary |
| B9 — observation and approval | `siduri/tests/test_observation.py::test_redacts_before_provider_and_marks_ocr_untrusted`; `siduri/tests/test_grounding.py::test_resolution_preserves_citation_and_unresolved_label`; `siduri/tests/test_response_approval.py::test_grounded_response_is_held_until_approval` | Capture is redacted, observation is uncertain/evidence-linked, grounding is cited, output waits for approval | Observation → grounding → response approval works end-to-end with no raw-frame/public leakage |

## Cross-cutting source rules

### Chat and history

The original chat tests establish four independent boundaries that must remain
separate in the neutral port:

1. history is bounded and rejects instruction-shaped system messages;
2. self-identity questions do not become knowledge searches;
3. ordinary messages do not become teaching candidates;
4. candidate generation does not itself approve memory or output.

The original test name `private_chat` describes the source deployment route. In
Siduri-Y it is evidence for explicit private-channel semantics, not permission
to make private chat the only or default public route.

### Memory and behavior

The behavioral-memory tests establish that learned user context and Siduri's
active behavior are different projections. Siduri-Y must preserve that split
even when both are stored by the same organ. A value used by the original
fixture is not a required identity fact; the required behavior is typed
proposal, approval, scope filtering, correction, and injection resistance.

### Evidence and observation

The observation and grounding tests establish an evidence chain, not a claim
that visual interpretation is truth:

```text
redacted capture -> uncertain observation -> bounded resolution -> citation
                 -> response proposal -> explicit output approval
```

Raw frames, untrusted OCR, private evidence, and internal correlation data
must remain outside public output.

## Personal-value quarantine

The following source values are retained only as fixture classification and
must not be copied into canonical Siduri-Y defaults, prompts, UI templates, or
public tests:

- original creator/operator names and titles;
- `master_private`, `MASTER_STREAM`, and equivalent personal recipients;
- named game-account fields or account identifiers;
- domain-specific identity fixture values;
- deployment-specific operator roles or local paths.

Their neutral replacements are defined in
[`LEGACY_IDENTIFIER_MIGRATION.md`](./LEGACY_IDENTIFIER_MIGRATION.md). The
original source catalog identifies where a value is a behavioral oracle versus
personal deployment data.

## Porting record

| Requirement | Current state | Evidence needed to close |
| --- | --- | --- |
| Every B0–B9 row has an original test reference | Documented here | Review against the source tree and retain exact test names |
| Neutral fixture replaces personal fixture | Partial; baseline is specified but fixtures are not ported | Neutral API/runtime fixtures with no personal identifiers |
| Original result is observable at the same boundary | Missing for most rows | Direct Siduri-Y runtime/API tests, not isolated organ tests |
| Privacy and approval failure modes are tested | Partial in isolated organs | End-to-end disclosure, approval, and failure tests |
| Source changes are recorded | Required for implementation | Completed extraction change record attached to each implementation |

This map is complete only when each row links to a Siduri-Y test and recorded
result in [`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
