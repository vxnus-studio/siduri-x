# Organs

## Canonical Organ Ecosystem (`@siduri-x/*`)
- **Brain (`@siduri-x/brain`)**: Implements provider-neutral LLM reasoning (`OpenAICompatibleBrain`, `OpenRouterBrain`). Enforces the `ResponsePlan` schema with internal monologue, structured memory proposals, and action intents.
- **Memory (`@siduri-x/memory`)**: Native PostgreSQL-backed memory organ. Manages claims, directives, and source events with immutable approved updates (`supersedes` link), confidence thresholds, and companion isolation (`companionId`). In single-owner local operation, all approved companion memories are accessible to the owner.
- **Behavior (`@siduri-x/behavior`)**: Implements `ActiveSelfCompiler`. Compiles active behavior directives into system prompt injections.
- **Hands (`@siduri-x/hands`)**: Tool execution and Model Context Protocol (MCP) organ. Enforces cryptographic `AuthorizationCapability` checks verified by `ActionPolicyEngine`.
- **Ear (`@siduri-x/ear`)**: Multi-modal sensory input ingestion organ for audio and text.
- **Vision (`@siduri-x/vision`)**: Visual observation and OCR perception adapter.
- **Voice (`@siduri-x/voice`)**: Speech synthesis queue adapter supporting Edge-TTS, Piper, and VOICEVOX with optional RVC post-processing.
- **Body (`@siduri-x/body`)**: Renderer-agnostic avatar expression state machine and embodiment event adapter.
- **Knowledge (`@siduri-x/knowledge`)**: Pack and provider loader for factual knowledge with citation contracts.
- **Observation (`@siduri-x/observation`)**: Fixture and screen observation organ with frame deduplication and OCR reading ingestion.
- **Mouth (`@siduri-x/mouth`)**: Output communication and presentation decoupling organ. Adapts cognitive utterances for the web medium with real-time SSE token streaming, Live2D viseme cues (`mouthOpenY`, `mouthForm`), SSML emotional prosody formatting, barge-in interruption handling, Voice coordination, and channel sinks (`BufferedMouthChannel`, `EventEmitterMouthChannel`).

