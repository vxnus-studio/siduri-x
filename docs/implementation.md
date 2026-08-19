# Implementation Status

* **Status**: Stabilized - Core implementation complete.
* **Brain**: Implemented using OpenRouter and structured generation.
* **Memory**: Implemented via PostgreSQL Adapter with TSVECTOR indexing and full isolation constraints.
* **Behavior**: Implemented `ActiveSelfCompiler` preserving security constraints.
* **Voice**: Implemented VOICEVOX Priority Queue logic.
* **Knowledge**: Implemented bounds-checked e-Teyvat integration.
* **Vision**: Implemented OpenRouter vision adapter.
* **Body**: Implemented Live2D stub.
* **Orchestrator API**: Implemented multi-companion isolated lifecycle in Hono/Express.

## Completed Tasks
- ✅ Infrastructure Fixes (Turborepo + TS configs)
- ✅ Core Types and Contracts
- ✅ Brain Organ
- ✅ Memory Organ (PG, Isolations, claims & directives schema)
- ✅ Behavior Organ (Compiler, prioritization)
- ✅ Voice Organ (Priority Queueing)
- ✅ Knowledge Organ
- ✅ Vision & Body Organs
- ✅ SiduriRuntime & API (Isolation Smoke Test)

## 4. What was dropped
- The continuous OBS multi-pass screen capture loop. It was deemed too game-specific for the core framework.
- Hardcoded `MASTER_PRIVATE` scopes, replaced with `OWNER`, `VIEWER`, `OPERATOR`.

## 5. File tree
\`\`\`
siduri-y/
├── apps/
│   ├── web/ (Next.js frontend)
│   └── api/ (Express runtime)
├── packages/
│   ├── core/ (Contracts)
│   └── organs/ (Implementations)
│       ├── brain/
│       ├── voice/
│       ├── memory/
│       ├── knowledge/
│       ├── vision/
│       ├── behavior/
│       └── body/
└── cli/ (Setup Wizard)
\`\`\`
