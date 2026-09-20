# @sidurijs/archive

> **Sovereign Primitive 5 (RFC VX-26-13):** Audited Interaction Ledger & Cold Search

The `@sidurijs/archive` domain package provides an append-only, cold audit ledger for tool executions, interaction turns, and historical events using pure SQLite WAL mode and FTS5 full-text indexing.

## Core Invariants

1. **Pure Audit Ledger:** Directives and claims are completely purged. Personality and behavior belong exclusively to `@sidurijs/self`, and user reality belongs exclusively to `@sidurijs/knowledge`.
2. **Cold Append-Only Storage:** Events are immutable historical traces retrieved only when explicitly queried.
3. **FTS5 BM25 Indexing:** Full-text search across payloads and source types.
