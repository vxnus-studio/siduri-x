# Blank-slate fixture guide

Status: fixture specification; executable B0–B9 fixtures are not yet ported

This guide defines the neutral data shape for extracted behavior tests. It
exists because a test can accidentally make a personal deployment look like
required Siduri behavior even when production defaults are clean. Fixtures
must prove behavior with opaque, generated identities and explicit context.

## Canonical fixture envelope

Every B0–B9 fixture should be representable by this envelope before it is
passed to an API, runtime, or organ adapter:

```json
{
  "scenarioId": "B2",
  "companionId": "companion-a",
  "request": {
    "actor": {
      "actorId": "actor-a",
      "sessionId": "session-a",
      "authorizationRole": "viewer",
      "capabilities": ["chat:public"],
      "authenticated": false
    },
    "conversation": {
      "channel": "public",
      "audienceId": "audience-public",
      "correlationId": "correlation-a"
    }
  },
  "messages": [
    { "role": "user", "content": "Please remember my preferred label is label-a." }
  ],
  "initialState": {
    "claims": [],
    "directives": [],
    "subjects": []
  },
  "expected": {
    "responseConstraints": ["no-unapproved-memory-effect"],
    "candidates": ["pending-claim-a"],
    "retrieval": [],
    "events": ["source-event-a", "proposal-event-a"]
  }
}
```

The envelope is illustrative, not a runtime schema. The runtime contract is
defined by [`T1-NEUTRAL-CONTEXT-SPEC.md`](./T1-NEUTRAL-CONTEXT-SPEC.md).

## Identifier rules

Use identifiers that communicate test topology, not a real person's identity:

| Field | Allowed examples | Not allowed as canonical fixture data |
| --- | --- | --- |
| Companion | `companion-a`, `companion-b` | `default`, a personal deployment name |
| Actor | `actor-a`, `anonymous-session-a` | `primary_user`, a legal/display name |
| Session | `session-a`, `session-expired-a` | an account, stream, or operator name |
| Audience | `audience-public`, `audience-direct-a`, `audience-operator` | `MASTER_PRIVATE`, `master_stream`, a personal title |
| Subject | `actor:actor-a`, `companion:companion-a` | a global user subject or role-derived subject |
| Evidence | `evidence-a`, `source-event-a` | raw prompt, screenshot, token, or private text |
| Domain value | `value-a`, `label-a`, `topic-a` | account IDs, personal facts, or provider-specific identity defaults |

Test values may be readable enough to explain an assertion, but they must not
encode a relationship. Prefer `label-a` and `value-new` over a real name or a
title that implies how the companion should address an actor.

## Scenario construction rules

### Fresh state

B0 fixtures start with empty claims, directives, subjects, and profile
projection. Configuration may provide the companion's capabilities, but never
a user identity, relationship, preferred address, or private audience.

### Teaching

B2 fixtures include an explicit teaching utterance only when testing teaching.
The utterance may propose a neutral value such as `label-a`; it must produce a
pending candidate with a source event. The fixture must assert that generation
does not activate it.

### Approval and correction

B3/B4/B7 fixtures must give every candidate and decision a stable opaque ID.
Approval, rejection, expiry, supersession, and revocation must be separate
steps. Assertions must inspect both the current projection and retained audit
history.

### Disclosure

B5 fixtures create two claims with the same companion and actor but different
audiences, for example `audience-public` and `audience-direct-a`. The public
request must not see the direct claim even when its actor has an elevated
authorization role.

### Untrusted context

B8 fixtures may contain injection-shaped text in a user message, retrieved
claim, OCR result, or provider result. Mark its origin explicitly and assert
that it remains data. Do not place injection text in a system/configuration
fixture where it would test the wrong boundary.

### Observation

B9 fixtures use deterministic bytes such as `[1, 2, 3]` and synthetic provider
readings. Assert redaction, expiry, duplicate suppression, evidence linkage,
and response approval. Never persist or print a real frame, raw prompt, token,
or private event payload.

## Fixture review checklist

- [ ] `scenarioId` maps to B0–B9 and the original source traceability map.
- [ ] `companionId`, `actorId`, `sessionId`, audience, and evidence IDs are opaque.
- [ ] The request contains explicit channel, audience, capability, and correlation context.
- [ ] Empty state has no user or relationship defaults.
- [ ] Teaching values are pending and actor-scoped, not global.
- [ ] Approval and response approval are represented as separate transitions.
- [ ] Public assertions inspect absence of private data, not only presence of public data.
- [ ] Untrusted text cannot be interpreted as a policy/system instruction.
- [ ] The fixture does not contain credentials, real personal data, raw frames, or provider secrets.
- [ ] The fixture has a negative assertion for the relevant blank-slate/privacy boundary.

## Required scan

Before a fixture change is accepted, run the repository's classified forbidden-
default scan and inspect every hit. A fixture is not neutral merely because it
lives under a test directory. Personal legacy values may appear only in an
explicit migration/regression test and must be labeled as such.

The fixture guide is complete only when each B0–B9 fixture has a linked test,
source reference, expected state transition, and result in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
