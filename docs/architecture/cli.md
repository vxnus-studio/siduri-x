# CLI Architecture & Reference (`@vxnus/siduri`)

> **Status:** Implemented (`v2.0.0`+) — Clean Architecture with Pure SQLite (`siduri.sqlite`)  
> **Ecosystem:** Zero external database dependencies. PostgreSQL removed.

---

The Siduri CLI (`@vxnus/siduri`) provides tooling to dynamically discover `@siduri-x/*` organ manifests, scaffold standalone ESM companion instances, and run local environment & service diagnostics.

---

## 1. Standalone Companion Creation (`siduri create`)

```bash
npx @vxnus/siduri create [directory]
```

### Architecture Invariants:
1. **Dynamic Manifest Discovery**: Discovers installed or workspace `@siduri-x/*` packages by inspecting their `organ-manifest.json`.
2. **Cognition Authority**: Brain is required for cognition planning. All other organs can be freely selected or omitted.
3. **No Monolithic Bundling**: Scaffolds a clean project containing only the selected organ dependencies and standard Node.js ESM imports.
4. **Blank-Slate Neutrality**: Generates purely neutral configuration without embedding predeclared personas or private memories (per [`BLANK_SLATE_CONTRACT.md`](../contracts/blank-slate-contract.md)).
5. **Zero External Database Setup**: Storage is powered by SQLite with WAL mode and built-in FTS5 (`siduri.sqlite`). No PostgreSQL containers or migration databases needed.
6. **Sequential Organ Flow (`organ > option > config`)**:
   - **Top-to-Downstream Progression**: Directly traverses capability organs from central cognition (Brain required) to memory, sovereign knowledge, identity, and downstream embodiment/perception.
   - **Zero Upfront Checklists**: Foundational organs (Brain, Memory, Knowledge, Behavior) go straight to their engine and configuration. Peripheral organs (Voice, Body, Mouth, Hands, Vision, Ear, Observation) prompt directly for their engine choice with a clean `None (Skip)` option.
   - **No Redundant Questions**: Completely eliminates separate boolean `? Enable <Organ>?` questions. Selecting `None` skips the organ cleanly in a single pass.

### Organ Behavior & Defaults:

| Organ | Default / Choices | Behavior & Runtime Details |
| :--- | :--- | :--- |
| **Brain** | OpenRouter / OpenAI Compatible | Cognitive planner. Required. Configures API key and model selection. |
| **Memory** | SQLite (WAL + FTS5) | Sovereign episodic memory store. Configures database file path (`siduri.sqlite`). |
| **Knowledge** | Sovereign Life DB / Hub Pack | Structured inventory/finance/schedule data or verified external lore pack (`@vxnus/e-teyvat`). |
| **Behavior** | Later (Blank Slate) / Now (.self) | Defines archetype, ethos, and directives. Blank slate evolutive mode by default. |
| **Voice** | VOICEVOX / RVC / None | VOICEVOX engine auto-downloads on first `npm start` to `~/.voicevox/engine/` if port 50021 is free; RVC pairs with Base TTS (Edge-TTS 0MB cloud, Kokoro, Piper). |
| **Body** | Live2D Cubism / None | Configures `.model3.json` path; automatically defaults to resting neutral expression. |
| **Mouth** | Web Streaming / None | Generates SSML and Live2D viseme cues for SSE output streaming. |
| **Hands** | MCP Client / None | Tool execution engine. Configures timeout; MCP servers registered in `siduri.config.json`. |
| **Vision** | OpenRouter Vision / None | Multimodal vision model configuration for OCR and image inspection. |
| **Ear** | **Enabled (Default)** / None | Sensory input guard enforcing 4KB text length limits, 10MB audio validation, and anti-spoofing. |
| **Observation**| **Disabled (Default)** / Fixture | Experimental screen frame ingest prototype (work in progress). |

### Generated Output Structure:

```text
my-companion/
├── package.json          # ESM package referencing selected @siduri-x/* packages
├── siduri.config.json    # Selected organ configurations
├── siduri.schema.json    # Composed JSON Schema from organ manifests
├── .env.example          # Organ-scoped environment variables
├── README.md             # Composition-specific guide
└── src/
    └── index.js          # Direct SiduriRuntime bootstrapping with explicit organ factories
```

---

## 2. Instance Diagnostics (`siduri doctor`)

```bash
npx @vxnus/siduri doctor [directory]
```

Inspects the companion directory and runs:
- **Environment Checks**: Validates required and optional environment variables per organ.
- **Service Availability**: Validates reachability for external endpoints (e.g. VTS WebSocket, RVC API).
- **Storage Readiness**: Validates local SQLite database access and permissions.
- **Health Probes**: Executes organ-level health probes exposed by `@siduri-x/*` organs.
