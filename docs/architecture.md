# Architecture

Siduri-Y is a virtual companion orchestrator that operates on the principle of
**composable organs**. The original Siduri repository is the behavioral and
memory reference, while Siduri-Y provides a public, blank-slate runtime that
instantiates companions dynamically from configuration without copying the
original project's personal identity or relationship defaults.

## Status: compatibility baseline; public blank-slate parity incomplete

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
3. A caller selects a channel and audience, then sends a message via `/chat`.
4. Runtime validates the actor, channel, audience, and bounded history.
5. Runtime retrieves only permitted contextual `Memory` and `Knowledge`.
6. Runtime resolves approved `Behavior` injections for that context.
7. `Brain` generates a validated `ResponsePlan` (speech + pending proposals).
8. Memory and response approval boundaries are applied independently.
9. `Voice` enqueues speech only when the response policy permits output.

The current implementation is not yet at this target flow: `/chat` still
forces a legacy private/owner route and the runtime still contains personal
subject/audience defaults. See
[`REPOSITORY_HEALTH_AUDIT.md`](./REPOSITORY_HEALTH_AUDIT.md).
