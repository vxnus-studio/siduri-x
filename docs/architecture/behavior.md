# Behavior

Status: compatibility slice; extraction parity incomplete

The Behavior organ compiles dynamic directives into system prompt injections.
Its organ boundary is decoupled from the original personal `ME_PROFILE`, but
its current context still uses legacy role/scope semantics. It must be adapted
to the neutral actor, channel, audience, subject, and lifecycle contracts
before it is considered behaviorally equivalent.

Required gates:

- only approved, active, permitted directives are compiled;
- audience and validity checks happen before prompt injection;
- learned user context remains separate from companion self/behavior;
- unsafe instructions and prompt injection are rejected;
- empty memory produces neutral behavior.

See [`NEUTRAL_CONTRACT_DECISIONS.md`](./NEUTRAL_CONTRACT_DECISIONS.md) and
[`PHASE-1-EXTRACTION-HANDOFF.md`](./PHASE-1-EXTRACTION-HANDOFF.md).

The detailed compilation target is
[`T3-ACTIVE-SELF-CONTRACT.md`](./T3-ACTIVE-SELF-CONTRACT.md); the current
compiler remains a compatibility slice until it consumes that context.
