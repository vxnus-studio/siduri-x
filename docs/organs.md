# Organs

## Status: Implemented
- **Brain (`@siduri-y/brain`)**: Implements `OpenRouterBrainAdapter`. Uses `fetch` and OpenAI-style tool calling to enforce the `ResponsePlan` JSON schema.
- **Voice (`@siduri-y/voice`)**: Implements `VoicevoxAdapter`. Retains the `SpeechQueue` semantics for handling `/audio_query` and `/synthesis`.
- **Memory (`@siduri-y/memory`)**: Implements `PostgresMemoryAdapter`. Schema isolation is guaranteed by `companionId`.
- **Knowledge (`@siduri-y/knowledge`)**: Implements `ETeyvatKnowledgeAdapter`.
- **Vision (`@siduri-y/vision`)**: Implements `OpenRouterVisionAdapter`. Exposes a simple `analyze(image)` interface, completely dropping the continuous OBS screen capture.
- **Behavior (`@siduri-y/behavior`)**: Implements `ActiveSelfAdapter`.

## Status: Stubbed
- **Body (`@siduri-y/body`)**: Implements `Live2DStubAdapter`. The interface exists (`setExpression`, `speak`, `act`), but it only logs to the console as there was no Live2D implementation to port from Siduri.
