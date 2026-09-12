# @vxnus/siduri

Experimental CLI for creating, diagnosing, and managing standalone Siduri companions powered by the `@siduri-x/*` organ ecosystem.

Requires Node.js >=22.16.0.

```bash
npx @vxnus/siduri create my-companion
```

## Prerequisites

- **Node.js**: `v22.16.0` or newer
- **LLM API Key**: e.g. `OPENROUTER_API_KEY` for Brain organ
- **Optional Local Services**:
  - **VOICEVOX**: For voice synthesis (auto-downloaded at runtime by default, or connect to standalone app).
  - Storage is powered by embedded SQLite with WAL mode and built-in FTS5 (`siduri.sqlite`). No external database servers or Docker containers are required.

## Features

- **Manifest-Driven Organ Discovery**: Dynamically discovers installed `@siduri-x/*` organs and generates custom, standalone ESM instance code.
- **Interactive Configuration Wizard**: Model catalog discovery for OpenRouter, manifest inspection for E Knowledge Hub, and guided organ parameters.
- **Zero Monolithic Bundling**: Scaffolds standard Node.js ESM projects with explicit dependency trees.
- **Diagnostics (`siduri doctor`)**: Runs environment variable validation, schema conformance checks, storage writeability verification, external service endpoint probing, and organ health probes.
- **Zero-Config Database**: Powered by embedded SQLite (`siduri.sqlite`). Memory and persistent state are initialized automatically at startup without manual SQL migrations.

## CLI Usage

### 1. Create a Standalone Companion

```bash
npx @vxnus/siduri create [directory]
```

The interactive wizard allows you to name your companion, configure organ providers and models, and inspect Knowledge manifests. It generates:

```text
my-companion/
├── package.json          # ESM package referencing only selected @siduri-x/* organs
├── siduri.config.json    # Selected organ configurations
├── siduri.schema.json    # Composed JSON Schema from organ manifests
├── .env.example          # Only environment variables required by selected organs
├── README.md             # Instance-specific guide
└── src/
    └── index.js          # Direct runtime bootstrapping with explicit organ factories
```

### 2. Run Diagnostics

```bash
npx @vxnus/siduri doctor [directory]
```

Inspects active configuration, checks required/optional environment variables, and executes health probes.

### 3. Database Management

```bash
npx @vxnus/siduri db push [directory]
```

Inspects the instance storage configuration. Under the SQLite unified foundation, schema initialization and table creation are handled natively and automatically at boot.

## Local Development

From the repository root:

```bash
pnpm --filter @vxnus/siduri build
pnpm --filter @vxnus/siduri test
```

## License

Licensed under the [Apache License, Version 2.0](./LICENSE).
