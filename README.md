# Siduri (Siduri-X)

Siduri is an **experimental, open-source AI companion framework** exploring single-owner persistent memory, modular capability organs, and local-first architecture.

Instead of treating memory as an unverified vector dump that silently drifts over time, Siduri explores an architectural model where memories are staged as explicit proposals, verified against local truth, and retained across sessions in a sovereign local SQLite store.

> [!WARNING]
> **Project Status: Experimental Prototype (Mock-Tested)**
> Siduri is an active research and architectural exploration, not a finished consumer appliance.
> - While package boundaries, schemas, and organ contracts are verified through unit tests and mock fixtures, the system is **untested in real-world end-to-end (E2E) scenarios** (e.g. live sensory hardware, extended multi-week conversational stability, diverse GPU environments).
> - Interfaces, storage structures, and protocols are under continuous development; breaking changes will occur. We invite developers to inspect the architecture, run local testbeds, and contribute feedback.

> *“She answered, ‘Gilgamesh, where are you hurrying to? You will never find that life for which you are looking. When the gods created man they allotted to him death, but life they retained in their own keeping. As for you, Gilgamesh, fill your belly with good things; day and night, night and day, dance and be merry, feast and rejoice. Let your clothes be fresh, bathe yourself in water, cherish the little child that holds your hand, and make your wife happy in your embrace; for this too is the lot of man.’”*
>
> — *The Epic of Gilgamesh* (source: John R. Bawden's *Ancient Civilizations*)

---

> [!NOTE]
> **Getting Started & Repository Guide**
>
> - **Looking to experiment with a local testbed?** You can scaffold a standalone companion instance using the development CLI:
>   ```bash
>   npx @vxnus/siduri create my-companion
>   ```
>   The CLI guides you through an interactive setup and scaffolds a testbed companion instance with the organs and configurations you select.
> - **About this repository:** This repository (`siduri-x`) houses the monorepo for the core engine, architectural contracts, and `@siduri-x/*` packages.
> - **Feedback & Collaboration:** We warmly welcome bug reports, architectural critiques, and community contributions.

---

## Architectural Focus & Hypotheses

- **Single-Owner, Local-First Perimeter**: Siduri explores a personal, single-owner companion running on a local workstation. Rather than a multi-tenant cloud service with complex RBAC partitions, the local machine is the primary security boundary.
- **Blank Slate Model**: Rather than arriving with a scripted backstory or pre-baked persona, an instance begins with an empty relational slate, investigating how personality and communication nuances might grow organically through interaction.
- **Audited Memory Proposals (The Truth Gate)**: Staged candidate memories must be confirmed before becoming persistent local facts, aiming to prevent prompt injection and conversational hallucination from silently corrupting long-term beliefs.
- **Modular Capability Organs**: Capabilities (reasoning, voice, vision, embodiment, tool calling) are separated into pluggable `@siduri-x/*` packages with standard ESM resolution.
- **Sovereign Data Storage**: Personal data (such as inventory, finance, and schedules) lives in structured SQLite tables, separating factual life data from subjective conversational memory.

---

## Canonical Packages (`@siduri-x/*`)

All canonical Siduri-X domain substrates and peripheral organs are independently distributed:

### Core Domain Substrates (Persistent Continuity)
| Package | Version | Description | Status |
| :--- | :---: | :--- | :--- |
| **`@siduri-x/core`** | `^2.0.1` | Runtime protocol, Truth Gate, response gating engine, capability tokens, and `SiduriDatabase` | **Implemented** |
| **`@siduri-x/self`** | `^2.0.1` | Identity, personality traits, directional relationships, directives, `ActiveSelfCompiler`, and `.self` parser | **Implemented** |
| **`@siduri-x/knowledge`** | `^2.0.1` | Internal sovereign Life Database (Inventory, Finance, Schedule, Preferences) | **Implemented** |
| **`@siduri-x/memory`** | `^2.0.1` | Pure SQLite FTS5 episodic memory store and verified claim retrieval | **Implemented** |

### Pluggable Peripheral Organs
| Package | Version | Description | Status |
| :--- | :---: | :--- | :--- |
| **`@siduri-x/brain`** | `^2.0.1` | Provider-neutral LLM reasoning, response planning, and proposal generation | **Implemented** |
| **`@siduri-x/hands`** | `^2.0.1` | Tool execution, cryptographic action policy capability verification, and MCP integration | **Implemented** |
| **`@siduri-x/eknowledge`** | `^2.0.1` | External E-compatible lore / documentation client with cited context & SSRF defense | **Implemented** |
| **`@siduri-x/ear`** | `^2.0.1` | Multi-modal sensory input ingestion, audio transcription, and MIME bounds validation | **Implemented** |
| **`@siduri-x/vision`** | `^2.0.1` | Visual observation, cropping, and multi-pass OCR perception adapter | **Implemented** |
| **`@siduri-x/body`** | `^2.0.1` | Renderer-agnostic avatar expression state machine and embodiment event adapter | **Implemented** |
| **`@siduri-x/voice`** | `^2.0.1` | Queued speech synthesis (Edge-TTS, Kokoro, Piper, VOICEVOX) and RVC post-processing | **Implemented** |
| **`@siduri-x/observation`** | `^2.0.1` | Evidence extraction, SHA-256 frame deduplication, and OCR reading ingest | **Implemented** |
| **`@siduri-x/mouth`** | `^2.0.1` | Output communication, SSE token streaming, Live2D visemes, SSML, and channel sinks | **Implemented** |
| ~~`@siduri-x/behavior`~~ | `^1.0.6` | *Legacy compatibility package* (superseded by `@siduri-x/self`) | **Legacy / Deprecated** |

---

## Quick Start (`@vxnus/siduri`)

To create and run your own standalone companion, you can scaffold an instance anywhere on your machine using the CLI:

### 1. Create a Standalone Companion

```bash
npx @vxnus/siduri create my-siduri
```

The CLI dynamically discovers installed `@siduri-x/*` organ manifests and guides you through an interactive setup:

```text
my-siduri/
├── package.json          # ESM package referencing only selected @siduri-x/* organs
├── siduri.config.json    # Selected organ configurations
├── siduri.schema.json    # Composed JSON Schema from organ manifests
├── .env.example          # Only environment variables required by selected organs
├── README.md             # Composition-specific guide
└── src/
    └── index.js          # Direct runtime bootstrapping with explicit organ factories
```

### 2. Zero-Config Local Storage (`siduri.sqlite`)

Siduri uses a unified, zero-configuration SQLite database (`siduri.sqlite`) with WAL mode and built-in FTS5 full-text indexing. No external database servers or Docker containers (like PostgreSQL) are required. The database initializes automatically in `< 20ms` on local hardware (`< 100ms` under virtualized CI runners).

### 3. Run Diagnostics (`siduri doctor`)

Inspects environment variables, external service declarations, local database readiness, and executes organ health probes:

```bash
npx @vxnus/siduri doctor
```

---

## Contributing

Contributions, bug reports, and RFC discussions are warmly welcomed!

- **Found a bug or have a suggestion?** Feel free to open an [Issue](https://github.com/vxnus-studio/siduri-x/issues).
- **Want to contribute code or fixes?** Pull requests (PRs) are open and appreciated.
- **Questions or RFCs?** Discussions and architecture questions are always welcome.

---

## Documentation & Architecture

Explore the architecture and specifications behind Siduri:
- [Documentation Hub](docs/README.md)
- [The Truth Gate & Anchor Architecture](docs/architecture/truth-gate.md)
- [Persistent Memory Subsystem](docs/architecture/memory.md)
- [Siduri Organ Architecture](docs/architecture/siduri-organ-architecture.md)
- [CLI Reference & Diagnostics](docs/architecture/cli.md)
- [Canonical Release Status](docs/release-status.md)
- [Safety & Verification Contracts](docs/contracts/t7-release-evidence-contract.md)


---

## License
Licensed under the [Apache License, Version 2.0](./LICENSE).
