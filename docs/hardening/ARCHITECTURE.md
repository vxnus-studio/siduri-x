# Concrete Architecture & Organ Boundaries

## Architecture Diagram

```mermaid
flowchart TD
    User([Owner / User]) -->|HTTP Request| API[apps/api or CLI Runtime]
    API -->|Auth / Identity Resolution| CtxMapper[Context Mapper]
    CtxMapper -->|Neutral RequestContext| Runtime[SiduriRuntime]

    subgraph "Perception & Retrieval"
        Runtime --> Ear[Ear: Perception & Intent]
        Runtime --> Memory[Memory: PostgreSQL FTS & Claims]
        Runtime --> Knowledge[Knowledge: E-Packs & safeFetch]
        Runtime --> ActiveSelf[Behavior: ActiveSelfCompiler]
    end

    subgraph "Cognition & Staged Gate"
        Runtime --> Brain[Brain: LLM Planning]
        Brain -->|Candidate Plan| Gate[T4 ResponseGatingEngine]
        Gate -->|Evaluate Evidence & Audiences| GateDecision{Gate Admissible?}
    end

    subgraph "Execution & Output"
        GateDecision -->|Yes| Dispatcher[ExperienceDispatcher]
        Dispatcher --> Voice[Voice: VOICEVOX Adapter]
        Dispatcher --> Body[Body: Live2D Adapter]
        
        Brain -.->|Proposed ActionIntent| ActionPolicy[ActionPolicyEngine]
        ActionPolicy -->|Sign Capability| Hands[Hands: MCP Tool Execution]
        Hands --> Store[(ActionStore & Audit Trail)]
    end
```

---

## Organ Responsibilities

1. **`@siduri-x/core` (`SiduriRuntime`)**:
   - Master orchestrator connecting perception, context resolution, active self compilation, cognitive planning, response gating, action policy evaluation, and multi-modal experience dispatch.
2. **`@siduri-x/memory` (`PostgresMemoryOrgan`)**:
   - Persistent PostgreSQL store for semantic claims, historical changes, source events, and behavioral directives. Supports PostgreSQL Full-Text Search (`to_tsvector` / `to_tsquery`), audience isolation, temporal validity, and confidence thresholding.
3. **`@siduri-x/brain` (`OpenRouterBrain` / `OpenAICompatibleBrain`)**:
   - Generates candidate dialogue and tool intents given the compiled system prompt and retrieved context.
4. **`@siduri-x/knowledge` (`EKnowledgeAdapter`)**:
   - Retrieves structured knowledge and documentation from local E-Packs or remote E-Hub endpoints with SSRF-hardened network fetching.
5. **`@siduri-x/hands` (`DefaultHandsOrgan`)**:
   - Executes system and external tools only after verifying an HMAC-signed `AuthorizationCapability` issued by the `ActionPolicyEngine`.
6. **`@siduri-x/voice` & `@siduri-x/body`**:
   - Consumes approved `ExperienceEvent` stream from `ExperienceDispatcher` to drive text-to-speech audio and visual avatar expressions.
