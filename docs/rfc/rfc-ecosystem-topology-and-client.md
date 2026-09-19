# RFC: Ecosystem Topology — Unscoped `siduri` Orchestrator & Scoped `@siduri-x/*` Modules

> **Status:** Proposed  
> **Target Subsystems:** `cli` (`siduri`), `apps/web` (`@siduri-x/client`), `@siduri-x/*` organ ecosystem  
> **Authors:** Kur Zagin & Siduri Architecture Team  

---

## 1. Executive Summary & Context

As the Siduri companion framework evolves beyond an experimental monolith towards an extensible, pluggable runtime, package naming and domain boundaries must reflect their architectural roles:

1. **Unscoped Package (`siduri`)**: The gatherer, entrypoint, project scaffolder, and lifecycle orchestrator.
2. **Scoped Namespace (`@siduri-x/*`)**: Truly modular, independently versionable building blocks, capability organs, and client layers.
3. **Decoupled Client (`@siduri-x/client`)**: Extraction of the presentation and interaction layer (web interface, client SDK, and static dist) away from raw file dumping in the CLI generator.

This RFC formalizes the ecosystem hierarchy, package separation, and client extraction strategy.

---

## 2. Problem Statement

### 2.1 The Overloaded CLI & Asset Ingestion Anti-Pattern
Currently, the CLI is published under `@vxnus/siduri` (or workspace `cli`) and performs two conflicting roles:
- **Code Generation & Scaffolding**: It traverses organ manifests and renders project configurations.
- **Monolithic Asset Shipping**: During `cli` build time, a custom script ([`copy-web-dist.cjs`](../../cli/scripts/copy-web-dist.cjs)) copies the production build of `apps/web` into `cli/dist/web-dist`. When running `siduri create`, static web assets are copied directly into the target project's `public/` directory.

#### Deficiencies of the Current Approach:
- **Zero In-Place Upgradability**: Existing companion instances cannot run `npm update` to receive Web UI fixes or design updates; the UI exists as dead, copied static files.
- **Bloated Package Footprint**: The CLI npm package bundle is heavily inflated with minified frontend bundles, media assets, and fonts.
- **Dual Maintenance Burden**: The CLI maintains an inline HTML fallback generator ([`web-template.ts`](../../cli/src/web-template.ts)) alongside the full Next.js application to handle scenarios where `apps/web/out` is absent.
- **Headless Inefficiency**: Deployments seeking a daemon, headless agent, Discord bot, or CLI-only companion are still forced to carry and serve static web assets.

### 2.2 Namespace Inconsistency
The ecosystem currently features a mix of `@vxnus/*`, `@siduri-x/*`, and private packages. Standardizing the ecosystem provides clear conceptual ownership:
- `siduri`: The singular brand and developer-facing hub.
- `@siduri-x/*`: The modular, interoperable components of the Siduri engine.

---

## 3. The Ecosystem Topology

```text
┌────────────────────────────────────────────────────────┐
│                        siduri                          │
│            (Unscoped - The Hub / Gatherer)             │
│  • Entrypoint CLI (`npx siduri create`)                │
│  • Project Scaffolding & Manifest Discovery            │
│  • Runtime Harness & Lifecycle Orchestration           │
│  • Instance Diagnostics (`siduri doctor`)              │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
       (dynamic / optional)     (installed dependencies)
                │                        │
┌───────────────┴────────────────────────┴───────────────┐
│                     @siduri-x/*                        │
│            (Scoped - Modular Capabilities)             │
│  • @siduri-x/core         • @siduri-x/brain-openrouter │
│  • @siduri-x/memory-sqlite• @siduri-x/voice-voicevox   │
│  • @siduri-x/body-live2d  • @siduri-x/client           │
└────────────────────────────────────────────────────────┘
```

### 3.1 `siduri` (Unscoped) — The Gatherer
- **Package Name**: `siduri`
- **Role**: Entrypoint harness, developer interface, and runtime gatherer.
- **Key Responsibilities**:
  - `npx siduri create [directory]`: Interactive setup wizard discovering organ manifests and generating companion project configurations.
  - `siduri doctor [directory]`: Diagnostic suite verifying environment variables, storage access, and organ health probes.
  - `siduri reset [directory]`: State-clearing utility restoring companions to Blank Slate compliance.
  - Runtime Host: Harness assembling instantiated organs into the canonical lifecycle order (`boot` -> `tick` -> `shutdown`).

### 3.2 `@siduri-x/*` (Scoped) — Modular Organs & Layers
All pluggable organs adhere to standard organ manifest contracts (`organ-manifest.json`):
- `@siduri-x/core`: Base contracts, runtime interfaces, event bus, and shared types.
- `@siduri-x/brain-*`: Cognitive planners and LLM inference providers.
- `@siduri-x/memory-*`: Sovereign episodic and semantic storage engines.
- `@siduri-x/self`: Dynamic behavior delivery, directive lifecycle, and active prompt compilation.
- `@siduri-x/voice-*`, `@siduri-x/body-*`, `@siduri-x/mouth-*`, `@siduri-x/hands-*`: Perception, sensory, and actuation organs.
- **`@siduri-x/client`**: Dedicated presentation, interaction, and communication package.

---

## 4. `@siduri-x/client` Specification

### 4.1 Why `client` Over `web`?
- **Protocol-Agnostic Boundary**: While the initial implementation packages the responsive Next.js web application, naming the package `client` establishes it as the general companion consumption layer.
- **Dual Export Pattern**:
  1. **Static Distribution**: Bundled, pre-compiled UI assets ready to be mounted by any HTTP server.
  2. **Programmatic SDK**: Client libraries (typed WebSocket/SSE subscriptions, chat protocols, and teach-mode proposal managers) that can be consumed by external applications, electron wraps, or alternative frontends.

### 4.2 Package Structure & Exports
```text
packages/client/ (or apps/web published as @siduri-x/client)
├── dist/
│   ├── web/              # Exported static UI bundle (Next.js out)
│   ├── index.js          # ESM entrypoint
│   └── index.d.ts        # Typed client interface
├── package.json
└── README.md
```

#### Proposed Exports:
```typescript
// 1. Path resolution for static serving in companion HTTP server
export function getClientDistPath(): string;

// 2. Ready-to-use HTTP/Connect/Express/Node static middleware
export function createClientMiddleware(options?: ClientMiddlewareOptions): MiddlewareFunction;

// 3. Programmatic API client for external or headless consumers
export class SiduriClient {
  constructor(config: { endpoint: string; token?: string });
  connect(): Promise<void>;
  sendMessage(text: string): Promise<Stream<CompanionEvent>>;
  teach(): TeachProposalClient;
}
```

### 4.3 Scaffolding & Runtime Decoupling
With `@siduri-x/client` as a peer dependency:

1. **Generation (`siduri create`)**:
   - The CLI no longer copies megabytes of raw static files into `public/`.
   - The scaffolded `package.json` declares:
     ```json
     {
       "dependencies": {
         "siduri": "^2.0.0",
         "@siduri-x/client": "^2.0.0",
         "@siduri-x/brain-openrouter": "^2.0.0"
       }
     }
     ```
2. **Serving (`src/index.js`)**:
   - The companion server imports the client package directly:
     ```javascript
     import { getClientDistPath } from '@siduri-x/client';
     import serveStatic from 'serve-static';

     // Serve UI directly from node_modules dependency
     app.use('/', serveStatic(getClientDistPath()));
     ```
3. **Seamless Upgrades**:
   - Running `npm update @siduri-x/client` updates the frontend instantly without touching instance configuration or asset directories.
4. **Headless Companions**:
   - Omitting `@siduri-x/client` creates lean, headless daemons for background autonomous workers or chat platform integrations.

---

## 5. Migration Strategy & Compatibility

1. **Phase 1 (Documentation & RFC)**: Establish community consensus on `siduri` and `@siduri-x/client`.
2. **Phase 2 (Client Package Extraction)**:
   - Configure `apps/web` (or `packages/client`) to publish as `@siduri-x/client`.
   - Export static asset paths via `getClientDistPath()` and publish clean ESM bundles.
3. **Phase 3 (CLI Refactor & Rename)**:
   - Rename `@vxnus/siduri` package to `siduri`.
   - Remove `copy-web-dist.cjs` and inline static generation from `generator.ts`.
   - Update `generator.ts` template to import `@siduri-x/client`.
4. **Phase 4 (Deprecation & Forwarding)**:
   - Publish deprecation notice on `@vxnus/siduri` pointing users to `siduri`.

---

## 6. Open Questions

1. **Should `@siduri-x/client` support server-side rendering (SSR)?**  
   *Current consensus:* No. Static SPA/SSG distribution keeps companion runtime dependencies minimal (zero Next.js server runtime required in production).
2. **Monorepo location:**  
   Should `apps/web` remain in `apps/web` with package name `@siduri-x/client`, or migrate to `packages/client`?
