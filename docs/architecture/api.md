# API

Status: Single-owner local companion API

The API is a single deployable Express process (`apps/api`) strictly bound to `127.0.0.1`:
- `POST /boot`: Loads a companion configuration into the runtime.
- `POST /chat`: Sends a chat message to a specific companion.
- `GET /memory` / `GET /memory/claims`: Lists memory claims for the companion.
- `POST /memory/proposals/approve`: Approves a pending memory claim.
- `POST /memory/proposals/reject`: Rejects a memory claim.
- `GET /memory/behavioral`: Lists behavioral directives.
- `POST /memory/behavioral/approve`: Approves a behavioral directive.
- `GET /health` / `GET /ready`: Health check endpoints.

The companion runs locally on the owner's machine. Authentication defaults to single-owner access, and all memories for the booted companion are accessible without audience segregation.

