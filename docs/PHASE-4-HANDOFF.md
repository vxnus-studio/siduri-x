# Phase 4 handoff — consume semantic retrieval

**Phase:** 4 — model activation and retrieval quality
**Status:** ready for implementation
**Prerequisite:** Teyvat advertises a tested semantic/hybrid capability.

## Outcome

Use semantic or hybrid retrieval in Siduri when negotiated, with bounded
lexical fallback and stable evidence semantics.

## Siduri-owned work

- Add configuration for the preferred mode and fallback observability.
- Verify semantic/hybrid results retain provider revision and citations.
- Test provider outages, partial indexes, and mode changes across startup.

## Completion gate

- Siduri never assumes vectors or embeds text itself;
- unsupported modes are not sent over the wire;
- fallback remains bounded and cited;
- runtime evidence remains stable across lexical, semantic, and hybrid modes.
