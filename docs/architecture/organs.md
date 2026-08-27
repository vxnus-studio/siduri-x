# Organs

## Status: organ integration baseline; behavioral extraction incomplete
- **Brain (`@siduri/brain`)**: Implements a provider-neutral
  `OpenAICompatibleBrain`; OpenRouter is supported as a preset endpoint. Uses
  `fetch` and OpenAI-style tool calling to enforce the `ResponsePlan` schema.
- **Voice (`@siduri/voice`)**: Implements `VoicevoxAdapter`. Retains the `SpeechQueue` semantics for handling `/audio_query` and `/synthesis`.
- **Memory (`@siduri/memory`)**: Implements the Postgres compatibility
  adapter. Schema isolation is guaranteed by `companionId`; neutral audience,
  subject, and complete lifecycle parity remain pending.
- **Knowledge (`@siduri/knowledge`)**: Implements `ETeyvatKnowledgeAdapter`.
- **Vision (`@siduri/vision`)**: Implements `OpenRouterVisionAdapter`. Exposes a simple `analyze(image)` interface, completely dropping the continuous OBS screen capture.
- **Behavior (`@siduri/behavior`)**: Implements the Active Self
  compatibility adapter; neutral context and complete scope parity remain
  pending.

## Status: Integrated at adapter level; parity gates remain
- **Body (`@siduri/body`)**: Broadcasts overlay lifecycle events and can connect
  to VTube Studio's local plugin API for expression and hotkey actions.
