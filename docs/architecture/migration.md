# Migration

Status: historical migration notes; not proof of behavioral parity

These notes describe the original porting intent. Current extraction status and
known contradictions are maintained in
[`SIDURI_EXTRACTION_MATRIX.md`](./SIDURI_EXTRACTION_MATRIX.md) and
[`REPOSITORY_HEALTH_AUDIT.md`](./REPOSITORY_HEALTH_AUDIT.md). “Changed” entries
are not accepted as complete until the neutral contract and B0–B9 evidence
exist.

For every piece copied from `siduri/`:

### 1. Memory / Claims
- **Original Location**: `siduri/packages/memory/postgres.py`
- **Copied**: The relational schema concept (subject, predicate, value) and the FTS retrieval strategy.
- **Changed**: Ported to TypeScript `pg`, added `companion_id` to every table,
  and introduced a temporary `MemoryScope` compatibility type. Neutral
  audience/subject extraction is still pending; this is not a successful
  replacement of the original personal scope model yet.
- **Why**: To support multi-companion isolation.
- **Preserved**: The rigorous structural definition of a memory claim.

### 2. Voice Queue
- **Original Location**: `siduri/packages/voice/queue.py`
- **Copied**: The async processing queue that dispatches `STARTED` and `COMPLETED` events.
- **Changed**: Ported to JS async iterators/promises.
- **Why**: The frontend/body needs exact timing on when audio actually begins playing, which direct synthesis doesn't provide.
- **Preserved**: Audio lifecycle tracking.

### 3. Brain Response Plan
- **Original Location**: `siduri/packages/model_router/`
- **Copied**: The JSON structure containing speech + memory actions.
- **Changed**: Implemented via OpenRouter function calling instead of ZAI GLM-5.2 specific structured outputs. Removed hardcoded language tuples (JA/EN/ID).
- **Why**: To support standard LLMs and user-configured languages.
- **Preserved**: The ability to think, speak, and propose memories in a single generation pass.


## Version 1: Single-User Agent Architecture & Decoupling Plan

### Objective
Simplify Siduri into a clean, single-user autonomous cognitive agent and decouple all streaming / VTuber / multi-viewer mechanics into external host applications.

### 1. Architectural Scope Boundary
- **Siduri Core**:
  - Serves strictly **1 User / Owner**.
  - Owns Brain (cognition), Memory (claims), Knowledge (factual evidence), Behavior (Active Self), Ear/Vision (perception), Hands (MCP actions), and Mouth/Body (expression via Experience Events).
  - Agnostic to streaming platforms, broadcast overlays, and viewer management.
- **External Streaming Application**:
  - Ingests platform streams (Twitch, YouTube, etc.), processes chat, manages multi-viewer traffic, and filters events.
  - Sends clean perception events to Siduri and receives Mouth/Body events to render on stream overlays.

### 2. Implementation Roadmap
1. **Context & Auth Simplification**:
   - Strip multi-viewer authorization states (`VIEWER`, `OPERATOR`) from core contracts.
   - Unify `RequestContext` around the authenticated single owner.
2. **Memory & Gating Streamlining**:
   - Remove audience-isolation leak checks (`allowedAudiences` per viewer) and channel-based disclosure barriers designed for live streams.
   - Retain companion isolation (`companionId`) and memory lifecycle states (`PENDING`, `APPROVED`, `EXPIRED`, `REVOKED`).
3. **Hands Organ (MCP)**:
   - Build `@siduri-x/hands` package enabling standardized tool use via Model Context Protocol.
4. **Ear Perception Ingestion**:
   - Build a formal perception ingress abstraction for multi-modal sensory inputs (audio, text, webhooks).

