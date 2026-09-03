# Integrations

Status: integration baseline; behavioral extraction incomplete

- **OpenRouter**: Used for Brain and Vision.
- **Voice Synthesis**: Voice adapter connects to Edge-TTS cloud endpoints, or manages local engines (Voicevox, Piper, Kokoro) via HTTP/runtime.
- **E Knowledge Packs**: `@siduri-x/knowledge` loads a validated local E pack
  and exposes its cited retrieval results through `KnowledgeOrgan`.

Siduri installs or selects the pack path during companion creation. The Hub
provides discovery and distribution URLs; it does not perform local companion
installation.

Integration availability does not grant external providers permission to write
active personal memory. Knowledge, vision, OCR, and platform inputs remain
untrusted or pending according to the blank-slate and provenance contracts.

The provider-to-response boundary is specified in
[`T4-EVIDENCE-CHAIN-CONTRACT.md`](./T4-EVIDENCE-CHAIN-CONTRACT.md); provider
availability is not response approval.
