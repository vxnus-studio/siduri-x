# Architecture

Siduri-X is a virtual companion orchestrator that operates on the principle of
**composable organs**. The original Siduri repository is the behavioral and
memory reference, while Siduri-X provides a public, blank-slate runtime that
instantiates companions dynamically from configuration without copying the
original project's personal identity or relationship defaults.

## Status: Standalone Single-Owner Architecture

The API loads `siduri.config.json` and creates a `SiduriRuntime`. Siduri operates as a local-first, single-owner companion running on the user's host machine. The runtime orchestrates interactions between the user and the organs:
- **Brain**: Handles LLM intelligence and structured response generation.
- **Memory**: Stores long-term claims and behaviors, strictly scoped by `companionId`.
- **Behavior**: Compiles dynamic persona rules into system prompts.
- **Voice**: Enqueues and synthesizes TTS audio.
- **Knowledge**: Loads an E-compatible pack/provider and preserves citations and revision metadata for the Brain.
- **Vision**: Analyzes images.
- **Body**: Controls avatar expressions and embodiment events.
- **Hands**: Executes authorized tools via Model Context Protocol (MCP).
- **Ear**: Handles sensory audio and text input ingestion.
- **Observation**: Deduplicates screen observations and ingests OCR text streams.
- **Mouth**: Manages output presentation, SSE chunk streaming, and Live2D viseme cues.

## Execution Flow
1. API boots the configured companion into runtime.
2. User chats with the companion via `/chat` (running locally on `127.0.0.1`).
3. Runtime validates actor context and bounded history.
4. Runtime retrieves contextual `Memory` and `Knowledge` for the companion.
5. Runtime compiles active `Behavior` directives into the prompt.
6. `Brain` generates a validated `ResponsePlan` (speech + memory proposals + optional actions).
7. Memory and response approval boundaries are evaluated.
8. Output adapters (`Voice`, `Body`) emit experience events to the user.

