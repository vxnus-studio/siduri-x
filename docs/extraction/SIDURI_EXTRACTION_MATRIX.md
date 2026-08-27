# Siduri extraction matrix

Status: baseline inventory for the extraction phase

The neutral scenario trace that will provide executable evidence is in
[`PHASE-0-GOLDEN-TRACE.md`](./PHASE-0-GOLDEN-TRACE.md).
Memory-specific extraction work is handed off in
[`PHASE-2-MEMORY-EXTRACTION-HANDOFF.md`](./PHASE-2-MEMORY-EXTRACTION-HANDOFF.md).
Behavior and prompt extraction work is handed off in
[`BEHAVIOR-EXTRACTION-HANDOFF.md`](./BEHAVIOR-EXTRACTION-HANDOFF.md).
Evidence and grounding extraction work is handed off in
[`EVIDENCE-EXTRACTION-HANDOFF.md`](./EVIDENCE-EXTRACTION-HANDOFF.md).
Experience-layer extraction work is handed off in
[`EXPERIENCE-EXTRACTION-HANDOFF.md`](./EXPERIENCE-EXTRACTION-HANDOFF.md).

Exact original test references for the B0–B9 behavior rows are maintained in
[`ORIGINAL-SOURCE-TRACEABILITY.md`](./ORIGINAL-SOURCE-TRACEABILITY.md).

This matrix tracks the work required to extract the original Siduri
experience into neutral Siduri-Y contracts. “Partial” means Siduri-Y has a
similarly named API or slice, not that it has behavioral parity.

| Capability | Original source of truth | Neutral Siduri-Y contract | Current state | Acceptance evidence |
| --- | --- | --- | --- | --- |
| Blank-slate greeting | `siduri/tests/test_chat.py::test_empty_memory_does_not_predeclare_user_relationship`; `siduri/packages/persona/prompt.py` | Prompt assembly receives no relationship until approved memory or behavior explicitly supplies one | Partial; prompt text has a safeguard, but runtime still has `primary_user` assumptions | Empty-memory test proves neutral prompt and response |
| Channel and audience routing | `siduri/packages/persona/domain.py::RecipientClassifier`; `siduri/docs/personality/AUDIENCE_AND_RECIPIENTS.md` | Separate actor authorization from conversation channel/audience; audience is request/config data | Violating; `/chat` forces `OWNER` | Public, direct, private, and operator requests resolve independently |
| Conversation history | `siduri/tests/test_chat.py::test_chat_history_is_bounded_and_validated` | Validate message roles, reject system injection, and enforce a bounded history before prompt assembly | Partial; needs parity test at the public runtime boundary | Invalid roles reject; oversized history is bounded deterministically |
| Source events | `siduri/packages/memory/service.py::SourceEvent`; `siduri/docs/memory/TEACH_SIDURI.md` | Immutable source event attached to every confirmed claim or directive | Partial; source-event API exists | Confirmed records cannot exist without a source event |
| Knowledge claims | `siduri/packages/memory/service.py::VersionedClaim`; `siduri/docs/memory/MEMORY_MODEL.md` | Versioned claim with authority, confidence, sensitivity, audiences, validity, and provenance | Partial; schema/API exists, retrieval and lifecycle parity remain open | Approval, retrieval, supersession, expiry, and audit tests |
| Teaching proposals | `siduri/packages/memory/teaching.py`; `siduri/tests/test_explicit_teaching.py` | Explicit input creates bounded pending candidates only | Violating; extractor embeds `primary_user`, creator, and Genshin-specific fields | Neutral teaching candidate test with no personal defaults |
| Approval lifecycle | `siduri/packages/memory/service.py::approve/reject/update`; `siduri/tests/test_teach_mode_evaluation.py` | Pending, approved, rejected, session-only, superseded, revoked, and expired are distinct states | Partial; basic proposal operations exist | Rejection/unreviewed candidates never enter retrieval |
| Revision and audit | `siduri/packages/memory/service.py::supersede/revisions/audit_events` | Corrections append history and preserve the prior value and reason | Partial; implementation has compatibility methods, transaction parity is open | Correction preserves history and links replacement |
| Disclosure policy | `siduri/packages/persona/domain.py::DisclosurePolicy`; `siduri/docs/memory/PUBLIC_DISCLOSURE_POLICY.md` | Retrieval filters by status, audience, sensitivity, and validity before prompt/output | Partial; scope filtering exists, audience model is not neutralized | Private claim absent from public prompt, citations, and overlay |
| Active behavior | `siduri/packages/persona/behavior.py`; `siduri/tests/test_behavioral_memory.py` | Approved directives compile only when their scope and validity match the request | Partial; compiler exists, scope model is legacy | Disable/revoke/supersede and audience tests |
| Prompt trust boundaries | `siduri/packages/persona/prompt.py`; `siduri/tests/test_prompt03.py` | Memory, OCR, platform text, and knowledge are data, never system instructions | Partial; Siduri-Y prompt includes the rule | Injection fixture cannot change identity, permissions, or policy |
| Response plan | `siduri/apps/orchestrator/src/siduri_orchestrator/contracts.py::ResponsePlan`; `siduri/tests/test_response_approval.py` | Structured speech, language, emotion, evidence, confidence, proposals, and approval state | Partial; response schema exists | Malformed plans fail safely and approval gates output |
| Observation grounding | `siduri/tests/test_observation*.py`; `siduri/tests/test_grounding.py` | Capture → redact → observe → ground → cite → approve → output | Partial; fixture observation organ exists | Expiry, duplicate suppression, evidence linkage, and no raw-frame leakage |
| Public distribution | `siduri/docs/memory/TEACH_SIDURI.md`; `siduri/docs/personality/*` as contrast | Public package has no personal defaults, private recipient names, or personal fixtures | Violating; legacy identifiers remain in runtime and tests | Repository scan plus fresh-companion integration test |

## Interpretation rules

### Extract behavior, not persona data

The original `MeProfile`, relationship policy, and recipient names describe one
personal deployment. Extract their validation and disclosure mechanics, but
replace their values with configuration and explicit teaching. A source file
that contains a personal value is not automatically a source of truth for the
public default.

### Treat tests as behavioral evidence

An original test is an extraction requirement when it asserts a safety or
user-visible outcome. Fixture names, personal titles, and game-specific sample
values are not requirements. Siduri-Y parity tests must use neutral fixture
identifiers unless the test is explicitly a migration/compatibility test.

### Do not promote compatibility names into canonical contracts

`OWNER`, `VIEWER`, and `OPERATOR` may remain authentication or operational
roles while migration is in progress. They must not be used as substitutes for
recipient identity, public/private audience, or relationship state.

## Phase exit gate

The extraction phase may advance only when:

- every row marked “violating” has a design decision and a remediation issue;
- neutral core contracts exist for actor, channel, audience, claim, proposal,
  source event, and response plan;
- blank-slate regression tests run through the actual API/runtime boundary;
- no default configuration or production prompt asserts a personal
  relationship;
- the next handoff names remaining gaps instead of declaring parity complete.
