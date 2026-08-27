# Companion Runtime

Status: compatibility slice; neutral extraction pending

Located in `apps/api/src/runtime.ts`. It is the current compatibility hub,
receiving user messages and querying organs:

1. Retrieves `Memory` and `Knowledge` context.
2. Resolves `Behavior` injections.
3. Requests `ResponsePlan` from `Brain`.
4. Records pending memory/behavior proposals with provenance.
5. Executes `Voice` queueing only after the response policy permits output.

Known contract gap: the current runtime still conflates authorization role,
conversation audience, and learned subject identity. It also carries legacy
private/personal defaults. The target flow is defined in
[`NEUTRAL_CONTRACT_DECISIONS.md`](./NEUTRAL_CONTRACT_DECISIONS.md); this file
must not be read as proof of parity.

Approved output dispatch is targeted by
[`T5-EXPERIENCE-EVENT-CONTRACT.md`](./T5-EXPERIENCE-EVENT-CONTRACT.md); current
adapter calls do not yet prove the unified event boundary.
