# API

Status: Single-owner local companion API

The API is a single deployable Express process (`apps/api`) strictly bound to `127.0.0.1`:
- `POST /boot`: Loads a companion configuration into the runtime.
- `POST /chat`: Sends a chat message to a specific companion.
- `POST /chat/stream`: Real-time SSE (`text/event-stream`) streaming endpoint delivering staged response info, avatar events, token chunks with Live2D viseme cues, and final completion.
- `POST /chat/interrupt`: Triggers barge-in cancellation on active streams for a companion.
- `GET /mouth/health`: Health probe reporting Mouth organ readiness.
- `GET /mouth/channels`: Lists registered downstream output channels on the Mouth organ.
- `POST /mouth/interrupt`: Alias for `/chat/interrupt` to abort active speech/streaming.
- `GET /memory` / `GET /memory/claims`: Lists memory claims for the companion.
- `POST /memory/proposals/approve`: Approves a pending memory claim.
- `POST /memory/proposals/reject`: Rejects a memory claim.
- `GET /memory/behavioral`: Lists behavioral directives.
- `POST /memory/behavioral/approve`: Approves a behavioral directive.
- `GET /health` / `GET /ready`: Health check endpoints.

The companion runs locally on the owner's machine. Authentication defaults to single-owner access, and all memories for the booted companion are accessible without audience segregation.

