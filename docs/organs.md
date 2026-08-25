# Organs

## Status: Implemented
- **Brain (`@siduri-y/brain`)**: Implements a provider-neutral
  `OpenAICompatibleBrain`; OpenRouter is supported as a preset endpoint. Uses
  `fetch` and OpenAI-style tool calling to enforce the `ResponsePlan` schema.
- **Voice (`@siduri-y/voice`)**: Implements `VoicevoxAdapter`. Retains the `SpeechQueue` semantics for handling `/audio_query` and `/synthesis`.
- **Memory (`@siduri-y/memory`)**: Implements `PostgresMemoryAdapter`. Schema isolation is guaranteed by `companionId`.
- **Knowledge (`@siduri-y/knowledge`)**: Implements `ETeyvatKnowledgeAdapter`.
- **Vision (`@siduri-y/vision`)**: Implements `OpenRouterVisionAdapter`. Exposes a simple `analyze(image)` interface, completely dropping the continuous OBS screen capture.
- **Behavior (`@siduri-y/behavior`)**: Implements `ActiveSelfAdapter`.

## Status: Integrated
- **Body (`@siduri-y/body`)**: Broadcasts overlay lifecycle events and can connect
  to VTube Studio's local plugin API for expression and hotkey actions.
