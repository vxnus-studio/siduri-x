# Single-Owner Single-Machine Context Specification

Status: Active Canonical Context Architecture

This specification defines the context and security boundary for Siduri-X in a **single-owner, single-machine** architecture.

## Architectural Mental Model

The fundamental mental model is: **Security is enforced strictly at the external machine boundary, NOT internally between artificial roles on the same machine.**

- **Single Owner, Single Machine**: The companion operates locally for one user/owner.
- **No Internal RBAC Hierarchy**: There are no artificial internal roles (`VIEWER`, `OPERATOR`, `OWNER`) dividing access on the machine.
- **No Audiences**: Memory claims, teaching, and cognition are not segregated by audience IDs (`allowedAudiences` or public stream chat isolation).
- **External Security Perimeter**:
  1. **Network Authentication**: External network requests connecting to the HTTP API require token authentication (`AUTH_TOKEN` / `API_KEY` / Bearer token). Local loopback requests are inherently trusted.
  2. **Untrusted Sensory Input Gating**: External sensory inputs (OCR text, untrusted audio, web documents, external webhooks) are marked `trust: "untrusted"` and gated against prompt injection or behavioral hijacking.
  3. **High-Risk Action Policy**: Execution of dangerous external actions (system commands, bash execution, file modifications) is gated by risk level (`CRITICAL`, `HIGH`), HMAC signatures, or user approval.

## Context Model

```ts
interface ActorContext {
  actorId: string;              // opaque identifier for user / session
  sessionId: string;            // request/session scope
  authenticated?: boolean;      // whether request is authenticated at the boundary
  capabilities?: string[];      // capability grants
  [key: string]: unknown;
}

interface ConversationContext {
  correlationId: string;        // unique request correlation ID for tracing
  sessionId?: string;
  channel?: string;             // optional transport channel descriptor (e.g. 'direct', 'web')
  audienceId?: string;          // optional legacy compatibility field
  [key: string]: unknown;
}

interface SubjectRef {
  subjectId: string;            // target of memory claim (e.g. actor:<id> or companion:<id>)
  kind: "actor" | "companion" | "configured";
  ownerActorId?: string;
}

interface RequestContext {
  companionId: string;          // companion isolation boundary
  actor: ActorContext;
  conversation: ConversationContext;
  source?: "local" | "external" | string; // network origin
  subject?: SubjectRef;
  metadata?: Record<string, unknown>;
}
```

## Invariants

1. **Companion Isolation**: `companionId` is mandatory across all stateful operations, memory queries, and perception events. Multiple companions on the same machine remain strictly isolated.
2. **Correlation Tracking**: `correlationId` is mandatory on chat, evidence, approval, output, and audit paths.
3. **External Authentication**: If `AUTH_TOKEN` is configured, external network requests must provide a valid Bearer token.
4. **Subject Integrity**: User teaching targets an actor-scoped subject (`actor:<id>`) or companion identity (`companion:<id>`). Global `primary_user` is quarantined/rejected.
5. **No Internal Role Gating**: Authenticated requests on the machine have full access to memory inspection, claim approval, and directives without internal viewer/operator restrictions.

## Request Mapping & API Boundary

Incoming HTTP requests are mapped into the canonical `RequestContext`:

- If an explicit `context` envelope is provided, it is validated and preserved.
- If a legacy or flat payload is sent (`id`, `message`, `correlationId`), the mapper defaults to the local owner context (`actorId: "local-user"`, `authenticated: true`, `source: "local"`).
- Legacy fields like `role: "OWNER"` or `role: "VIEWER"` are mapped harmlessly without failing the request.
