# T1 neutral API contract examples

Status: examples for implementation review; current API does not yet enforce this envelope

> [!NOTE]
> Updated for single-owner deployment model. Multi-audience request/response shapes have been simplified.

These examples make the T1 context contract concrete at the HTTP boundary.
They are illustrative request/response shapes, not evidence that the current
runtime already accepts them. All identifiers are synthetic.

## Owner chat

A direct owner request is the standard interaction mode in single-owner
deployments.

```json
{
  "companionId": "companion-a",
  "context": {
    "actor": {
      "actorId": "owner-a",
      "sessionId": "session-a",
      "relationship": "owner",
      "capabilities": ["chat"],
      "authenticated": true
    },
    "conversation": {
      "channel": "direct",
      "correlationId": "corr-direct-a"
    }
  },
  "message": "Hello.",
  "history": []
}
```

Expected mapper result:

```json
{
  "accepted": true,
  "context": {
    "companionId": "companion-a",
    "channel": "direct",
    "subject": null
  }
}
```

This request creates no durable actor subject and grants no approval capability.

## Direct owner teaching chat

```json
{
  "companionId": "companion-a",
  "context": {
    "actor": {
      "actorId": "owner-a",
      "sessionId": "session-a",
      "relationship": "owner",
      "capabilities": ["chat", "teach:propose"],
      "authenticated": true
    },
    "conversation": {
      "channel": "direct",
      "correlationId": "corr-direct-a"
    },
    "subject": {
      "subjectId": "actor:owner-a",
      "kind": "actor",
      "ownerActorId": "owner-a"
    }
  },
  "message": "Please remember my preferred label is label-a.",
  "history": []
}
```

Expected behavior: the source event and candidate may be created according to
teaching policy, but the candidate remains pending until approved. The owner
can inspect and approve proposals.

## Operator request

```json
{
  "companionId": "companion-a",
  "context": {
    "actor": {
      "actorId": "operator-a",
      "sessionId": "operator-session-a",
      "relationship": "operator",
      "capabilities": ["memory:inspect", "response:approve"],
      "authenticated": true
    },
    "conversation": {
      "channel": "operator",
      "correlationId": "corr-operator-a"
    }
  },
  "operation": "inspect_pending",
  "targetId": "proposal-a"
}
```

Expected behavior: the operation is scoped to `companion-a` and the operator
channel. It does not create an owner subject or mutate companion persona.

## Rejection envelopes

### Missing required context

```json
{
  "accepted": false,
  "error": {
    "code": "MISSING_CONTEXT",
    "fields": ["actor.relationship", "actor.capabilities"],
    "correlationId": "corr-missing-context"
  }
}
```

### Unauthorized operator operation

```json
{
  "accepted": false,
  "error": {
    "code": "UNAUTHORIZED_OPERATION",
    "operation": "memory:mutate",
    "requiredCapability": "memory:mutate",
    "correlationId": "corr-unauth-a"
  }
}
```

Error responses may identify fields and reason codes, but must not echo private
messages, prompts, credentials, evidence payloads, or personal profile data.

## Compatibility request

Legacy input can be accepted at the mapper boundary:

```json
{
  "id": "companion-a",
  "role": "OWNER",
  "message": "Hello."
}
```

The mapper maps this legacy payload to a direct channel context with owner
relationship. Missing context uses safe defaults for the single-owner runtime.

## Example review assertions

- accepted stateful requests contain companion, actor/session, channel,
  and correlation context before organ invocation;
- no response envelope contains a personal fallback identity;
- relationship changes authorization only and cannot bypass policy;
- mapper diagnostics preserve ambiguity and migration reasons;
- two companion IDs remain isolated under identical actor/session inputs.

These examples complement the formal shapes in
[`T1-NEUTRAL-CONTEXT-SPEC.md`](./t1-neutral-context-spec.md) and the file-level
plan in [`T1-IMPLEMENTATION-PLAN.md`](./t1-neutral-context-spec.md).
