# T1 neutral API contract examples

Status: examples for implementation review; current API does not yet enforce this envelope

These examples make the T1 context contract concrete at the HTTP boundary.
They are illustrative request/response shapes, not evidence that the current
runtime already accepts them. All identifiers are synthetic and all audience
names are configured neutral values.

## Public chat

An anonymous/public request may omit `audienceId` only when the endpoint is
explicitly public and the mapper supplies the configured public audience.

```json
{
  "companionId": "companion-a",
  "context": {
    "actor": {
      "actorId": "anonymous-session-a",
      "sessionId": "session-a",
      "authorizationRole": "viewer",
      "capabilities": ["chat:public"],
      "authenticated": false
    },
    "conversation": {
      "channel": "public",
      "correlationId": "corr-public-a"
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
    "channel": "public",
    "audienceId": "audience-public",
    "subject": null
  },
  "diagnostics": ["audience_defaulted_by_public_policy"]
}
```

This request creates no durable actor subject and grants no approval capability.

## Direct actor-scoped chat

```json
{
  "companionId": "companion-a",
  "context": {
    "actor": {
      "actorId": "actor-a",
      "sessionId": "session-a",
      "authorizationRole": "viewer",
      "capabilities": ["chat:direct", "teach:propose"],
      "authenticated": true
    },
    "conversation": {
      "channel": "direct",
      "audienceId": "audience-direct-actor-a",
      "correlationId": "corr-direct-a"
    },
    "subject": {
      "subjectId": "actor:actor-a",
      "kind": "actor",
      "ownerActorId": "actor-a"
    }
  },
  "message": "Please remember my preferred label is label-a.",
  "history": []
}
```

Expected behavior: the source event and candidate may be created according to
teaching policy, but the candidate remains pending. The actor's role does not
approve it and the value is not public merely because the actor is
authenticated.

## Private request

```json
{
  "companionId": "companion-a",
  "context": {
    "actor": {
      "actorId": "actor-a",
      "sessionId": "session-a",
      "authorizationRole": "administrator",
      "capabilities": ["chat:private", "memory:approve"],
      "authenticated": true
    },
    "conversation": {
      "channel": "private",
      "audienceId": "audience-private-a",
      "correlationId": "corr-private-a"
    }
  },
  "message": "Show my approved private context.",
  "history": []
}
```

Expected behavior: the mapper accepts only if both channel policy and explicit
capabilities permit private access. Approval capability is checked for the
approval operation, not inferred from the channel or administrator role. The
request cannot be remapped to a public audience.

## Operator request

```json
{
  "companionId": "companion-a",
  "context": {
    "actor": {
      "actorId": "operator-a",
      "sessionId": "operator-session-a",
      "authorizationRole": "operator",
      "capabilities": ["memory:inspect", "response:approve"],
      "authenticated": true
    },
    "conversation": {
      "channel": "operator",
      "audienceId": "audience-operator",
      "correlationId": "corr-operator-a"
    }
  },
  "operation": "inspect_pending",
  "targetId": "proposal-a"
}
```

Expected behavior: the operation is scoped to `companion-a` and the explicit
operator audience. It does not create a user subject or make operator-only
metadata eligible for public output.

## Rejection envelopes

### Missing private context

```json
{
  "accepted": false,
  "error": {
    "code": "MISSING_CONTEXT",
    "fields": ["conversation.audienceId", "actor.capabilities"],
    "correlationId": "corr-private-missing"
  }
}
```

### Personal legacy audience in public mode

```json
{
  "accepted": false,
  "error": {
    "code": "LEGACY_PERSONAL_AUDIENCE",
    "field": "audienceId",
    "correlationId": "corr-legacy-a"
  }
}
```

### Ambiguous role-only request

```json
{
  "accepted": false,
  "error": {
    "code": "AMBIGUOUS_CONTEXT",
    "conflicts": ["role_does_not_select_audience", "role_does_not_select_subject"],
    "correlationId": "corr-ambiguous-a"
  }
}
```

Error responses may identify fields and reason codes, but must not echo private
messages, prompts, credentials, evidence payloads, or personal profile data.

## Compatibility request

Legacy input can be accepted only at the mapper boundary:

```json
{
  "id": "companion-a",
  "role": "VIEWER",
  "message": "Hello."
}
```

For an explicitly public endpoint, the mapper may produce a neutral public
context and a diagnostic such as `legacy_role_mapped_to_authorization`. It must
not produce a private audience, subject, relationship, or approval capability.
For a private/operator endpoint, missing context is an error rather than a
silent fallback.

## Example review assertions

- accepted stateful requests contain companion, actor/session, channel,
  audience, and correlation context before organ invocation;
- no response envelope contains a personal fallback identity;
- role changes authorization only and cannot change subject/audience by itself;
- public context cannot retrieve private evidence;
- mapper diagnostics preserve ambiguity and migration reasons;
- two companion IDs remain isolated under identical actor/session inputs.

These examples complement the formal shapes in
[`T1-NEUTRAL-CONTEXT-SPEC.md`](./T1-NEUTRAL-CONTEXT-SPEC.md) and the file-level
plan in [`T1-IMPLEMENTATION-PLAN.md`](./T1-IMPLEMENTATION-PLAN.md).
