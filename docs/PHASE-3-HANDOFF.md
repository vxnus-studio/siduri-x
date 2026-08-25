# Phase 3 handoff — Siduri semantic knowledge

> Knowledge-track handoff. This phase number is independent from the
> behavior-extraction phases in [`SIDURI_PARITY_ROADMAP.md`](./SIDURI_PARITY_ROADMAP.md).
> Its status does not indicate full Siduri behavior or blank-slate parity.

**Phase:** 3 — optional vector/hybrid retrieval
**Status:** foundation complete; semantic activation pending
**Prerequisite:** Phase 2 hosted provider is live and Hub-backed discovery is
verified.

## Outcome

Siduri uses semantic or hybrid retrieval when the provider advertises it and
falls back to lexical retrieval when it does not or when vector infrastructure
is unavailable.

## Siduri-owned work

- Read provider capabilities during manifest validation.
- Select `hybrid` or `semantic` only when supported.
- Preserve cited results and revision IDs in runtime context/evidence.
- Keep lexical fallback bounded and observable.
- Add tests for capability mismatch, embedding outage, and lexical fallback.

## Delivered foundation

- Added a preferred retrieval mode that is negotiated against the provider
  manifest.
- Unsupported semantic/hybrid requests are downgraded to lexical retrieval;
  semantic failures retry lexical retrieval while preserving citations and
  revisions.
- Added coverage for semantic capability mismatch and lexical fallback.

## Completion gate

- lexical-only Teyvat providers remain fully supported;
- unsupported modes are never sent to providers;
- semantic/hybrid failures do not prevent optional knowledge startup;
- prompt context and evidence identifiers remain stable across modes;
- no vector database or embedding SDK is coupled directly to Siduri.

The remaining production activation and retrieval-quality work is handed off to
Phase 4.
