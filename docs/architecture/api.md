# API Reference

> **Status:** Implemented (Single-Owner Local Companion API + Teach Mode)  
> **Host Binding:** Strictly `127.0.0.1` (Localhost only)

---

The API is a single deployable Express process (`apps/api`):

## 1. Lifecycle & Chat Endpoints
- `POST /boot`: Loads a companion configuration into the runtime with all wired substrates and organs.
- `POST /chat`: Sends a chat message to a specific companion.
- `POST /chat/stream`: Real-time Server-Sent Events (SSE) streaming endpoint delivering staged response info, avatar events, timed token/viseme chunks via the Mouth organ, and completion envelopes. (Operates on an utterance-staging model to allow Truth Gate validation and synchronous avatar synthesis).
- `POST /chat/interrupt`: Triggers barge-in cancellation on active streams.

## 2. Teach Mode & `.self` Ingestion Endpoints (Phase 5)
- `GET /teach/detected-self`: Discovers candidate `.self` packages on local filesystem path (configured `selfPath`, `assets/self/*.self`, or project root), parses the manifest, checks whether already installed, and returns `{ detected, filename, path, content, parsed, alreadyInstalled }` for client prompt/review.
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

## 5. Stream Interruption & Barge-in Lifecycle
- **Barge-In (`user_barge_in`)**: When a user submits a prompt while generation is currently in-flight, the active `AbortController` triggers immediate cancellation.
  - If the previous turn had not started generating text tokens yet (`!msg.content`), the unstarted assistant placeholder is pruned from the conversation history to eliminate ghost bubbles.
  - If the companion was already actively streaming speech chunks, the partial text generated so far is preserved as-is, with an unobtrusive `[INTERRUPTED]` status badge and an attribution footnote.
- **Manual Stop (`user_stop`)**: Clicking the stop generation control triggers cancellation. Displays `[STOPPED]` with *"Response stopped by user."*
- **Premature Connection Close (`client_disconnect`)**: The server listens to response socket termination (`res.on('close')` guarded by `!res.writableEnded`). If the connection drops before completion, it displays `[DISCONNECTED]` with *"Response stopped due to connection close."* and guidance on connection state.
- **Timeout (`timeout`)**: When requests exceed wall-clock deadlines, the client displays `[TIMED OUT]` with *"Response timed out."*

## 6. LLM Provider Error Propagation & Diagnostics
- **Upstream Error Extraction**: `@sidurijs/brain` inspects upstream HTTP error bodies (`response.text()`) from OpenRouter / OpenAI-compatible providers rather than discarding details.
- **Fatal Error Gating**: HTTP statuses `400` (Bad Request), `401` (Unauthorized), `402` (Payment Required / Insufficient credits), `403` (Forbidden), and `404` (Model not found) are marked fatal and abort immediately rather than exhausting backoff retries.
- **Diagnostic Classification**: `apps/web` identifies error signatures (authentication failures, credits exhausted, rate limits, missing models, context window overflow, request timeout, upstream 5xx outages) and displays an in-character message (*"I couldn't complete the response."*) paired with an actionable diagnosis hint and collapsible technical trace drawer.
- **Direct Completion Fallback**: When an LLM returns direct text output rather than calling the `submitResponsePlan` function tool, the brain gracefully extracts the text into speech instead of throwing a parsing error.
