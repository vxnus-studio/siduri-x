# Phase 2 handoff — Hub-backed Siduri knowledge

**Phase:** 2 — hosted E provider and Hub promotion
**Status:** planned
**Prerequisite:** Phase 1 remote provider selection is pushed.

## Outcome

Siduri resolves `@vxnus/teyvat` from the deployed E Hub, validates the provider
manifest, and uses the live Teyvat provider without a local pack or database
connection.

## Siduri-owned work

- Exercise Hub lookup with version selection and provider distributions.
- Surface registry, manifest, timeout, `404`, and `503` failures clearly.
- Keep local-pack mode as an explicit offline option.
- Verify revision and citations survive Hub resolution, remote retrieval, and
  runtime prompt/evidence construction.
- Add an end-to-end test against a local mock Hub and mock Teyvat provider.

## Completion gate

- a Hub-backed configuration boots successfully;
- archive-only registry entries are rejected for remote mode;
- local and Hub-backed providers satisfy the same `KnowledgeOrgan` behavior;
- remote failure does not prevent Siduri startup when knowledge is optional;
- no direct Neon, R2, or Teyvat dependency is added to Siduri.

## Handoff to the next phase

Phase 3 may enable vector/hybrid retrieval through E capability negotiation;
Siduri must continue to work when `semanticSearch` is false.
