# Architecture

Siduri-Y is a virtual companion orchestrator that operates on the principle of **composable organs**. Rather than hardcoding a single companion (like the original Siduri did with Ganyu), the framework provides a runtime (`apps/api`) that instantiates a companion dynamically from a JSON configuration file.

## Status: Implemented

The API loads `siduri.config.json` and creates a `CompanionRuntime`. The runtime orchestrates interactions between the user and the organs:
- **Brain**: Handles LLM intelligence and structured response generation.
- **Memory**: Stores long-term claims and behaviors, strictly scoped by `companionId`.
- **Behavior**: Compiles dynamic persona rules into system prompts.
- **Voice**: Enqueues and synthesizes TTS audio.
- **Knowledge**: Loads an E-compatible pack/provider and preserves citations
  and revision metadata for the Brain.
- **Vision**: Analyzes images.
- **Body**: Controls overlay lifecycle and optional VTube Studio expressions/actions.

## Execution Flow
1. API receives `/boot` with a config.
2. `CompanionRuntime` is instantiated.
3. User sends a message via `/chat`.
4. Runtime retrieves contextual `Memory` and `Knowledge`.
5. Runtime resolves `Behavior` injections.
6. `Brain` generates a `ResponsePlan` (speech + memory proposals).
7. `Memory` saves approved/pending proposals.
8. `Voice` enqueues the speech for TTS synthesis.
