# Organs

## Status: organ integration baseline; behavioral extraction incomplete
- **Brain (`@siduri-x/brain`)**: Implements a provider-neutral
  `OpenAICompatibleBrain`; OpenRouter is supported as a preset endpoint. Uses
  `fetch` and OpenAI-style tool calling to enforce the `ResponsePlan` schema.
- **Voice (`@siduri-x/voice`)**: Implements `VoiceAdapter` (with Edge-TTS, Kokoro, Piper, VOICEVOX base TTS support and RVC middleware). Retains the `SpeechQueue` semantics for handling text-to-speech.
- **Memory (`@siduri-x/memory`)**: Implements the Postgres compatibility
  adapter. Schema isolation is guaranteed by `companionId`; neutral audience,
  subject, and complete lifecycle parity remain pending.
- **Knowledge (`@siduri-x/knowledge`)**: Implements `ETeyvatKnowledgeAdapter`.
- **Vision (`@siduri-x/vision`)**: Implements `OpenRouterVisionAdapter`. Exposes a simple `analyze(image)` interface, completely dropping the continuous OBS screen capture.
- **Behavior (`@siduri-x/behavior`)**: Implements the Active Self
  compatibility adapter; neutral context and complete scope parity remain
  pending.

## Status: Integrated at adapter level; parity gates remain
- **Body (`@siduri-x/body`)**: Broadcasts overlay lifecycle events and can connect
  to VTube Studio's local plugin API for expression and hotkey actions.
