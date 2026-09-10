# Siduri (Siduri-X)

Siduri is an intelligent AI companion framework designed with **persistent, authoritative memory**, atomic behavioral gating, and modular capability organs.

Unlike standard conversational agents that lose context when a session ends or a context window fills up, Siduri is built around a robust memory foundation. She learns, remembers, and adapts over time, treating her memory as a central source of truth for identity, relationships, and learned behaviors.

Our goal is simple: **Siduri should be as easy to install or run anywhere as a single command** — no matter the platform, no matter the setup.

> *“She answered, ‘Gilgamesh, where are you hurrying to? You will never find that life for which you are looking. When the gods created man they allotted to him death, but life they retained in their own keeping. As for you, Gilgamesh, fill your belly with good things; day and night, night and day, dance and be merry, feast and rejoice. Let your clothes be fresh, bathe yourself in water, cherish the little child that holds your hand, and make your wife happy in your embrace; for this too is the lot of man.’”*
>
> — *The Epic of Gilgamesh* (source: John R. Bawden's *Ancient Civilizations*)

---

> [!NOTE]
> **Getting Started & Repository Guide**
>
> - **Looking to run your own companion?** You don't need to clone this repository! The quickest way to get started is with the official CLI:
>   ```bash
>   npx @vxnus/siduri create my-companion
>   ```
>   The CLI guides you through an interactive setup and scaffolds a clean, standalone companion instance with only the organs and configurations you choose.
> - **About this repository:** This repository (`siduri-x`) houses the monorepo for the core engine, architectural contracts, and `@siduri-x/*` packages.
> - **Status:** Siduri is currently in an active, experimental development phase. APIs and configurations are evolving, and we are grateful for your feedback, suggestions, and contributions!

---

## Core Features & Architecture

- **Single-Owner, Local-First Architecture**: Siduri is built as a personal, single-owner companion running on a single local machine. She is not a multi-tenant SaaS or enterprise RBAC service: your machine is her security perimeter. Everything she learns and experiences is directly accessible to her owner locally, without artificial token barriers or partitioned audience boundaries.
- **Blank Slate Instance**: Every Siduri instance starts with no pre-baked persona or backstory. She isn't scripted into being — she's *grown* into it, forming her identity entirely through accumulated memory and real interaction. Same core, completely different Siduri depending on who she grows with.
- **Persistent Memory**: Siduri remembers past interactions, preferences, and established facts across sessions. Her memory is not a temporary cache, but an authoritative database of shared history.
- **Modular Capabilities**: Extensible by design. Whether she needs to speak, see, or interact with platforms, her capabilities act as independent `@siduri-x/*` packages that plug into her core runtime with **zero bundling** and standard Node.js ESM resolution.
- **Contextual Awareness**: Siduri dynamically retrieves relevant memories to ground her responses in established facts, maintaining a consistent persona over time.
- **Privacy & Safety First**: Designed for local-first operations and explicit consent. Action policies and capability tokens prevent unauthorized actions.

---

## Canonical Packages (`@siduri-x/*`)

All canonical Siduri-X organ and core packages are independently distributed:

| Package | Version | Description |
| :--- | :---: | :--- |
| **`@siduri-x/core`** | `^1.0.6` | Core runtime protocol, action dispatcher, capability validation, and evidence bounds |
| **`@siduri-x/brain`** | `^1.0.4` | Provider-neutral LLM reasoning, response planning, and proposal generation |
| **`@siduri-x/memory`** | `^1.0.4` | PostgreSQL-backed conversational memory, episodic/semantic claims, and SQL migrations |
| **`@siduri-x/hands`** | `^1.0.3` | Tool execution, cryptographic action policy capability verification, and MCP integration |
| **`@siduri-x/knowledge`** | `^1.0.2` | Installed or hosted E-compatible packs with bounded, cited context integration |
| **`@siduri-x/behavior`** | `^1.0.5` | Atomic directive state machine and personality projection compiler |
| **`@siduri-x/ear`** | `^1.0.3` | Multi-modal sensory input ingestion, audio transcription, and MIME bounds validation |
| **`@siduri-x/vision`** | `^1.0.2` | Visual observation, cropping, and multi-pass OCR perception adapter |
| **`@siduri-x/body`** | `^1.0.4` | Renderer-agnostic avatar expression state machine and embodiment event adapter |
| **`@siduri-x/voice`** | `^1.0.6` | Queued speech synthesis (Edge-TTS, Piper, VOICEVOX) and RVC post-processing |
| **`@siduri-x/observation`** | `^1.0.3` | Evidence extraction, SHA-256 frame deduplication, and OCR reading ingest |
| **`@siduri-x/mouth`** | `^1.0.0` | Output communication, SSE token streaming, Live2D visemes, SSML, and channel sinks |

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
├── docker-compose.yml    # Optional local services (PostgreSQL / VOICEVOX if selected)
└── src/
    └── index.js          # Direct runtime bootstrapping with explicit organ factories
```

### 2. Apply Database Migrations (`siduri db push`)

Executes SQL migrations with SHA-256 checksum validation for database-owning organs (such as `@siduri-x/memory`):

```bash
npx @vxnus/siduri db push
```

If the companion has no database organs (e.g. Brain only, or Brain + Hands), `siduri db push` reports that no migrations are required.

### 3. Run Diagnostics (`siduri doctor`)

Inspects environment variables, external service declarations, database connectivity, and executes organ health probes:

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
