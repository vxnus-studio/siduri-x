# CLI Architecture & Reference (`@vxnus/siduri`)

Status: Composable standalone architecture implemented (`v0.0.6`)

The Siduri CLI (`@vxnus/siduri`) provides tooling to dynamically discover `@siduri-x/*` organ manifests, scaffold standalone ESM companion instances, run environment & service diagnostics, and manage database migrations.

---

## 1. Standalone Companion Creation (`siduri create`)

```bash
npx @vxnus/siduri create [directory]
```

### Architecture Invariants:
1. **Dynamic Manifest Discovery**: Rather than relying on hardcoded organs, the CLI discovers installed or workspace `@siduri-x/*` packages and inspects their `organ-manifest.json`.
2. **Cognition Authority**: Brain is required for cognition planning. All other organs (`memory`, `hands`, `voice`, `body`, `behavior`, `ear`, `vision`, `knowledge`, `observation`) can be freely selected or omitted.
3. **No Monolithic Bundling**: Scaffolds a clean project containing only the selected organ dependencies and standard Node.js ESM imports.
4. **Blank-Slate Neutrality**: The CLI generates purely neutral configuration without embedding predeclared personas or private memories (per [`BLANK_SLATE_CONTRACT.md`](../contracts/BLANK_SLATE_CONTRACT.md)).

### Generated Output Structure:

```text
my-companion/
├── package.json          # ESM package referencing only selected @siduri-x/* organs
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
- **Service Availability**: Validates reachability for external endpoints (e.g. VTS WebSocket, VOICEVOX).
- **Database Connectivity**: Validates PostgreSQL connectivity if database-owning organs are active.
- **Health Probes**: Executes organ-level health probes exposed by `@siduri-x/*` organs.

---

## 3. Database Migrations (`siduri db push`)

```bash
npx @vxnus/siduri db push [directory]
```

Inspects active organs for database migration requirements:
- Automatically loads SQL migrations packaged within database organs (e.g. `@siduri-x/memory/migrations`).
- Validates SHA-256 migration checksums to prevent schema drift.
- If the instance does not configure any database organs, reports `NOOP` cleanly without failing.

---

## 4. Running a Standalone Instance

From the generated instance directory:

```bash
npm install
cp .env.example .env
npm start
```
