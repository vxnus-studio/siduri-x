# Organs

## Status: organ integration baseline; behavioral extraction incomplete
- **Brain (`@siduri-y/brain`)**: Implements a provider-neutral
  `OpenAICompatibleBrain`; OpenRouter is supported as a preset endpoint. Uses
  `fetch` and OpenAI-style tool calling to enforce the `ResponsePlan` schema.
- **Voice (`@siduri-y/voice`)**: Implements `VoicevoxAdapter`. Retains the `SpeechQueue` semantics for handling `/audio_query` and `/synthesis`.
- **Memory (`@siduri-y/memory`)**: Implements the Postgres compatibility
  adapter. Schema isolation is guaranteed by `companionId`; neutral audience,
  subject, and complete lifecycle parity remain pending.
- **Knowledge (`@siduri-y/knowledge`)**: Implements `ETeyvatKnowledgeAdapter`.
- **Vision (`@siduri-y/vision`)**: Implements `OpenRouterVisionAdapter`. Exposes a simple `analyze(image)` interface, completely dropping the continuous OBS screen capture.
- **Behavior (`@siduri-y/behavior`)**: Implements the Active Self
  compatibility adapter; neutral context and complete scope parity remain
  pending.

## Status: Integrated at adapter level; parity gates remain
- **Body (`@siduri-y/body`)**: Broadcasts overlay lifecycle events and can connect
  to VTube Studio's local plugin API for expression and hotkey actions.
