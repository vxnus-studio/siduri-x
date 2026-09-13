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
6. **Hierarchical Wizard Flow (`organ > option > config`)**:
   - **Organ Selection**: Upfront selection of capability organs with clean capability titles (Brain required, core recommended organs pre-selected).
   - **Organ Options**: Selects the specific provider/engine for the chosen organ (e.g. Voice: Edge-TTS, Kokoro, Piper, VOICEVOX, RVC).
   - **Configuration**: Prompts only for parameters relevant to that option. Knowledge enables sovereign Life DB by default, queries E Knowledge Hub for optional packs, and automatically downloads archives to `./assets/knowledge/<pack-slug>` without manual path input.

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
