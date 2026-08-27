# T1 neutral context specification

Status: implementation target; not yet represented by the current runtime

This specification turns the neutral contract decisions into concrete boundary
shapes for T1 P1/P2. It is a target for `@siduri-y/core` and the API
compatibility mapper. It does not authorize changing later memory, prompt, or
UI behavior before the boundary is implemented.

Concrete HTTP examples are in
[`T1-API-CONTRACT-EXAMPLES.md`](./T1-API-CONTRACT-EXAMPLES.md).

## Context model

```ts
type AuthorizationRole = "viewer" | "operator" | "administrator";
type Channel = "public" | "direct" | "private" | "operator";

interface ActorContext {
  actorId: string;              // opaque, bounded, non-personal identifier
  sessionId: string;            // request/session scope
  authorizationRole: AuthorizationRole;
  capabilities: string[];       // explicit operations, not relationships
  authenticated: boolean;
}

interface ConversationContext {
  channel: Channel;
  audienceId: string;           // configured audience, never a personal title
  isLive?: boolean;
  correlationId: string;
}

interface SubjectRef {
  subjectId: string;            // e.g. actor:<opaque actor id>
  kind: "actor" | "companion" | "configured";
  ownerActorId?: string;
}

interface RequestContext {
  companionId: string;
  actor: ActorContext;
  conversation: ConversationContext;
  subject?: SubjectRef;
}
```

## Invariants

1. `authorizationRole` answers what an actor may do. It does not identify the
   actor to the companion or establish a relationship.
2. `channel` and `audienceId` answer where a response may be visible. They do
   not identify the user or grant approval capability.
3. `subject` identifies the target of a claim or directive. If absent, no user
   profile claim may be created.
4. `companionId` is mandatory on every stateful operation and event.
5. `correlationId` is mandatory on chat, evidence, approval, output, and audit
   paths.
6. Anonymous public actors may chat, subject to configured policy, but cannot
   create durable identity or approve state without explicit capability.
7. Missing audience uses the configured public audience only when the channel
   is public. Missing private/operator context is an error.

## Channel policy

| Channel | Default audience | Required capability | Memory/output rule |
| --- | --- | --- | --- |
| `public` | configured public audience | public chat capability | public-safe memory/evidence and approved output only |
| `direct` | actor-scoped audience | direct-chat capability | actor-permitted context; no public broadcast |
| `private` | configured private audience | private-chat capability | private claims/evidence allowed by policy; no public output by default |
| `operator` | configured operator audience | operator capability | inspection/approval context; never implies personal relationship |

Audience IDs are deployment configuration. The core contract must not embed
`MASTER_PRIVATE`, a personal title, or a named creator.

## Subject policy

For explicit user teaching, the mapper creates an actor-scoped subject only
when the request supplies a valid actor/session context:

```text
subjectId: actor:<opaque actorId>
kind: actor
ownerActorId: <opaque actorId>
```

The mapper must reject or quarantine:

- a global `primary_user` subject;
- a subject derived from `OWNER`, `VIEWER`, or `OPERATOR`;
- a subject derived from a display name or route;
- a relationship inferred from authentication;
- a durable subject for an unauthenticated actor without consent policy.

## Chat request envelope

The target request shape is conceptually:

```json
{
  "companionId": "companion-a",
  "context": {
    "actor": {
      "actorId": "actor-session-a",
      "sessionId": "session-a",
      "authorizationRole": "viewer",
      "capabilities": ["chat:public"],
      "authenticated": false
    },
    "conversation": {
      "channel": "public",
      "audienceId": "public",
      "correlationId": "corr-a"
    }
  },
  "message": "Hello.",
  "history": []
}
```

This example creates no user subject and no memory candidate.

## Legacy compatibility mapping

The mapper accepts current request shapes only at the API boundary:

| Legacy input | Mapping | Reject/quarantine condition |
| --- | --- | --- |
| `role: "VIEWER"` | authorization role `viewer`; require/derive configured public context | cannot silently become private audience |
| `role: "OWNER"` | authorization role `administrator` or configured equivalent | cannot become subject, relationship, or audience |
| `role: "OPERATOR"` | authorization role `operator` | cannot become personal/private relationship |
| missing `channel` | public only when endpoint is explicitly public | private/operator endpoint without channel |
| missing `audienceId` | configured public audience for public channel | private/operator request |
| `MASTER_PRIVATE` | legacy migration marker only | reject in public mode; never canonical default |
| `primary_user` | actor-scoped subject mapping only when actor context exists | reject global subject |
| missing `actorId` | anonymous session actor if policy permits | no durable profile or approval capability |
| `companionId: "default"` | development bootstrap lookup only | public client assumes ID without discovery |

The mapper must preserve an ambiguity/error reason in diagnostics and must not
silently select a personal/private interpretation.

## T1 acceptance tests

- public request with no audience resolves to configured public audience;
- private request without explicit private capability is rejected;
- `OWNER` cannot create a relationship or retrieve private memory by role alone;
- `primary_user` cannot enter a canonical claim through compatibility mapping;
- anonymous public chat has no subject and cannot approve a claim;
- two companion IDs remain isolated through the same context mapper;
- every accepted request has companion, actor/session, channel, audience, and
  correlation context before reaching an organ;
- ambiguity is visible in a structured error/diagnostic, not hidden.

## Non-goals for T1

Do not implement in this slice:

- deterministic teaching extraction;
- memory retrieval changes;
- prompt wording changes;
- web copy changes;
- response/voice/platform output changes;
- personal relationship migration.

Those belong to the dependent handoffs after the context boundary is proven.
