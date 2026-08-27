# API

Status: API compatibility baseline; neutral channel extraction incomplete

The API is a single deployable Express process (`apps/api`).
- `POST /boot`: Loads a companion into memory.
- `POST /chat`: Sends a message to a specific companion.

The current `/chat` route still has a legacy private/owner routing assumption.
Its target contract requires explicit actor, channel, and audience context.
See [`NEUTRAL_CONTRACT_DECISIONS.md`](./NEUTRAL_CONTRACT_DECISIONS.md).

The concrete neutral request and rejection envelopes are in
[`T1-API-CONTRACT-EXAMPLES.md`](./T1-API-CONTRACT-EXAMPLES.md).
