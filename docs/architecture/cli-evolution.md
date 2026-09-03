# Siduri CLI Evolution: Previous, Current, and Target Architecture

This document provides a side-by-side analysis of the **`@vxnus/siduri`** CLI across its evolution stages:
1. **Previous Implementation (`v0.0.4` / `v0.0.5`)**
2. **Current Implementation (`v0.0.6` / `v0.0.7`)**
3. **Target / Desired State (The Unified Goal)**

---

## 1. High-Level Comparison Matrix

| Dimension | Previous (`v0.0.4` / `v0.0.5`) | Current (`v0.0.6` / `v0.0.7`) | Target / Desired State |
| :--- | :--- | :--- | :--- |
| **User Setup UX** | **Interactive & Guided** step-by-step questionnaire per organ (Brain model, DB deployment, Knowledge pack). | **Checkbox-only** organ selection. Stamps generic static defaults into config. | **Guided Organ Flow**: Selection + interactive step-by-step configuration for all selected organs. |
| **Instance Code Generation** | Copies a single bundled monolithic runtime (`siduri-runtime.js`). | Generates explicit Node.js ESM (`src/index.js`) importing `@siduri-x/*` factories. | **Explicit Node.js ESM (`src/index.js`)** with user's customized configuration. |
| **Dependency Model** | Bundles heavy external deps (`express`, `ws`, `cors`, `zod`) into every instance. | Only installs `@siduri-x/core` and selected `@siduri-x/*` organ packages. | **Zero-bundling modular `@siduri-x/*` ecosystem**. |
| **Organ Composability** | Fixed set of hardcoded organs; Brain & Memory strictly required. | Composable across 10+ `@siduri-x/*` organs; built-in manifest fallback. | **Composable organ ecosystem** with schema validation and zero dead code. |
| **Diagnostics & DB Tooling** | None (`start` script only). | `siduri doctor` (health probes) & `siduri db push` (SQL checksum validation). | **Integrated `doctor` and `db push` commands**. |
| **Offline / Fresh Machine `npx`** | Required pre-bundled runtime in package. | Manifest fallback built-in (`builtin-manifests.ts`). | **Zero-pre-installation `npx` wizard** with full prompt guidance. |

---

## 2. Deep Dive: Previous Implementation (`v0.0.4` / `v0.0.5`)

### Architecture & Runtime
- **Runtime Mechanism**: Copied a large pre-bundled JavaScript file (`siduri-runtime.js` ~133 KB) into the companion instance directory.
- **Dependencies**: The instance `package.json` had to install generic web frameworks (`express`, `ws`, `cors`, `zod`, `@vxnus/e`) even if the user didn't need them.
- **Organs**: Hardcoded organ schema. Organs that were not wanted were populated with `{ "provider": "none" }`.

### User Experience (The Strengths)
- **Guided Brain Setup**:
  - Prompted whether to use `OpenRouter` or `OpenAI-compatible / Custom endpoint`.
  - Prompted for Model ID (`openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet`, etc.).
  - Prompted for API Key environment variable name (`OPENROUTER_API_KEY`, custom name).
- **Guided Memory Setup**:
  - Prompted for engine (PostgreSQL).
  - Prompted for deployment provider (`Local PostgreSQL`, `Neon`, `Supabase`, `Other`).
- **Guided Knowledge Setup**:
  - Interactive search and inspection of E Knowledge Hub (`https://e.vxnus.xyz/api/v1/knowledge`) or local `.tar.gz` packs.
- **Guided Voice, Behavior, Body**:
  - Prompted for Live2D, TTS providers (Edge-TTS/VOICEVOX), RVC models, and personality presets (`Calm`, `Cheerful`, etc.).

> **Verdict**: Excellent onboarding and configuration UX, but flawed runtime/packaging architecture (monolithic bundling, rigid dependencies).

---

## 3. Deep Dive: Current Implementation (`v0.0.6` / `v0.0.7`)

### Architecture & Runtime (The Strengths)
- **Manifest-Driven Discovery**: Discovers organ metadata, environment schemas, and service requirements from `organ-manifest.json` and `builtin-manifests.ts`.
- **Pure ESM Code Generation**: Outputs explicit `src/index.js` instantiating only selected organ classes (`OpenRouterBrain`, `PostgresMemoryOrgan`, etc.).
- **Diagnostic Tooling**: Includes `siduri doctor` for environment/service validation and `siduri db push` for organ SQL migrations.
- **Standalone `npx` Ready**: Built-in fallback ensures `npx @vxnus/siduri create` works on a completely clean machine with zero pre-installed organs.

### User Experience (The Regression)
- **Checkbox-Only Selection**: After asking for companion name, the user is presented only with a checkbox list (`[ ] memory`, `[ ] hands`, `[ ] voice`, etc.).
- **Static Generic Defaults**: The CLI automatically writes hardcoded default values into `siduri.config.json` without asking the user:
  - Brain default: `anthropic/claude-3.5-sonnet` (even if user wanted GPT-4o or a local Ollama model).
  - Memory default: `local` deployment (even if user uses Supabase or Neon).
  - Knowledge default: `none`.
- **Manual Post-Setup Burden**: Forces the user to manually edit JSON configuration files in an editor rather than guiding them through setup during the wizard.

> **Verdict**: Clean, robust, modular architecture, but regressed wizard UX that assumes users will manually configure JSON files later.

---

## 4. Target / Desired State (The Goal)

The target state combines the **friendly, guided UX of 0.4/0.5** with the **clean, manifest-driven ESM architecture of Siduri-X**.

```
                           TARGET WIZARD FLOW
                           
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Companion Identity: Name & Isolation ID                             │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Organ Selection: Choose active organs (Brain required)               │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Guided Configuration Prompts (Executed for each SELECTED organ):    │
│    • Brain:     [OpenRouter | Custom Endpoint] → Model ID → API Key Var│
│    • Memory:    [Local Postgres | Supabase | Neon | Other]             │
│    • Knowledge: [E-Hub Registry | Local Pack | Remote Provider]        │
│    • Voice:     [Edge-TTS/VOICEVOX/Piper, Speaker, RVC Model]          │
│    • Behavior:  [Calm | Cheerful | Custom Directives]                  │
│    • Body:      [Live2D model path / initial expression]               │
│    • Hands:     [MCP Servers & Timeout settings]                       │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Code & Config Generation:                                           │
│    • Generate customized `siduri.config.json` (reflecting answers)     │
│    • Generate tailored `siduri.schema.json`                            │
│    • Generate tailored `.env.example` with exact required keys         │
│    • Generate explicit `src/index.js` with only chosen organ imports   │
│    • Scaffold assets (e.g. `assets/body/model/` if Body is selected)   │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Automated Dependency Installation (`npm install`)                   │
├────────────────────────────────────────────────────────────────────────┤
│ 6. Ready State: `npm run doctor`, `npx @vxnus/siduri db push`, `start` │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Principles of the Desired State:
1. **Interactive Guidance, Never Assumptions**:
   When an organ is enabled, the CLI interactively asks the user for their preferred provider, model ID, deployment target, or endpoints.
2. **Zero Monolithic Bundles**:
   Keep the clean `src/index.js` ESM bootstrapping and direct `@siduri-x/*` organ package dependencies.
3. **Organized Config Schema**:
   Maintain the modern `{ id, name, organs: { ... } }` configuration schema and instance schema generation.
4. **Immediate Operability**:
   Once the wizard finishes, the user simply runs `cp .env.example .env`, enters their API key(s), and runs `npm start` (or `npm run doctor` to verify). No manual config file surgery required.
