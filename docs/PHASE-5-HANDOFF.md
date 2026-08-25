# Phase 5 handoff — connect Siduri to the hosted Hub

**Phase:** 5 — production deployment and cross-boundary verification
**Status:** complete
**Prerequisite:** the Hub lookup and Teyvat provider smoke checks pass.

## Siduri-owned gate

- Set `SIDURI_KNOWLEDGE_PROVIDER=e-hub`.
- Set `SIDURI_KNOWLEDGE_REGISTRY_URL=https://e.vxnus.xyz/api/packs`.
- Set `SIDURI_KNOWLEDGE_PACK_ID` to the installed or explicitly selected Hub package.
- Set `SIDURI_KNOWLEDGE_MODE=lexical` until the provider advertises semantic
  readiness.
- Local packs are selected explicitly with
  `SIDURI_KNOWLEDGE_PROVIDER=e-knowledge` and `SIDURI_KNOWLEDGE_PACK`.
- Verify startup, retrieval, revision, and citations in runtime evidence.

Siduri must receive only public HTTPS URLs; it must never receive the Neon
connection string or embedding API credentials.

Production verification passed through Hub resolution with Teyvat revision and
`gi-data` citations preserved.
