# T5 experience event contract

Status: implementation target; output adapters are not yet on one neutral event boundary

This contract defines how an approved response is rendered or sent. Voice,
body, overlay, platform, and outbound adapters are consumers of policy-approved
events; they are not alternate memory, identity, or approval systems.

## Event envelope

Every visible or outbound event must carry:

```ts
interface ExperienceEvent {
  eventId: string;
  companionId: string;
  responseId: string;
  correlationId: string;
  channel: "public" | "direct" | "private" | "operator";
  audienceId: string;
  approval: "APPROVED";
  kind: "voice" | "caption" | "avatar" | "platform_action";
  lifecycle: "STARTED" | "PROGRESS" | "COMPLETED" | "FAILED";
  evidenceIds: string[];
  text?: string;
  language?: string;
  createdAt: string;
  expiresAt?: string;
}
```

The envelope is a target contract, not the current TypeScript API. An adapter
must reject an event missing companion, response, audience, approval, or
correlation context. `APPROVED` means the response decision has been made for
this exact companion/audience; it does not grant broader output permission.

## One output path

```text
model response
  -> staged response plan
  -> evidence/disclosure filter
  -> explicit response approval
  -> neutral experience event
  -> selected adapter(s)
  -> lifecycle/audit events
```

Raw model text, OCR, platform messages, observations, or knowledge results may
not enter an adapter directly. Rejection, expiry, unknown approval, provider
failure, or audience mismatch terminates the path before visible/output event
creation.

## Adapter responsibilities

| Adapter | May do | Must not do |
| --- | --- | --- |
| Voice | Queue approved speech, preserve order/priority, emit lifecycle/failure events, fall back to captions | Speak staged/private-forbidden text or invent a speaker identity |
| Body/avatar | Render approved expression/action lifecycle and isolate companion connections | Expose private evidence or approve a response |
| Overlay | Render audience-permitted captions/citations and bounded uncertainty | Infer identity from transport or show operator/private metadata publicly |
| Platform ingress | Normalize bounded viewer events with actor/channel/audience context and deduplicate | Treat platform text as policy, memory approval, or trusted identity |
| Outbound action | Persist pending target/content/evidence, require explicit approval, audit send/failure | Send unknown, expired, duplicate, or unapproved actions |

## Lifecycle rules

### Voice and avatar

```text
APPROVED response -> STARTED -> PROGRESS* -> COMPLETED
                                  └────────> FAILED
```

Cancellation and provider failure emit bounded failure metadata and do not
change memory or approval state. A speech retry must reuse the same approved
response and remain within its expiry/audience policy.

### Outbound actions

```text
SUGGESTED -> PENDING_APPROVAL -> APPROVED -> SENT
                         ├──────> REJECTED
                         └──────> EXPIRED
```

`SENT` is valid only after target, content, companion, audience, evidence, and
approval IDs match. A send failure is recorded as failed; it is not silently
retried with broadened scope.

## Disclosure and metadata

Before dispatch, the event builder rechecks:

```text
companion isolation
  -> response status/expiry
  -> channel and audience
  -> evidence sensitivity and allowed audiences
  -> adapter capability and destination policy
```

Public output may include only public-safe text, bounded citations, and
permitted uncertainty. It must exclude private claims/evidence, raw frames,
operator controls, prompts, secrets, correlation internals not intended for
the audience, and approval controls.

## Platform ingress boundary

Inbound events are untrusted source events. Normalization must preserve:

```text
source event ID
platform/provider ID
actor/session reference (when available)
channel and configured audience
received timestamp
deduplication key
bounded text/content
trust classification
```

Signature, OAuth state, rate, and replay checks happen before an event can
enter response planning. A platform message can suggest a response or pending
memory candidate only under the relevant policy; it cannot activate either.

## Blank-slate output

With a fresh companion and no approved response, adapters emit nothing. With a
fresh companion and an approved neutral response, they must not add a personal
name, title, relationship, account, or private audience. Output defaults come
from explicit deployment configuration and capability policy, never from the
original personal Siduri deployment.

## Required tests

| Group | Minimum proof |
| --- | --- |
| Envelope | Missing metadata is rejected before adapter dispatch |
| Approval | Rejected/staged/expired responses produce no output |
| Voice | Queue, cancellation, fallback, and lifecycle ordering are preserved |
| Body/overlay | Companion isolation and public-safe rendering are enforced |
| Ingress | Signature/replay/rate/deduplication checks bound source events |
| Outbound | Pending → approved → sent is explicit and auditable |
| Disclosure | Private evidence never reaches public voice, overlay, or platform output |
| Failure | Adapter/provider failure does not mutate memory or approval state |
| Runtime | One approved response path drives all output adapters |

These tests must use the neutral fixture policy in
[`BLANK-SLATE-FIXTURE-GUIDE.md`](./BLANK-SLATE-FIXTURE-GUIDE.md) and record
results in [`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
