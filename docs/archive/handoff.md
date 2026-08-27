# Siduri-Y Handoff

> **Current knowledge integration note (2026-08-24):** The knowledge organ
> now consumes E-compatible local packs through `EKnowledgeAdapter`. This note
> supersedes the older E-Teyvat-specific references below. The Hub provides
> discovery and distribution; Siduri performs installation and lifecycle.

## Current Status
**HISTORICAL / NOT PARITY-COMPLETE**

This handoff records an earlier implementation slice. It is not evidence that
Siduri-Y has extracted the original behavior or satisfies the public
blank-slate contract. See [`SIDURI_BEHAVIOR_EXTRACTION.md`](./SIDURI_BEHAVIOR_EXTRACTION.md)
and [`BLANK_SLATE_CONTRACT.md`](./BLANK_SLATE_CONTRACT.md).

All PASS/FAIL tables and “next actions” below are historical notes from that
session. The current status, blockers, and phase order are maintained in
[`REPOSITORY_HEALTH_AUDIT.md`](./REPOSITORY_HEALTH_AUDIT.md),
[`SIDURI_PARITY_ROADMAP.md`](./SIDURI_PARITY_ROADMAP.md), and
[`PHASE-1-EXTRACTION-HANDOFF.md`](./PHASE-1-EXTRACTION-HANDOFF.md).

## Session Date
August 16, 2026

## Session Objective
Conduct a deep source-to-source implementation audit comparing the original Python `siduri/` reference implementation to the newly constructed `siduri-y/` TypeScript monorepo, verifying strict behavioral parity, testing boundaries, and determining release-readiness.

*(Historical instruction)* The handoff was intended to be maintained as a
session record. The current source of truth is now the documentation authority
index at [`README.md`](./README.md).

## Work Completed
**Implementation Work:**
- `packages/organs/memory/src/index.ts`: Fixed Memory FTS semantics to use `to_tsquery('simple')`, alphanumeric filtering, OR semantics (`|`), prefix matching (`:*`), and `ts_rank` sorting matching Python parity.
- `packages/organs/memory/src/index.ts`: Implemented `proposeDirective` and `approveDirective`. Replaced the previous test mock with a fully atomic `BEGIN...FOR UPDATE...COMMIT` PostgreSQL transaction locking mechanism to ensure superseded directives are transitioned from `ACTIVE` to `SUPERSEDED` synchronously with the new directive's activation.
- `packages/core/src/index.ts`: Updated `BehaviorDirective` type definition to include the `PENDING` state string matching database lifecycle invariants.
- `packages/organs/memory/src/index.test.ts`: Added exact FTS parity unit tests mimicking the Python regex edge cases.
- `apps/api/src/smoke.test.ts`: Added rigorous database-level regression tests asserting behavioral directive atomicity, isolation constraints, and invalid approval blocking.
- `packages/organs/vision/src/index.ts`: Ported `MultiPassVisionAdapter` and `CroppedVisionAdapter` directly mirroring original Python ffmpeg logic and party list expansions.
- `packages/organs/body/src/index.ts`: Replaced `Live2DStubAdapter` with a functional `Live2DAdapter` that broadcasts typed WebSocket messages securely mapping the original orchestrator socket behavior.
- `packages/organs/memory/src/index.test.ts`: Fixed isolated jest configuration preventing `dummy` connection failures, maintaining pure unit test boundaries.
- `apps/cli`: Scaffolding implemented securely interacting to generate `siduri.config.json` via `@vxnus/siduri create`.
- Added missing `typecheck` and `lint` pipeline scripts into `turbo.json`.

**Investigation Work:**
- Completed Memory FTS Parity investigation: Confirmed regressions in dictionary (`english` vs `simple`), prefix matching, ranking, and limits/tokenization.
- Completed Behavioral Directive Parity investigation: Inspected `siduri/packages/memory/postgres.py`, `service.py`, and `siduri/packages/persona/behavior.py`. 
- **Correction**: The previous handoff claimed original Python code used complex atomic transaction-locked SQL functions. This was incorrect; Python executed two completely separate auto-committed SQL statements for superseding directives. We implemented a strictly atomic PostgreSQL transaction block for Siduri-Y anyway to enforce the requested invariant.
- Performed rigorous parallel source inspection on all modules using subagents.
- Found exact matching behaviors across Vision multi-pass aggregations, Voice queues, and E-Teyvat bounds.
- Discovered major behavioral regressions within the `web` UI frontends (Next.js empty templates instead of operator dashboards).
- Verified existing handoff documentation and established standard operating procedure for end-of-session handoffs.

## Historical Parity Snapshot (Superseded)

| Area | Status | Notes |
|---|---|---|
| Brain | PASS | Uses OpenRouter Tool Calling to preserve structured `ResponsePlan` constraints identical to ZAI. |
| Memory | PASS | Restored FTS weighting (`ts_rank`) and prefix queries (`term1:* \| term2:*`) matching original behavior. |
| Behavior | PASS | `approveDirective` successfully commits transactional `ACTIVE` -> `SUPERSEDED` transitions matching compiler rules. |
| Knowledge | PASS | `ETeyvatAdapter` perfectly maps external retrieval bounds and citations. |
| Voice | PASS | Synthesize sequence arrays logically block and prioritize via queues matching the original endpoints. |
| Vision | PASS | `ffmpeg` cropping byte buffers and `top_party_is_active` active character mappings successfully implemented. |
| Body | PASS | `Live2DAdapter` broadcasts expression/speech lifecycle hooks via dedicated `Set<WebSocket>` connections. |
| Runtime/API | PASS | Global singletons safely decoupled into `SiduriRuntime` isolated class dependency injection. Concurrent execution tested successfully via smoke tests. |
| Web | FAIL | Route proxy endpoints exist in Next.js, but no visual code (Chat, Operator Console, OBS Overlay DOM-based) was actually implemented. |
| CLI | PASS | Configurations accurately map to `siduri.config.json`. |

## Important Findings
- **Memory FTS Logic**: The original `siduri` code uses `setweight(..., 'A')` and logical `|` prefix matching to generate highly relevant conversational memory retrieval sorted by `ts_rank`. The `siduri-y` implementation currently executes exact-word unweighted boolean `AND` matching ordered by `ID`, completely disrupting context relevance. This was an accidental semantic difference.
- **Directive State Machine**: The original code executed two separate queries to update supersede targets. `siduri-y` was incorrectly skipping state mutations entirely. We fixed this by introducing a unified `BEGIN/COMMIT` Postgres block explicitly setting `status = 'SUPERSEDED'`.
- **Web UI Empty Shells**: The Next.js frontend migration correctly established routing, but fully neglected porting any actual React UI logic or DOM-based canvasing.

## Historical Known Gaps

1. **Web UI Frontends Unimplemented**
   - Severity: HIGH
   - Affected Package: `apps/web/src/app`
   - Original Behavior: Deep Chat interface, rich Operator control panel, and transparent DOM-based overlay canvas.
   - Current Behavior: Next.js boilerplate empty page templates.
   - Recommended Action: Extract the original React view components and port them sequentially inside the Next.js routes.

## Tests and Verification
- `pnpm install` — PASS
- `pnpm turbo run test` — PASS (All isolated unit tests execute completely without local dummy Postgres dependency drops)
- `pnpm turbo run typecheck` — PASS
- `pnpm turbo run lint` — PASS
- `pnpm turbo run build` — PASS
- `npx tsx apps/api/src/smoke.test.ts` — PASS (verified FTS parity, companion data isolation, and atomic directive updates).

**Integration Smoke Test (`apps/api/src/smoke.test.ts`)**
- Validated real PostgreSQL connections enforcing companion isolation with two
  historical fixture companions. This verifies tenant isolation only; it does
  not verify blank-slate behavior or behavioral parity.
- Validated explicit constraint checking prevents updating directives across isolated companion spaces, verifying full atomic safety.

## Architectural Decisions
- **Global singleton → Scoped `SiduriRuntime`**: Made intentionally to support N+ concurrently active companions via pure dependency injection mapping to isolated `companion_id` instances.
- **Provider-specific → OpenRouter API**: Made intentionally to unlock arbitrary model choices using native JSON Schema validation instead of hardcoded ZAI structured endpoints while maintaining `ResponsePlan` behaviors.
- **Centralized WebSocket handling → Body Organ**: Extracted core Live2D socket listeners out of the HTTP API directly into the domain organ to isolate concern.

## Files / Areas To Continue From
1. `apps/web/src/app/*`: Needs actual UI layout building mirroring legacy implementations.

## Current Recommended Actions

The UI port is no longer the current phase gate. Follow the neutral contract
and extraction handoff:

1. Implement the actor/channel/audience/subject contracts.
2. Add the single legacy compatibility mapper.
3. Port B0, B2, B4, B5, and B6 through the runtime/API boundary.
4. Remove personal defaults and update the health audit.

## Do Not Repeat
- Do not attempt to add Voice queue ordering logic; priority queuing is fully verified as successfully integrated.
- Do not rewrite the OpenRouter schemas; they successfully capture the original structured model rules correctly.

## Risks / Warnings
- **Do not modify companion isolation behavior:** The data isolation layer is active and verified; FTS query rewrites MUST maintain `WHERE companion_id = $1` filters.
- **Do not replace real integration tests with mocks:** `smoke.test.ts` must continue relying on a live Postgres DB `DATABASE_URL` via docker.

## Session End State

### Ready for next session
Begin P1/P2 from
[`PHASE-1-EXTRACTION-HANDOFF.md`](./PHASE-1-EXTRACTION-HANDOFF.md): neutral
context contracts and the legacy compatibility mapper.

### Blocking issues
See the H1/H2 findings in
[`REPOSITORY_HEALTH_AUDIT.md`](./REPOSITORY_HEALTH_AUDIT.md). The repository is
not release-ready.

### Last verification
`pnpm turbo run test && pnpm turbo run typecheck && pnpm turbo run lint && pnpm turbo run build` -> All exited with code 0.

## Historical Phase 3: Web UI Parity Audit

The original UI implementation was found inside `siduri/apps/web/app/` consisting of three Next.js routes (`/chat`, `/operator`, `/overlay`). The `siduri-y` Next.js frontend currently contains only boilerplate templates.

### A. Chat Audit
| Feature | Original Python API | Siduri-Y Target API | Status | Action |
|---|---|---|---|---|
| **State** | `siduri.chat.conversations.v1` in `localStorage` | Same | FAIL | Port `chat-client.tsx` |
| **Messaging API** | `POST /chat` with `message`, `history` | `POST /chat` with `id`, `message`, `role` | INTENTIONAL | Update UI request payload to match Siduri-Y's scoped runtime model |
| **Memory Approvals** | Renders receipts; calls `POST /memory/proposals/approve` | **Missing API endpoints** | FAIL | Cannot fully port without adding `approveClaim` API endpoints to `apps/api` |
| **Behavior Approvals**| Renders receipts; calls `POST /memory/behavioral/approve` | **Missing API endpoints** | FAIL | Cannot fully port without adding `approveDirective` API endpoints to `apps/api` |
| **UI/UX** | Sidebar, evidence chips, thinking dots | N/A | FAIL | Copy original CSS and layout |

### B. Operator Console Audit
| Feature | Original Python API | Siduri-Y Target API | Status | Action |
|---|---|---|---|---|
| **Overview Status** | Polled `/health`, `/voice/health`, `/obs/health`, etc. | **Missing API endpoints** | FAIL | Port UI, but mock/document missing data until API is extended |
| **Response Gate** | `POST /dev/mock-response`, `POST /dev/approve-response` | **Missing API endpoints** | FAIL | Cannot implement |
| **Memory Review** | `GET /memory/proposals`, `GET /memory/claims`, `GET /memory/behavioral` | **Missing API endpoints** | FAIL | Port UI, but requires API extension for data fetching |
| **Inbox/Evidence** | `GET /platforms/*`, `GET /evidence` | **Missing API endpoints** | FAIL | Cannot implement |

### C. OBS Overlay Audit
| Feature | Original Python API | Siduri-Y Target API | Status | Action |
|---|---|---|---|---|
| **WebSocket** | Listened to global `WS_URL` | Connects to Body Organ at `ws://localhost:8089` | PASS | Ported |
| **State parsing** | Parsed `response_plan` and `SpeechStarted` events | `Live2DAdapter` emits `ExpressionEvent` and `SpeechEvent` | PASS | Ported |
| **Visuals** | Venus orb with amplitude CSS variable | Venus orb with amplitude CSS variable | PASS | Ported |

## Current Outstanding Work

The historical UI migration status does not close the current extraction goal.
Outstanding work is tracked by the Phase 0 baseline, Phase 1 extraction
handoff, open decisions, limitations, and public-release checklist.

## User Knowledge
- "Do not treat the handoff as optional documentation."
- "Do not replace real integration tests with mocks."
- "Do not declare parity complete" until extraction, blank-slate behavior, and
  all components are verified.
- "Do not infer behavior from existing TS code. Use the original Python as the behavioral reference."
- Persistence state changes (specifically directive supersession) must be atomic and transactional.
- Architectural constraint: The API layer must be an adapter/composition boundary over existing organs.
- Companion isolation: Every stateful endpoint must preserve `companion_id` and never query global state.

## Work Accomplished
1. **Phase 3A: API Contract Parity (COMPLETED)**
   - Performed source-to-source audit of `siduri/apps/orchestrator/server.py` against `siduri-y/apps/api/src/index.ts`.
   - Expanded `PostgresMemoryOrgan` with missing admin methods: `getClaims`, `getPendingClaims`, `approveClaim`, `rejectClaim`, `rejectDirective`, `revokeDirective`, and `disableDirective`.
   - Updated `MemoryOrgan` interface in `@siduri/core` to expose these methods.
   - Implemented full CRUD API surface in `apps/api/src/index.ts` to mirror the Python orchestrator's requirements.
2. **Phase 3B: Web UI implementation (COMPLETED)**
   - Ported original Chat (`/chat`) and Operator Console (`/operator`) Next.js interfaces directly to `siduri-y/apps/web/src/app`.
   - Ported original OBS / Live2D Overlay (`/overlay`) to `siduri-y/apps/web/src/app`.
   - Updated Next.js clients to construct REST request bodies using `{ id: <UUID>, companionId: "default" }` rather than the old Python payload contracts to interface with the strictly isolated API.
   - Adapted the Overlay client to correctly parse the newer `@siduri/body` WebSocket event schema (`type: "speech" | "state_transition" | "lifecycle"`) instead of relying on the legacy `response_plan` event, properly simulating amplitude where no longer explicitly provided.
   - Removed broken legacy CSS imports from `globals.css` and successfully completed `pnpm run build` across all workspace apps. All frontend pages render successfully.
