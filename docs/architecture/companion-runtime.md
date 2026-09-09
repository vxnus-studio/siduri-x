# Companion Runtime

Status: Production Modular Pipeline (`@siduri-x/core`)

The canonical `SiduriRuntime` orchestrator is located in `@siduri-x/core` (`packages/core/src/runtime.ts`). It serves as the local, neutral orchestration hub for companion perception, cognition, action gating, memory settlement, and experience dispatch.

## Architecture & Modular Pipeline

To prevent God-object anti-patterns and enforce strict single-responsibility boundaries, `SiduriRuntime` delegates its execution cycle to discrete pipeline modules:

1. **Input Normalization & Ingestion** (`packages/core/src/input-normalizer.ts`):
   - Validates input size ceilings and strips dangerous null-byte sequences.
   - Normalizes actor identity, authorization roles, and conversation audience per contract T1.
   - Routes structured or raw audio perceptions through the configured `Ear` organ.
   - Synthesizes fallback role metadata for non-interactive channels.

2. **Intent Classification** (`packages/core/src/intent-classifier.ts`):
   - Fast deterministic regex heuristics for common conversational intents (`chat`, `command`, `reflection`, `mutation`).
   - Asynchronous cognitive classification (`classifyInputIntentAsync`) delegating to organ classification when available.

3. **Context Retrieval** (`packages/core/src/context-retriever.ts`):
   - Concurrent retrieval of `Memory` claims and `Knowledge` items.
   - Audience disclosure filtering per contract T2.
   - Preserves native `EvidenceRecord` metadata and citation provenance per contract T4.
   - Isolates organ failures into structured subsystem diagnostics without crashing the cognition cycle.

4. **Prompt Compilation** (`packages/core/src/prompt-compiler.ts`):
   - Compiles layered system prompts adhering to the contract T3 prompt section matrix.
   - Injects active persona directives from `Behavior` organ.
   - Formats contextual knowledge citations and working context.
   - Emits bounded fallback prompts if context retrieval degrades.

5. **Cognition Planning** (`packages/core/src/cognition-planner.ts`):
   - Invokes the `Brain` organ under global wall-clock deadlines to generate structured `ResponsePlan`s.
   - Deterministic headless fallback planning when `Brain` is unavailable or offline.

6. **Memory Settlement** (`packages/core/src/memory-settler.ts`):
   - Records raw sensory and chat events into the audit log.
   - Submits proposed memory claims (`PENDING`) with cryptographically traceable provenance.
   - Submits proposed behavior directives to the approval queue.

7. **Action Authorization & Execution** (`packages/core/src/action-executor.ts`):
   - Enforces the Primary Security Invariant: Propose -> Authorize -> Execute -> Audit.
   - Evaluates action policies and executes authorized tools via `Hands` organ (MCP).
   - Guarantees two-phase reservation to prevent duplicate or replayed execution.

8. **Experience Emission** (`packages/core/src/experience-emitter.ts`):
   - Emits unified `ExperienceEvent` streams (text, voice, expression) per contract T5.
   - Dispatches TTS audio synthesis to `Voice` organ and embodiment expressions to `Body` organ.

9. **Response Enveloping** (`packages/core/src/response-envelope.ts`):
   - Enforces gating boundaries (`TruthGate` / `GatingManager`).
   - Formats approved responses or structured rejection notifications with policy reason codes.

## Session History Management

Session state is isolated using `SessionHistoryManager` (`packages/core/src/session-history.ts`):
- Per-session history keying prevents cross-actor and cross-channel context leakage.
- Enforces strict message length ceilings and turn count limits to bound memory consumption.
- LRU session eviction prevents unbounded growth of idle sessions.
- Input strings are sanitized against control characters and null bytes.

## Unified Perception Cycle

The runtime exposes `processPerception(perception: CompanionPerception)`:
- Ingests raw audio, transcribed text, and webhook payloads into a unified perception cycle.
- Attaches sensory observation data from the `Observation` organ.
- Legacy `handleUserMessage` acts as a thin wrapper over `processPerception`.

## Cohesive Facade Architecture

To prevent Law of Demeter violations across consuming applications (such as `apps/api`), `SiduriRuntime` exposes direct facade methods for memory operations and response staging:
- Memory Facades: `getClaims()`, `getPendingClaims()`, `getDirectives()`, `updateClaim()`, `approveClaim()`, `rejectClaim()`, `approveDirective()`, `rejectDirective()`, `revokeDirective()`, `disableDirective()`, `resetMemory()`.
- Gating Facades: `stageResponse()`, `findStagedPlanByCorrelation()`, `getStagedPlan()`, `approveResponse()`, `rejectResponse()`, `evaluateGate()`.
- Observation Management: `setObservationOrgan()`.

## Neutral Contracts Parity

The companion runtime strictly complies with the Siduri-X neutral contracts:
- **T1**: Neutral Context Specification (explicit actor, audience, companion ID).
- **T2**: Memory Disclosure Matrix (audience-scoped claims and directives).
- **T3**: Active Self & Prompt Matrix (strict layered system prompt composition).
- **T4**: Evidence Chain (native `EvidenceRecord` preservation and citation provenance).
- **T5**: Experience Events (unified event stream for voice, body, text).
- **T6**: Security Operations (durable capability signing and audit chaining).
- **T7**: Release Evidence & Zero-Dependency Invariants (clean packaging, `@siduri-x/core` has 0 external dependencies).
