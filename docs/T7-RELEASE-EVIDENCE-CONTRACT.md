# T7 release evidence contract

Status: go/no-go target; current release is NO-GO / RED

This contract defines the evidence required before Siduri-Y may claim public
blank-slate behavioral parity. It is stricter than a successful build and does
not allow documentation completion or isolated organ tests to substitute for a
runtime experience proof.

## Release decision

```text
NO-GO unless every required gate is proven on one candidate commit
```

The candidate commit must be identified by commit hash, branch, environment,
dependency lock state, and test output. A gate is `PASS` only when its evidence
crosses the boundary named by that gate.

## Gate order

| Gate | Must prove | Current status |
| --- | --- | --- |
| R0 repository | Approved branch, clean checkout, no unclassified personal/secrets/artifacts | RED; scan and release evidence pending |
| R1 neutral context | Actor, channel, audience, subject, capability, session, and correlation context are canonical | RED; T1 implementation pending |
| R2 blank slate | Fresh companion and `/me` contain no invented personal identity or relationship | RED; current `/me` has a personal fallback |
| R3 memory | Proposal, approval, revision, expiry, revocation, retrieval, disclosure, and provenance lifecycle | RED; compatibility slice only |
| R4 behavior/prompt | Active Self is approved/scoped; user context is separate; untrusted data cannot rewrite policy | RED; legacy role context remains |
| R5 evidence | Observations/knowledge preserve citation, uncertainty, revision, expiry, and independent response approval | RED; end-to-end proof missing |
| R6 experience | Only approved, audience-safe events reach voice, avatar, overlay, or outbound adapters | RED; unified output path missing |
| R7 security/operations | Isolation, capability, secret, ingress, failure, rollback, and runbook evidence | RED; production-like proof missing |
| R8 vertical slice | Neutral public chat, teaching, approval, disclosure, correction, and safe output work together | RED; B0–B9 not ported |

Gates are ordered dependencies. A later green component test cannot close an
earlier red boundary.

## Required evidence bundle

For each gate, attach:

```text
candidate commit
environment/runtime versions
configuration class (never secret values)
command or manual procedure
test/scenario IDs
expected invariant
observed result
logs/events with sensitive fields redacted
known deviations
reviewer and date
```

Evidence must be reproducible from a clean checkout. Screenshots or logs are
supporting evidence only; the underlying runtime/API result and test procedure
must also be recorded.

## Minimum vertical scenarios

The candidate release must execute these neutral scenarios through the actual
boundary, not only direct organ calls:

1. **Fresh public start (B0/B6):** empty companion greets an anonymous/public
   actor without inventing identity, relationship, title, or prior memory.
2. **Ordinary message (B1):** a normal question creates no memory/behavior
   candidate and respects bounded history/trust rules.
3. **Teaching and approval (B2/B3):** explicit teaching creates a pending,
   actor-scoped candidate; only explicit approval changes retrieval/behavior.
4. **Rejection and correction (B4/B7):** rejected/expired data is inactive;
   correction preserves history and returns only the current permitted value.
5. **Disclosure (B5):** public output excludes private claims/evidence even
   when the actor has an elevated authorization role.
6. **Injection/failure (B8):** untrusted context and provider failure cannot
   change policy, identity, approval, memory, or output state.
7. **Observation grounding (B9):** redacted bounded observation becomes cited
   evidence; output waits for independent response approval.

Each scenario needs positive and negative assertions, a correlation ID, and a
record in the verification manifest.

## Forbidden release claims

Do not claim “public ready,” “blank slate,” “behavioral parity,” or “memory
parity” when any of the following is true:

- a runtime route still forces a personal/private audience;
- a role is used as subject, relationship, or audience;
- a personal identity or private audience is a default;
- a pending proposal enters active prompt/output context;
- private evidence can reach public output or citations;
- an adapter can send without response/action approval;
- B0–B9 evidence exists only at isolated organ level;
- the forbidden-default scan has unclassified production hits;
- build/typecheck/test passes but the relevant API/runtime boundary is untested.

## Sign-off record

Use one record for every candidate release:

```text
Candidate commit:
Branch:
Environment:
Dependency lock:
R0 repository: PASS | FAIL
R1 neutral context: PASS | FAIL
R2 blank slate: PASS | FAIL
R3 memory: PASS | FAIL
R4 behavior/prompt: PASS | FAIL
R5 evidence: PASS | FAIL
R6 experience: PASS | FAIL
R7 security/operations: PASS | FAIL
R8 vertical slice: PASS | FAIL
Evidence manifest:
Known deviations:
Reviewer:
Date:
Decision: GO | NO-GO
```

The decision is `NO-GO` if any required gate is `FAIL`, `Missing`,
`Partial`, or supported only by indirect evidence. The authoritative current
checklist remains [`PUBLIC_RELEASE_READINESS.md`](./PUBLIC_RELEASE_READINESS.md);
gate evidence belongs in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).
The forbidden-default scan procedure and current classifications are in
[`FORBIDDEN-DEFAULT-SCAN-BASELINE.md`](./FORBIDDEN-DEFAULT-SCAN-BASELINE.md).
