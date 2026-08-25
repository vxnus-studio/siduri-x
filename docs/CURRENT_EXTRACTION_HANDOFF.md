# Current Siduri-Y extraction handoff

Status: **RED — documentation baseline complete enough to begin T1**

Date: 2026-08-25

## Read this first

This is the current handoff for the public Siduri-Y extraction work. It
supersedes historical implementation/session handoffs as the next-session
starting point. The [documentation index](./README.md) defines authority order.

## Goal

Extract the original Siduri behavior and memory guarantees into Siduri-Y's
decoupled organs while keeping Siduri-Y public, configurable, and blank slate.
The original project's personal identity and relationship are not part of the
Siduri-Y default.

## What is now documented

- [Blank-slate contract](./BLANK_SLATE_CONTRACT.md)
- [Neutral contract decisions](./NEUTRAL_CONTRACT_DECISIONS.md)
- [Original source catalog](./EXTRACTION_SOURCE_CATALOG.md)
- [Legacy identifier migration](./LEGACY_IDENTIFIER_MIGRATION.md)
- [Phase 0 baseline and golden trace](./PHASE-0-EXTRACTION-BASELINE.md)
- [Phase 1 contract handoff](./PHASE-1-EXTRACTION-HANDOFF.md)
- [Memory extraction handoff](./PHASE-2-MEMORY-EXTRACTION-HANDOFF.md)
- [Behavior extraction handoff](./BEHAVIOR-EXTRACTION-HANDOFF.md)
- [Evidence extraction handoff](./EVIDENCE-EXTRACTION-HANDOFF.md)
- [Experience extraction handoff](./EXPERIENCE-EXTRACTION-HANDOFF.md)
- [Security/operations handoff](./SECURITY-OPERATIONS-EXTRACTION-HANDOFF.md)
- [Verification evidence manifest](./VERIFICATION_EVIDENCE_MANIFEST.md)
- [Public release readiness](./PUBLIC_RELEASE_READINESS.md)

## Evidence-based health result

The repository is RED because production code still:

1. forces `/chat` through a private/owner route;
2. defaults teaching and retrieval to `primary_user` and `MASTER_PRIVATE`;
3. returns `Primary User` from `/me`;
4. offers creator relationship teaching in public UI;
5. hardcodes `default` companion IDs in web/operator clients;
6. lacks neutral actor/channel/audience/subject contracts at the runtime
   boundary;
7. lacks B0–B9 runtime/API evidence.

See [REPOSITORY_HEALTH_AUDIT.md](./REPOSITORY_HEALTH_AUDIT.md) for exact
source locations and [VERIFICATION_EVIDENCE_MANIFEST.md](./VERIFICATION_EVIDENCE_MANIFEST.md)
for what current tests do and do not prove.

## Next authorized implementation slice

Implement only T1 P1/P2 from
[EXTRACTION_TRACK_MAP.md](./EXTRACTION_TRACK_MAP.md):

1. add neutral actor, authorization, channel, audience, subject, and session
   context contracts;
2. add one compatibility mapper at the API boundary;
3. require explicit channel/audience context for chat;
4. reject or quarantine personal legacy audiences in public mode;
5. add contract tests for ambiguous and missing context.

Do not change teaching extraction, retrieval, prompt assembly, UI copy, or
output wiring until this boundary exists. That sequencing is required to keep
the extracted semantics reviewable.

## Required evidence after T1

- core types no longer use authentication roles as audience/subject semantics;
- legacy request shapes map once and record ambiguity;
- public missing-audience requests resolve only to configured public context;
- private/operator contexts require explicit capability;
- no compatibility mapper creates a relationship or personal identity;
- B0 and B6 test fixtures can be expressed through the new context;
- health audit moves only if the corresponding H1 finding is actually fixed.

## Working rules

- Use the [source catalog](./EXTRACTION_SOURCE_CATALOG.md) before reading a
  personal original value as behavior.
- Use [EXTRACTION_CHANGE_RECORD_TEMPLATE.md](./EXTRACTION_CHANGE_RECORD_TEMPLATE.md)
  for every implementation change.
- Use neutral/generated fixtures.
- Preserve provenance, audience, approval, revision, and failure metadata.
- Do not declare parity from build/typecheck/unit-test success alone.

## Handoff status

No runtime code was changed by the documentation phase represented here. The
next session should begin with T1 P1/P2 implementation and add its evidence to
the manifest, health audit, roadmap, and release checklist.

The concrete target shapes for that slice are in
[`T1-NEUTRAL-CONTEXT-SPEC.md`](./T1-NEUTRAL-CONTEXT-SPEC.md).
The bounded execution checklist and test matrix are in
[`T1-IMPLEMENTATION-CHECKLIST.md`](./T1-IMPLEMENTATION-CHECKLIST.md).
