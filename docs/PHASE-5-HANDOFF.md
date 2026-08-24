# Phase 5 handoff — connect Siduri to the hosted Hub

**Phase:** 5 — production deployment and cross-boundary verification
**Status:** blocked on external E Hub/Teyvat deployment
**Prerequisite:** the Hub lookup and Teyvat provider smoke checks pass.

## Siduri-owned gate

- Set `SIDURI_KNOWLEDGE_PROVIDER=e-hub`.
- Set `SIDURI_KNOWLEDGE_REGISTRY_URL=https://e.vxnus.xyz/api/packs`.
- Set `SIDURI_KNOWLEDGE_PACK_ID=@vxnus/teyvat`.
- Set `SIDURI_KNOWLEDGE_MODE=lexical` until the provider advertises semantic
  readiness.
- The default API runtime now selects `e-hub`; local packs remain explicit via
  `SIDURI_KNOWLEDGE_PROVIDER=e-knowledge`.
- Verify startup, retrieval, revision, and citations in runtime evidence.

Siduri must receive only public HTTPS URLs; it must never receive the Neon
connection string or embedding API credentials.
