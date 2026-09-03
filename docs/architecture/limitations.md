# Limitations & Boundary Architecture

Status: **RELEASE READY WITH EXPLICIT LIMITATIONS** (Verified commit: `06823ac2de61a5d8923f4072fe221bf943ea4aa4`)
Historical Status: Extraction baseline; public blank-slate parity incomplete (superseded)

This document distinguishes historical extraction gaps (now resolved) from intentional architectural boundaries for Siduri's single-owner, local companion model.

---

## 1. Intentional Architectural Boundaries (Release Invariants)

These constraints are deliberate design choices for Siduri's target product model and will not be expanded into multi-user SaaS infrastructure:

- **Local Trust Boundary**:
  Siduri is designed for a single owner on a single host machine. It intentionally does not provide public identity federation, OAuth2 authentication servers, multi-tenant isolation, or remote network ingress.
- **Localhost-Only Network Footprint**:
  All network listeners (API, Gateway, Memory Service, and CLI generated companions) strictly bind to `127.0.0.1`. Remote binding or unauthenticated exposure across public interfaces is unsupported by design.
- **Platform Ingestion Stubs**:
  Outbound streaming platform routes (`/platforms/*`) return truthful HTTP `501 Not Implemented`. Local companion operation is entirely self-contained without mandatory streaming platform dependencies.
- **ActionStore Durability Scope**:
  `InMemoryActionStore` is the default in-memory implementation for development and single-session execution. Production deployments requiring action authorizations to survive process or host restarts must supply a persistent store (e.g. `PostgresActionStore`).
- **Web Client Lint Warnings**:
  The Next.js web console (`apps/web`) exports clean static artifacts for the CLI companion UI, but standalone ESLint produces warnings concerning React 19 effect state setters and WebGL loader types.

---

## 2. Resolved Historical Extraction Gaps

The following gaps identified in earlier extraction phases have been fully resolved and proven across the codebase:

- **Public Chat Routing**:
  Resolved — `/chat` routes through `mapRequestContext`, defaulting to neutral public channel/audience context unless verified authentication tokens are provided.
- **Identity & Subjects**:
  Resolved — `primary_user`, creator defaults, and `MASTER_PRIVATE` assumptions were purged from schemas and runtime context.
- **Memory Lifecycle & Immutability**:
  Resolved — `PostgresMemoryOrgan.updateClaim` enforces strict immutability for `APPROVED` claims, generating `PENDING` revisions with `supersedes` provenance.
- **Behavior & Active Self**:
  Resolved — `ActiveSelfCompiler` compiles behavior strictly scoped to companion, role, channel, and audience without conflating user memory with behavioral directives.
- **Response Approval & Gating (T4)**:
  Resolved — `ResponseGatingEngine` gates candidate speech, evaluates citations and uncertainty, and requires explicit approval before emitting output events.
- **Blank-Slate Parity (B0–B6)**:
  Resolved — verified at the API/runtime boundary in `apps/api/src/b0-b6.test.ts`.
- **Observation / Screen Capture**:
  Resolved — continuous OBS screen capture was removed in favor of `FixtureObservationOrgan` with bounded SHA-256 digested frames and rate-limited ingestion.
