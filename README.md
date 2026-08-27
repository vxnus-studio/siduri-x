# Siduri (Siduri-X)

> [!WARNING]
> **Experimental & Active Development Notice:**
> Siduri-X is in an **active, experimental, and fast-evolving phase**. APIs, schemas, configurations, and organ protocols are subject to breaking changes. While core boundary contracts and clean-machine distribution are verified, current builds should be considered **unstable/untested in live production environments**. Use at your own discretion, inspect generated code directly, and report any architectural issues.

> [!IMPORTANT]
> **Siduri-X Architecture Migration:**
> Siduri-Y has been unified into **Siduri-X**. This repository is the canonical TypeScript monorepo implementation of the Siduri architecture, combining the core conceptual framework with the clean-machine, manifest-driven standalone instance distribution system under the **`@siduri-x/*`** package ecosystem.

Siduri is an intelligent AI companion framework designed with **persistent, authoritative memory**, atomic behavioral gating, and modular capability organs.

Unlike standard conversational agents that lose context when a session ends or a context window fills up, Siduri is built around a robust memory foundation. She learns, remembers, and adapts over time, treating her memory as a central source of truth for identity, relationships, and learned behaviors.

Our goal is simple: **Siduri should be as easy to install or run anywhere as a single command** — no matter the platform, no matter the setup.

---

## Core Features & Architecture

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
| **`@siduri-x/core`** | `^1.0.0` | Core runtime protocol, action dispatcher, capability validation, and evidence bounds |
| **`@siduri-x/brain`** | `^1.0.0` | Provider-neutral LLM reasoning, response planning, and proposal generation |
| **`@siduri-x/memory`** | `^1.0.0` | PostgreSQL-backed conversational memory, episodic/semantic claims, and SQL migrations |
| **`@siduri-x/hands`** | `^1.0.0` | Tool execution, cryptographic action policy capability verification, and MCP integration |
| **`@siduri-x/knowledge`** | `^1.0.0` | Installed or hosted E-compatible packs with bounded, cited context integration |
| **`@siduri-x/behavior`** | `^1.0.0` | Atomic directive state machine and personality projection compiler |
| **`@siduri-x/ear`** | `^1.0.0` | Multi-modal sensory input ingestion, audio transcription, and MIME bounds validation |
| **`@siduri-x/vision`** | `^1.0.0` | Visual observation, cropping, and multi-pass OCR perception adapter |
| **`@siduri-x/body`** | `^1.0.0` | Renderer-agnostic avatar expression state machine and embodiment event adapter |
| **`@siduri-x/voice`** | `^1.0.0` | Queued speech synthesis and TTS adapter (VOICEVOX) |
| **`@siduri-x/observation`** | `^1.0.0` | Evidence extraction, SHA-256 frame deduplication, and OCR reading ingest |

---

## Standalone Instance CLI (`@vxnus/siduri`)

### 1. Create a Standalone Companion

Requires Node.js >=20:

```bash
npx @vxnus/siduri create my-siduri
```

The CLI dynamically discovers installed `@siduri-x/*` organ manifests and generates a clean, standalone ESM application containing only the selected organ dependencies:

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

### 2. Run Diagnostics (`siduri doctor`)

Inspects environment variables, external service declarations, database connectivity (only if memory is selected), and executes organ health probes:

```bash
cd my-siduri
npx @vxnus/siduri doctor
```

### 3. Apply Database Migrations (`siduri db push`)

Executes SQL migrations with SHA-256 checksum validation exclusively for database-owning organs (`@siduri-x/memory`):

```bash
npx @vxnus/siduri db push
```

If the companion has no database organs (e.g. Brain only, or Brain + Hands), `siduri db push` reports that no migrations are required.

### 4. Start Your Companion

```bash
npm install
npm start
```

---

## Documentation & Conceptual Architecture

Explore the concepts behind Siduri:
- [Persistent Memory](docs/concepts/memory.md)
- [Modular Design](docs/concepts/modular-design.md)
- [The Truth Gate](docs/concepts/the-anchor.md)
- [CLI Reference](docs/architecture/cli.md)
- [Organ Contracts](docs/architecture/organs.md)

---

## License
Licensed under the [Apache License, Version 2.0](./LICENSE).
