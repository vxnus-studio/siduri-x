# API Reference

> **Status:** Implemented (Single-Owner Local Companion API + Teach Mode)  
> **Host Binding:** Strictly `127.0.0.1` (Localhost only)

---

The API is a single deployable Express process (`apps/api`):

## 1. Lifecycle & Chat Endpoints
- `POST /boot`: Loads a companion configuration into the runtime with all wired substrates and organs.
- `POST /chat`: Sends a chat message to a specific companion.
- `POST /chat/stream`: Real-time Server-Sent Events (SSE) streaming endpoint delivering staged response info, avatar events, token chunks with Live2D visemes, and completion envelopes.
- `POST /chat/interrupt`: Triggers barge-in cancellation on active streams.

## 2. Teach Mode & `.self` Ingestion Endpoints (Phase 5)
- `POST /teach/upload-self`: Accepts raw `.self` YAML content, parses and validates manifest schema, executes safety scans (`scanDirective`) on all proposed directives, and returns `{ isValid, errors, manifest, scannedDirectives }` for interactive user review.
- `POST /teach/install-self`: Accepts `{ companionId, manifest, approvedDirectiveIds }`, writes approved identity and personality traits, and commits approved behavioral directives directly into `siduri.sqlite` via `SqliteSelfRepository`.

## 3. Truth Gate & Memory Endpoints
- `GET /memory` / `GET /memory/claims`: Lists memory claims for the companion.
- `POST /memory/proposals/approve`: Approves a pending memory claim.
- `POST /memory/proposals/reject`: Rejects a memory claim.
- `GET /memory/behavioral`: Lists behavioral directives.
- `POST /memory/behavioral/approve`: Approves a behavioral directive.

## 4. Peripheral Health & Channel Endpoints
- `GET /health` / `GET /ready`: Health check endpoints.
- `GET /mouth/health`: Health probe reporting Mouth organ readiness.
- `GET /mouth/channels`: Lists registered downstream output channels on Mouth.
- `POST /mouth/interrupt`: Aborts active speech/streaming.
- `GET /voice/health`: Voice organ readiness probe.
- `GET /obs/health`: Observation organ connection probe.
- `GET /me`: Returns authenticated local actor identity.
