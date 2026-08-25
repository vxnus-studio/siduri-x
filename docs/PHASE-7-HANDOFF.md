# Phase 7 handoff — default Hub-backed Siduri runtime

> Knowledge/deployment-track handoff. This phase number is independent from
> the behavior-extraction phases in
> [`SIDURI_PARITY_ROADMAP.md`](./SIDURI_PARITY_ROADMAP.md). “Complete” here
> means only runtime adoption for the hosted knowledge provider; it does not
> indicate full Siduri behavior or blank-slate parity.

**Phase:** 7 — runtime adoption
**Status:** complete

## Delivered

- Siduri no longer selects a specific Hub package by default.
- Installed local packs are the default; Hub packages remain explicit through
  configuration.
- `SIDURI_KNOWLEDGE_MODE` controls lexical, semantic, or hybrid preference;
  lexical remains the default until the selected provider advertises semantic
  readiness.

## Completion gate

- Teyvat manifest returns 200 from its hosted URL;
- default Siduri startup resolves the Hub provider and preserves citations;
- optional provider failure does not corrupt other runtime organs;
- local pack fallback remains test-covered.

Hosted Siduri adapter verification passed against the deployed Hub/Teyvat
provider with six cited results and the active Teyvat revision.
