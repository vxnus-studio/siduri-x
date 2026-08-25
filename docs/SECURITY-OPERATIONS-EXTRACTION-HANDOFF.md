# Security and operations extraction handoff

Status: pending after experience contracts

The normative security and operations target is defined in
[`T6-SECURITY-OPERATIONS-CONTRACT.md`](./T6-SECURITY-OPERATIONS-CONTRACT.md).

## Objective

Extract the original Siduri security, reliability, and operational boundaries
into public Siduri-Y deployment contracts. These controls protect the neutral
companion experience; they must not introduce a personal operator or private
deployment assumption.

## Original sources

- `siduri/tests/test_chat_cors.py` (origin/CORS behavior);
- `siduri/tests/test_platforms.py` (rate limits, deduplication, signatures,
  OAuth state, encrypted token storage, outbound approval and audit);
- `siduri/tests/test_supabase_memory.py`;
- `siduri/docs/memory/SUPABASE_RUNTIME_RELIABILITY.md`;
- `siduri/docs/memory/MEMORY_WRITE_POLICY.md`;
- `siduri/docs/memory/PUBLIC_DISCLOSURE_POLICY.md`.

Personal account names, tokens, broadcaster IDs, and database URLs in original
fixtures are test values only. They must never become shared defaults.

## Security invariants

### S1 — identity and authorization

- authentication establishes actor capabilities, not companion relationships;
- operator actions require explicit capability and companion scope;
- anonymous public actors cannot approve memory, behavior, response, or
  outbound actions;
- private channel access is explicit and policy-checked;
- `/me` does not invent a user identity.

### S2 — tenant and subject isolation

- every stateful query includes `companion_id`;
- actor, subject, channel, and audience context cannot cross companions;
- approval/action IDs are scoped to companion and correlation context;
- caches, WebSockets, queues, and logs do not share private state globally.

### S3 — memory write safety

- conversation, model, OCR, vision, platform, and knowledge inputs create only
  pending proposals;
- canonical memory requires explicit authorized approval;
- source, authority, sensitivity, audience, revisions, and audit events survive
  approval and correction;
- failed or partial writes roll back without activating state.

### S4 — network and secret safety

- origins are explicitly configured; permissive CORS is not a production
  default;
- credentials, API keys, OAuth tokens, and database URLs remain in secret
  storage/environment configuration and never enter public config or logs;
- TLS/HTTPS and provider endpoint validation are enforced where required;
- OAuth state is one-time, provider-bound, and expires;
- signed platform events reject stale or tampered payloads.

### S5 — bounded ingress and output

- platform input is normalized, deduplicated, and rate-limited;
- message, history, evidence, provider, and query bounds are explicit;
- outbound actions are pending until approval and are auditable;
- rejected, expired, duplicate, unknown, or cross-companion actions cannot be
  sent;
- provider failures degrade without unsafe retries or state mutation.

### S6 — observability without leakage

- correlation IDs connect source event, response, approval, output, and audit;
- logs contain decision metadata, not private evidence or secrets;
- operator inspection is scoped and itself auditable;
- health endpoints expose capability/status, not memory or private profile data;
- failure states are distinguishable from empty state.

## Work packages

### S1 — policy enforcement boundary

Centralize authorization, actor/channel/audience mapping, companion scope, and
approval capability checks. Organs must not each implement their own role
interpretation.

### S2 — persistence reliability

Apply transaction-local timeouts, bounded retries, rollback behavior, migration
checks, connection failure handling, and audit persistence to all memory and
approval operations.

### S3 — platform security

Implement origin validation, OAuth state/credential handling, signature checks,
ingress bounds, deduplication, and outbound action approval using neutral
platform/provider identifiers.

### S4 — secret/configuration audit

Scan source, generated config, package artifacts, logs, and documentation for
credentials, private paths, personal defaults, and unsafe fallback URLs.

### S5 — operational runbooks

Document startup, migration, provider outage, queue failure, approval backlog,
data correction, revocation, incident response, and safe shutdown procedures.

## Required test port

| Test group | Required evidence |
| --- | --- |
| Auth/context | Actor capability cannot create relationship or bypass disclosure |
| Origin/CORS | Allowed origin works; disallowed origin is rejected |
| Isolation | Cross-companion reads, approvals, WebSocket events, and actions fail |
| Persistence | Timeout/failure rolls back multi-record changes and preserves audit |
| Ingress | Rate, deduplication, signature, OAuth-state, and malformed-input bounds |
| Secrets | Tokens are encrypted/secret-managed and absent from logs/artifacts |
| Outbound | Action requires approval, survives restart, and audits proposed/approved/sent |
| Failure | Provider outage produces bounded status without active memory/output |
| Release | Clean checkout passes branch, forbidden-default, build, typecheck, and test gates |

## Do-not-copy list

- personal operator names or roles as public defaults;
- private tokens, account IDs, database URLs, or local filesystem paths;
- permissive CORS and unauthenticated mutation endpoints;
- global singleton state or unscoped caches;
- silent retry of unapproved outbound actions;
- private evidence in logs, health responses, or public error messages.

## Exit criteria

Security and operations extraction is complete only when:

1. S1–S6 have explicit contracts and production-like tests;
2. cross-companion and cross-audience isolation is proven for all stateful
   boundaries;
3. credentials and private evidence are absent from release artifacts/logs;
4. failures, timeouts, and rollbacks are bounded and auditable;
5. outbound output requires explicit approval;
6. runbooks support safe operation and correction;
7. the public-release checklist and health audit record green evidence.

Until then, security/operations is pending and the repository remains RED.
