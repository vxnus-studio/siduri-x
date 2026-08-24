# Integrations

Status: Implemented

- **OpenRouter**: Used for Brain and Vision.
- **VOICEVOX**: Voice adapter connects to external Voicevox engine HTTP endpoints.
- **E Knowledge Packs**: `@siduri-y/knowledge` loads a validated local E pack
  and exposes its cited retrieval results through `KnowledgeOrgan`.

Siduri installs or selects the pack path during companion creation. The Hub
will later provide discovery and distribution URLs; it does not perform local
companion installation.
