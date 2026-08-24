# Phase 8 handoff — consume user-owned Hub projects

**Phase:** 8 — user-owned publisher workspace
**Status:** boundary defined; implementation follows Hub migration

Siduri continues to consume public E provider distributions. Supabase Auth is
owned by E Hub and must not be coupled directly into Siduri’s knowledge organ.

When a user selects a private project, Siduri may receive a short-lived,
provider-scoped access credential through configuration, but never a Supabase
service key or database URL.

## Completion gate

- public Teyvat resolution remains unchanged;
- user-selected project/provider URLs resolve through the E Hub contract;
- project access failures are explicit and do not break local-pack fallback;
- citations, revisions, and publisher identity remain in runtime evidence.
