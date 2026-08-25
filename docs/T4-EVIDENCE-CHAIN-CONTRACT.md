# T4 evidence-chain contract

Status: implementation target; observation, knowledge, and response approval are not yet proven end-to-end

This contract defines how Siduri-Y turns observations and knowledge into
bounded, inspectable response plans. Evidence is context with provenance; it
is not memory, identity, policy, or permission.

## Evidence record

Every evidence item entering grounding or response planning must have:

```ts
interface EvidenceRecord {
  evidenceId: string;
  sourceId: string;
  documentId?: string;
  chunkId?: string;
  locator?: string;
  revision?: string;
  origin: "knowledge" | "observation" | "ocr" | "platform" | "conversation";
  confidence?: number;
  uncertainty?: string;
  createdAt: string;
  expiresAt?: string;
  trust: "configured" | "provider" | "untrusted";
  sensitivity: "public" | "private" | "restricted";
  allowedAudiences: string[];
  companionId: string;
  correlationId: string;
}
```

Evidence IDs are bounded references. Raw frames, full prompts, secrets, and
unredacted private text are not evidence payloads and must not be persisted in
public events or response metadata.

## Evidence pipeline

```text
capture
  -> redact and validate
  -> observe with confidence/expiry
  -> resolve against configured knowledge
  -> preserve source/revision/citation
  -> stage response plan
  -> apply disclosure and approval policy
  -> emit only permitted output
```

Each step may add evidence or a bounded failure status. No step may promote
untrusted content into a system instruction, approved memory, active behavior,
or public output without its separate approval boundary.

## Response-plan contract

A staged response plan must carry:

```text
response_id
companion_id
correlation_id
channel and audience
speech/content and language metadata
bounded evidence IDs and citation metadata
confidence/uncertainty summary
required approval policy
status: STAGED | APPROVED | REJECTED | EXPIRED | EMITTED
```

The response plan is not emitted merely because a provider returned valid JSON.
Provider validation proves shape; response approval proves permission to
deliver it.

## Disclosure filter

Before planning and again immediately before output, evaluate evidence in this
order:

```text
companion isolation
  -> evidence status and expiry
  -> channel
  -> audience intersection
  -> sensitivity policy
  -> response/output capability
```

Authorization permits an operation such as inspection or approval. It does not
make private evidence public and cannot bypass sensitivity or audience rules.
Excluded evidence must be absent from speech, captions, overlay events,
platform sends, and public citations—not merely hidden from the operator UI.

## Source-specific rules

| Origin | Required handling | Forbidden effect |
| --- | --- | --- |
| `knowledge` | Preserve validated source, document/chunk, locator, and revision | Cannot become identity or policy |
| `observation` | Redact first; retain confidence, expiry, duplicate status, and evidence ID | Cannot become a confirmed claim automatically |
| `ocr` | Mark as untrusted data and preserve uncertainty | Cannot issue instructions or change permissions |
| `platform` | Bind to channel/audience and retain source event | Cannot trigger public send without response approval |
| `conversation` | Validate role/history bounds and correlate to the request | Cannot override system or approval policy |

## Approval separation

```text
evidence -> staged response
claim proposal -> claim approval
behavior proposal -> behavior approval
```

These are independent records and decisions. Approving a memory claim does
not authorize a response; approving a response does not confirm a claim or
activate a directive. Unknown, expired, mismatched, or cross-companion approval
IDs are rejected.

## Failure behavior

The pipeline degrades to a bounded status when capture, provider, parsing,
resolution, citation, or approval fails. It must not:

- invent a citation, entity, confidence, or identity;
- retain raw frames or private provider payloads;
- write canonical memory or activate behavior;
- publish, speak, overlay, or send unapproved output;
- reveal excluded evidence through an error, debug field, or citation preview.

Failure and rejection records retain only safe metadata: stage, reason code,
companion, correlation ID, bounded source/evidence IDs, and timestamps.

## Required tests

| Group | Minimum proof |
| --- | --- |
| Redaction | Provider receives redacted bytes and raw frame is never retained |
| Observation | Empty, duplicate, expired, malformed, and provider-failure paths are bounded |
| Knowledge | Source/revision/citation metadata survives validated retrieval |
| Grounding | Low-confidence and unresolved results remain explicit |
| Trust | OCR, knowledge, platform, and quoted text remain data-only |
| Disclosure | Private evidence is absent from public response and output events |
| Approval | Staged response waits for matching explicit approval |
| Separation | Memory/behavior approval cannot substitute for response approval |
| Runtime | B5, B8, and B9 cross API/runtime/output boundaries |

The contract is complete only when these tests use the neutral fixture rules in
[`BLANK-SLATE-FIXTURE-GUIDE.md`](./BLANK-SLATE-FIXTURE-GUIDE.md) and their
results are recorded in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
