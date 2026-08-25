# T6 security and operations contract

Status: implementation target; current public runtime still has unverified security and operational gaps

This contract turns the security/operations handoff into enforceable public
deployment boundaries. It protects the extracted companion experience without
assuming a personal operator, account, token, or private deployment.

## Security context

Every stateful operation must resolve a context containing:

```text
companion_id
actor_id / session_id
authorization role and explicit capabilities
channel / audience
subject reference when applicable
correlation_id
```

Authentication answers whether an actor may perform an operation. It does not
create a relationship, subject, audience, or private memory scope. Anonymous
public chat may be allowed by configuration, but anonymous actors cannot
approve memory, behavior, responses, or outbound actions without an explicit
consent/capability policy.

## Capability matrix

| Operation | Public actor | Authenticated actor | Operator | Administrator |
| --- | --- | --- | --- | --- |
| Public chat | Configured policy | Configured policy | Configured policy | Configured policy |
| Direct/private chat | Explicit policy/capability | Explicit policy/capability | Explicit policy/capability | Explicit policy/capability |
| Propose memory/behavior | Pending-only policy | Pending-only policy | Pending-only policy | Pending-only policy |
| Approve memory/behavior | No | No by default | Explicit companion capability | Explicit companion capability |
| Approve response/output | No | No by default | Explicit companion capability | Explicit companion capability |
| Inspect private records | No | No by default | Explicit scoped capability | Explicit scoped capability |
| Send outbound action | No | No | Explicit action capability plus approval | Explicit action capability plus approval |

The table is a policy target. A role label alone is never sufficient for a
private audience or approval decision.

## Isolation boundary

Every database query, cache key, queue item, WebSocket subscription, approval
ID, response event, and audit record must bind to `companion_id`. Operations
must additionally validate the relevant actor, audience, and correlation
context before returning or mutating state.

Required failure behavior:

- missing or mismatched companion context is rejected;
- cross-companion IDs are treated as unknown, not retried against another
  companion;
- caches and queues cannot use a global singleton key for private state;
- disconnected clients do not cause state or approval mutation;
- an isolation failure is an auditable security event without private payload
  leakage.

## Mutation and approval safety

The only canonical mutation paths are explicit, scoped operations:

```text
source event -> pending proposal -> authorized approval -> canonical state
staged response -> authorized response approval -> output event
outbound suggestion -> authorized action approval -> provider send
```

Model, OCR, observation, knowledge, platform, and quoted conversation content
may be inputs to a proposal. None may supply approval capability or directly
write active memory, behavior, response, or outbound state.

Multi-record operations must commit atomically. On timeout, provider failure,
validation error, or process interruption, rollback must leave no partial
approval, supersession, audit, or output state.

## Network and secret boundary

- Allowed origins are explicit configuration; permissive production CORS is
  forbidden.
- Credentials, API keys, OAuth tokens, database URLs, and VTube Studio tokens
  are supplied by secret storage/environment configuration only.
- Secrets never appear in source, generated public configuration, logs, health
  responses, error messages, citations, or experience events.
- Provider URLs are validated for required scheme and deployment policy.
- OAuth state is one-time, provider-bound, correlation-bound, and expiring.
- Signed platform events reject stale, replayed, malformed, or tampered input.

## Ingress and egress bounds

Ingress must enforce configured bounds for message length, history count,
query size, lookup count, payload size, rate, replay window, and duplicate
keys. Bounded rejection responses must not echo raw private payloads.

Egress must recheck companion, response/action status, channel, audience,
sensitivity, expiry, and approval immediately before dispatch. Unknown,
rejected, expired, duplicate, or cross-companion output IDs cannot be sent.

## Observability contract

Safe audit metadata includes:

```text
event type and stage
companion_id
actor/capability class (not secret)
channel/audience identifiers
correlation_id
source/response/approval/action IDs
decision and reason code
timestamps and bounded latency/status
```

Logs and health endpoints must exclude raw prompts, private claims, OCR,
frames, provider payloads, credentials, tokens, and personal profile data.
Health must distinguish disabled, degraded, failed, and empty states without
exposing private memory.

## Operational runbooks required

| Runbook | Safe outcome |
| --- | --- |
| Startup/configuration | Invalid or secret-bearing config fails closed with a safe diagnostic |
| Migration/rollback | Schema and memory changes are reversible or explicitly recoverable |
| Provider outage | Capability is disabled/degraded; no unsafe retry or state mutation |
| Approval backlog | Pending records remain pending; no automatic activation or send |
| Data correction/revocation | Replacement/revocation preserves audit history and disclosure boundaries |
| Queue/WebSocket failure | Output stops safely; memory and approvals remain unchanged |
| Security incident | Public output is muted, credentials can be rotated, and metadata is preserved without raw private data |
| Shutdown/restart | Pending approvals and outbound actions recover with status intact |

## Required tests

| Group | Minimum proof |
| --- | --- |
| Context/capability | Role cannot create relationship, audience, or approval authority |
| CORS/network | Allowed origins work; disallowed origins and unsafe endpoints fail |
| Isolation | Cross-companion reads, approvals, queues, sockets, and actions fail |
| Persistence | Timeout/failure rolls back multi-record state and keeps audit integrity |
| Ingress | Bounds, deduplication, signatures, OAuth state, and replay checks hold |
| Secrets | Tokens and private payloads are absent from logs/artifacts/health |
| Output | Approval, disclosure, expiry, and companion checks occur at dispatch |
| Failure | Provider outage produces bounded status without active memory/output |
| Operations | Runbook scenarios are executable in a production-like environment |

The contract is complete only when tests use neutral fixtures from
[`BLANK-SLATE-FIXTURE-GUIDE.md`](./BLANK-SLATE-FIXTURE-GUIDE.md), results are
recorded in [`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md),
and the release checklist reflects the actual evidence.
