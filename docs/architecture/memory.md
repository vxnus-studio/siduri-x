# Memory

Status: compatibility slice only; extraction parity incomplete

The Memory organ uses PostgreSQL.
- Isolation: Every table enforces `companion_id`.
- Tables: `claims` and `directives`.
- Scope and audience semantics must follow the public blank-slate contract.
  Authentication roles are not conversational relationships or proof of a
  personal identity.

See [`SIDURI_BEHAVIOR_EXTRACTION.md`](./SIDURI_BEHAVIOR_EXTRACTION.md) and
[`BLANK_SLATE_CONTRACT.md`](./BLANK_SLATE_CONTRACT.md) before changing memory
schemas or retrieval behavior.

The target lifecycle is specified in
[`T2-MEMORY-STATE-MACHINE.md`](./T2-MEMORY-STATE-MACHINE.md); the current organ
does not yet satisfy every state or retrieval invariant there.
