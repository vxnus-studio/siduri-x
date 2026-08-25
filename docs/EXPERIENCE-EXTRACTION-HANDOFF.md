# Experience-layer extraction handoff

Status: ready after evidence and response contracts

## Objective

Extract the original Siduri visible experience—voice lifecycle, avatar/body
events, overlay rendering, platform ingress, and outbound approval—without
allowing any adapter to bypass audience, evidence, or response approval rules.

The experience layer renders an approved response. It does not decide identity,
memory, disclosure, or whether an unapproved response may be sent.

## Original sources

- `siduri/tests/test_phase4_voice.py` (speaker discovery, synthesis fallback,
  queue priority, cancellation, amplitude safety);
- `siduri/tests/test_platforms.py` (bounded/deduplicated ingress, OAuth state,
  signatures, outbound approval, audit persistence);
- `siduri/tests/test_response_approval.py` (staged response and approval);
- `siduri/tests/test_chat.py::test_private_chat_uses_private_recipient_without_public_broadcast`;
- original body/overlay and voice package implementations;
- `siduri/docs/personality/AUDIENCE_AND_RECIPIENTS.md` and response policy docs.

Personal broadcaster names, private recipient labels, and platform account
values are fixtures/configuration, not experience defaults.

## Output contract

Every visible or outbound event must carry enough metadata to enforce and audit:

```text
companion_id
response_id / speech_id / event_id
channel and audience
approval state
correlation_id
language and text (when permitted)
evidence IDs (when grounded)
created_at / expires_at
```

An adapter must reject or suppress an event that is missing its companion,
audience, approval, or correlation context.

## Work packages

### X1 — voice lifecycle

- preserve queue priority, ordering, cancellation, and failure events;
- discover configured speakers without a fixed personal speaker ID;
- degrade to subtitles/captions when synthesis fails or speaker metadata is
  unavailable;
- emit `STARTED`, `COMPLETED`, and `FAILED` events with response context;
- never speak a response that is staged, rejected, expired, or audience-
  prohibited.

### X2 — body and avatar events

- translate approved speech/action lifecycle into body events;
- keep WebSocket clients isolated by companion/runtime;
- broadcast only permitted text, captions, expressions, and state transitions;
- avoid exposing private evidence in overlay events;
- handle disconnected clients and VTube Studio failures without mutating
  response or memory state.

### X3 — overlay experience

- consume the neutral event envelope rather than legacy response-plan names;
- render captions only for the event audience;
- preserve lifecycle order and correlation IDs;
- show bounded uncertainty and citations when policy permits;
- never infer identity or relationship from the overlay transport.

### X4 — platform ingress

- normalize viewer/platform events into bounded actor/channel/audience input;
- deduplicate and rate-limit ingress;
- verify signatures and one-time OAuth state where applicable;
- mark platform/OCR text as untrusted data;
- prevent public platform text from creating active memory or behavior.

### X5 — outbound action approval

- represent a platform send as a pending outbound action;
- retain target, content, source event, response/evidence links, and audit;
- require explicit approval before send;
- reject unknown, expired, duplicate, or cross-companion action IDs;
- make send failure visible without retrying unsafe or unapproved content.

### X6 — end-to-end runtime wiring

Connect response approval to voice, body, overlay, and platform adapters in a
single policy-aware flow:

```text
response plan → disclosure filter → approval gate
              → voice/body/overlay/platform output
              → lifecycle/audit event
```

No adapter may independently call a provider or send output from raw model,
observation, OCR, or platform text.

## Required test port

| Test group | Required evidence |
| --- | --- |
| Voice | Speaker discovery, queue priority, cancellation, subtitles, safe amplitude |
| Body | Event ordering, WebSocket isolation, disconnect/failure handling |
| Overlay | Audience-safe captions, lifecycle rendering, correlation preservation |
| Platform ingress | Bounded normalization, deduplication, rate limiting, signature/OAuth checks |
| Outbound | Pending action, explicit approval, audit, unknown/expired rejection |
| Disclosure | Private response/evidence never reaches public voice, overlay, or platform output |
| Runtime | Approved plan alone drives all output; rejection produces no output |

## Do-not-copy list

- personal broadcaster or creator identity;
- private recipient labels as transport defaults;
- direct platform account IDs or tokens;
- raw model/OCR/platform text as approved speech;
- automatic output before response approval;
- global singleton state shared across companions.

## Exit criteria

Experience-layer extraction is complete only when:

1. X1–X6 have neutral event contracts and adapter evidence;
2. output is companion-, audience-, approval-, and correlation-scoped;
3. voice, body, overlay, and platform actions follow one response gate;
4. rejected, expired, unknown, or failed responses produce no unauthorized
   output;
5. private evidence is absent from public output events;
6. platform ingress and outbound actions are audited and bounded;
7. the verification manifest, health audit, and release checklist record the
   evidence.

Until then, the experience layer is an adapter baseline and the repository
remains RED.
