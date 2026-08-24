# Phase 7 handoff — default Hub-backed Siduri runtime

**Phase:** 7 — runtime adoption
**Status:** local implementation complete; hosted provider readiness pending

## Delivered

- Default Siduri API configuration now selects `e-hub` and
  `@vxnus/teyvat` through `https://e.vxnus.xyz/api/packs`.
- Local filesystem packs remain supported as an explicit development and
  recovery mode.
- `SIDURI_KNOWLEDGE_MODE` controls lexical, semantic, or hybrid preference;
  lexical remains the default until Teyvat advertises semantic readiness.

## Completion gate

- Teyvat manifest returns 200 from its hosted URL;
- default Siduri startup resolves the Hub provider and preserves citations;
- optional provider failure does not corrupt other runtime organs;
- local pack fallback remains test-covered.
