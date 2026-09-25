# Siduri (Siduri-X)

Siduri is an **experimental, open-source AI companion framework** exploring single-owner local-first cognition, modular capability organs, and sovereign cognitive primitives ([RFC VX-26-13](docs/rfc/rfc-removing-memory.md)).

Instead of treating memory as an unverified vector dump that silently drifts over time, Siduri deconstructs 'memory' into explicit, decoupled primitives: identity directives (`@sidurijs/self`), deterministic user reality (`@sidurijs/knowledge`), and a cold append-only audit ledger (`@sidurijs/archive`), all stored locally in zero-config SQLite.

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
> - **Looking to experiment with a local testbed?** You can scaffold a standalone companion instance using the CLI:
>   ```bash
>   npx siduri create my-companion
>   ```
>   *(or `npx @vxnus/siduri create my-companion`)*
>   The CLI guides you through an interactive setup and scaffolds a testbed companion instance with the organs and configurations you select.
> - **About this repository:** This repository (`siduri-x`) houses the monorepo for the core engine, architectural contracts, and `@sidurijs/*` packages.
> - **Feedback & Collaboration:** We warmly welcome bug reports, architectural critiques, and community contributions.

---

## Architectural Focus & Hypotheses

- **Single-Owner, Local-First Perimeter**: Siduri explores a personal, single-owner companion running on a local workstation. Rather than a multi-tenant cloud service with complex RBAC partitions, the local machine is the primary security boundary.
- **Blank Slate Model**: Rather than arriving with a scripted backstory or pre-baked persona, an instance begins with an empty relational slate, investigating how personality and communication nuances might grow organically through interaction.
- **Audited Directives & Evidence (The Truth Gate)**: Staged behavioral directives and evidence must be confirmed before becoming persistent local facts, aiming to prevent prompt injection and conversational hallucination from silently corrupting identity and responses.
- **Modular Capability Organs**: Capabilities (reasoning, voice, vision, embodiment, tool calling) are separated into pluggable `@sidurijs/*` packages with standard ESM resolution.
- **Sovereign Data Storage**: Personal data (such as inventory, finance, and schedules) lives in structured SQLite tables (`@sidurijs/knowledge`), decoupled from cold interaction logs (`@sidurijs/archive`) and qualitative self traits (`@sidurijs/self`).

---

## Canonical Packages (`@sidurijs/*`)

All canonical Siduri-X domain substrates and peripheral organs are independently distributed:

### Core Domain Substrates (Persistent Continuity)
| Package | Version | Description | Status |
| **`@sidurijs/core`** | `^1.0.6` | Runtime protocol, Truth Gate, response gating engine, capability tokens, and `SiduriDatabase` | **Implemented** |
| **`@sidurijs/self`** | `^1.0.2` | Identity, personality traits, directional relationships, directives, `ActiveSelfCompiler`, and `.self` parser | **Implemented** |
| **`@sidurijs/knowledge`** | `^1.0.2` | Sovereign Life Database (Inventory, Finance, Schedule, Preferences) & optional E-Packs | **Implemented** |
| **`@sidurijs/archive`** | `^1.0.2` | Append-only interaction ledger, source events, and SQLite FTS5 event search | **Implemented** |

### Pluggable Peripheral Organs
| Package | Version | Description | Status |
| :--- | :---: | :--- | :--- |
| **`@sidurijs/brain`** | `^1.0.3` | Provider-neutral LLM reasoning, response planning, and proposal generation | **Implemented** |
| **`@sidurijs/hands`** | `^1.0.1` | Tool execution, cryptographic action policy capability verification, and MCP integration | **Implemented** |
| **`@sidurijs/ear`** | `^1.0.1` | Multi-modal sensory input ingestion, audio transcription, and MIME bounds validation | **Implemented** |
| **`@sidurijs/vision`** | `^1.0.1` | Visual observation, cropping, and multi-pass OCR perception adapter | **Implemented** |
| **`@sidurijs/body`** | `^1.0.1` | Renderer-agnostic avatar expression state machine and embodiment event adapter | **Implemented** |
| **`@sidurijs/voice`** | `^1.0.1` | Queued speech synthesis (Edge-TTS, Kokoro, Piper, VOICEVOX) and RVC voice conversion | **Implemented** |
| **`@sidurijs/observation`** | `^1.0.1` | Evidence extraction, SHA-256 frame deduplication, and OCR reading ingest | **Experimental Prototype** |
| **`@sidurijs/mouth`** | `^1.0.1` | Output communication, SSE token streaming, Live2D visemes, SSML, and channel sinks | **Implemented** |
| ~~`@sidurijs/behavior`~~ | `^1.0.6` | *Legacy compatibility package* (superseded by `@sidurijs/self`) | **Legacy / Deprecated** |

---

## Quick Start (`siduri`)

To create and run your own standalone companion, you can scaffold an instance anywhere on your machine using the CLI:

### 1. Create a Standalone Companion

```bash
npx siduri create my-siduri
```
*(Alternative scoped alias: `npx @vxnus/siduri create my-siduri`)*

The CLI dynamically discovers installed `@sidurijs/*` organ manifests and guides you through an interactive setup:

```text
my-siduri/
├── package.json          # ESM package referencing only selected @sidurijs/* organs
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
npx siduri doctor
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
- [RFC VX-26-13: Deconstructing Memory into Sovereign Primitives](docs/rfc/rfc-removing-memory.md)
- [Cold Audit Ledger & Historical Memory](docs/architecture/memory.md)
- [Siduri Organ Architecture](docs/architecture/siduri-organ-architecture.md)
- [CLI Reference & Diagnostics](docs/architecture/cli.md)
- [Canonical Release Status](docs/release-status.md)
- [Safety & Verification Contracts](docs/contracts/t7-release-evidence-contract.md)
- [Third-Party Organ & Asset Licensing](docs/third-party-organ-licensing.md)


---

## License
Licensed under the [Apache License, Version 2.0](./LICENSE).
