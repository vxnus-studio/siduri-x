# Phase 1 — neutral contract extraction handoff

Status: ready for implementation after review

## Purpose

Implement the contracts described in
[`NEUTRAL_CONTRACT_DECISIONS.md`](./NEUTRAL_CONTRACT_DECISIONS.md) before
porting more original Siduri behavior into Siduri-Y. This phase is an adapter
and contract phase, not a persona migration.

The first implementation slice is bounded by
[`T1-IMPLEMENTATION-CHECKLIST.md`](./T1-IMPLEMENTATION-CHECKLIST.md), with
concrete request shapes in
[`T1-NEUTRAL-CONTEXT-SPEC.md`](./T1-NEUTRAL-CONTEXT-SPEC.md).

## Inputs

- [SIDURI_BEHAVIOR_EXTRACTION.md](./SIDURI_BEHAVIOR_EXTRACTION.md)
- [BLANK_SLATE_CONTRACT.md](./BLANK_SLATE_CONTRACT.md)
- [SIDURI_EXTRACTION_MATRIX.md](./SIDURI_EXTRACTION_MATRIX.md)
- [PHASE-0-EXTRACTION-BASELINE.md](./PHASE-0-EXTRACTION-BASELINE.md)
- [NEUTRAL_CONTRACT_DECISIONS.md](./NEUTRAL_CONTRACT_DECISIONS.md)
- [LEGACY_IDENTIFIER_MIGRATION.md](./LEGACY_IDENTIFIER_MIGRATION.md)
- [OPEN_EXTRACTION_DECISIONS.md](./OPEN_EXTRACTION_DECISIONS.md)
- [VERIFICATION_EVIDENCE_MANIFEST.md](./VERIFICATION_EVIDENCE_MANIFEST.md)
- original Siduri source and tests under `/home/zagin/Projects/vxnuslabs/siduri/`

## Work packages

### P1 — Core context contracts

Add neutral types for:

- actor identity and authorization role;
- conversation channel and configured audience;
- explicit subject references;
- sensitivity and disclosure context;
- source events and evidence;
- complete candidate and activation lifecycle;
- separate response-approval state.

The existing role and scope types may be retained as deprecated compatibility
inputs, but new contracts must not expose them as relationship or audience
semantics.

### P2 — Lossless compatibility mapping

Create a single mapping boundary for current Siduri-Y requests. It must:

- require or derive a configured public audience when a request omits one;
- reject personal legacy audiences unless an explicit migration configuration
  is supplied;
- map legacy roles only to authorization context;
- surface ambiguous mappings instead of silently inventing a relationship;
- preserve source, provenance, sensitivity, and approval metadata.

No organ should independently reinterpret legacy role or scope values.

### P3 — Memory contract adapter

Adapt the memory organ to the extracted lifecycle without losing fields:

- source event before candidate persistence;
- candidate status before approval;
- audience and sensitivity filtering at retrieval;
- revision, supersession, expiry, revocation, and audit preservation;
- companion isolation on every operation;
- deterministic in-memory test adapter for contract tests.

### P4 — Prompt and behavior adapter

Adapt prompt assembly and Active Self compilation to consume the neutral
context. It must:

- start neutral with empty memory;
- inject only approved permitted memory and active directives;
- keep learned user context separate from companion self/behavior;
- treat retrieved content as untrusted data;
- apply channel/audience policy before prompt construction;
- never infer identity from authorization or routing metadata.

### P5 — Baseline test port

Port the B0–B9 scenarios from
[`PHASE-0-EXTRACTION-BASELINE.md`](./PHASE-0-EXTRACTION-BASELINE.md), beginning
with B0, B2, B4, B5, and B6 at the API/runtime boundary. Use neutral fixture
identifiers and retain the original test reference beside each test.

### P6 — Public-default audit

Before the phase is accepted, scan production code, default configuration,
CLI templates, web copy, and test fixtures for personal defaults. Explicit
references in extraction documentation are allowed; executable defaults are
not.

## Do not proceed conditions

Stop and resolve the contract if any implementation proposal:

- makes `OWNER` the default chat audience;
- makes private chat the only chat path;
- creates a global `primary_user` subject;
- uses `MASTER_PRIVATE` as a public-package default;
- activates a claim or behavior during generation;
- lets model/OCR/observation/platform text bypass approval;
- merges response approval with memory approval;
- drops provenance or audience fields for adapter convenience.

## Phase exit criteria

Phase 1 is complete only when:

1. The core types represent every contract acceptance gate.
2. One compatibility boundary maps all legacy request shapes.
3. Memory and behavior organs consume neutral context rather than raw legacy
   roles.
4. B0, B2, B4, B5, and B6 pass through the actual runtime/API boundary.
5. A fresh companion has no personal memory, relationship, or private audience
   defaults.
6. The forbidden-default scan is clean, except for documented migration tests.
7. The handoff records test output and remaining gaps without claiming full
   parity.

The current missing/partial evidence rows are listed in
[`VERIFICATION_EVIDENCE_MANIFEST.md`](./VERIFICATION_EVIDENCE_MANIFEST.md).

## First implementation slice

The first code change should be limited to P1 and P2. Do not alter teaching,
retrieval, prompt assembly, or UI behavior until the neutral context and
compatibility boundary exist. This keeps the extracted semantics reviewable
and prevents another partial port from becoming the de facto contract.
