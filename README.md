# Siduri-Y

**Siduri-Y** is the modular, composable TypeScript implementation of the Siduri AI companion architecture.

A Siduri instance is composed of **@siduri/core** plus whatever user-selected **@siduri/<organ>** packages are chosen—with **zero bundling**, standard Node.js ESM module resolution, and clean-machine portability.

## Composable Organs

There are **NO presets**. A user can compose any combination of organs into a runnable standalone application:

- **Brain (`@siduri/brain`)**: Provider-neutral LLM reasoning, response planning, and proposal generation.
- **Memory (`@siduri/memory`)**: PostgreSQL-backed conversational memory, episodic/semantic claims, and companion isolation.
- **Hands (`@siduri/hands`)**: Tool execution, cryptographic action policy capability verification, and MCP provider integration.
- **Knowledge (`@siduri/knowledge`)**: Installed or hosted E-compatible packs with bounded, cited context integration.
- **Behavior (`@siduri/behavior`)**: Atomic directive state machine and personality projection compiler.
- **Ear (`@siduri/ear`)**: Multi-modal sensory input ingestion, audio transcription, and MIME boundary validation.
- **Vision (`@siduri/vision`)**: Visual observation, cropping, and multi-pass OCR perception adapter.
- **Body (`@siduri/body`)**: Renderer-agnostic avatar expression state machine and embodiment event adapter.
- **Voice (`@siduri/voice`)**: Queued speech synthesis and TTS adapter (VOICEVOX).
- **Observation (`@siduri/observation`)**: Evidence extraction, SHA-256 frame deduplication, and OCR reading ingest.

## Standalone Instance CLI (`@vxnus/siduri`)

### 1. Create a Standalone Companion

Requires Node.js >=20:

```bash
npx @vxnus/siduri create my-siduri
```

The CLI dynamically discovers installed `@siduri/*` organ manifests and generates a clean, standalone ESM application containing only the selected organ dependencies:

```text
my-siduri/
├── package.json          # ESM package referencing only selected @siduri/* organs
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

Executes SQL migrations with SHA-256 checksum validation exclusively for database-owning organs (`@siduri/memory`):

```bash
npx @vxnus/siduri db push
```

If the companion has no database organs (e.g. Brain only, or Brain + Hands), `siduri db push` reports that no migrations are required.

### 4. Start Your Companion

```bash
npm install
npm start
```

## License
All rights are restricted until the project is officially released publicly to
VXNUS Creative Technology Studio. See the
[experimental CLI license](./cli/LICENSE) for more details.
