# Testing

Status: automation baseline; behavioral extraction incomplete

- **Smoke test**: Created `apps/api/src/smoke.test.ts`.
- **Result**: Proves memory isolation. Two neutral fixture companions are
  completely isolated because the `PostgresMemoryAdapter` enforces
  `companion_id` in all SQL queries (`INSERT`, `SELECT`), and each
  `CompanionRuntime` is instantiated with its unique `id` passed directly to
  the memory organ. This test does not prove blank-slate or behavior parity.

The required behavior scenarios are documented in
[`PHASE-0-EXTRACTION-BASELINE.md`](./PHASE-0-EXTRACTION-BASELINE.md). A green
unit suite is not sufficient for a public-health or parity claim.
