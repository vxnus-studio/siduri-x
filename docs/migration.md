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
