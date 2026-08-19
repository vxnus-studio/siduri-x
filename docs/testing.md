# Testing

Status: Implemented

- **Smoke test**: Created `apps/api/src/smoke.test.ts`.
- **Result**: Proves memory isolation. `Ganyu` and `Astra` memories are completely isolated because the `PostgresMemoryAdapter` enforces `companion_id` in all SQL queries (`INSERT`, `SELECT`), and each CompanionRuntime is instantiated with its unique `id` passed directly to the memory organ.
