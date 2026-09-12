# Siduri Memory Architecture & Drivers Guide

> **Status:** Superseeded / Legacy Reference (Historical Documentation)  
> **Current Architecture:** Implemented in `@siduri-x/memory` via **Pure SQLite FTS5** (`siduri.sqlite`). PostgreSQL has been completely purged from the codebase as part of Phase 6 of the Clean Architecture Migration.

---

> [!WARNING]
> **ARCHITECTURAL CHANGE NOTICE: POSTGRESQL PURGED**
>
> The documentation below outlines the earlier PostgreSQL (`pg`) implementation and historical driver exploration.
>
> **Canonical Current State:**
> - Memory is now an isolated domain package: **`@siduri-x/memory`**.
> - It is backed directly by **SQLite with WAL mode and built-in FTS5** (Full-Text Search BM25 ranking) via `SiduriDatabase` in `@siduri-x/core`.
> - Zero external database setup (`DATABASE_URL`, PostgreSQL containers, `pg` driver) is needed. The database boots in `< 20ms`.
> - For the current architecture and contract, see:
>   - [`docs/self-organ-knowledge/01-domain-architecture.md`](../self-organ-knowledge/01-domain-architecture.md)
>   - [`docs/self-organ-knowledge/03-phased-migration-plan.md`](../self-organ-knowledge/03-phased-migration-plan.md)

---

## 1. Core Memory Concepts

### 1.1 Structured Claims
Memories in Siduri are structured as **versioned claims** rather than raw unbounded text dumps:
- **Subject**: The entity or concept (`user`, `siduri`, `project_x`).
- **Predicate**: The relational property (`favorite_color`, `birthday`, `role`).
- **Value**: The current asserted truth (`teal`, `March 14`, `software_engineer`).
- **Metadata**: Provenance, confidence score (`0.0` - `1.0`), privacy/sensitivity level (`public`, `private`, `system`), and creation/validity timestamps.

### 1.2 Companion Scoping
Every memory table tracks `companion_id`, scoping memory events to specific companion instances on the local machine. In current single-companion releases, this defaults to `'default'` and is architecturally reserved for multi-agent workspaces.

### 1.3 Full-Text Search (FTS) & Truth Gating
* **Truth Gating Filter**: `searchClaims()` strictly filters `status = 'APPROVED'` to prevent unverified or rejected claims from entering the perception cycle and context prompt.
* **Legacy Design:** PostgreSQL Full-Text Search (`tsvector`) and GIN indexes.
* **Implemented Design:** SQLite FTS5 virtual tables (`memory_search`) using BM25 relevance ranking.

---

## 2. Historical Implementation: Native PostgreSQL (`pg`) [LEGACY]

### Overview
In earlier prototypes (v0.1.x – v0.2.x), `@siduri-x/memory` was built directly on native `pg` (`node-postgres`) with SQL migration scripts.

### Historical Schema Structure (`001_initial_schema.sql`)
- `memory_claims`: Authoritative semantic and episodic claims.
- `memory_directives`: Active self personality rules and gating directives.
- `memory_source_events`: Raw sensory evidence input records.
- `memory_claim_history`: Audit trail for claim updates and superseding.
- `_siduri_migrations`: Checksum-verified migration history.

---

## 3. Current Implemented Architecture: Pure SQLite FTS5

The canonical `@siduri-x/memory` implementation now provides:
1. **Episodic Event Ingestion:** `recordEvent()`, `getRecentEvents()`.
2. **Claim Proposal & Truth Gating:** `proposeClaim()`, `approveClaim()`, `rejectClaim()`, `getApprovedClaims()`.
3. **BM25 Search:** Sub-millisecond keyword and claim retrieval via `searchClaims()`.
4. **Zero-Config Portability:** Single `siduri.sqlite` file, zero Docker/PostgreSQL dependencies.
