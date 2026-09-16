# Prototype Verification Status: Siduri-X

**Current Status**: **EXPERIMENTAL PROTOTYPE (MOCK-VERIFIED)**  
**Verification Baseline**: `main` branch (v2.0.25 milestone) (Canonical RequestContext Envelope Construction in Companion Generator, Defensive Optional Chaining in Ear and Action Policy, Input Normalizer Context Safety, Standalone Companion Generator /chat & /chat/stream Request Body Payload Parsing Fix, .self Automatic Path Detection & Ingestion, Mode-Gated Attach .self Button in Teach Mode, Automatic Mode Transition on Import, Pure LLM Cognitive Proposer for Teach Mode Live Affirmation, OpenRouter Max-Tokens & Pseudo-Tool-Call Fallback Recovery, FTS5 Comma/Punctuation Sanitization, Elimination of Auto Mode and Magic Commands in Favor of Explicit 3 Interaction Modes [Casual, Teach, Hybrid], Local .env Priority & Ambient Shell Variable Isolation, Streamlined LLM Error Diagnosis & Hints, False Client Disconnect Resolution, Enriched SelfRelationship with Interlocutor Name & Affiliation, Conversational Teach Mode End-to-End Self Persistence & Truth Gate Bridge, Custom Base Persona .self Generation & Blank Slate Flow, Sequential Top-to-Downstream Organ Wizard Flow, Direct Engine Options & Clean Single-Pass Config, Sovereign Life DB Foundation & E Knowledge Hub Discovery, Clean Capability Manifests, LLM-Native Self & Qualitative Relational Stances, Decoupled Perception Pipeline, Clean Architecture & Pure SQLite)  
**Branch**: `main`  
**Product Architecture**: **Single-owner / Single-machine / Local companion / Pure SQLite**  

> [!IMPORTANT]
> **Testing Scope & Real-World Reality**  
> All current verification is based on **isolated unit tests, mock fixtures, AST analysis, and packaging tarball smoke tests**.  
> Siduri is **untested at real-world end-to-end (E2E) scale**: live audio input/output on diverse physical hardware, multi-week continuous memory accumulation, and un-mocked LLM latency and drift are active research frontiers, not verified production guarantees.

---

## 1. Verified Architectural & Unit Invariants

The following invariants have been verified in unit test suites and mock fixtures within the monorepo:

1. **Localhost-Only Ingress (P0)**:
   All listeners (`apps/api` and `cli/src/generator.ts` companion template) explicitly bind to `127.0.0.1`. No listener defaults to `0.0.0.0` or dual-stack broadcast.
2. **Production `/dev/*` Isolation (P0)**:
   Routes under `/dev/*` are conditionally mounted only when `process.env.NODE_ENV !== 'production' || process.env.SIDURI_DEV_MODE === 'true'`. In production, the router table does not contain these endpoints (HTTP 404).
3. **Static Path Traversal Defenses (P0)**:
   Decoded path traversal attacks (`../`, `%2e%2e%2f`, `%252e%252e%252f`, null bytes, backslashes, outside symlinks) are strictly rejected by the generator's path containment check (`path.relative(root, target)`).
4. **Approved Memory Immutability (P0)**:
   `SqliteMemoryStore` (`@siduri-x/memory`) enforces lifecycle gating. Any update generates a new `PENDING` replacement claim linked via `supersedes`. The approved original remains authoritative until explicit approval of the revision. `approveClaim()` rejects transitions from non-`PENDING` states.
5. **Pure SQLite Storage Foundation (P0)**:
   External database servers (PostgreSQL) are completely eradicated. Persistent continuity (`Self`, `Knowledge`/Life DB, `Memory`) runs on a unified, zero-config `siduri.sqlite` with WAL mode and FTS5 full-text indexing, initializing instantaneously (typical `< 20ms` locally, verified within `< 100ms` budget under CI virtualization in `packages/core/src/siduri-db.test.ts`).
6. **Brain Global Wall-Clock Deadline (P1)**:
   Overall deadline is governed by a global `AbortController` timer spanning all retry attempts. In-flight `fetch` calls abort immediately upon deadline expiry; retries cannot extend execution indefinitely.
7. **Peripheral Response Byte Bounding (P1)**:
   `readBoundedResponseBody` (Voice) and `readBoundedResponseText` (Knowledge) enforce size ceilings on both `Content-Length` headers and incremental streaming chunks via reader cancellation, preventing unbounded memory buffering.
8. **Durable Action Approval & Restart (P1)**:
   `ActionPolicyEngine` and `ActionStore` cryptographically sign capabilities and record approvals durably. Restarting the engine preserves approval validity without duplicate execution.
9. **Idempotency & Concurrency Safety (P1)**:
   Two-phase reservation prevents concurrent duplicate execution; replaying a completed execution returns the cached result without re-invoking the tool handler.
10. **Tamper-Evident Audit Chaining (P1)**:
    Audit events separate `previousEventHash`, `eventHash`, and `resultHash` into a SHA-256 hash chain over canonicalized payloads.
11. **Clean Distribution Packaging & Smoke Test**:
    `npm run release:check` passes on all 14 packages (13 canonical `@siduri-x/*` domain and organ packages + `@vxnus/siduri` CLI; zero leaking `workspace:` references). `clean-machine-smoke.test.ts` validates that tarballs unpack and scaffold an empty project in an isolated temp folder (packaging smoke test).
12. **3 Interaction Modes & Multi-Source Resolution (P0)**:
    Runtime implements Casual Mode (Zero Memory Drift: short-circuits proposals, zero SQLite or source event writes), Teach Mode (strict HITL staged proposal creation), and Hybrid Mode (default companion salience filtering), resolved deterministically via a 4-tier hierarchy (request context override -> public security channel boundary -> in-dialogue cues -> hybrid default).
13. **LLM-Native Self & Relational Stance Substrate (P0)**:
    Replaces numeric pseudo-math sliders with qualitative personality traits and directional relational stances (affinity, trust, dynamic interpersonal posture), compiled into clean inference frames via `ActiveSelfCompiler`.
14. **Conversational Teach Mode: Pure LLM Proposer & Enriched Self Relationship (P0)**:
    Replaced rigid regex slot-matching with pure LLM cognitive candidate proposal generation via structured response planning (`submitResponsePlan`: `memoryProposals`, `behaviorProposals`). All candidates enter `pending` status for owner review. Approved interlocutor claims (name, affiliation, creator stance) canonically enrich `SelfRelationship` and render resident in `<active_self>`, eliminating colloquial BM25 retrieval failures on turn 1. Persists durably across runtime restarts and destruction without duplicate drift.
15. **Companion Server Template Request Body & Context Envelope Safety (P0)**:
    Standalone companion instances generated by `@vxnus/siduri` parse POST body JSON payloads and construct canonical `RequestContext` envelopes (with default actor identity and direct conversation channels) before dispatching `/chat` and `/chat/stream` requests. In tandem, `normalizeUserInput`, `DefaultEarOrgan`, `MemorySettler`, and `ActionPolicyEngine` enforce defensive optional chaining across context descriptors, eliminating `ReferenceError: payload is not defined` and `Cannot read properties of undefined (reading 'channel')` failures.

---

## 2. Explicit Product Limitations

The following properties represent intentional architectural boundaries for Siduri's single-owner local model:

- **Synthetic Mock Testing vs. Real E2E**:
  All peripheral organs (`brain`, `voice`, `ear`, `vision`, `body`, `hands`) and runtime pipelines are currently verified using synthetic mocks and unit fixtures. Siduri has **not yet undergone continuous real-world E2E validation** (e.g., live microphone hardware, real GPU Live2D rendering loads, edge network TTS variations, or long-term multi-week memory consistency). It should be treated as an experimental prototype.
- **Local Trust Boundary**:
  Siduri does not implement multi-tenant authentication, public identity federation (OAuth2/OIDC), or tenant isolation. Authentication relies on server-verified local tokens (`OWNER_TOKEN`, `OPERATOR_TOKEN`) or development environment defaults.
- **Localhost-Only Deployment**:
  Siduri is designed to operate on the user's local workstation. Remote ingress is unsupported.
- **Platform Ingestion Stubs**:
  Streaming platform routes (`/platforms/*`) return truthful HTTP `501 Not Implemented`. Local companion operation is self-contained without external platform dependencies.
- **ActionStore Durability Scope**:
  `InMemoryActionStore` is the default in-memory implementation for single-session execution. Deployments requiring action approvals to survive host machine reboots or process restarts can configure persistent local storage via `actionStore: 'sqlite'` (or passing `SqliteActionStore` into `RuntimeOrgans`).
- **Single Active Companion Scope**:
  While database schemas and runtime facades include `companion_id` partitioning as a reserved architectural foundation for future multi-agent capabilities, the product is verified and supported strictly for **single-companion operation** at this time.
- **Web Client Lint Warnings**:
  The Next.js web application (`apps/web`) exports clean static artifacts for the CLI companion UI, but standalone ESLint reports non-blocking warnings concerning React 19 synchronous effect state setters and WebGL loader types.

---

## 3. Configuration Contract & Production Requirements

- `ACTION_POLICY_SECRET`: **Mandatory in production** (`NODE_ENV=production`). If unset, the Action Policy Engine and Hands organ fail closed immediately at startup.
- `STORAGE_PATH`: Optional local SQLite path (defaults to `./siduri.sqlite`). Zero external database dependencies.
- `PORT`: Defaults to `3001` (API) or `3000` (CLI Companion).
- Host Binding: All listeners strictly bind to `127.0.0.1`.

---

## 4. Reproducible Release Verification Commands

```bash
# 1. Typecheck all packages
pnpm run typecheck

# 2. Build monorepo packages and web static distribution
npm run build

# 3. Full fresh test suite across all organs and packages (29 Turbo tasks across workspace packages)
pnpm test

# 4. Packaging and distribution integrity check (14 packages inspected)
npm run release:check

# 5. Clean-machine packaging smoke verification
pnpm --filter @vxnus/siduri test src/clean-machine-smoke.test.ts
```
