# Siduri-Y — Hands / Ear / Runtime Hardening Summary

## Overall assessment

The 10-organ architecture is structurally real and the Brain → ActionIntent → Hands execution path is now wired into `SiduriRuntime`.

The core interfaces are reasonably decoupled, and organ implementations are injected through `RuntimeOrgans`.

However, the action boundary is currently under-hardened compared with the memory/response governance already present in the system.

The biggest priority is to establish a dedicated action authorization/policy boundary before expanding Hands into more powerful external tools.

---

## P0 — Action authorization boundary

### Problem

`SiduriRuntime` passes `plan.actionIntents` directly to:

    hands.executeAction(action)

The `ActionIntent` does not carry the request's authorization context, actor, capabilities, audience, or approval state.

Response gating happens before action execution, but response admissibility is not equivalent to action authorization.

### Risk

A model-generated response that is allowed to be spoken can potentially trigger an action without an independent capability/authorization decision.

### Hardening

Introduce an `ActionPolicyEngine` between Brain and Hands:

    Brain
      ↓
    ActionIntent
      ↓
    ActionPolicyEngine
      ↓
    authorized action
      ↓
    Hands
      ↓
    Tool

The policy engine should evaluate:

- actor identity
- authorization role
- capabilities
- companion ID
- session ID
- channel
- audience
- tool identity
- requested parameters
- risk level
- approval requirements
- rate limits
- expiration
- provenance

Hands should execute only already-authorized actions.

---

## P0 — Propagate RequestContext into actions

### Problem

`RequestContext` already contains useful security information, but it is not propagated into `ActionIntent` / `HandsOrgan`.

### Hardening

Every action should retain provenance such as:

    companionId
    actorId
    sessionId
    correlationId
    channel
    audienceId
    authorizationRole
    capabilities

This should allow every action execution to answer:

> Who caused this action, in which session, under which authority, and from which request?

---

## P0 — Validate tool parameters

### Problem

`ToolDefinition` exposes an `inputSchema`, but `HandsOrgan.executeAction()` currently executes the handler with the raw parameter object.

The schema is therefore descriptive rather than an enforced boundary.

### Hardening

Before execution:

    ActionIntent.parameters
          ↓
    tool.inputSchema validation
          ↓
    normalized parameters
          ↓
    handler.execute()

Reject malformed or unexpected parameters.

Prefer strict schemas with:

- required fields
- type checking
- enum constraints
- additional-property restrictions
- size limits
- nested validation

---

## P0 — Add an action lifecycle

Actions currently behave approximately as:

    ActionIntent → execute → result

Introduce an explicit lifecycle:

    PROPOSED
       ↓
    POLICY_CHECKED
       ↓
    APPROVED / AUTO_APPROVED
       ↓
    EXECUTING
       ↓
    COMPLETED / FAILED / CANCELLED / EXPIRED / REJECTED

This should be represented in the action result and persisted/audited where appropriate.

---

## P1 — Separate action gating from response gating

### Problem

`ResponseGatingEngine` protects response emission, but action execution occurs after the response gate and does not appear to have an equivalent dedicated gate.

### Hardening

Keep response gating and action gating as separate policy boundaries:

    ResponseGatingEngine
        └── controls what Siduri can emit

    ActionPolicyEngine
        └── controls what Siduri can do

Do not assume:

    "response is admissible"
    
means:

    "all associated actions are authorized"

---

## P1 — Risk classification

Introduce action risk levels, for example:

    LOW
    MEDIUM
    HIGH
    CRITICAL

Example policy:

    LOW
      → automatic execution

    MEDIUM
      → capability + policy check

    HIGH
      → explicit approval

    CRITICAL
      → deny by default

The exact policy should be configurable per deployment.

---

## P1 — Tool namespace isolation

### Problem

Hands currently uses a flat:

    Map<string, ToolHandler>

This can create collisions when multiple providers expose the same tool name.

### Hardening

Use provider-qualified identities:

    provider/tool

or:

    providerId + toolName

Do not allow accidental overwriting of an existing tool registration.

---

## P1 — Provider trust boundary

MCP-shaped configuration exists, but Hands should treat external tool providers as untrusted boundaries.

Each provider should have:

- provider identity
- explicit allowed tools
- capability restrictions
- timeout
- concurrency limits
- input/output size limits
- network restrictions where applicable
- audit metadata
- failure isolation

Do not implicitly trust every tool exposed by a provider.

---

## P1 — Audit every external side effect

Every execution should generate an immutable audit event containing at minimum:

    actionId
    toolName
    providerId
    companionId
    actorId
    sessionId
    correlationId
    authorization decision
    policy version
    parameters hash
    execution start/end
    result status
    error code

Avoid storing sensitive raw parameters unless explicitly required.

---

## P1 — Idempotency / replay protection

Actions should have an execution identity.

Recommended:

    actionId
    executionId

Prevent accidental duplicate execution when:

- requests retry
- network calls retry
- workers restart
- the same response is processed twice

Especially important for irreversible external operations.

---

## P1 — Timeouts and cancellation

Every Hands action should have bounded execution.

Support:

- per-tool timeout
- global timeout
- cancellation
- maximum payload size
- maximum output size

A hung external tool must not block the runtime indefinitely.

---

## P1 — Ear should become the perception boundary

`EarOrgan` currently provides a useful normalization layer for text/audio/object input.

However, normal text chat still enters `SiduriRuntime` directly as a `Message`, bypassing Ear.

Long-term architecture should converge on:

    external input
          ↓
        Ear
          ↓
      Perception
          ↓
        Brain

Ear should eventually provide metadata such as:

- source
- speaker/actor
- timestamp
- language
- transcription confidence
- correlation ID
- provenance
- input modality

---

## P2 — Harden Ear against untrusted input

Audio/transcription input should have:

- maximum duration
- maximum byte size
- MIME/type validation
- decoding limits
- transcription timeout
- malformed input handling
- provenance
- correlation IDs
- replay protection where applicable

Treat transcribed text as data/context, never as trusted instructions.

---

## P2 — Treat retrieved context as untrusted

The current runtime already makes the important distinction that memory/knowledge/observations are context rather than instructions.

Maintain that boundary for:

- Ear transcription
- Vision observations
- Knowledge results
- Memory results
- tool output

Tool output in particular must never automatically become executable instructions.

---

## P2 — Tool output isolation

Hands results should be treated as untrusted external data.

Do not allow:

    tool output
       ↓
    direct action
       
without returning through Brain/policy evaluation.

Prefer:

    action
      ↓
    tool
      ↓
    result
      ↓
    trusted normalization
      ↓
    Brain / policy
      ↓
    next action

This prevents tool output from becoming an uncontrolled action chain.

---

## P2 — Capability-based tool registration

Instead of merely registering:

    toolName

register:

    tool
    capabilities
    risk
    allowedActors
    allowedChannels
    approvalPolicy

Example:

    send_message
      capabilities:
        - messaging:send
      risk:
        MEDIUM
      approval:
        required_for_public

---

## Recommended target architecture

    ┌──────────────┐
    │ External     │
    │ Input        │
    └──────┬───────┘
           ↓
    ┌──────────────┐
    │ Ear / Vision │
    │ Perception   │
    └──────┬───────┘
           ↓
    ┌──────────────┐
    │    Brain     │
    └──────┬───────┘
           │
       ActionIntent
           ↓
    ┌─────────────────────┐
    │ Action Policy       │
    │                     │
    │ Auth                │
    │ Capabilities        │
    │ Schema validation   │
    │ Risk                │
    │ Approval            │
    │ Rate limits         │
    │ Expiration          │
    └──────────┬──────────┘
               │
          authorized
               ↓
    ┌─────────────────────┐
    │       Hands         │
    │                     │
    │ Tool registry       │
    │ Provider isolation  │
    │ Timeout             │
    │ Cancellation        │
    └──────────┬──────────┘
               ↓
        External system
               │
               ↓
    ┌─────────────────────┐
    │ Action Audit/Event  │
    └─────────────────────┘


## Priority order

### P0 — Do before expanding Hands capabilities

1. Add ActionPolicyEngine.
2. Propagate RequestContext/provenance into actions.
3. Enforce `ToolDefinition.inputSchema`.
4. Add explicit action authorization.
5. Add action lifecycle/status.
6. Separate action gating from response gating.

### P1 — Do before production-grade external actions

7. Risk classification.
8. Provider/tool namespace isolation.
9. Provider trust boundaries.
10. Audit events.
11. Idempotency/replay protection.
12. Timeouts/cancellation.
13. Capability-based tool registration.

### P2 — Architectural maturity

14. Make Ear the universal perception boundary.
15. Harden audio/transcription inputs.
16. Treat tool output as untrusted data.
17. Prevent uncontrolled tool → tool action chains.
18. Add comprehensive action-policy tests.

---

## Bottom line

The current organ architecture is a solid foundation, and the Brain → ActionIntent → Hands path is genuinely implemented.

The main missing piece is not another organ.

It is a **strong security/policy boundary around agency**.

Before giving Hands powerful real-world capabilities, make this invariant true:

> Brain may propose an action, but Brain never gets to authorize its own action.

The Brain proposes.
The policy layer authorizes.
Hands executes.
The audit layer records.

That separation should be treated as a core architectural invariant.
