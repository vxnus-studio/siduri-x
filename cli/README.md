# @vxnus/siduri

Experimental CLI for creating, diagnosing, and managing standalone Siduri companions powered by the `@siduri-x/*` organ ecosystem.

Requires Node.js 20 or newer.

```bash
npx @vxnus/siduri create my-companion
```

## Prerequisites

- **Node.js**: `v20.0.0` or newer
- **LLM API Key**: e.g. `OPENROUTER_API_KEY` for Brain organ
- **Optional Local Services**:
  - **Docker**: For running local PostgreSQL database (`docker compose up -d` / `npm run services:up`) and/or VOICEVOX engine.
  - *Non-Docker Alternatives*: Cloud databases (Supabase, Neon) or standalone [VOICEVOX Desktop App](https://voicevox.hiroshiba.jp/).

## Features

- **Manifest-Driven Organ Discovery**: Dynamically discovers installed `@siduri-x/*` organs and generates custom, standalone ESM instance code.
- **Interactive Configuration Wizard**: Model catalog discovery for OpenRouter, manifest inspection for E Knowledge Hub, and guided organ parameters.
- **Zero Monolithic Bundling**: Scaffolds standard Node.js ESM projects with explicit dependency trees.
- **Diagnostics (`siduri doctor`)**: Runs environment variable validation, external service checks, database health probes, and organ-specific assertions.
- **Database Migrations (`siduri db push`)**: Inspects database-owning organs (such as `@siduri-x/memory`) and executes SQL migrations with SHA-256 integrity checksums.

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
├── docker-compose.yml    # Scaffolds PostgreSQL / VOICEVOX when selected
└── src/
    └── index.js          # Direct runtime bootstrapping with explicit organ factories
```

### 2. Run Diagnostics

```bash
npx @vxnus/siduri doctor [directory]
```

Inspects active configuration, checks required/optional environment variables, and executes health probes.

### 3. Apply Migrations

```bash
npx @vxnus/siduri db push [directory]
```

Runs database migrations exclusively for configured database organs. If no database organs are selected (e.g. Brain + Hands), reports that no migrations are needed.

## Local Development

From the repository root:

```bash
pnpm --filter @vxnus/siduri build
pnpm --filter @vxnus/siduri test
```

## License

Licensed under the [Apache License, Version 2.0](./LICENSE).
