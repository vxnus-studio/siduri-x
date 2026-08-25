# Phase 1 handoff — Siduri remote knowledge

**Phase:** 1 — E-compatible remote provider
**Status:** implementation complete; hosted end-to-end verification pending
**Scope:** discover and consume an E provider through the E Hub registry.
Local packs remain supported.

## Outcome

Siduri can resolve a provider from the E Hub registry, boot with either a
local E pack or a remote E provider, retrieve lexical knowledge, preserve
revisions and citations, and degrade gracefully when the remote provider is
unavailable.

## Siduri-owned work

- Add a remote implementation of `KnowledgeOrgan` using E’s provider client.
- Select the implementation from `config.knowledge.provider`.
- Resolve `@publisher/name` and optional version through the Hub registry, then
  use its `distribution.url` when `distribution.kind` is `provider`.
- Support `baseUrl`, timeout, and optional API key configuration.
- Validate the provider manifest before boot completes.
- Retry only bounded transient failures; do not retry malformed requests.
- Keep the local `e-knowledge` pack path as the default development mode.
- Preserve citation IDs and revision IDs in runtime context and evidence.

## Configuration

```json
{
  "knowledge": {
    "provider": "e-hub",
    "registryUrl": "https://e.vxnus.xyz/api/packs",
    "packId": "@publisher/installed-pack",
    "timeoutMs": 5000
  }
}
```

## Completion gate

- local-pack tests continue to pass;
- remote-provider tests cover successful retrieval, invalid manifest, timeout,
  `503`, and empty results;
- boot selects providers by configuration rather than always constructing the
  local adapter;
- Hub discovery resolves the registered provider URL and rejects archive-only
  distributions for remote mode;
- the runtime remains usable when optional remote knowledge fails;
- no direct Neon or Teyvat database dependency is added to Siduri.

## Handoff to the next phase

Phase 2 hardens hosted deployment, caching, and provider promotion. Phase 3
may add vector/hybrid retrieval behind the same `KnowledgeOrgan` interface.
