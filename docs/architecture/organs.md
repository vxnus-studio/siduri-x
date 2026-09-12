# Organs

> **Status:** Updated for Clean Architecture & Pure SQLite Substrates  
> **Architecture Topology:**
> - **Top-Level Domains (`packages/`):** `@siduri-x/core`, `@siduri-x/self`, `@siduri-x/knowledge` (Life DB), `@siduri-x/memory`
> - **Peripheral Organs (`packages/organs/`):** `brain`, `hands`, `ear`, `vision`, `voice`, `body`, `observation`, `mouth`, `eknowledge`

---

## 1. Core Domains (`packages/`)

- **Core (`@siduri-x/core`)**: Central runtime protocol, `SiduriRuntime`, `ResponseGatingEngine` (Truth Gate), Action Policy Engine, and `SiduriDatabase` (unified SQLite WAL + FTS5 foundation).
- **Self (`@siduri-x/self`)**: Agent identity, personality traits (warmth, formality, sarcasm, verbosity, curiosity), directional relationships, `ActiveSelfCompiler`, and `.self` package parser.
- **Knowledge (`@siduri-x/knowledge`)**: Internal Sovereign Life Database. Manages structured user reality across inventory, finance, schedule, and preferences.
- **Memory (`@siduri-x/memory`)**: Pure SQLite FTS5 episodic memory store. Tracks conversation episodes, claims lifecycle (`PENDING` -> `APPROVED`), and BM25 relevance search. Zero external database dependencies.

---

## 2. Pluggable Peripheral Organs (`packages/organs/`)

Each organ implements the canonical `@siduri-x/core` organ interface and publishes an `organ-manifest.json`:

- **Brain (`packages/organs/brain`)**: Implements provider-neutral LLM reasoning (`OpenAICompatibleBrain`, `OpenRouterBrain`). Enforces the `ResponsePlan` schema with internal monologue, structured memory proposals, and action intents.
- **Hands (`packages/organs/hands`)**: Tool execution and Model Context Protocol (MCP) organ. Enforces cryptographic `AuthorizationCapability` checks verified by `ActionPolicyEngine`.
- **Ear (`packages/organs/ear`)**: Multi-modal sensory input ingestion organ for audio transcription and text normalization.
- **Vision (`packages/organs/vision`)**: Visual observation and multi-pass OCR perception adapter.
- **Voice (`packages/organs/voice`)**: Speech synthesis queue adapter supporting Edge-TTS, Piper, and VOICEVOX with optional RVC post-processing.
- **Body (`packages/organs/body`)**: Renderer-agnostic avatar expression state machine and embodiment event adapter (Live2D Cubism WebGL).
- **Observation (`packages/organs/observation`)**: Fixture and screen observation organ with SHA-256 frame deduplication and OCR reading ingestion.
- **Mouth (`packages/organs/mouth`)**: Output communication and presentation decoupling organ. Adapts cognitive utterances for web mediums with real-time SSE token streaming, Live2D viseme cues (`mouthOpenY`, `mouthForm`), SSML emotional prosody formatting, barge-in interruption handling, and channel sinks.
- **E-Knowledge (`packages/organs/eknowledge`)**: External cited pack and remote documentation client with SSRF hardening.

---

## 3. Deprecated / Superseded Packages

- ~~**Behavior (`@siduri-x/behavior`)**~~: Merged into `@siduri-x/self`. The `ActiveSelfCompiler` in `@siduri-x/self` implements the `BehaviorOrgan` interface for full backward compatibility.
