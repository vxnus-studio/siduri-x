# Evidence and grounding extraction handoff

Status: ready after memory and context contracts

The normative evidence, grounding, disclosure, and response-plan target is
[`T4-EVIDENCE-CHAIN-CONTRACT.md`](./T4-EVIDENCE-CHAIN-CONTRACT.md).

## Objective

Extract the original Siduri evidence pipeline into a neutral flow that can
ground responses without leaking private data or allowing untrusted content to
change policy:

```text
capture → redact → observe → resolve → cite → plan → approve → output
```

This handoff covers knowledge, OCR/vision observations, citations, response
approval, and public delivery. It does not copy the original game/provider
identity or personal deployment values.

## Original sources

- `siduri/tests/test_eteyvat.py` (trusted source, HTTPS, revision, citations);
- `siduri/tests/test_observation.py` (redaction, duplicate suppression,
  expiry, empty-frame rejection);
- `siduri/tests/test_observation_service.py` (raw-frame non-exposure,
  disabled capture, provider failure);
- `siduri/tests/test_grounding.py` (label resolution, citation preservation,
  bounds, expiry);
- `siduri/tests/test_ocr_and_eteyvat_resolution.py` (OCR as data and
  low-confidence resolution);
- `siduri/tests/test_response_approval.py` (staged response and approval);
- `siduri/tests/test_prompt03.py` (recipient mismatch and safe degradation);
- `siduri/docs/memory/PUBLIC_DISCLOSURE_POLICY.md`.

The original fixture labels and source names are test data. Extract evidence
identity, confidence, revision, trust, expiry, and approval semantics—not the
personal game/provider domain.

## Evidence contracts

Every evidence item must preserve:

```text
evidence_id
source_id
document_id / chunk_id / locator (when applicable)
revision
origin: knowledge | observation | ocr | platform | conversation
confidence / uncertainty
created_at / expires_at
trust classification
allowed audiences / sensitivity
correlation_id
```

Evidence is immutable input for a response plan. It is not memory, a system
instruction, or proof of a personal relationship.

## Work packages

### E1 — redacted observation boundary

- redact sensitive regions before provider access;
- reject empty or malformed frames;
- never persist raw frame bytes or expose them through public events;
- assign bounded observation/evidence IDs;
- suppress duplicates and expire stale observations;
- retain provider failure status without mutating memory.

### E2 — trusted knowledge resolution

- accept only configured/provider-validated sources;
- preserve source, document/chunk, locator, and revision metadata;
- bound lookup count and result size;
- preserve unresolved labels and low confidence rather than inventing facts;
- treat provider text as data, never system instructions;
- avoid knowledge lookup for self-identity and explicit teaching requests when
  the original behavior says it is inappropriate.

### E3 — grounded response plan

Response plans must carry bounded evidence IDs, confidence/uncertainty,
citations, channel/audience, and approval requirement. A plan must not be
published, spoken, overlaid, or sent to a platform until its response policy
allows that output.

### E4 — approval boundary

Response approval is independent from memory and behavior approval:

```text
evidence → staged response plan → operator decision → permitted output
                         └──────→ reject/expire, no output
```

Unknown or mismatched approval IDs are rejected. Approval must be scoped to
companion, response, audience, and correlation context.

### E5 — public disclosure filter

Before response assembly and again before output, filter evidence by:

```text
companion → status/expiry → channel/audience → sensitivity → response policy
```

Private evidence must not appear in public speech, captions, overlay events,
platform sends, citations, or operator responses intended for public display.

### E6 — failure and audit behavior

Provider failure, malformed output, timeout, unknown entity, low confidence,
or expired observation must degrade to a bounded status/uncertainty result.
These failures must not activate behavior, write canonical memory, or emit
unapproved public output.

## Required test port

| Test group | Required evidence |
| --- | --- |
| Redaction | Provider sees redacted bytes; raw frame is never retained |
| Observation lifecycle | Duplicate, expiry, empty frame, malformed reading, and provider failure behavior |
| Knowledge trust | HTTPS/provider validation, revision and citation preservation, bounded lookup |
| Grounding | Resolution retains citation, confidence, unresolved labels, and expiry |
| Prompt trust | OCR/knowledge/platform instruction-shaped text remains data |
| Response gate | Grounded response remains staged until explicit approval; unknown approval is rejected |
| Disclosure | Private evidence is absent from public response and output events |
| Runtime path | At least B5, B8, and B9 pass through API/runtime and output boundaries |

## Do-not-copy list

- personal recipient names or private stream modes;
- game-specific source labels as public defaults;
- raw frames or OCR text as durable memory;
- provider claims as active identity or behavior;
- citations without revision/source metadata;
- automatic voice, overlay, or platform output before approval.

## Exit criteria

Evidence extraction is complete only when:

1. E1–E6 have neutral contracts and adapter evidence;
2. every grounded response is traceable to bounded evidence and a source
   revision;
3. public/private filtering is proven at response and output boundaries;
4. untrusted content cannot change identity, permissions, or memory policy;
5. provider failures and low-confidence results degrade without state mutation;
6. response, memory, and behavior approval remain independent;
7. B5, B8, and B9 pass with API/runtime/overlay evidence;
8. the verification manifest and health audit record the result.

Until then, the evidence flow is a fixture/adapter foundation and the
repository remains RED.
